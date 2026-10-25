import { prisma } from "@/lib/prisma";
import {
  getSmsSettings,
  renderSmsTemplate,
  DEFAULT_EXPIRED_SMS_TEMPLATE,
  SmsSettings,
} from "@/lib/smsSettings";
import {
  sendQsmsSms,
  normalizeBdPhoneNumber,
} from "@/lib/qsmsService";

import {
  saveSiteSettingsPayload,
  loadSiteSettingsPayload,
} from "./siteSettingsStorage";

import {
  type SmsLogEntry,
} from "./smsShared";
import { logInstitutionCommunication } from "@/lib/communicationLogsService";

export type { SmsLogEntry };

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
 * Resolves candidate contact numbers from an institution according to recipientTargets settings.
 */
function getValidRecipients(inst: any, settings: SmsSettings): { phone: string; label: string }[] {
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

  const validRecipients: { phone: string; label: string }[] = [];
  const seenPhones = new Set<string>();

  for (const cand of candidates) {
    const normalized = normalizeBdPhoneNumber(cand.rawNumber);
    if (normalized && !seenPhones.has(normalized)) {
      seenPhones.add(normalized);
      validRecipients.push({ phone: normalized, label: cand.label });
    }
  }

  return validRecipients;
}

/**
 * Scans all active Institutions nearing domain expiration and dispatches automated SMS alerts.
 */
export async function checkAndSendSmsExpiryAlerts(options?: {
  force?: boolean;
  allExpired?: boolean;
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

  if (milestones.length === 0 && !settings.sendExpiredAlerts && !options?.allExpired) {
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
      const dateStr = expDate.toISOString().slice(0, 10);

      // If allExpired is specifically requested, only process expired domains (diffDays <= 0)
      if (options?.allExpired && diffDays > 0) {
        continue;
      }

      // CASE A: DOMAIN IS ALREADY EXPIRED
      // In allExpired mode: all domains where diffDays <= 0
      // In standard mode: Day 0 or Day -1
      const isExpiredMatch = options?.allExpired
        ? diffDays <= 0
        : (diffDays === 0 || diffDays === -1);

      if (isExpiredMatch) {
        if (!options?.allExpired && !settings.sendExpiredAlerts) {
          continue;
        }

        const alertKey = `sms-expired-${inst.id}-${dateStr}`;

        if (!options?.force && sentSmsAlertsMemory.has(alertKey)) {
          result.skippedAlreadySent++;
          continue;
        }

        const validRecipients = getValidRecipients(inst, settings);
        if (validRecipients.length === 0) {
          result.skippedNoPhone++;
          continue;
        }

        const recipientsToDispatch =
          settings.sendMode === "first_available"
            ? [validRecipients[0]]
            : validRecipients;

        const messageBody = renderSmsTemplate(
          settings.expiredTemplate || DEFAULT_EXPIRED_SMS_TEMPLATE,
          {
            instituteName: inst.instituteName,
            instituteNameBangla: inst.instituteNameBangla,
            domain: inst.domain,
            expireDate: expDate,
            daysRemaining: 0,
            contactPerson: inst.instituteHead || inst.inChargeTeacher || undefined,
            companyName: settings.companyName,
            companyPhone: settings.companyPhone,
          }
        );

        let anySuccessForExpired = false;

        for (const recipient of recipientsToDispatch) {
          try {
            const sendRes = await sendQsmsSms({
              to: recipient.phone,
              message: messageBody,
              senderId: settings.senderId || settings.campaignTitle,
              messageType: settings.messageType,
              credentials: {
                apiKey: settings.apiKey,
                apiSecret: settings.apiSecret,
                apiDomain: settings.apiDomain,
                senderId: settings.senderId || settings.campaignTitle,
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
              milestoneDays: 0, // 0 indicates domain expired alert
              daysRemaining: diffDays,
              messageText: messageBody,
              status: sendRes.success ? "SUCCESS" : "FAILED",
              smsUid: sendRes.smsUid || null,
              apiResponseCode: sendRes.apiResponseCode,
              apiResponseMessage: sendRes.apiResponseMessage,
              error: sendRes.error || null,
            };

            // Log communication under institution
            await logInstitutionCommunication({
              id: logItem.id,
              type: "SMS",
              institutionId: inst.id,
              institutionName: inst.instituteName,
              domain: inst.domain,
              recipient: recipient.phone,
              recipientName: inst.instituteHead || undefined,
              recipientLabel: recipient.label,
              subject: "Domain Expired SMS Alert",
              content: messageBody,
              status: sendRes.success ? "SUCCESS" : "FAILED",
              trigger: "Domain Expired Alert",
              milestoneDays: 0,
              error: sendRes.error || null,
              createdAt: logItem.timestamp,
            });

            newLogs.push(logItem);
            result.logs.push(logItem);

            if (sendRes.success) {
              result.smsSent++;
              anySuccessForExpired = true;
            } else {
              result.smsFailed++;
              result.errors.push(
                `SMS failed for ${inst.instituteName} (${recipient.phone}): ${sendRes.error}`
              );
            }
          } catch (smsErr: any) {
            result.smsFailed++;
            result.errors.push(
              `Exception sending expired SMS to ${inst.instituteName}: ${smsErr?.message || smsErr}`
            );
          }
        }

        if (anySuccessForExpired) {
          sentSmsAlertsMemory.add(alertKey);
          persistedKeys.add(alertKey);
        }

        continue;
      }

      // If older than -1 day expired, skip
      if (diffDays < 0) continue;

      // CASE B: UPCOMING EXPIRY REMINDER MILESTONES (diffDays > 0)
      for (const milestone of milestones) {
        if (diffDays <= milestone) {
          const alertKey = `sms-${inst.id}-m${milestone}-${dateStr}`;

          if (!options?.force && sentSmsAlertsMemory.has(alertKey)) {
            // Already sent for this milestone
            result.skippedAlreadySent++;
            continue;
          }

          const validRecipients = getValidRecipients(inst, settings);

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
              const sendRes = await sendQsmsSms({
                to: recipient.phone,
                message: messageBody,
                senderId: settings.senderId || settings.campaignTitle,
                messageType: settings.messageType,
                credentials: {
                  apiKey: settings.apiKey,
                  apiSecret: settings.apiSecret,
                  apiDomain: settings.apiDomain,
                  senderId: settings.senderId || settings.campaignTitle,
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

              // Log communication under institution
              await logInstitutionCommunication({
                id: logItem.id,
                type: "SMS",
                institutionId: inst.id,
                institutionName: inst.instituteName,
                domain: inst.domain,
                recipient: recipient.phone,
                recipientName: inst.instituteHead || undefined,
                recipientLabel: recipient.label,
                subject: `Domain Expiry Reminder (${milestone} Days)`,
                content: messageBody,
                status: sendRes.success ? "SUCCESS" : "FAILED",
                trigger: `Expiry Alert (${milestone} Days)`,
                milestoneDays: milestone,
                error: sendRes.error || null,
                createdAt: logItem.timestamp,
              });

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
