import {
  saveSiteSettingsPayload,
  loadSiteSettingsPayload,
} from "./siteSettingsStorage";
import {
  type RecipientTargetsConfig,
  type SmsSettings,
  DEFAULT_SMS_TEMPLATE,
  DEFAULT_SMS_SETTINGS,
  SMS_SETTINGS_KEY,
  LEGACY_SMS_SETTINGS_KEY,
  renderSmsTemplate,
} from "./smsShared";

export {
  type RecipientTargetsConfig,
  type SmsSettings,
  DEFAULT_SMS_TEMPLATE,
  DEFAULT_SMS_SETTINGS,
  SMS_SETTINGS_KEY,
  LEGACY_SMS_SETTINGS_KEY,
  renderSmsTemplate,
};

/**
 * Loads current SMS Settings from SiteSettings table.
 * Supports QSMS and legacy ADN configurations.
 */
export async function getSmsSettings(): Promise<SmsSettings> {
  try {
    let rawPayload = await loadSiteSettingsPayload(SMS_SETTINGS_KEY);
    if (!rawPayload) {
      rawPayload = await loadSiteSettingsPayload(LEGACY_SMS_SETTINGS_KEY);
    }

    if (rawPayload) {
      const parsed = JSON.parse(rawPayload);

      // Parse milestones safely
      let milestones = DEFAULT_SMS_SETTINGS.expiryDaysMilestones;
      if (Array.isArray(parsed.expiryDaysMilestones) && parsed.expiryDaysMilestones.length > 0) {
        milestones = parsed.expiryDaysMilestones
          .map((m: any) => Number(m))
          .filter((m: number) => !isNaN(m) && m > 0)
          .sort((a: number, b: number) => b - a); // descending order
      }

      const senderId = parsed.senderId || parsed.campaignTitle || DEFAULT_SMS_SETTINGS.senderId;

      return {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SMS_SETTINGS.enabled,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : (process.env.QSMS_API_KEY || process.env.ADN_SMS_API_KEY || ""),
        apiSecret: typeof parsed.apiSecret === "string" ? parsed.apiSecret : (process.env.QSMS_API_SECRET || process.env.ADN_SMS_API_SECRET || ""),
        apiDomain: typeof parsed.apiDomain === "string" && parsed.apiDomain.trim() ? parsed.apiDomain.trim() : DEFAULT_SMS_SETTINGS.apiDomain,
        senderId: senderId,
        campaignTitle: senderId,
        expiryDaysMilestones: milestones.length > 0 ? milestones : DEFAULT_SMS_SETTINGS.expiryDaysMilestones,
        recipientTargets: {
          contact1: parsed.recipientTargets?.contact1 ?? DEFAULT_SMS_SETTINGS.recipientTargets.contact1,
          contact2: parsed.recipientTargets?.contact2 ?? DEFAULT_SMS_SETTINGS.recipientTargets.contact2,
          inChargeTeacher: parsed.recipientTargets?.inChargeTeacher ?? DEFAULT_SMS_SETTINGS.recipientTargets.inChargeTeacher,
          btclMobile: parsed.recipientTargets?.btclMobile ?? DEFAULT_SMS_SETTINGS.recipientTargets.btclMobile,
        },
        sendMode: parsed.sendMode === "all_selected" ? "all_selected" : "first_available",
        template: typeof parsed.template === "string" && parsed.template.trim() ? parsed.template : DEFAULT_SMS_TEMPLATE,
        companyPhone: typeof parsed.companyPhone === "string" && parsed.companyPhone.trim() ? parsed.companyPhone : DEFAULT_SMS_SETTINGS.companyPhone,
        companyName: typeof parsed.companyName === "string" && parsed.companyName.trim() ? parsed.companyName : DEFAULT_SMS_SETTINGS.companyName,
        adminCopyPhone: typeof parsed.adminCopyPhone === "string" ? parsed.adminCopyPhone.trim() : "",
        messageType: ["AUTO", "TEXT", "UNICODE"].includes(parsed.messageType) ? parsed.messageType : "AUTO",
      };
    }
  } catch (err: any) {
    console.warn("Could not load SMS settings from SiteSettings:", err?.message);
  }

  return {
    ...DEFAULT_SMS_SETTINGS,
    apiKey: process.env.QSMS_API_KEY || process.env.ADN_SMS_API_KEY || "",
    apiSecret: process.env.QSMS_API_SECRET || process.env.ADN_SMS_API_SECRET || "",
  };
}

/**
 * Saves SMS Settings to SiteSettings table.
 */
export async function saveSmsSettings(settings: Partial<SmsSettings>): Promise<SmsSettings> {
  const current = await getSmsSettings();

  const milestones = Array.isArray(settings.expiryDaysMilestones)
    ? settings.expiryDaysMilestones
        .map((m) => Number(m))
        .filter((m) => !isNaN(m) && m > 0)
        .sort((a, b) => b - a)
    : current.expiryDaysMilestones;

  const senderId = (settings.senderId !== undefined ? settings.senderId.trim() : (settings.campaignTitle !== undefined ? settings.campaignTitle.trim() : current.senderId)) || DEFAULT_SMS_SETTINGS.senderId;

  const updated: SmsSettings = {
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : current.enabled,
    apiKey: settings.apiKey !== undefined ? settings.apiKey.trim() : current.apiKey,
    apiSecret: settings.apiSecret !== undefined ? settings.apiSecret.trim() : current.apiSecret,
    apiDomain: settings.apiDomain !== undefined && settings.apiDomain.trim() ? settings.apiDomain.trim() : current.apiDomain,
    senderId: senderId,
    campaignTitle: senderId,
    expiryDaysMilestones: milestones.length > 0 ? milestones : current.expiryDaysMilestones,
    recipientTargets: {
      contact1: settings.recipientTargets?.contact1 ?? current.recipientTargets.contact1,
      contact2: settings.recipientTargets?.contact2 ?? current.recipientTargets.contact2,
      inChargeTeacher: settings.recipientTargets?.inChargeTeacher ?? current.recipientTargets.inChargeTeacher,
      btclMobile: settings.recipientTargets?.btclMobile ?? current.recipientTargets.btclMobile,
    },
    sendMode: settings.sendMode === "all_selected" ? "all_selected" : "first_available",
    template: settings.template !== undefined && settings.template.trim() ? settings.template : current.template,
    companyPhone: settings.companyPhone !== undefined && settings.companyPhone.trim() ? settings.companyPhone.trim() : current.companyPhone,
    companyName: settings.companyName !== undefined && settings.companyName.trim() ? settings.companyName.trim() : current.companyName,
    adminCopyPhone: settings.adminCopyPhone !== undefined ? settings.adminCopyPhone.trim() : current.adminCopyPhone,
    messageType: settings.messageType && ["AUTO", "TEXT", "UNICODE"].includes(settings.messageType) ? settings.messageType : current.messageType,
  };

  const payload = JSON.stringify(updated);
  await saveSiteSettingsPayload(SMS_SETTINGS_KEY, payload, "qsms_config");

  return updated;
}
