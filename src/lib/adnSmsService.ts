/**
 * ADN SMS API Client Service
 *
 * Implements the ADN SMS Gateway specification for Bangladesh:
 * - Single SMS dispatch
 * - Real-time credit balance check
 * - SMS delivery status check
 * - Unicode (Bangla) / GSM (English) character detection
 * - Bangladeshi phone number normalization (8801XXXXXXXXX)
 * - Robust HTTPS client with CURLOPT_SSL_VERIFYPEER=FALSE and IPv4 support
 */

import https from "https";
import http from "http";
import { URL } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

const DEFAULT_ADN_DOMAIN = "https://portal.adnsms.com";

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
 * Robust HTTP client matching the official ADN SMS PHP cURL specification:
 * - CURLOPT_SSL_VERIFYPEER = FALSE (rejectUnauthorized: false)
 * - CURLOPT_TIMEOUT = 30
 * - IPv4 forced (family: 4)
 * - Proper User-Agent header
 */
async function callAdnViaNode(
  endpointUrl: string,
  formData: URLSearchParams
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(endpointUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const postData = formData.toString();

      const options: https.RequestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        rejectUnauthorized: false,
        timeout: 15000,
        headers: {
          "Accept": "application/json",
          "Format": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ImperialIT-ADN-Client/1.0",
        },
      };

      const req = client.request(options, (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 200,
            body: responseBody,
          });
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Node HTTPS connection timed out after 15s"));
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fallback client using native cURL CLI (matches official PHP cURL sample behavior)
 */
async function callAdnViaCurl(
  endpointUrl: string,
  formData: URLSearchParams
): Promise<{ statusCode: number; body: string }> {
  const postData = formData.toString();
  const args = [
    "-s",
    "-k", // CURLOPT_SSL_VERIFYPEER = FALSE
    "-4", // force IPv4
    "--max-time", "20",
    "--connect-timeout", "10",
    "-X", "POST",
    endpointUrl,
    "-H", "Accept: application/json",
    "-H", "Format: application/json",
    "-H", "Content-Type: application/x-www-form-urlencoded",
    "-d", postData,
    "-w", "\n%{http_code}",
  ];

  const { stdout } = await execFileAsync("curl", args, { timeout: 25000 });
  const lines = stdout.trim().split("\n");
  const statusCode = parseInt(lines[lines.length - 1], 10) || 200;
  const body = lines.slice(0, lines.length - 1).join("\n").trim();
  return { statusCode, body };
}

/**
 * Dual-engine HTTP caller: Attempts native Node HTTPS first, then falls back to cURL CLI.
 */
async function callAdnHttp(
  endpointUrl: string,
  formData: URLSearchParams
): Promise<{ statusCode: number; body: string }> {
  try {
    return await callAdnViaNode(endpointUrl, formData);
  } catch (nodeErr: any) {
    try {
      return await callAdnViaCurl(endpointUrl, formData);
    } catch (curlErr: any) {
      throw new Error(
        `Connection to ADN SMS timed out (30s). Both Node HTTPS and cURL failed (${nodeErr?.message || "timeout"}; ${curlErr?.message || "timeout"}). ` +
        `This indicates that packets to 103.12.205.229:443 are being dropped by ADN Telecom's firewall or your VPS firewall.`
      );
    }
  }
}

/**
 * Sends a single SMS via ADN SMS Gateway.
 */
export async function sendAdnSms(options: SendSmsOptions): Promise<AdnSendResponse> {
  const {
    to,
    message,
    requestType = "SINGLE_SMS",
    messageType = "AUTO",
    campaignTitle,
    credentials,
  } = options;

  if (!to || !to.trim()) {
    return { success: false, error: "Recipient phone number is required" };
  }

  if (!message || !message.trim()) {
    return { success: false, error: "Message body cannot be empty" };
  }

  const normalizedPhone = normalizeBdPhoneNumber(to);
  if (!normalizedPhone) {
    return {
      success: false,
      error: `Invalid Bangladeshi mobile number: "${to}". Must be a valid 11-digit mobile number (e.g. 017XXXXXXXX).`,
    };
  }

  const apiKey = credentials?.apiKey || process.env.ADN_SMS_API_KEY;
  const apiSecret = credentials?.apiSecret || process.env.ADN_SMS_API_SECRET;
  const apiDomain = (credentials?.apiDomain || process.env.ADN_SMS_DOMAIN || DEFAULT_ADN_DOMAIN).replace(/\/+$/, "");

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      error: "ADN SMS API Key and Secret are not configured. Please set them in Super Admin SMS Settings.",
    };
  }

  // Determine message type (Unicode for Bangla, Text for standard English)
  let resolvedMessageType: "TEXT" | "UNICODE" = "TEXT";
  if (messageType === "UNICODE" || (messageType === "AUTO" && isUnicodeMessage(message))) {
    resolvedMessageType = "UNICODE";
  }

  const sendEndpoint = `${apiDomain}/api/v1/secure/send-sms`;

  // ADN SMS expects form-urlencoded parameters
  const formData = new URLSearchParams();
  formData.append("api_key", apiKey.trim());
  formData.append("api_secret", apiSecret.trim());
  formData.append("request_type", requestType);
  formData.append("message_type", resolvedMessageType);
  formData.append("mobile", normalizedPhone);
  formData.append("message_body", message);

  // Only pass campaign_title if using GENERAL_CAMPAIGN or MULTIBODY_CAMPAIGN (not allowed for SINGLE_SMS/OTP)
  if (requestType !== "SINGLE_SMS" && requestType !== "OTP" && campaignTitle && campaignTitle.trim()) {
    formData.append("campaign_title", campaignTitle.trim());
  }

  try {
    const { statusCode, body: responseText } = await callAdnHttp(sendEndpoint, formData);

    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Unexpected response from ADN SMS server (${statusCode}): ${responseText.slice(0, 200)}`,
        rawResponse: responseText,
      };
    }

    // ADN SMS returns { api_response_code: 200, api_response_message: "SUCCESS", campaign_uid, sms_uid } on success
    if (json.api_response_code === 200) {
      return {
        success: true,
        requestType: json.request_type,
        campaignUid: json.campaign_uid,
        smsUid: json.sms_uid,
        invalidNumbers: json.invalid_numbers || [],
        apiResponseCode: json.api_response_code,
        apiResponseMessage: json.api_response_message,
        rawResponse: json,
      };
    }

    // Failed response
    const errorCode = json.error?.error_code || json.api_response_code;
    const errorMessage = json.error?.error_message || json.api_response_message || "Failed to send SMS";

    let ipHint = "";
    if (String(errorCode) === "9998" || String(errorMessage).toUpperCase().includes("IP_NOT_WHITELISTED")) {
      const serverIp = await getServerOutboundIp().catch(() => null);
      ipHint = ` Your server IP ${serverIp ? `(${serverIp})` : ""} must be whitelisted in your ADN SMS Portal under API Settings / IP Whitelist.`;
    }

    return {
      success: false,
      apiResponseCode: errorCode,
      apiResponseMessage: errorMessage,
      error: `ADN SMS Error [${errorCode}]: ${errorMessage}.${ipHint}`,
      rawResponse: json,
    };
  } catch (err: any) {
    console.error("sendAdnSms network error:", err);
    return {
      success: false,
      error: `Network error connecting to ADN SMS API: ${err?.message || err}`,
    };
  }
}

/**
 * Checks remaining balance of the ADN SMS account.
 */
export async function checkAdnBalance(credentials?: AdnCredentials): Promise<AdnBalanceResponse> {
  const apiKey = credentials?.apiKey || process.env.ADN_SMS_API_KEY;
  const apiSecret = credentials?.apiSecret || process.env.ADN_SMS_API_SECRET;
  const apiDomain = (credentials?.apiDomain || process.env.ADN_SMS_DOMAIN || DEFAULT_ADN_DOMAIN).replace(/\/+$/, "");

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      error: "ADN SMS API Key and Secret are required to check balance.",
    };
  }

  const balanceEndpoint = `${apiDomain}/api/v1/secure/check-balance`;

  const formData = new URLSearchParams();
  formData.append("api_key", apiKey.trim());
  formData.append("api_secret", apiSecret.trim());

  try {
    const { statusCode, body: responseText } = await callAdnHttp(balanceEndpoint, formData);

    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Unexpected server response (${statusCode}): ${responseText.slice(0, 200)}`,
        rawResponse: responseText,
      };
    }

    // ADN SMS returns { api_response_code: 200, api_response_message: "SUCCESS", balance: ... }
    if (json.api_response_code === 200 && json.balance !== undefined && json.balance !== null) {
      let balanceNum = 0;
      if (typeof json.balance === "number") {
        balanceNum = json.balance;
      } else if (typeof json.balance === "string") {
        balanceNum = parseFloat(json.balance) || 0;
      } else if (typeof json.balance === "object") {
        if (typeof json.balance.sms === "number") {
          balanceNum = json.balance.sms;
        } else if (typeof json.balance.sms === "string") {
          balanceNum = parseFloat(json.balance.sms) || 0;
        }
      }

      return {
        success: true,
        smsBalance: balanceNum,
        apiResponseCode: json.api_response_code,
        apiResponseMessage: json.api_response_message,
        rawResponse: json,
      };
    }

    const errorCode = json.error?.error_code || json.api_response_code || 500;
    const errorMessage = json.error?.error_message || json.api_response_message || "Failed to check balance";

    let ipHint = "";
    if (String(errorCode) === "9998" || String(errorMessage).toUpperCase().includes("IP_NOT_WHITELISTED")) {
      const serverIp = await getServerOutboundIp().catch(() => null);
      ipHint = ` Your server IP ${serverIp ? `(${serverIp})` : ""} must be whitelisted in your ADN SMS Portal under API Settings / IP Whitelist.`;
    }

    return {
      success: false,
      apiResponseCode: errorCode,
      apiResponseMessage: errorMessage,
      error: `ADN SMS Error [${errorCode}]: ${errorMessage}.${ipHint}`,
      rawResponse: json,
    };
  } catch (err: any) {
    console.error("checkAdnBalance network error:", err);
    return {
      success: false,
      error: `Network error connecting to ADN SMS API: ${err?.message || err}`,
    };
  }
}

/**
 * Checks the status of a specific SMS by UID.
 */
export async function checkAdnSmsStatus(
  smsUid: string,
  credentials?: AdnCredentials
): Promise<AdnSmsStatusResponse> {
  const apiKey = credentials?.apiKey || process.env.ADN_SMS_API_KEY;
  const apiSecret = credentials?.apiSecret || process.env.ADN_SMS_API_SECRET;
  const apiDomain = (credentials?.apiDomain || process.env.ADN_SMS_DOMAIN || DEFAULT_ADN_DOMAIN).replace(/\/+$/, "");

  if (!apiKey || !apiSecret) {
    return { success: false, error: "Credentials not provided" };
  }

  const endpoint = `${apiDomain}/api/v1/secure/sms-status`;
  const formData = new URLSearchParams();
  formData.append("api_key", apiKey.trim());
  formData.append("api_secret", apiSecret.trim());
  formData.append("sms_uid", smsUid);

  try {
    const { statusCode, body: responseText } = await callAdnHttp(endpoint, formData);

    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Unexpected server response (${statusCode}): ${responseText.slice(0, 200)}`,
        rawResponse: responseText,
      };
    }

    if (json.api_response_code === 200 && json.sms) {
      return {
        success: true,
        smsUid: json.sms.sms_uid,
        recipient: json.sms.recipient,
        status: json.sms.sms_status,
        quantity: json.sms.sms_quantity,
        rawResponse: json,
      };
    }

    return {
      success: false,
      error: json.error?.error_message || json.api_response_message || "Failed to check SMS status",
      rawResponse: json,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

let cachedServerIp: { ip: string; fetchedAt: number } | null = null;

/**
 * Resolves the public outbound IP address of this server.
 * ADN SMS requires this IP to be added in their portal whitelist (error 9998: IP_NOT_WHITELISTED).
 */
export async function getServerOutboundIp(): Promise<string | null> {
  if (cachedServerIp && Date.now() - cachedServerIp.fetchedAt < 120000) {
    return cachedServerIp.ip;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) {
        cachedServerIp = { ip: data.ip, fetchedAt: Date.now() };
        return data.ip;
      }
    }
  } catch {
    // ignore
  }
  return cachedServerIp?.ip || null;
}

