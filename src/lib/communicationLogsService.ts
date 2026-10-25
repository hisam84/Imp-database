import { prisma } from "@/lib/prisma";
import { CommunicationLog, CommunicationChannel, CommunicationStatus } from "@/lib/types";
import { loadSiteSettingsPayload, saveSiteSettingsPayload } from "@/lib/siteSettingsStorage";

const GLOBAL_COMM_LOGS_KEY = "recent_communication_logs";
const RECENT_SMS_LOGS_KEY = "recent_sms_logs";
const MAX_GLOBAL_LOGS = 300;
const MAX_INSTITUTION_LOGS = 100;

/**
 * Appends a communication log (EMAIL or SMS) to an institution and global audit trail.
 */
export async function logInstitutionCommunication(
  entry: Omit<CommunicationLog, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<CommunicationLog | null> {
  try {
    const fullLog: CommunicationLog = {
      id: entry.id || `comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: entry.type,
      institutionId: entry.institutionId,
      institutionName: entry.institutionName,
      domain: entry.domain || null,
      recipient: entry.recipient,
      recipientName: entry.recipientName || null,
      recipientLabel: entry.recipientLabel || null,
      subject: entry.subject,
      content: entry.content,
      status: entry.status,
      trigger: entry.trigger || undefined,
      milestoneDays: typeof entry.milestoneDays === "number" ? entry.milestoneDays : undefined,
      error: entry.error || null,
      metadata: entry.metadata || undefined,
      createdAt: entry.createdAt || new Date().toISOString(),
    };

    // 1. Persist directly onto the institution record under customFields.communicationLogs
    if (entry.institutionId) {
      try {
        const inst = await (prisma as any).institution.findUnique({
          where: { id: entry.institutionId },
          select: { id: true, customFields: true },
        });

        if (inst) {
          const currentCf =
            inst.customFields && typeof inst.customFields === "object"
              ? (inst.customFields as any)
              : {};
          const existingLogs: CommunicationLog[] = Array.isArray(currentCf.communicationLogs)
            ? currentCf.communicationLogs
            : [];

          const updatedLogs = [fullLog, ...existingLogs].slice(0, MAX_INSTITUTION_LOGS);

          await (prisma as any).institution.update({
            where: { id: entry.institutionId },
            data: {
              customFields: {
                ...currentCf,
                communicationLogs: updatedLogs,
              },
            },
          });
        }
      } catch (instErr: any) {
        console.warn(`Could not attach log to institution ${entry.institutionId}:`, instErr?.message);
      }
    }

    // 2. Persist to global communication logs archive in SiteSettings
    try {
      const raw = await loadSiteSettingsPayload(GLOBAL_COMM_LOGS_KEY);
      let globalLogs: CommunicationLog[] = [];
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (Array.isArray(data.logs)) {
            globalLogs = data.logs;
          }
        } catch {
          // ignore corrupted payload
        }
      }

      const combined = [fullLog, ...globalLogs].slice(0, MAX_GLOBAL_LOGS);
      await saveSiteSettingsPayload(
        GLOBAL_COMM_LOGS_KEY,
        JSON.stringify({ logs: combined, updatedAt: new Date().toISOString() }),
        "recent_communication_logs"
      );
    } catch (globalErr: any) {
      console.warn("Could not save to global communication logs:", globalErr?.message);
    }

    return fullLog;
  } catch (error: any) {
    console.error("logInstitutionCommunication error:", error);
    return null;
  }
}

/**
 * Retrieves all communication logs for a specific institution, merging institution-level
 * logs and historical SMS logs stored in SiteSettings.
 */
export async function getInstitutionCommunicationLogs(institutionId: string): Promise<CommunicationLog[]> {
  const mergedMap = new Map<string, CommunicationLog>();

  // 1. Load from institution.customFields.communicationLogs
  try {
    const inst = await (prisma as any).institution.findUnique({
      where: { id: institutionId },
      select: { id: true, instituteName: true, domain: true, customFields: true },
    });

    if (inst) {
      const cf = (inst.customFields as any) || {};
      if (Array.isArray(cf.communicationLogs)) {
        for (const log of cf.communicationLogs) {
          if (log && log.id) {
            mergedMap.set(log.id, log);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("Error loading institution communicationLogs:", err?.message);
  }

  // 2. Load from global recent_sms_logs for this institution
  try {
    const rawSms = await loadSiteSettingsPayload(RECENT_SMS_LOGS_KEY);
    if (rawSms) {
      const data = JSON.parse(rawSms);
      if (Array.isArray(data.logs)) {
        for (const entry of data.logs) {
          if (entry && (entry.institutionId === institutionId || (!entry.institutionId && entry.id))) {
            const mappedLog: CommunicationLog = {
              id: entry.id || `sms_${entry.timestamp}_${Math.random().toString(36).slice(2, 6)}`,
              type: "SMS",
              institutionId: entry.institutionId || institutionId,
              institutionName: entry.institutionName || "Institution",
              domain: entry.domain || null,
              recipient: entry.recipientPhone,
              recipientLabel: entry.recipientLabel || "Phone",
              subject:
                entry.milestoneDays === 0
                  ? "Domain Expired SMS Alert"
                  : `Domain Expiry Reminder (${entry.milestoneDays} Days)`,
              content: entry.messageText,
              status: entry.status === "SUCCESS" ? "SUCCESS" : "FAILED",
              trigger:
                entry.milestoneDays === 0
                  ? "Domain Expired Alert"
                  : `Expiry Alert (${entry.milestoneDays} Days)`,
              milestoneDays: entry.milestoneDays,
              error: entry.error || null,
              createdAt: entry.timestamp || new Date().toISOString(),
            };

            const dedupKey = mappedLog.id;
            if (!mergedMap.has(dedupKey)) {
              mergedMap.set(dedupKey, mappedLog);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("Error querying matching SMS logs for institution:", err?.message);
  }

  // 3. Load from global recent_communication_logs
  try {
    const rawComm = await loadSiteSettingsPayload(GLOBAL_COMM_LOGS_KEY);
    if (rawComm) {
      const data = JSON.parse(rawComm);
      if (Array.isArray(data.logs)) {
        for (const log of data.logs) {
          if (log && log.institutionId === institutionId) {
            if (!mergedMap.has(log.id)) {
              mergedMap.set(log.id, log);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("Error querying matching global communication logs:", err?.message);
  }

  const logs = Array.from(mergedMap.values());
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return logs;
}

/**
 * Retrieves global communication logs across all institutions.
 */
export async function getRecentCommunicationLogs(limit = 100): Promise<CommunicationLog[]> {
  try {
    const raw = await loadSiteSettingsPayload(GLOBAL_COMM_LOGS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.logs)) {
        return data.logs.slice(0, limit);
      }
    }
  } catch (err: any) {
    console.warn("Could not load recent communication logs:", err?.message);
  }
  return [];
}
