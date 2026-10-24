import { prisma } from "@/lib/prisma";
import {
  getSmsSettings,
  renderSmsTemplate,
  SmsSettings,
} from "@/lib/smsSettings";
import {
  sendAdnSms,
  normalizeBdPhoneNumber,
} from "@/lib/adnSmsService";

import {
  saveSiteSettingsPayload,
  loadSiteSettingsPayload,
} from "./siteSettingsStorage";

export interface SmsLogEntry {
  id: string;
  timestamp: string;
  institutionId?: string;
  institutionName: string;
  domain?: string | null;
  recipientPhone: string;
  recipientLabel: string;
  milestoneDays: number;
  daysRemaining: number;
  messageText: string;
  status: "SUCCESS" | "FAILED" | "INCOMING";
  smsUid?: string | null;
  apiResponseCode?: number;
  apiResponseMessage?: string;
  error?: string | null;
}

export interface SmsExpiryCheckResult {
  checkedWebsites: number;
  smsSent: number;
  smsFailed: number;
  skippedAlreadySent: number;
  skippedNoPhone: number;
  errors: string[];
  logs: SmsLogEntry[];
}

const SMS_ALERTS_KEY = "sent_sms_expiry_alerts";
const RECENT_SMS_LOGS_KEY = "recent_sms_logs";
const MAX_LOG_ENTRIES = 200;

// In-memory cache for fast deduplication within same process
const sentSmsAlertsMemory = new Set<string>();

/**
 * Loads persisted sent alert keys from SiteSettings.
 */
async function loadPersistedSmsAlerts(): Promise<Set<string>> {
  try {
    const raw = await loadSiteSettingsPayload(SMS_ALERTS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.keys)) {
        return new Set(data.keys);
      }
    }
  } catch (err: any) {
    console.warn("Could not load persisted SMS alerts:", err?.message);
  }
  return new Set();
}

/**
 * Persists sent alert keys to SiteSettings.
 */
async function savePersistedSmsAlerts(keys: Set<string>) {
  try {
    const payload = JSON.stringify({
      keys: Array.from(keys),
      updatedAt: new Date().toISOString(),
    });
    await saveSiteSettingsPayload(SMS_ALERTS_KEY, payload, "sms_alerts_cache");
  } catch (err: any) {
    console.error("Could not save persisted SMS alerts:", err?.message);
  }
}

/**
 * Loads recent SMS logs for Super Admin inspection.
 */
export async function getRecentSmsLogs(): Promise<SmsLogEntry[]> {
  try {
    const raw = await loadSiteSettingsPayload(RECENT_SMS_LOGS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch (err: any) {
    console.warn("Could not load recent SMS logs:", err?.message);
  }
  return [];
}

/**
 * Appends new log entries to the persisted recent logs.
 */
async function appendRecentSmsLogs(newEntries: SmsLogEntry[]) {
  if (newEntries.length === 0) return;
  try {
    const existing = await getRecentSmsLogs();
    const combined = [...newEntries, ...existing].slice(0, MAX_LOG_ENTRIES);

    const payload = JSON.stringify({
      logs: combined,
      updatedAt: new Date().toISOString(),
    });

    await saveSiteSettingsPayload(RECENT_SMS_LOGS_KEY, payload, "recent_sms_logs");
  } catch (err: any) {
    console.error("Could not append recent SMS logs:", err?.message);
  }
}

/**
 * Clears sent alert deduplication keys and logs (useful for testing and reset).
 */
export async function clearPersistedSmsExpiryAlerts(options?: { clearLogs?: boolean }) {
  sentSmsAlertsMemory.clear();
  try {
    await saveSiteSettingsPayload(
      SMS_ALERTS_KEY,
      JSON.stringify({ keys: [], updatedAt: new Date().toISOString() }),
      "sms_alerts_cache"
    );

    if (options?.clearLogs) {
      await saveSiteSettingsPayload(
        RECENT_SMS_LOGS_KEY,
        JSON.stringify({ logs: [], updatedAt: new Date().toISOString() }),
        "recent_sms_logs"
      );
    }
  } catch (err: any) {
    console.error("Could not clear persisted SMS expiry alerts:", err?.message);
  }
}

/**
 * Scans all active Institutions nearing domain expiration and dispatches automated SMS alerts.
 */
export async function checkAndSendSmsExpiryAlerts(options?: {
  force?: boolean;
}): Promise<SmsExpiryCheckResult> {
  const result: SmsExpiryCheckResult = {
    checkedWebsites: 0,
    smsSent: 0,
    smsFailed: 0,
    skippedAlreadySent: 0,
    skippedNoPhone: 0,
    errors: [],
    logs: [],
  };

  const settings: SmsSettings = await getSmsSettings();

  if (!settings.enabled) {
    console.log("Automated SMS expiry alerts skipped: Master switch is disabled in SMS Settings.");
    return result;
  }

  if (!settings.apiKey || !settings.apiSecret) {
    const msg = "ADN SMS credentials are not configured in SMS Settings.";
    console.warn(msg);
    result.errors.push(msg);
    return result;
  }

  // Load deduplication keys
  const persistedKeys = await loadPersistedSmsAlerts();
  persistedKeys.forEach((k) => sentSmsAlertsMemory.add(k));

  const now = new Date();
  const milestones = [...settings.expiryDaysMilestones].sort((a, b) => b - a); // descending

  if (milestones.length === 0) {
    result.errors.push("No expiry reminder milestones configured in SMS settings.");
    return result;
  }

  try {
    const institutions = await prisma.institution.findMany({
      where: {
        deletedAt: null,
        expireDate: { not: null },
      },
      select: {
        id: true,
        instituteName: true,
        instituteNameBangla: true,
        domain: true,
        category: true,
        expireDate: true,
        instituteHead: true,
        contact1: true,
        contact2: true,
        inChargeTeacher: true,
        inChargeTeacherContact: true,
        btclMobileNo: true,
      },
    });

    result.checkedWebsites = institutions.length;

    const newLogs: SmsLogEntry[] = [];

    for (const inst of institutions) {
      if (!inst.expireDate) continue;

      const expDate = new Date(inst.expireDate);
      if (isNaN(expDate.getTime())) continue;

      // Calculate days difference
      const diffMs = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Only evaluate if not already past expired date
      if (diffDays < 0) continue;

      const dateStr = expDate.toISOString().slice(0, 10);

      // Determine which milestone(s) this institution falls into
      // Find the milestone that corresponds to the current remaining days
      // E.g. if milestones are [30, 15, 7, 3, 1] and diffDays is 14,
      // it matches milestone 15 if m15 hasn't been sent yet.
      for (const milestone of milestones) {
        if (diffDays <= milestone) {
          const alertKey = `sms-${inst.id}-m${milestone}-${dateStr}`;

          if (!options?.force && sentSmsAlertsMemory.has(alertKey)) {
            // Already sent for this milestone
            result.skippedAlreadySent++;
            continue;
          }

          // Resolve target recipient numbers based on configuration
          interface TargetCandidate {
            label: string;
            rawNumber: string | null | undefined;
          }
          const candidates: TargetCandidate[] = [];

          if (settings.recipientTargets.contact1 && inst.contact1) {
            candidates.push({ label: "Primary Contact (contact1)", rawNumber: inst.contact1 });
          }
          if (settings.recipientTargets.contact2 && inst.contact2) {
            candidates.push({ label: "Secondary Contact (contact2)", rawNumber: inst.contact2 });
          }
          if (settings.recipientTargets.inChargeTeacher && inst.inChargeTeacherContact) {
            candidates.push({ label: "In-Charge Teacher", rawNumber: inst.inChargeTeacherContact });
          }
          if (settings.recipientTargets.btclMobile && inst.btclMobileNo) {
            candidates.push({ label: "BTCL Mobile", rawNumber: inst.btclMobileNo });
          }

          // Normalize and deduplicate candidate phones
          const validRecipients: { phone: string; label: string }[] = [];
          const seenPhones = new Set<string>();

          for (const cand of candidates) {
            const normalized = normalizeBdPhoneNumber(cand.rawNumber);
            if (normalized && !seenPhones.has(normalized)) {
              seenPhones.add(normalized);
              validRecipients.push({ phone: normalized, label: cand.label });
            }
          }

          if (validRecipients.length === 0) {
            result.skippedNoPhone++;
            continue;
          }

          // Apply sendMode ("first_available" vs "all_selected")
          const recipientsToDispatch =
            settings.sendMode === "first_available"
              ? [validRecipients[0]]
              : validRecipients;

          // Render SMS body with variables
          const messageBody = renderSmsTemplate(settings.template, {
            instituteName: inst.instituteName,
            instituteNameBangla: inst.instituteNameBangla,
            domain: inst.domain,
            expireDate: expDate,
            daysRemaining: diffDays,
            contactPerson: inst.instituteHead || inst.inChargeTeacher || undefined,
            companyName: settings.companyName,
            companyPhone: settings.companyPhone,
          });

          let anySuccessForThisMilestone = false;

          for (const recipient of recipientsToDispatch) {
            try {
              const sendRes = await sendAdnSms({
                to: recipient.phone,
                message: messageBody,
                requestType: "SINGLE_SMS",
                messageType: settings.messageType,
                campaignTitle: settings.campaignTitle,
                credentials: {
                  apiKey: settings.apiKey,
                  apiSecret: settings.apiSecret,
                  apiDomain: settings.apiDomain,
                },
              });

              const logItem: SmsLogEntry = {
                id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                timestamp: new Date().toISOString(),
                institutionId: inst.id,
                institutionName: inst.instituteName,
                domain: inst.domain,
                recipientPhone: recipient.phone,
                recipientLabel: recipient.label,
                milestoneDays: milestone,
                daysRemaining: diffDays,
                messageText: messageBody,
                status: sendRes.success ? "SUCCESS" : "FAILED",
                smsUid: sendRes.smsUid || null,
                apiResponseCode: sendRes.apiResponseCode,
                apiResponseMessage: sendRes.apiResponseMessage,
                error: sendRes.error || null,
              };

              newLogs.push(logItem);
              result.logs.push(logItem);

              if (sendRes.success) {
                result.smsSent++;
                anySuccessForThisMilestone = true;
              } else {
                result.smsFailed++;
                result.errors.push(
                  `SMS failed for ${inst.instituteName} (${recipient.phone}): ${sendRes.error}`
                );
              }
            } catch (smsErr: any) {
              result.smsFailed++;
              result.errors.push(
                `Exception sending SMS to ${inst.instituteName}: ${smsErr?.message || smsErr}`
              );
            }
          }

          // Mark this milestone as handled to prevent duplicate dispatch
          if (anySuccessForThisMilestone) {
            sentSmsAlertsMemory.add(alertKey);
            persistedKeys.add(alertKey);
          }

          // Break to avoid sending multiple milestones in a single scan run for the same institution
          break;
        }
      }
    }

    // Persist sent alerts and recent audit logs
    if (persistedKeys.size > 0) {
      await savePersistedSmsAlerts(persistedKeys);
    }
    if (newLogs.length > 0) {
      await appendRecentSmsLogs(newLogs);
    }
  } catch (err: any) {
    console.error("Error running SMS expiry alerts check:", err);
    result.errors.push(`SMS check error: ${err?.message || err}`);
  }

  return result;
}
