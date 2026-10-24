/**
 * QSMS (Qolek SMS) API Client Service
 *
 * Implements the QSMS REST Gateway specification:
 * - Direct REST API integration via https://api.qsms.com.bd/v1/sms/send
 * - Full Bangladeshi Unicode (Bangla) & English GSM message support
 * - Native Node.js HTTPS client with reliable fetch and fallback
 * - Automatic phone number normalization (8801XXXXXXXXX)
 */

import https from "https";
import http from "http";
import { URL } from "url";
import {
  type QsmsCredentials,
  type SendSmsOptions,
  type QsmsSendResponse,
  type QsmsBalanceResponse,
  normalizeBdPhoneNumber,
  isUnicodeMessage,
  calculateSmsParts,
} from "./smsShared";

export {
  type QsmsCredentials,
  type SendSmsOptions,
  type QsmsSendResponse,
  type QsmsBalanceResponse,
  normalizeBdPhoneNumber,
  isUnicodeMessage,
  calculateSmsParts,
};

const DEFAULT_QSMS_DOMAIN = "https://api.qsms.com.bd";

/**
 * Robust JSON HTTP POST client using Node.js https.
 */
async function callQsmsApi(
  endpointUrl: string,
  headers: Record<string, string>,
  bodyData: any
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(endpointUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const postData = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData);

      const options: https.RequestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        rejectUnauthorized: false,
        timeout: 20000,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          "User-Agent": "ImperialIT-QSMS-Client/1.0",
          ...headers,
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
        reject(new Error("QSMS API connection timed out after 20s"));
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
 * Sends a single SMS via the QSMS (Qolek SMS) REST API.
 */
export async function sendQsmsSms(options: SendSmsOptions): Promise<QsmsSendResponse> {
  const { to, message, senderId, messageType, credentials } = options;

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

  const apiKey = credentials?.apiKey || process.env.QSMS_API_KEY || process.env.ADN_SMS_API_KEY;
  const apiSecret = credentials?.apiSecret || process.env.QSMS_API_SECRET || process.env.ADN_SMS_API_SECRET;
  const resolvedDomain = (credentials?.apiDomain || process.env.QSMS_API_DOMAIN || DEFAULT_QSMS_DOMAIN).replace(/\/+$/, "");
  const resolvedSenderId = senderId || credentials?.senderId || options.campaignTitle || process.env.QSMS_SENDER_ID || "Imperial IT";

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      error: "QSMS API Key and Secret are not configured. Please enter them in Super Admin SMS Settings.",
    };
  }

  // Determine message type (unicode for Bangla, plain for standard English)
  let resolvedMessageType: "plain" | "unicode" = "plain";
  if (messageType === "UNICODE" || messageType === "unicode" || (messageType === "AUTO" && isUnicodeMessage(message))) {
    resolvedMessageType = "unicode";
  }

  const sendEndpoint = `${resolvedDomain}/v1/sms/send`;

  const payload = {
    api_key: apiKey.trim(),
    api_secret: apiSecret.trim(),
    recipient: normalizedPhone,
    sender_id: resolvedSenderId.trim(),
    type: resolvedMessageType,
    message: message.trim(),
  };

  const customHeaders = {
    "X-API-KEY": apiKey.trim(),
    "X-API-SECRET": apiSecret.trim(),
  };

  try {
    const { statusCode, body: responseText } = await callQsmsApi(sendEndpoint, customHeaders, payload);

    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Unexpected response from QSMS server (${statusCode}): ${responseText.slice(0, 250)}`,
        rawResponse: responseText,
      };
    }

    // Check for success responses
    // Common successful patterns: { status: "success", message_id: ... } or { success: true } or status 200 without error field
    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      !json.error &&
      (json.status === "success" || json.success === true || json.message_id || json.id || json.status === 200)
    ) {
      const msgId = json.message_id || json.id || json.sms_uid || json.campaign_uid || null;
      return {
        success: true,
        messageId: msgId,
        smsUid: msgId,
        campaignUid: msgId,
        apiResponseCode: statusCode,
        apiResponseMessage: json.message || "Message queued successfully",
        rawResponse: json,
      };
    }

    // Handle API Error Responses
    const errMsg = json.message || json.error || json.errorMessage || `QSMS returned error (HTTP ${statusCode})`;
    return {
      success: false,
      apiResponseCode: statusCode,
      apiResponseMessage: errMsg,
      error: errMsg,
      rawResponse: json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network error connecting to QSMS API: ${err?.message || err}`,
    };
  }
}

/**
 * Checks QSMS Balance / Status
 */
export async function checkQsmsBalance(credentials?: QsmsCredentials): Promise<QsmsBalanceResponse> {
  const apiKey = credentials?.apiKey || process.env.QSMS_API_KEY || process.env.ADN_SMS_API_KEY;
  const apiSecret = credentials?.apiSecret || process.env.QSMS_API_SECRET || process.env.ADN_SMS_API_SECRET;
  const apiDomain = (credentials?.apiDomain || process.env.QSMS_API_DOMAIN || DEFAULT_QSMS_DOMAIN).replace(/\/+$/, "");

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      error: "QSMS API Key and Secret are not configured.",
    };
  }

  // Attempt to ping /v1 root or send endpoint with auth headers to verify credentials
  try {
    const { statusCode, body: responseText } = await callQsmsApi(
      `${apiDomain}/v1/sms/send`,
      {
        "X-API-KEY": apiKey.trim(),
        "X-API-SECRET": apiSecret.trim(),
      },
      {
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
      }
    );

    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = { raw: responseText };
    }

    // If unauthorized, credentials are wrong
    if (json.error === "Unauthorized" || json.message?.includes("Invalid API Key")) {
      return {
        success: false,
        apiResponseCode: 401,
        apiResponseMessage: json.message || "Invalid API Key or API Secret",
        error: json.message || "Invalid API Key or API Secret",
        rawResponse: json,
      };
    }

    // If it complains about missing recipient or sender_id, authentication succeeded!
    if (json.message?.includes("recipient") || json.message?.includes("required") || statusCode === 422 || statusCode === 400) {
      return {
        success: true,
        apiResponseCode: 200,
        apiResponseMessage: "QSMS API Credentials Verified Successfully",
        rawResponse: json,
      };
    }

    return {
      success: true,
      apiResponseCode: statusCode,
      apiResponseMessage: json.message || "QSMS Gateway Connected",
      rawResponse: json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Could not connect to QSMS: ${err?.message || err}`,
    };
  }
}

/**
 * Detects the public outbound IP address of the server running this Next.js app.
 */
export async function getServerOutboundIp(): Promise<string> {
  const services = [
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
    "https://icanhazip.com",
    "https://checkip.amazonaws.com",
  ];

  for (const service of services) {
    try {
      const res = await fetch(service, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(text)) {
          return text;
        }
      }
    } catch {
      // Try next service
    }
  }

  return "Detection unavailable";
}

// Backward-compatibility aliases
export const sendAdnSms = sendQsmsSms;
export const checkAdnBalance = checkQsmsBalance;
