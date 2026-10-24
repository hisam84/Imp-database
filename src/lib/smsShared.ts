/**
 * Shared SMS types, templates, and text calculation utilities.
 * Completely isomorphic and safe for use in both Client Components and Server code.
 * (NO Node.js built-ins or Prisma/DB imports).
 */

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
  details: Array<{
    institution: string;
    domain: string;
    daysRemaining: number;
    milestone: number;
    phone: string;
    status: string;
    error?: string;
  }>;
}

export interface AdnCredentials {
  apiKey: string;
  apiSecret: string;
  apiDomain?: string;
}

export interface SendSmsOptions {
  to: string;
  message: string;
  requestType?: "SINGLE_SMS" | "OTP";
  messageType?: "AUTO" | "TEXT" | "UNICODE";
  campaignTitle?: string;
  credentials?: AdnCredentials;
}

export interface AdnSendResponse {
  success: boolean;
  requestType?: string;
  campaignUid?: string | null;
  smsUid?: string | null;
  invalidNumbers?: string[];
  apiResponseCode?: number;
  apiResponseMessage?: string;
  error?: string;
  rawResponse?: any;
}

export interface AdnBalanceResponse {
  success: boolean;
  smsBalance?: number;
  apiResponseCode?: number;
  apiResponseMessage?: string;
  error?: string;
  rawResponse?: any;
}

export interface AdnSmsStatusResponse {
  success: boolean;
  smsUid?: string;
  recipient?: string;
  status?: string;
  quantity?: number;
  error?: string;
  rawResponse?: any;
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
 * Normalizes a Bangladeshi mobile phone number into 13-digit format (8801XXXXXXXXX)
 * or 11-digit (01XXXXXXXXX). ADN SMS accepts both, but 8801XXXXXXXXX is standard.
 */
export function normalizeBdPhoneNumber(input: string | null | undefined): string | null {
  if (!input) return null;

  // Remove whitespace, dashes, parens, and leading plus
  let cleaned = input.trim().replace(/[\s\-\(\)\+]/g, "");

  // If Bengali digits are provided, convert to English digits
  const banglaDigits: { [key: string]: string } = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
  };
  cleaned = cleaned.replace(/[০-৯]/g, (char) => banglaDigits[char] || char);

  // If starts with 8801... and length is 13
  if (/^8801[3-9]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // If starts with 01... and length is 11, add 88 prefix
  if (/^01[3-9]\d{8}$/.test(cleaned)) {
    return `88${cleaned}`;
  }

  // If starts with 1... and length is 10 (without leading 0)
  if (/^1[3-9]\d{8}$/.test(cleaned)) {
    return `880${cleaned}`;
  }

  // Fallback: if strictly 11 digits starting with 01
  if (/^01\d{9}$/.test(cleaned)) {
    return `88${cleaned}`;
  }

  return null;
}

/**
 * Detects whether a message contains characters that require UNICODE encoding (e.g. Bangla script).
 */
export function isUnicodeMessage(text: string): boolean {
  return /[^\u0000-\u007F]/.test(text);
}

/**
 * Calculates characters count and SMS segments based on GSM vs Unicode rules.
 * Standard GSM: 160 chars for 1 SMS, then 153 chars/segment for multi-part.
 * Unicode (Bangla): 70 chars for 1 SMS, then 67 chars/segment for multi-part.
 */
export function calculateSmsParts(text: string): {
  charCount: number;
  isUnicode: boolean;
  smsCount: number;
  charsRemainingInCurrentPart: number;
  maxPerPart: number;
} {
  const charCount = text ? text.length : 0;
  const isUnicode = isUnicodeMessage(text);

  if (charCount === 0) {
    return {
      charCount: 0,
      isUnicode,
      smsCount: 0,
      charsRemainingInCurrentPart: isUnicode ? 70 : 160,
      maxPerPart: isUnicode ? 70 : 160,
    };
  }

  if (isUnicode) {
    if (charCount <= 70) {
      return {
        charCount,
        isUnicode: true,
        smsCount: 1,
        charsRemainingInCurrentPart: 70 - charCount,
        maxPerPart: 70,
      };
    }
    const smsCount = Math.ceil(charCount / 67);
    const charsRemainingInCurrentPart = smsCount * 67 - charCount;
    return {
      charCount,
      isUnicode: true,
      smsCount,
      charsRemainingInCurrentPart,
      maxPerPart: 67,
    };
  } else {
    if (charCount <= 160) {
      return {
        charCount,
        isUnicode: false,
        smsCount: 1,
        charsRemainingInCurrentPart: 160 - charCount,
        maxPerPart: 160,
      };
    }
    const smsCount = Math.ceil(charCount / 153);
    const charsRemainingInCurrentPart = smsCount * 153 - charCount;
    return {
      charCount,
      isUnicode: false,
      smsCount,
      charsRemainingInCurrentPart,
      maxPerPart: 153,
    };
  }
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
