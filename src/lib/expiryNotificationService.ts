import { prisma } from "@/lib/prisma";
import {
  getSubscriptionExpirySettings,
  getExpiryThresholdForCycle,
  SubscriptionExpirySettings,
} from "@/lib/subscriptionSettings";
import {
  sendWebsiteExpiryAlertEmail,
  sendCompanySubscriptionExpiryAlertEmail,
} from "@/lib/mailer";

// In-memory set for rapid deduplication
const sentWebsiteAlertsMemory = new Set<string>();
const sentSubAlertsMemory = new Set<string>();

export interface ExpiryAlertCheckResult {
  checkedWebsites: number;
  websiteAlertsSent: number;
  checkedSubscriptions: number;
  subscriptionAlertsSent: number;
  errors: string[];
}

const EXPIRY_ALERTS_KEY = "sent_expiry_alerts";

/**
 * Loads previously sent expiry alert keys from SiteSettings.
 */
async function loadPersistedExpiryAlerts(): Promise<{
  websites: Set<string>;
  subscriptions: Set<string>;
}> {
  try {
    const record = await (prisma as any).siteSettings.findUnique({
      where: { id: EXPIRY_ALERTS_KEY },
    });
    if (record?.adminEmail) {
      const data = JSON.parse(record.adminEmail);
      return {
        websites: new Set(Array.isArray(data.websites) ? data.websites : []),
        subscriptions: new Set(Array.isArray(data.subscriptions) ? data.subscriptions : []),
      };
    }
  } catch (err: any) {
    console.warn("Could not load persisted expiry alerts:", err?.message);
  }
  return { websites: new Set(), subscriptions: new Set() };
}

/**
 * Persists sent alert keys to SiteSettings permanently across restarts.
 */
async function savePersistedExpiryAlerts(
  websites: Set<string>,
  subscriptions: Set<string>
) {
  try {
    const payload = JSON.stringify({
      websites: Array.from(websites),
      subscriptions: Array.from(subscriptions),
      updatedAt: new Date().toISOString(),
    });

    await (prisma as any).siteSettings.upsert({
      where: { id: EXPIRY_ALERTS_KEY },
      create: {
        id: EXPIRY_ALERTS_KEY,
        password: "expiry_alerts_cache",
        adminEmail: payload,
      },
      update: {
        adminEmail: payload,
      },
    });
  } catch (err: any) {
    console.error("Could not save persisted expiry alerts:", err?.message);
  }
}

/**
 * Clears the persisted expiry alerts cache, allowing alerts to be re-evaluated.
 */
export async function clearPersistedExpiryAlerts() {
  sentWebsiteAlertsMemory.clear();
  sentSubAlertsMemory.clear();
  try {
    await (prisma as any).siteSettings.upsert({
      where: { id: EXPIRY_ALERTS_KEY },
      create: {
        id: EXPIRY_ALERTS_KEY,
        password: "expiry_alerts_cache",
        adminEmail: JSON.stringify({ websites: [], subscriptions: [], updatedAt: new Date().toISOString() }),
      },
      update: {
        adminEmail: JSON.stringify({ websites: [], subscriptions: [], updatedAt: new Date().toISOString() }),
      },
    });
  } catch (err: any) {
    console.error("Could not clear persisted expiry alerts:", err?.message);
  }
}

/**
 * Checks all active Websites (Institutions) and Company Subscriptions nearing expiry,
 * and automatically dispatches alert emails based on configured thresholds.
 *
 * CRITICAL RULE: For institutions/websites, expiry date calculation strictly uses
 * `expireDate` (NOT `actualExpireDate`).
 */
export async function checkAndSendExpiryAlerts(options?: {
  force?: boolean;
}): Promise<ExpiryAlertCheckResult> {
  const result: ExpiryAlertCheckResult = {
    checkedWebsites: 0,
    websiteAlertsSent: 0,
    checkedSubscriptions: 0,
    subscriptionAlertsSent: 0,
    errors: [],
  };

  const settings: SubscriptionExpirySettings = await getSubscriptionExpirySettings();

  // If automated emails are globally disabled, skip execution
  if (!settings.autoEmailEnabled) {
    console.log("Automated expiry alerts skipped: Master switch autoEmailEnabled is false.");
    return result;
  }

  // Load persisted sent memory
  const persisted = await loadPersistedExpiryAlerts();
  persisted.websites.forEach((k) => sentWebsiteAlertsMemory.add(k));
  persisted.subscriptions.forEach((k) => sentSubAlertsMemory.add(k));

  const now = new Date();
  const adminFallbackEmail = settings.adminNotificationEmail || "imperialitbd2011@gmail.com";

  // =========================================================================
  // 1. Scan Institutions / Websites
  // =========================================================================
  if (settings.websiteExpiryEmailEnabled) {
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
          actualExpireDate: true,
          btclEmail: true,
          instituteHead: true,
          contact1: true,
          contact2: true,
          customFields: true,
        },
      });

      result.checkedWebsites = institutions.length;

      for (const inst of institutions) {
        if (!inst.expireDate) continue;

        // Strictly use expireDate (ignore actualExpireDate for mailing)
        const expDate = new Date(inst.expireDate);
        if (isNaN(expDate.getTime())) continue;

        const diffMs = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const isSoftware = (inst.category || "").toLowerCase() === "software";
        const thresholdDays = isSoftware ? settings.softwareDays : settings.websiteDays;

        // Check if within warning window: 0 < diffDays <= thresholdDays
        if (diffDays > 0 && diffDays <= thresholdDays) {
          const dateStr = expDate.toISOString().slice(0, 10);
          const alertKey = `web-${inst.id}-${dateStr}`;

          if (!options?.force && sentWebsiteAlertsMemory.has(alertKey)) {
            continue; // Already sent for this cycle
          }

          // Resolve primary recipient email
          let recipientEmail = inst.btclEmail?.trim();
          if (!recipientEmail && inst.customFields && typeof inst.customFields === "object") {
            const cf = inst.customFields as Record<string, any>;
            if (typeof cf.email === "string" && cf.email.includes("@")) {
              recipientEmail = cf.email.trim();
            }
          }

          const hasClientEmail = Boolean(recipientEmail && recipientEmail.includes("@"));
          const targetEmail = hasClientEmail ? recipientEmail! : adminFallbackEmail;
          const adminCopy = hasClientEmail && settings.notifyAdminOnExpiry ? adminFallbackEmail : null;

          try {
            const sendRes = await sendWebsiteExpiryAlertEmail({
              institutionName: inst.instituteName,
              institutionNameBangla: inst.instituteNameBangla,
              domain: inst.domain,
              category: inst.category,
              expireDate: expDate,
              daysRemaining: diffDays,
              contactName: inst.instituteHead || undefined,
              contactPhone: inst.contact1 || inst.contact2 || undefined,
              recipientEmail: targetEmail,
              recipientName: inst.instituteHead || inst.instituteName,
              adminEmailCopy: adminCopy,
            });

            if (sendRes.success) {
              sentWebsiteAlertsMemory.add(alertKey);
              persisted.websites.add(alertKey);
              result.websiteAlertsSent++;
            } else if (sendRes.error) {
              result.errors.push(`Website alert failed for ${inst.instituteName}: ${sendRes.error}`);
            }
          } catch (err: any) {
            result.errors.push(`Error sending website alert for ${inst.instituteName}: ${err?.message || err}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Error querying institutions for expiry alerts:", err);
      result.errors.push(`Institution scan error: ${err?.message || err}`);
    }
  }

  // =========================================================================
  // 2. Scan Company Software Subscriptions
  // =========================================================================
  if (settings.companyExpiryEmailEnabled) {
    try {
      const subscriptions = await prisma.companySubscription.findMany({
        where: {
          deletedAt: null,
          expireDate: { not: null },
          status: {
            notIn: ["Cancelled", "Deactivated"],
          },
        },
        include: {
          company: true,
          software: true,
        },
      });

      result.checkedSubscriptions = subscriptions.length;

      for (const sub of subscriptions) {
        if (!sub.expireDate) continue;

        const expDate = new Date(sub.expireDate);
        if (isNaN(expDate.getTime())) continue;

        const diffMs = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const thresholdDays = getExpiryThresholdForCycle(sub.billingCycle, settings);

        // Check if within warning window: 0 < diffDays <= thresholdDays
        if (diffDays > 0 && diffDays <= thresholdDays) {
          const dateStr = expDate.toISOString().slice(0, 10);
          const alertKey = `sub-${sub.id}-${dateStr}`;

          if (!options?.force && sentSubAlertsMemory.has(alertKey)) {
            continue; // Already sent for this cycle
          }

          const companyEmail = sub.company.email?.trim();
          const hasCompanyEmail = Boolean(companyEmail && companyEmail.includes("@"));
          const targetEmail = hasCompanyEmail ? companyEmail! : adminFallbackEmail;
          const adminCopy = hasCompanyEmail && settings.notifyAdminOnExpiry ? adminFallbackEmail : null;

          try {
            const sendRes = await sendCompanySubscriptionExpiryAlertEmail({
              companyName: sub.company.companyName,
              companyNameBangla: sub.company.companyNameBangla,
              softwareName: sub.software.name,
              billingCycle: sub.billingCycle,
              expireDate: expDate,
              daysRemaining: diffDays,
              contactPerson: sub.company.contactPerson || undefined,
              contactPhone: sub.company.phone || undefined,
              recipientEmail: targetEmail,
              recipientName: sub.company.contactPerson || sub.company.companyName,
              adminEmailCopy: adminCopy,
            });

            if (sendRes.success) {
              sentSubAlertsMemory.add(alertKey);
              persisted.subscriptions.add(alertKey);
              result.subscriptionAlertsSent++;
            } else if (sendRes.error) {
              result.errors.push(`Subscription alert failed for ${sub.company.companyName}: ${sendRes.error}`);
            }
          } catch (err: any) {
            result.errors.push(`Error sending subscription alert for ${sub.company.companyName}: ${err?.message || err}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Error querying subscriptions for expiry alerts:", err);
      result.errors.push(`Subscription scan error: ${err?.message || err}`);
    }
  }

  // Save updated cache
  await savePersistedExpiryAlerts(persisted.websites, persisted.subscriptions);

  return result;
}
