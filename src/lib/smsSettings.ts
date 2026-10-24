import { prisma } from "@/lib/prisma";

export interface RecipientTargetsConfig {
  contact1: boolean;
  contact2: boolean;
  inChargeTeacher: boolean;
  btclMobile: boolean;
}

export interface SmsSettings {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  apiDomain: string;
  campaignTitle: string;
  expiryDaysMilestones: number[];
  recipientTargets: RecipientTargetsConfig;
  sendMode: "first_available" | "all_selected";
  template: string;
  companyPhone: string;
  companyName: string;
  adminCopyPhone?: string;
  messageType: "AUTO" | "TEXT" | "UNICODE";
}

export const DEFAULT_SMS_TEMPLATE =
  "শ্রদ্ধেয় গ্রাহক, আপনার {instituteName} এর ডোমেইন ({domain}) আগামী {expireDate} তারিখে এক্সপায়ার হতে যাচ্ছে (বাকি {daysRemaining} দিন)। সেবা সচল রাখতে দ্রুত নবায়ন করুন। {companyName} হেল্পলাইন: {companyPhone}";

export const DEFAULT_SMS_SETTINGS: SmsSettings = {
  enabled: true,
  apiKey: "",
  apiSecret: "",
  apiDomain: "https://portal.adnsms.com",
  campaignTitle: "Imperial_IT",
  expiryDaysMilestones: [30, 15, 7, 3, 1],
  recipientTargets: {
    contact1: true,
    contact2: false,
    inChargeTeacher: true,
    btclMobile: false,
  },
  sendMode: "first_available",
  template: DEFAULT_SMS_TEMPLATE,
  companyPhone: "01711223344",
  companyName: "Imperial IT",
  adminCopyPhone: "",
  messageType: "AUTO",
};

export const SMS_SETTINGS_KEY = "adn_sms_settings";

/**
 * Loads current SMS Settings from SiteSettings table.
 */
export async function getSmsSettings(): Promise<SmsSettings> {
  try {
    const record = await (prisma as any).siteSettings.findUnique({
      where: { id: SMS_SETTINGS_KEY },
    });

    if (record?.adminEmail) {
      const parsed = JSON.parse(record.adminEmail);

      // Parse milestones safely
      let milestones = DEFAULT_SMS_SETTINGS.expiryDaysMilestones;
      if (Array.isArray(parsed.expiryDaysMilestones) && parsed.expiryDaysMilestones.length > 0) {
        milestones = parsed.expiryDaysMilestones
          .map((m: any) => Number(m))
          .filter((m: number) => !isNaN(m) && m > 0)
          .sort((a: number, b: number) => b - a); // descending order
      }

      return {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SMS_SETTINGS.enabled,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : (process.env.ADN_SMS_API_KEY || ""),
        apiSecret: typeof parsed.apiSecret === "string" ? parsed.apiSecret : (process.env.ADN_SMS_API_SECRET || ""),
        apiDomain: typeof parsed.apiDomain === "string" && parsed.apiDomain.trim() ? parsed.apiDomain.trim() : DEFAULT_SMS_SETTINGS.apiDomain,
        campaignTitle: typeof parsed.campaignTitle === "string" && parsed.campaignTitle.trim() ? parsed.campaignTitle.trim() : DEFAULT_SMS_SETTINGS.campaignTitle,
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
    apiKey: process.env.ADN_SMS_API_KEY || "",
    apiSecret: process.env.ADN_SMS_API_SECRET || "",
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

  const updated: SmsSettings = {
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : current.enabled,
    apiKey: settings.apiKey !== undefined ? settings.apiKey.trim() : current.apiKey,
    apiSecret: settings.apiSecret !== undefined ? settings.apiSecret.trim() : current.apiSecret,
    apiDomain: settings.apiDomain !== undefined && settings.apiDomain.trim() ? settings.apiDomain.trim() : current.apiDomain,
    campaignTitle: settings.campaignTitle !== undefined && settings.campaignTitle.trim() ? settings.campaignTitle.trim() : current.campaignTitle,
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
  await (prisma as any).siteSettings.upsert({
    where: { id: SMS_SETTINGS_KEY },
    create: {
      id: SMS_SETTINGS_KEY,
      password: "adn_sms_config",
      adminEmail: payload,
    },
    update: {
      adminEmail: payload,
    },
  });

  return updated;
}

/**
 * Replaces template placeholders with institution & domain information.
 */
export function renderSmsTemplate(
  template: string,
  variables: {
    instituteName?: string | null;
    instituteNameBangla?: string | null;
    domain?: string | null;
    expireDate?: string | Date | null;
    daysRemaining?: number | string | null;
    contactPerson?: string | null;
    companyName?: string | null;
    companyPhone?: string | null;
  }
): string {
  let rendered = template || DEFAULT_SMS_TEMPLATE;

  // Format expire date nicely (e.g. 15-Nov-2026 or 15/11/2026)
  let formattedDate = "";
  if (variables.expireDate) {
    const d = new Date(variables.expireDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      formattedDate = `${day}-${month}-${year}`;
    }
  }

  const map: { [key: string]: string } = {
    "{instituteName}": variables.instituteName || variables.instituteNameBangla || "প্রতিষ্ঠান",
    "{instituteNameBangla}": variables.instituteNameBangla || variables.instituteName || "প্রতিষ্ঠান",
    "{domain}": variables.domain || "ডোমেইন",
    "{expireDate}": formattedDate || "শীঘ্রই",
    "{daysRemaining}": variables.daysRemaining !== undefined && variables.daysRemaining !== null ? String(variables.daysRemaining) : "০",
    "{contactPerson}": variables.contactPerson || "সম্মানিত গ্রাহক",
    "{companyName}": variables.companyName || "Imperial IT",
    "{companyPhone}": variables.companyPhone || "",
  };

  for (const [key, val] of Object.entries(map)) {
    rendered = rendered.split(key).join(val);
  }

  return rendered.trim();
}
