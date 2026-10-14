import { prisma } from "@/lib/prisma";

export interface SubscriptionExpirySettings {
  // Company Subscription Thresholds
  monthlyDays: number;     // e.g. 7 days for monthly
  halfYearlyDays: number;  // e.g. 15 days for half-yearly
  yearlyDays: number;      // e.g. 30 days for yearly
  defaultDays: number;     // e.g. 30 days fallback for custom/other

  // Website & Institution Expiry Thresholds
  websiteDays: number;     // e.g. 30 days before expireDate
  softwareDays: number;    // e.g. 30 days for Institution category='Software'

  // Automated Email Notification Settings
  autoEmailEnabled: boolean;              // Master switch for automated expiry emails
  websiteExpiryEmailEnabled: boolean;     // Automated emails for websites nearing expiry
  companyExpiryEmailEnabled: boolean;     // Automated emails for company subscriptions nearing expiry
  notifyAdminOnExpiry: boolean;           // Send copy/alert to Administrator
  adminNotificationEmail?: string;        // Custom admin recipient email
}

export const DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS: SubscriptionExpirySettings = {
  monthlyDays: 7,
  halfYearlyDays: 15,
  yearlyDays: 30,
  defaultDays: 30,

  websiteDays: 30,
  softwareDays: 30,

  autoEmailEnabled: true,
  websiteExpiryEmailEnabled: true,
  companyExpiryEmailEnabled: true,
  notifyAdminOnExpiry: true,
  adminNotificationEmail: "imperialitbd2011@gmail.com",
};

export const SETTINGS_KEY = "subscription_expiry_settings";

/**
 * Loads subscription and website expiry thresholds & email settings from persistent SiteSettings.
 */
export async function getSubscriptionExpirySettings(): Promise<SubscriptionExpirySettings> {
  try {
    const record = await (prisma as any).siteSettings.findUnique({
      where: { id: SETTINGS_KEY },
    });

    if (record?.adminEmail) {
      const parsed = JSON.parse(record.adminEmail);
      return {
        monthlyDays: typeof parsed.monthlyDays === "number" && parsed.monthlyDays >= 0 ? parsed.monthlyDays : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.monthlyDays,
        halfYearlyDays: typeof parsed.halfYearlyDays === "number" && parsed.halfYearlyDays >= 0 ? parsed.halfYearlyDays : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.halfYearlyDays,
        yearlyDays: typeof parsed.yearlyDays === "number" && parsed.yearlyDays >= 0 ? parsed.yearlyDays : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.yearlyDays,
        defaultDays: typeof parsed.defaultDays === "number" && parsed.defaultDays >= 0 ? parsed.defaultDays : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.defaultDays,

        websiteDays: typeof parsed.websiteDays === "number" && parsed.websiteDays >= 0 ? parsed.websiteDays : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteDays,
        softwareDays: typeof parsed.softwareDays === "number" && parsed.softwareDays >= 0 ? parsed.softwareDays : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.softwareDays,

        autoEmailEnabled: typeof parsed.autoEmailEnabled === "boolean" ? parsed.autoEmailEnabled : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.autoEmailEnabled,
        websiteExpiryEmailEnabled: typeof parsed.websiteExpiryEmailEnabled === "boolean" ? parsed.websiteExpiryEmailEnabled : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteExpiryEmailEnabled,
        companyExpiryEmailEnabled: typeof parsed.companyExpiryEmailEnabled === "boolean" ? parsed.companyExpiryEmailEnabled : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.companyExpiryEmailEnabled,
        notifyAdminOnExpiry: typeof parsed.notifyAdminOnExpiry === "boolean" ? parsed.notifyAdminOnExpiry : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.notifyAdminOnExpiry,
        adminNotificationEmail: typeof parsed.adminNotificationEmail === "string" ? parsed.adminNotificationEmail : DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.adminNotificationEmail,
      };
    }
  } catch (err: any) {
    console.warn("Could not load subscription expiry settings:", err?.message);
  }

  return { ...DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS };
}

/**
 * Saves subscription and website expiry thresholds & email settings to SiteSettings.
 */
export async function saveSubscriptionExpirySettings(
  settings: Partial<SubscriptionExpirySettings>
): Promise<SubscriptionExpirySettings> {
  const current = await getSubscriptionExpirySettings();
  const updated: SubscriptionExpirySettings = {
    monthlyDays: typeof settings.monthlyDays === "number" && settings.monthlyDays >= 0 ? Math.round(settings.monthlyDays) : current.monthlyDays,
    halfYearlyDays: typeof settings.halfYearlyDays === "number" && settings.halfYearlyDays >= 0 ? Math.round(settings.halfYearlyDays) : current.halfYearlyDays,
    yearlyDays: typeof settings.yearlyDays === "number" && settings.yearlyDays >= 0 ? Math.round(settings.yearlyDays) : current.yearlyDays,
    defaultDays: typeof settings.defaultDays === "number" && settings.defaultDays >= 0 ? Math.round(settings.defaultDays) : current.defaultDays,

    websiteDays: typeof settings.websiteDays === "number" && settings.websiteDays >= 0 ? Math.round(settings.websiteDays) : current.websiteDays,
    softwareDays: typeof settings.softwareDays === "number" && settings.softwareDays >= 0 ? Math.round(settings.softwareDays) : current.softwareDays,

    autoEmailEnabled: typeof settings.autoEmailEnabled === "boolean" ? settings.autoEmailEnabled : current.autoEmailEnabled,
    websiteExpiryEmailEnabled: typeof settings.websiteExpiryEmailEnabled === "boolean" ? settings.websiteExpiryEmailEnabled : current.websiteExpiryEmailEnabled,
    companyExpiryEmailEnabled: typeof settings.companyExpiryEmailEnabled === "boolean" ? settings.companyExpiryEmailEnabled : current.companyExpiryEmailEnabled,
    notifyAdminOnExpiry: typeof settings.notifyAdminOnExpiry === "boolean" ? settings.notifyAdminOnExpiry : current.notifyAdminOnExpiry,
    adminNotificationEmail: typeof settings.adminNotificationEmail === "string" ? settings.adminNotificationEmail : current.adminNotificationEmail,
  };

  try {
    const payload = JSON.stringify(updated);
    await (prisma as any).siteSettings.upsert({
      where: { id: SETTINGS_KEY },
      create: {
        id: SETTINGS_KEY,
        password: "expiry_config",
        adminEmail: payload,
      },
      update: {
        adminEmail: payload,
      },
    });
  } catch (err: any) {
    console.error("Could not save subscription expiry settings:", err?.message);
    throw err;
  }

  return updated;
}

/**
 * Returns threshold in days based on billingCycle.
 */
export function getExpiryThresholdForCycle(
  billingCycle: string | undefined | null,
  settings: SubscriptionExpirySettings
): number {
  if (!billingCycle) return settings.defaultDays;
  const cycle = billingCycle.trim().toLowerCase();

  if (cycle === "monthly" || cycle === "month") {
    return settings.monthlyDays;
  }
  if (cycle === "half-yearly" || cycle === "halfyearly" || cycle === "half yearly" || cycle === "biannual") {
    return settings.halfYearlyDays;
  }
  if (cycle === "yearly" || cycle === "annual") {
    return settings.yearlyDays;
  }
  return settings.defaultDays;
}

/**
 * Computes effective status for a company subscription:
 * "Active" | "Expiring Soon" | "Expired" | "Deactivated" | "Cancelled"
 */
export function computeEffectiveSubscriptionStatus(
  sub: {
    status?: string | null;
    billingCycle?: string | null;
    expireDate?: string | Date | null;
  },
  settings: SubscriptionExpirySettings,
  now = new Date()
): string {
  const currentStatus = sub.status || "Active";
  if (currentStatus === "Deactivated" || currentStatus === "Cancelled") {
    return currentStatus;
  }

  if (!sub.expireDate) {
    return currentStatus;
  }

  const exp = new Date(sub.expireDate);
  if (isNaN(exp.getTime())) {
    return currentStatus;
  }

  // Calculate day difference
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Expired";
  }

  const threshold = getExpiryThresholdForCycle(sub.billingCycle, settings);
  if (diffDays <= threshold) {
    return "Expiring Soon";
  }

  return "Active";
}
