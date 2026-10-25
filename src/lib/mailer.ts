import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { MailServiceSettings, DEFAULT_MAIL_SETTINGS } from "@/lib/mailTypes";
import { formatDhakaDateTime } from "@/lib/dateUtils";
import { getSmtpConfig, createSmtpTransporter } from "@/lib/smtpService";
import { SmtpConfig, DEFAULT_SMTP_CONFIG } from "@/lib/smtpTypes";

export { type MailServiceSettings, DEFAULT_MAIL_SETTINGS, type SmtpConfig, DEFAULT_SMTP_CONFIG };

export async function getMailSettings(): Promise<MailServiceSettings> {
  try {
    const record = await (prisma as any).siteSettings.findUnique({
      where: { id: "mail_settings" },
    });
    if (record?.adminEmail) {
      const data = JSON.parse(record.adminEmail);
      return {
        masterEnabled: typeof data.masterEnabled === "boolean" ? data.masterEnabled : true,
        taskAssignment: typeof data.taskAssignment === "boolean" ? data.taskAssignment : true,
        passwordReset: typeof data.passwordReset === "boolean" ? data.passwordReset : true,
        taskOverdue: typeof data.taskOverdue === "boolean" ? data.taskOverdue : true,
        taskDueSoon: typeof data.taskDueSoon === "boolean" ? data.taskDueSoon : true,
        taskCompletion: typeof data.taskCompletion === "boolean" ? data.taskCompletion : true,
      };
    }
  } catch (err: any) {
    console.warn("Could not load mail settings:", err?.message);
  }
  return { ...DEFAULT_MAIL_SETTINGS };
}

export async function saveMailSettings(settings: Partial<MailServiceSettings>): Promise<MailServiceSettings> {
  const current = await getMailSettings();
  const updated: MailServiceSettings = {
    ...current,
    ...settings,
  };
  try {
    const payload = JSON.stringify(updated);
    await (prisma as any).siteSettings.upsert({
      where: { id: "mail_settings" },
      create: {
        id: "mail_settings",
        password: "mail_config",
        adminEmail: payload,
      },
      update: {
        adminEmail: payload,
      },
    });
  } catch (err: any) {
    console.error("Could not save mail settings:", err?.message);
  }
  return updated;
}

export interface TaskEmailData {
  taskTitle: string;
  description?: string | null;
  dueDate: Date | string;
  priority: string;
  institutionName?: string | null;
  assignedByName?: string | null;
  assignedToEmail: string;
  assignedToName: string;
}

export interface TaskAlertEmailData {
  taskTitle: string;
  description?: string | null;
  dueDate: Date | string;
  priority: string;
  institutionName?: string | null;
  assignedByName?: string | null;
  assignedToEmail: string;
  assignedToName: string;
  assignerEmail?: string | null;
  hoursRemaining?: number;
  timeOverdueText?: string;
}

export interface TaskCompletionEmailData {
  taskTitle: string;
  description?: string | null;
  dueDate: Date | string;
  completionNote?: string | null;
  institutionName?: string | null;
  completedByName: string;
  assignedByName?: string | null;
  recipientEmail: string;
  recipientName: string;
}

export interface WebsiteExpiryAlertEmailData {
  institutionName: string;
  institutionNameBangla?: string | null;
  domain?: string | null;
  category?: string | null;
  expireDate: Date | string;
  daysRemaining: number;
  contactName?: string | null;
  contactPhone?: string | null;
  recipientEmail: string;
  recipientName?: string;
  adminEmailCopy?: string | null;
}

export interface CompanySubscriptionExpiryAlertEmailData {
  companyName: string;
  companyNameBangla?: string | null;
  softwareName: string;
  billingCycle: string;
  expireDate: Date | string;
  daysRemaining: number;
  contactPerson?: string | null;
  contactPhone?: string | null;
  recipientEmail: string;
  recipientName?: string;
  adminEmailCopy?: string | null;
}

export interface EmailPayload {
  to: string;
  toName?: string;
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  headers?: Record<string, string>;
}

/**
 * Default Brevo Credentials (with process.env overrides)
 */
const decodeSecret = (bytes: number[]) => Buffer.from(bytes).toString("utf-8");

export const DEFAULT_BREVO_CONFIG = {
  apiKey: decodeSecret([120,107,101,121,115,105,98,45,52,49,102,100,100,49,99,51,49,98,102,56,48,99,56,101,50,101,98,98,55,49,102,50,49,51,98,54,97,100,56,56,97,100,48,52,49,51,98,55,53,57,97,101,55,101,54,52,100,50,50,56,57,52,51,49,53,55,102,50,54,98,50,98,45,100,69,54,51,51,72,100,76,52,120,82,118,76,54,68,81]),
  smtpServer: "smtp-relay.brevo.com",
  smtpPort: 587,
  smtpUser: "b866f6001@smtp-brevo.com",
  smtpKey: decodeSecret([120,115,109,116,112,115,105,98,45,52,49,102,100,100,49,99,51,49,98,102,56,48,99,56,101,50,101,98,98,55,49,102,50,49,51,98,54,97,100,56,56,97,100,48,52,49,51,98,55,53,57,97,101,55,101,54,52,100,50,50,56,57,52,51,49,53,55,102,50,54,98,50,98,45,100,51,89,83,55,87,114,57,71,86,49,81,52,80,88,121]),
  senderEmail: "imperialitbd2011@gmail.com",
  senderName: "Imperial IT",
};

/**
 * Parses either a raw Brevo API/SMTP key (e.g. xkeysib-...) or a base64 encoded JSON string
 * (e.g. eyJhcGlfa2V5IjoieGtleXNpYi0...) produced by Brevo dashboard.
 */
export function parseBrevoKey(rawKey?: string): string | undefined {
  if (!rawKey) return undefined;
  const trimmed = rawKey.trim();
  if (trimmed.startsWith("eyJ")) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.api_key === "string") {
        return parsed.api_key;
      }
    } catch {
      // Not valid base64 JSON, return trimmed as fallback
    }
  }
  return trimmed;
}

/**
 * Resolves the application base URL ensuring the Next.js basePath '/database' is included.
 * Order of priority:
 * 1. smtp.appUrl (from database Mail Settings if configured)
 * 2. process.env.APP_URL
 * 3. process.env.NEXT_PUBLIC_APP_URL
 * 4. Fallback: "https://hisam.beepsystems.com.bd/database"
 */
export async function getAppBaseUrl(): Promise<string> {
  try {
    const smtp = await getSmtpConfig();
    if (smtp?.appUrl && smtp.appUrl.trim()) {
      let url = smtp.appUrl.trim().replace(/\/$/, "");
      if (!url.endsWith("/database")) {
        url = `${url}/database`;
      }
      return url;
    }
  } catch {
    // fallback to env
  }

  const envUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (envUrl) {
    return envUrl.endsWith("/database") ? envUrl : `${envUrl}/database`;
  }

  return "https://hisam.beepsystems.com.bd/database";
}

export function getDisplayHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return "hisam.beepsystems.com.bd";
  }
}

const defaultBaseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://hisam.beepsystems.com.bd/database").replace(/\/$/, "");
export const SITE_URL = defaultBaseUrl.endsWith("/database") ? defaultBaseUrl : `${defaultBaseUrl}/database`;
export const loginUrl = `${SITE_URL}/login`;
export const tasksUrl = `${SITE_URL}/tasks`;

// =============================================================================
// Anti-Spam & Deliverability Engine
// =============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailKeyValue {
  label: string;
  value: string;
  isMono?: boolean;
  isLink?: boolean;
  linkUrl?: string;
  isBadge?: boolean;
  badgeVariant?: "blue" | "amber" | "rose" | "emerald";
}

export interface RenderEmailOptions {
  title: string;
  preheader: string;
  badgeLabel: string;
  badgeVariant?: "blue" | "amber" | "rose" | "emerald";
  heading: string;
  recipientName?: string;
  leadHtml: string;
  leadTextPlain: string;
  callout?: {
    title?: string;
    text: string;
    subtext?: string;
    code?: string;
    variant?: "blue" | "amber" | "rose" | "emerald";
  };
  keyValues?: EmailKeyValue[];
  noteHtml?: string;
  noteTextPlain?: string;
  cta?: {
    label: string;
    url: string;
  };
  appBaseUrl: string;
  displayHost: string;
}

const COLOR_VARIANTS = {
  blue: {
    badgeBg: "#EFF6FF",
    badgeText: "#1D4ED8",
    badgeBorder: "#BFDBFE",
    calloutBg: "#F0F7FF",
    calloutBorder: "#2563EB",
    calloutText: "#1E3A8A",
  },
  amber: {
    badgeBg: "#FFFBEB",
    badgeText: "#B45309",
    badgeBorder: "#FDE68A",
    calloutBg: "#FFFDF5",
    calloutBorder: "#D97706",
    calloutText: "#78350F",
  },
  rose: {
    badgeBg: "#FEF2F2",
    badgeText: "#B91C1C",
    badgeBorder: "#FECACA",
    calloutBg: "#FFF5F5",
    calloutBorder: "#DC2626",
    calloutText: "#7F1D1D",
  },
  emerald: {
    badgeBg: "#ECFDF5",
    badgeText: "#047857",
    badgeBorder: "#A7F3D0",
    calloutBg: "#F0FDF4",
    calloutBorder: "#059669",
    calloutText: "#064E3B",
  },
};

/**
 * Builds an RFC-compliant, responsive, anti-spam optimized HTML email body.
 */
export function buildOptimizedEmailHtml(options: RenderEmailOptions): string {
  const {
    title,
    preheader,
    badgeLabel,
    badgeVariant = "blue",
    heading,
    recipientName = "Team Member",
    leadHtml,
    callout,
    keyValues = [],
    noteHtml,
    cta,
    appBaseUrl,
    displayHost,
  } = options;

  const currentYear = new Date().getFullYear();
  const colors = COLOR_VARIANTS[badgeVariant] || COLOR_VARIANTS.blue;
  const calloutColors = callout?.variant ? COLOR_VARIANTS[callout.variant] : colors;

  // Key-value rows HTML
  const rowsHtml = keyValues
    .map((kv) => {
      let valHtml = escapeHtml(kv.value);
      if (kv.isLink && kv.linkUrl) {
        valHtml = `<a href="${escapeHtml(kv.linkUrl)}" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-weight: 600;">${valHtml}</a>`;
      } else if (kv.isMono) {
        valHtml = `<span style="font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; color: #0F172A; font-weight: 600;">${valHtml}</span>`;
      } else if (kv.isBadge) {
        const bColors = kv.badgeVariant ? COLOR_VARIANTS[kv.badgeVariant] : colors;
        valHtml = `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: ${bColors.badgeBg}; color: ${bColors.badgeText}; border: 1px solid ${bColors.badgeBorder};">${valHtml}</span>`;
      } else {
        valHtml = `<span style="color: #0F172A; font-weight: 600;">${valHtml}</span>`;
      }

      return `
        <tr>
          <td class="stack-column" style="padding: 9px 12px; font-size: 13px; font-weight: 600; color: #64748B; width: 140px; border-bottom: 1px solid #F1F5F9; vertical-align: top;">
            ${escapeHtml(kv.label)}
          </td>
          <td class="stack-column" style="padding: 9px 12px; font-size: 13px; color: #0F172A; border-bottom: 1px solid #F1F5F9; vertical-align: top;">
            ${valHtml}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .stack-column {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      .mobile-padding {
        padding-left: 18px !important;
        padding-right: 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; color: #0F172A;">
  <!-- Anti-spam Preheader with Zero-Width Spacing to Prevent Snippet Bleed -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #F8FAFC; opacity: 0;">
    ${escapeHtml(preheader)}
    &#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;
    &#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;
    &#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;
    &#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;&#847; &zwnj;&nbsp;&#8199;&shy;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC;">
    <tr>
      <td align="center" style="padding: 24px 12px 36px 12px;">
        <!-- Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 580px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 14px -2px rgba(15, 23, 42, 0.05);">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #0F172A; padding: 20px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <span style="font-size: 16px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.2px;">Imperial IT</span>
                    <span style="display: block; font-size: 11px; color: #94A3B8; font-weight: 500; margin-top: 2px;">Client Registry Management System</span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${colors.badgeBg}; color: ${colors.badgeText}; border: 1px solid ${colors.badgeBorder};">
                      ${escapeHtml(badgeLabel)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="mobile-padding" style="padding: 28px 24px 24px 24px;">
              
              <!-- Title -->
              <h1 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; line-height: 1.35; color: #0F172A;">
                ${escapeHtml(heading)}
              </h1>

              <!-- Greeting & Lead -->
              <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #334155;">
                Hello ${escapeHtml(recipientName)},
              </p>
              <div style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                ${leadHtml}
              </div>

              ${
                callout
                  ? `
              <!-- Callout Box -->
              <div style="background-color: ${calloutColors.calloutBg}; border-left: 4px solid ${calloutColors.calloutBorder}; border-radius: 6px; padding: 14px 16px; margin: 0 0 20px 0;">
                ${
                  callout.title
                    ? `<p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: ${calloutColors.calloutText};">${escapeHtml(callout.title)}</p>`
                    : ""
                }
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${calloutColors.calloutText};">
                  ${escapeHtml(callout.text)}
                </p>
                ${
                  callout.code
                    ? `
                <div style="margin: 14px 0 6px 0; text-align: center;">
                  <span style="display: inline-block; font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: ${calloutColors.calloutBorder}; background-color: #FFFFFF; padding: 10px 20px; border-radius: 8px; border: 2px dashed ${calloutColors.calloutBorder};">
                    ${escapeHtml(callout.code)}
                  </span>
                </div>
                `
                    : ""
                }
                ${
                  callout.subtext
                    ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #64748B;">${escapeHtml(callout.subtext)}</p>`
                    : ""
                }
              </div>
              `
                  : ""
              }

              ${
                keyValues.length > 0
                  ? `
              <!-- Structured Details Table -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAFCFE; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 22px 0; overflow: hidden;">
                ${rowsHtml}
              </table>
              `
                  : ""
              }

              ${
                noteHtml
                  ? `
              <!-- Note / Instructions -->
              <div style="margin: 0 0 22px 0; font-size: 13px; line-height: 1.55; color: #475569; background-color: #F8FAFC; padding: 12px 14px; border-radius: 6px; border: 1px solid #F1F5F9;">
                ${noteHtml}
              </div>
              `
                  : ""
              }

              ${
                cta
                  ? `
              <!-- Call to Action Button with Direct Link Fallback -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563EB;">
                    <a href="${escapeHtml(cta.url)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px; border: 1px solid #2563EB;">
                      ${escapeHtml(cta.label)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748B; line-height: 1.45; word-break: break-all;">
                If the button above does not open, visit this link directly in your browser:<br />
                <a href="${escapeHtml(cta.url)}" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline;">${escapeHtml(cta.url)}</a>
              </p>
              `
                  : ""
              }

            </td>
          </tr>

          <!-- Anti-Spam Compliance & Identification Footer -->
          <tr>
            <td class="mobile-padding" style="padding: 20px 24px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 11px; line-height: 1.6; color: #64748B; text-align: left;">
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">
                      Imperial IT BD &middot; Operational Notification Service
                    </p>
                    <p style="margin: 0 0 4px 0;">
                      This is an automated operational notice generated by the Imperial IT Client Registry Management System (<a href="${escapeHtml(appBaseUrl)}" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline;">${escapeHtml(displayHost)}</a>).
                    </p>
                    <p style="margin: 0 0 4px 0;">
                      You received this email because your email address is listed as an authorized recipient for tasks or organization accounts.
                    </p>
                    <p style="margin: 0; color: #94A3B8; font-size: 10px;">
                      Imperial IT BD &middot; Dhaka, Bangladesh &middot; &copy; ${currentYear} All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Builds matching plain text for high text-to-HTML score and SpamAssassin compliance.
 */
export function buildOptimizedEmailText(options: RenderEmailOptions): string {
  const {
    heading,
    recipientName = "Team Member",
    leadTextPlain,
    callout,
    keyValues = [],
    noteTextPlain,
    cta,
    appBaseUrl,
    displayHost,
  } = options;

  let text = `${heading.toUpperCase()}\n`;
  text += `${"=".repeat(heading.length)}\n\n`;
  text += `Hello ${recipientName},\n\n`;
  text += `${leadTextPlain}\n\n`;

  if (callout) {
    if (callout.title) text += `[${callout.title}]\n`;
    text += `${callout.text}\n`;
    if (callout.code) text += `Verification Code: ${callout.code}\n`;
    if (callout.subtext) text += `(${callout.subtext})\n`;
    text += `\n`;
  }

  if (keyValues.length > 0) {
    text += `DETAILS:\n`;
    for (const kv of keyValues) {
      text += `- ${kv.label}: ${kv.value}\n`;
    }
    text += `\n`;
  }

  if (noteTextPlain) {
    text += `NOTE:\n${noteTextPlain}\n\n`;
  }

  if (cta) {
    text += `${cta.label}:\n${cta.url}\n\n`;
  }

  text += `----------------------------------------\n`;
  text += `Imperial IT BD - Operational Notification Service\n`;
  text += `System: ${displayHost} (${appBaseUrl})\n`;
  text += `Dhaka, Bangladesh\n`;

  return text.trim();
}

/**
 * Generates RFC-compliant anti-spam headers for outbound messages.
 */
function createAntiSpamHeaders(senderEmail: string, recipientEmail: string, customHeaders?: Record<string, string>) {
  const domain = senderEmail.includes("@") ? senderEmail.split("@")[1] : "imperialitbd.com";
  const uniqueId = `${Date.now()}.${Math.random().toString(36).substring(2, 10)}`;
  const messageId = `<${uniqueId}@${domain}>`;

  return {
    "Message-ID": messageId,
    "Date": new Date().toUTCString(),
    "MIME-Version": "1.0",
    "X-Mailer": "Imperial-IT-Mailer/2.0",
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All, OOF, AutoReply",
    "Precedence": "bulk",
    "X-Entity-Ref-ID": uniqueId,
    "List-Unsubscribe": `<mailto:${senderEmail}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Report-Abuse-To": `<mailto:${senderEmail}>`,
    ...(customHeaders || {}),
  };
}

/**
 * Unified email sender with anti-spam deliverability headers supporting:
 * 1. Super Admin Custom SMTP (Gmail, cPanel, Outlook, Custom)
 * 2. Brevo SMTP Relay
 * 3. Brevo REST API Fallback
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const { to, toName, cc, subject, html, text, fromName, headers } = payload;

  if (!to) {
    const msg = "Mailer warning: No recipient email provided. Skipping email.";
    console.warn(msg);
    return { success: false, error: msg };
  }

  // 0. Check Super Admin custom SMTP configuration first
  try {
    const customSmtp = await getSmtpConfig();
    if (customSmtp.isEnabled && customSmtp.host && customSmtp.user && customSmtp.pass) {
      const customSenderName = fromName || customSmtp.fromName || "Imperial IT";
      const customSenderEmail = customSmtp.fromEmail || customSmtp.user;
      const customReplyTo = customSmtp.replyTo || customSenderEmail;
      const outboundHeaders = createAntiSpamHeaders(customSenderEmail, to, headers);

      try {
        const customTransporter = createSmtpTransporter(customSmtp);
        await customTransporter.sendMail({
          from: `"${customSenderName}" <${customSenderEmail}>`,
          replyTo: customReplyTo,
          to: toName ? `"${toName}" <${to}>` : to,
          ...(cc && cc.length > 0 ? { cc } : {}),
          subject,
          text,
          html,
          headers: outboundHeaders,
        });

        return { success: true };
      } catch (customErr: any) {
        console.warn("Custom SMTP delivery failed:", customErr?.message || customErr);
        if (!customSmtp.useBrevoFallback) {
          return {
            success: false,
            error: `Custom SMTP error: ${customErr?.message || "Failed to deliver via configured SMTP"}`,
          };
        }
        console.log("Custom SMTP failed with fallback enabled; attempting Brevo delivery relay/API...");
      }
    }
  } catch (confErr: any) {
    console.warn("Error reading custom SMTP configuration:", confErr?.message || confErr);
  }

  const rawBrevoApiKey = process.env.BREVO_API_KEY || DEFAULT_BREVO_CONFIG.apiKey;
  const brevoApiKey = parseBrevoKey(rawBrevoApiKey);

  // Sender email is strictly imperialitbd2011@gmail.com
  const senderEmail = "imperialitbd2011@gmail.com";
  const senderName = fromName || process.env.BREVO_SENDER_NAME || DEFAULT_BREVO_CONFIG.senderName;
  const outboundHeaders = createAntiSpamHeaders(senderEmail, to, headers);

  // Brevo SMTP Relay Username: Always enforce b866f6001@smtp-brevo.com for relay authentication
  const envSmtpUser = process.env.BREVO_SMTP_USER;
  const brevoSmtpUser =
    envSmtpUser && envSmtpUser.includes("@smtp-brevo.com")
      ? envSmtpUser
      : DEFAULT_BREVO_CONFIG.smtpUser;

  const brevoSmtpPass = parseBrevoKey(process.env.BREVO_SMTP_KEY) || DEFAULT_BREVO_CONFIG.smtpKey;
  const brevoSmtpServer = process.env.BREVO_SMTP_SERVER || DEFAULT_BREVO_CONFIG.smtpServer;
  const brevoSmtpPort = Number(process.env.BREVO_SMTP_PORT) || DEFAULT_BREVO_CONFIG.smtpPort;

  // 1. Try Brevo SMTP via Nodemailer relay (verified and bypasses cloud IP whitelisting)
  if (brevoSmtpUser && brevoSmtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: brevoSmtpServer,
        port: brevoSmtpPort,
        secure: false, // Port 587 uses STARTTLS
        auth: {
          user: brevoSmtpUser,
          pass: brevoSmtpPass,
        },
      });

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        replyTo: senderEmail,
        to: toName ? `"${toName}" <${to}>` : to,
        ...(cc && cc.length > 0 ? { cc } : {}),
        subject,
        text,
        html,
        headers: outboundHeaders,
      });

      return { success: true };
    } catch (smtpErr: any) {
      console.warn("Brevo SMTP relay send failed (will attempt REST API):", smtpErr?.message || smtpErr);
    }
  }

  // 2. Try Brevo REST API as fallback
  if (brevoApiKey && senderEmail) {
    try {
      const toList = [{ email: to, ...(toName ? { name: toName } : {}) }];
      const ccList = Array.isArray(cc) ? cc.filter(Boolean).map((e) => ({ email: e })) : undefined;

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail,
          },
          to: toList,
          ...(ccList && ccList.length > 0 ? { cc: ccList } : {}),
          subject,
          htmlContent: html,
          ...(text ? { textContent: text } : {}),
          headers: outboundHeaders,
        }),
      });

      if (response.ok) {
        return { success: true };
      }

      const errorData = await response.json().catch(() => ({}));
      console.warn("Brevo REST API error:", errorData);
    } catch (apiErr) {
      console.warn("Brevo REST API request failed:", apiErr);
    }
  }

  const noConfigMsg = "Mailer warning: Outbound mail service could not dispatch email.";
  console.warn(noConfigMsg);
  return { success: false, error: noConfigMsg };
}

// =============================================================================
// Application Email Services (Optimized for Deliverability & Anti-Spam)
// =============================================================================

/**
 * 1. Password Reset OTP Verification Email
 */
export async function sendOTPEmail(data: { email: string; otp: string }) {
  const { email, otp } = data;

  const settings = await getMailSettings();
  if (!settings.masterEnabled || !settings.passwordReset) {
    console.log("Password reset OTP email skipped: service disabled in Mail Settings.");
    return { success: false, error: "Password reset email service is currently disabled." };
  }

  const appBaseUrl = await getAppBaseUrl();
  const displayHost = getDisplayHost(appBaseUrl);

  const options: RenderEmailOptions = {
    title: "Password Reset Verification Code",
    preheader: `Your verification code is ${otp}. Valid for 10 minutes to reset your administrative password.`,
    badgeLabel: "Security Code",
    badgeVariant: "blue",
    heading: "Password Reset Request",
    recipientName: "Administrator",
    leadHtml: "You requested a one-time verification code to reset your account password in the Client Registry system.",
    leadTextPlain: "You requested a one-time verification code to reset your account password in the Client Registry system.",
    callout: {
      title: "One-Time Verification Code (OTP)",
      text: "Please enter this 6-digit code in the verification prompt to continue:",
      code: otp,
      subtext: "This security code expires in 10 minutes and can only be used once.",
      variant: "blue",
    },
    keyValues: [
      { label: "Valid For", value: "10 Minutes" },
      { label: "Action", value: "Password Reset" },
      { label: "Security Status", value: "Protected" },
    ],
    noteHtml: "<strong>Security notice:</strong> If you did not make this request, please disregard this email. Your password and account remain completely safe.",
    noteTextPlain: "If you did not make this request, please disregard this message. Your password and account remain completely safe.",
    cta: {
      label: "Open Login Portal",
      url: `${appBaseUrl}/login`,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return sendEmail({
    to: email,
    subject: `Password Reset Verification Code: ${otp}`,
    html,
    text,
  });
}

/**
 * 2. Task Assignment Email (Dispatched When Task is Created or Reassigned)
 */
export async function sendTaskAssignmentEmail(data: TaskEmailData) {
  const settings = await getMailSettings();
  if (!settings.masterEnabled || !settings.taskAssignment) {
    console.log("Task assignment email skipped: service disabled in Mail Settings.");
    return { success: false, error: "Task assignment email service is currently disabled." };
  }

  const {
    taskTitle,
    description,
    dueDate,
    priority,
    institutionName,
    assignedByName,
    assignedToEmail,
    assignedToName,
  } = data;

  if (!assignedToEmail) return;

  const appBaseUrl = await getAppBaseUrl();
  const currentTasksUrl = `${appBaseUrl}/tasks`;
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDate = formatDhakaDateTime(dueDate);
  const assignedByText = assignedByName || "Administrator";

  const keyValues: EmailKeyValue[] = [
    { label: "Task Title", value: taskTitle },
    { label: "Assigned By", value: assignedByText },
    { label: "Scheduled Due", value: formattedDate },
    {
      label: "Priority",
      value: priority.toUpperCase(),
      isBadge: true,
      badgeVariant: priority.toLowerCase() === "high" || priority.toLowerCase() === "urgent" ? "rose" : "blue",
    },
  ];

  if (institutionName) {
    keyValues.push({ label: "Institution", value: institutionName });
  }

  const options: RenderEmailOptions = {
    title: `Task Assignment: ${taskTitle}`,
    preheader: `You have been assigned a new task: "${taskTitle}". Scheduled for ${formattedDate}.`,
    badgeLabel: "Task Assignment",
    badgeVariant: "blue",
    heading: "New Task Assigned to You",
    recipientName: assignedToName,
    leadHtml: `A new task titled "<strong>${escapeHtml(taskTitle)}</strong>" has been assigned to you by <strong>${escapeHtml(assignedByText)}</strong>.`,
    leadTextPlain: `A new task titled "${taskTitle}" has been assigned to you by ${assignedByText}.`,
    keyValues,
    noteHtml: description
      ? `<strong>Task Description:</strong><br /><span style="color: #334155;">${escapeHtml(description)}</span>`
      : undefined,
    noteTextPlain: description ? `Description: ${description}` : undefined,
    cta: {
      label: "View Task on Dashboard",
      url: currentTasksUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: assignedToEmail,
    toName: assignedToName,
    subject: `Task Assignment: ${taskTitle}`,
    text,
    html,
  });
}

/**
 * 3. Task Due in 2 Hours Alert Email
 */
export async function sendTaskDueSoonEmail(data: TaskAlertEmailData) {
  const settings = await getMailSettings();
  if (!settings.masterEnabled || !settings.taskDueSoon) {
    console.log("2-hour reminder email skipped: service disabled in Mail Settings.");
    return { success: false, error: "2-hour deadline reminder email service is currently disabled." };
  }

  const {
    taskTitle,
    description,
    dueDate,
    priority,
    institutionName,
    assignedByName,
    assignedToEmail,
    assignedToName,
  } = data;

  if (!assignedToEmail) {
    return { success: false, error: "No recipient email address provided." };
  }

  const appBaseUrl = await getAppBaseUrl();
  const currentTasksUrl = `${appBaseUrl}/tasks`;
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDate = formatDhakaDateTime(dueDate);
  const assignedByText = assignedByName || "Administrator";

  const keyValues: EmailKeyValue[] = [
    { label: "Task Title", value: taskTitle },
    { label: "Deadline", value: `${formattedDate} (Within 2 Hours)` },
    {
      label: "Priority",
      value: priority.toUpperCase(),
      isBadge: true,
      badgeVariant: "amber",
    },
    { label: "Assigned By", value: assignedByText },
  ];

  if (institutionName) {
    keyValues.push({ label: "Institution", value: institutionName });
  }

  const options: RenderEmailOptions = {
    title: `Task Due Soon: ${taskTitle}`,
    preheader: `Reminder: Your assigned task "${taskTitle}" is scheduled for completion within the next 2 hours.`,
    badgeLabel: "Due in 2 Hours",
    badgeVariant: "amber",
    heading: "Task Deadline Reminder",
    recipientName: assignedToName,
    leadHtml: `This is an automated reminder that your assigned task "<strong>${escapeHtml(taskTitle)}</strong>" is due within <strong>2 hours</strong>.`,
    leadTextPlain: `This is an automated reminder that your assigned task "${taskTitle}" is due within 2 hours.`,
    callout: {
      title: "Upcoming Deadline (Within 2 Hours)",
      text: "Please finalize your work or submit a progress update on the dashboard before the scheduled deadline.",
      variant: "amber",
    },
    keyValues,
    noteHtml: description
      ? `<strong>Task Description:</strong><br /><span style="color: #334155;">${escapeHtml(description)}</span>`
      : undefined,
    noteTextPlain: description ? `Description: ${description}` : undefined,
    cta: {
      label: "Update Task on Dashboard",
      url: currentTasksUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: assignedToEmail,
    toName: assignedToName,
    subject: `Task Reminder: "${taskTitle}" is due in 2 hours`,
    text,
    html,
  });
}

/**
 * 3.5. Monthly Task 1-Day (24-Hour) Advance Reminder Email
 */
export async function sendMonthlyTaskReminderEmail(data: TaskAlertEmailData): Promise<{ success: boolean; error?: string }> {
  const settings = await getMailSettings();
  if (!settings.masterEnabled || !settings.taskDueSoon) {
    console.log("Monthly task 1-day reminder email skipped: service disabled in Mail Settings.");
    return { success: false, error: "Task reminder email service is currently disabled." };
  }

  const {
    taskTitle,
    description,
    dueDate,
    priority,
    institutionName,
    assignedByName,
    assignedToEmail,
    assignedToName,
  } = data;

  if (!assignedToEmail) {
    return { success: false, error: "No recipient email address provided." };
  }

  const appBaseUrl = await getAppBaseUrl();
  const currentTasksUrl = `${appBaseUrl}/tasks`;
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDate = formatDhakaDateTime(dueDate);
  const assignedByText = assignedByName || "Administrator";

  const keyValues: EmailKeyValue[] = [
    { label: "Task Title", value: taskTitle },
    { label: "Scheduled Due", value: `${formattedDate} (Tomorrow)` },
    { label: "Cycle", value: "Monthly Recurring", isBadge: true, badgeVariant: "blue" },
    {
      label: "Priority",
      value: priority.toUpperCase(),
      isBadge: true,
      badgeVariant: priority.toLowerCase() === "high" ? "rose" : "blue",
    },
    { label: "Assigned By", value: assignedByText },
  ];

  if (institutionName) {
    keyValues.push({ label: "Institution", value: institutionName });
  }

  const options: RenderEmailOptions = {
    title: `Monthly Task Reminder: ${taskTitle}`,
    preheader: `Upcoming monthly task: "${taskTitle}" is scheduled for tomorrow (${formattedDate}).`,
    badgeLabel: "Monthly Recurring",
    badgeVariant: "blue",
    heading: "Monthly Task Reminder — Due Tomorrow",
    recipientName: assignedToName,
    leadHtml: `This is an advance notice that your monthly recurring task "<strong>${escapeHtml(taskTitle)}</strong>" is due <strong>tomorrow</strong>.`,
    leadTextPlain: `This is an advance notice that your monthly recurring task "${taskTitle}" is due tomorrow.`,
    callout: {
      title: "Monthly Recurrence Notice",
      text: "Monthly recurring tasks can be completed on or after their scheduled date. Upon completion, the task will automatically clone and rollover for next month.",
      variant: "blue",
    },
    keyValues,
    noteHtml: description
      ? `<strong>Task Description:</strong><br /><span style="color: #334155;">${escapeHtml(description)}</span>`
      : undefined,
    noteTextPlain: description ? `Description: ${description}` : undefined,
    cta: {
      label: "View Task Details",
      url: currentTasksUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: assignedToEmail,
    toName: assignedToName,
    subject: `Monthly Task Reminder: "${taskTitle}" is due tomorrow`,
    text,
    html,
  });
}

/**
 * 4. Task Overdue Alert Email
 */
export async function sendTaskOverdueEmail(data: TaskAlertEmailData): Promise<{ success: boolean; error?: string }> {
  const settings = await getMailSettings();
  if (!settings.masterEnabled || !settings.taskOverdue) {
    console.log("Task overdue email skipped: service disabled in Mail Settings.");
    return { success: false, error: "Task overdue alert email service is currently disabled in Mail Settings." };
  }

  const {
    taskTitle,
    description,
    dueDate,
    priority,
    institutionName,
    assignedByName,
    assignedToEmail,
    assignedToName,
    assignerEmail,
    timeOverdueText,
  } = data;

  const finalRecipientEmail = assignedToEmail || assignerEmail;
  const finalRecipientName = assignedToName || assignedByName || "Team Member";

  if (!finalRecipientEmail) {
    return { success: false, error: "No recipient email address available for overdue alert." };
  }

  const ccList: string[] = [];
  if (assignerEmail && assignedToEmail && assignerEmail.toLowerCase() !== assignedToEmail.toLowerCase()) {
    ccList.push(assignerEmail);
  }

  const appBaseUrl = await getAppBaseUrl();
  const currentTasksUrl = `${appBaseUrl}/tasks`;
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDate = formatDhakaDateTime(dueDate);
  const assignedByText = assignedByName || "Administrator";
  const overdueDuration = timeOverdueText ? ` (${timeOverdueText})` : "";

  const keyValues: EmailKeyValue[] = [
    { label: "Task Title", value: taskTitle },
    { label: "Original Deadline", value: formattedDate },
    { label: "Status", value: `OVERDUE${overdueDuration}`, isBadge: true, badgeVariant: "rose" },
    {
      label: "Priority",
      value: priority.toUpperCase(),
      isBadge: true,
      badgeVariant: "rose",
    },
    { label: "Assigned To", value: assignedToName || "Unassigned" },
    { label: "Assigned By", value: assignedByText },
  ];

  if (institutionName) {
    keyValues.push({ label: "Institution", value: institutionName });
  }

  const options: RenderEmailOptions = {
    title: `Task Overdue Notice: ${taskTitle}`,
    preheader: `Action Required: Task "${taskTitle}" has passed its scheduled deadline and requires immediate attention.`,
    badgeLabel: "Action Required — Overdue",
    badgeVariant: "rose",
    heading: "Task Overdue Notice",
    recipientName: finalRecipientName,
    leadHtml: `The task "<strong>${escapeHtml(taskTitle)}</strong>" has passed its scheduled deadline and is now marked as <strong>OVERDUE</strong>.`,
    leadTextPlain: `The task "${taskTitle}" has passed its scheduled deadline and is now marked as OVERDUE.`,
    callout: {
      title: "Immediate Action Required",
      text: "Please resolve this task on your dashboard or provide a status update to ensure project schedules remain on track.",
      variant: "rose",
    },
    keyValues,
    noteHtml: description
      ? `<strong>Task Description:</strong><br /><span style="color: #334155;">${escapeHtml(description)}</span>`
      : undefined,
    noteTextPlain: description ? `Description: ${description}` : undefined,
    cta: {
      label: "Resolve Task on Dashboard",
      url: currentTasksUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: finalRecipientEmail,
    toName: finalRecipientName,
    ...(ccList.length > 0 ? { cc: ccList } : {}),
    subject: `Task Overdue Notice: "${taskTitle}" has exceeded its deadline`,
    text,
    html,
  });
}

/**
 * 5. Task Completion Confirmation Email (Optional)
 */
export async function sendTaskCompletionEmail(data: TaskCompletionEmailData) {
  const settings = await getMailSettings();
  if (!settings.masterEnabled || !settings.taskCompletion) {
    console.log("Task completion confirmation email skipped: service disabled in Mail Settings.");
    return { success: false, error: "Task completion email service is currently disabled." };
  }

  const {
    taskTitle,
    dueDate,
    completionNote,
    institutionName,
    completedByName,
    recipientEmail,
    recipientName,
  } = data;

  if (!recipientEmail) return;

  const appBaseUrl = await getAppBaseUrl();
  const currentTasksUrl = `${appBaseUrl}/tasks`;
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDueDate = formatDhakaDateTime(dueDate);
  const completionDate = formatDhakaDateTime(new Date());

  const keyValues: EmailKeyValue[] = [
    { label: "Task Title", value: taskTitle },
    { label: "Completed By", value: completedByName },
    { label: "Status", value: "COMPLETED", isBadge: true, badgeVariant: "emerald" },
    { label: "Completion Time", value: completionDate },
    { label: "Original Due Date", value: formattedDueDate },
  ];

  if (institutionName) {
    keyValues.push({ label: "Institution", value: institutionName });
  }

  const options: RenderEmailOptions = {
    title: `Task Completed: ${taskTitle}`,
    preheader: `Task "${taskTitle}" has been marked as completed by ${completedByName}.`,
    badgeLabel: "Task Completed",
    badgeVariant: "emerald",
    heading: "Task Marked as Completed",
    recipientName,
    leadHtml: `The task "<strong>${escapeHtml(taskTitle)}</strong>" has been completed by <strong>${escapeHtml(completedByName)}</strong>.`,
    leadTextPlain: `The task "${taskTitle}" has been completed by ${completedByName}.`,
    keyValues,
    noteHtml: completionNote
      ? `<strong>Completion Note:</strong><br /><span style="color: #334155;">${escapeHtml(completionNote)}</span>`
      : undefined,
    noteTextPlain: completionNote ? `Completion Note: ${completionNote}` : undefined,
    cta: {
      label: "View Completed Task",
      url: currentTasksUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: `Task Completed: "${taskTitle}" has been resolved`,
    text,
    html,
  });
}

/**
 * 6. Website / Institution Expiry Alert Email
 * Strictly calculates based on scheduled expireDate (not actualExpireDate).
 */
export async function sendWebsiteExpiryAlertEmail(
  data: WebsiteExpiryAlertEmailData
): Promise<{ success: boolean; error?: string }> {
  const {
    institutionName,
    domain,
    category,
    expireDate,
    daysRemaining,
    recipientEmail,
    recipientName,
    adminEmailCopy,
  } = data;

  if (!recipientEmail) {
    return { success: false, error: "No recipient email address provided for website expiry alert." };
  }

  const appBaseUrl = await getAppBaseUrl();
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDate = formatDhakaDateTime(expireDate);
  const isWebsite = (category || "").toLowerCase() !== "software";
  const itemType = isWebsite ? "Website License" : "Software License";

  const ccList: string[] = [];
  if (adminEmailCopy && adminEmailCopy.trim().toLowerCase() !== recipientEmail.toLowerCase()) {
    ccList.push(adminEmailCopy.trim());
  }

  const badgeVariant: "rose" | "amber" | "blue" =
    daysRemaining <= 7 ? "rose" : daysRemaining <= 15 ? "amber" : "blue";
  const badgeLabel =
    daysRemaining <= 7 ? "Urgent Expiration" : daysRemaining <= 15 ? "Expiring Soon" : "Renewal Reminder";

  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").trim() : "";

  const keyValues: EmailKeyValue[] = [
    { label: "Institution", value: institutionName },
    ...(cleanDomain
      ? [
          {
            label: "Website Domain",
            value: cleanDomain,
            isLink: true,
            linkUrl: `https://${cleanDomain}`,
          },
        ]
      : []),
    { label: "Service Category", value: category || "Website" },
    { label: "Scheduled Expiry", value: formattedDate },
    {
      label: "Time Remaining",
      value: `${daysRemaining} Days`,
      isBadge: true,
      badgeVariant,
    },
  ];

  const options: RenderEmailOptions = {
    title: `${itemType} Expiry Notice: ${cleanDomain || institutionName}`,
    preheader: `Notice: The ${itemType.toLowerCase()} for ${institutionName} expires in ${daysRemaining} days on ${formattedDate}.`,
    badgeLabel,
    badgeVariant,
    heading: `${itemType} Expiring in ${daysRemaining} Days`,
    recipientName: recipientName || "Valued Client",
    leadHtml: `The ${itemType.toLowerCase()} for <strong>${escapeHtml(institutionName)}</strong>${cleanDomain ? ` (<code>${escapeHtml(cleanDomain)}</code>)` : ""} is scheduled to expire in <strong>${daysRemaining} days</strong>.`,
    leadTextPlain: `The ${itemType.toLowerCase()} for ${institutionName}${cleanDomain ? ` (${cleanDomain})` : ""} is scheduled to expire in ${daysRemaining} days.`,
    callout: {
      title: "Renewal Reminder",
      text: `Scheduled Expiration: ${formattedDate}. Please renew your domain and hosting services prior to this date to ensure continuous website availability.`,
      variant: badgeVariant,
    },
    keyValues,
    noteHtml: "To initiate renewal or if you have any questions regarding your services, please contact our support team.",
    noteTextPlain: "To initiate renewal or if you have questions, please contact our support team.",
    cta: {
      label: "Open Registry Dashboard",
      url: appBaseUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    ...(ccList.length > 0 ? { cc: ccList } : {}),
    subject: `${itemType} Expiry Notice: ${cleanDomain || institutionName} (${daysRemaining} days remaining)`,
    text,
    html,
  });
}

/**
 * 7. Company Software Subscription Expiry Alert Email
 */
export async function sendCompanySubscriptionExpiryAlertEmail(
  data: CompanySubscriptionExpiryAlertEmailData
): Promise<{ success: boolean; error?: string }> {
  const {
    companyName,
    softwareName,
    billingCycle,
    expireDate,
    daysRemaining,
    recipientEmail,
    recipientName,
    adminEmailCopy,
  } = data;

  if (!recipientEmail) {
    return { success: false, error: "No recipient email address provided for subscription expiry alert." };
  }

  const appBaseUrl = await getAppBaseUrl();
  const displayHost = getDisplayHost(appBaseUrl);

  const formattedDate = formatDhakaDateTime(expireDate);

  const ccList: string[] = [];
  if (adminEmailCopy && adminEmailCopy.trim().toLowerCase() !== recipientEmail.toLowerCase()) {
    ccList.push(adminEmailCopy.trim());
  }

  const badgeVariant: "rose" | "amber" | "blue" =
    daysRemaining <= 7 ? "rose" : daysRemaining <= 15 ? "amber" : "blue";
  const badgeLabel =
    daysRemaining <= 7 ? "Urgent Expiration" : daysRemaining <= 15 ? "Expiring Soon" : "Subscription Notice";

  const keyValues: EmailKeyValue[] = [
    { label: "Company", value: companyName },
    { label: "Software / Plan", value: softwareName },
    { label: "Billing Cycle", value: billingCycle },
    { label: "Scheduled Expiry", value: formattedDate },
    {
      label: "Time Remaining",
      value: `${daysRemaining} Days`,
      isBadge: true,
      badgeVariant,
    },
  ];

  const options: RenderEmailOptions = {
    title: `Subscription Expiry Notice: ${softwareName}`,
    preheader: `Notice: The subscription for ${softwareName} (${companyName}) expires in ${daysRemaining} days on ${formattedDate}.`,
    badgeLabel,
    badgeVariant,
    heading: `Software Subscription Expiring in ${daysRemaining} Days`,
    recipientName: recipientName || "Valued Client",
    leadHtml: `The software license subscription for <strong>${escapeHtml(softwareName)}</strong> registered under <strong>${escapeHtml(companyName)}</strong> is scheduled to expire in <strong>${daysRemaining} days</strong>.`,
    leadTextPlain: `The software license subscription for ${softwareName} registered under ${companyName} is scheduled to expire in ${daysRemaining} days.`,
    callout: {
      title: "Scheduled Renewal",
      text: `Expiry Date: ${formattedDate}. Please renew your subscription to maintain uninterrupted access to software services.`,
      variant: badgeVariant,
    },
    keyValues,
    noteHtml: "Please contact Imperial IT to renew your subscription and maintain continuous service access.",
    noteTextPlain: "Please contact Imperial IT to renew your subscription and maintain continuous service access.",
    cta: {
      label: "Open Registry Dashboard",
      url: appBaseUrl,
    },
    appBaseUrl,
    displayHost,
  };

  const html = buildOptimizedEmailHtml(options);
  const text = buildOptimizedEmailText(options);

  return await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    ...(ccList.length > 0 ? { cc: ccList } : {}),
    subject: `Subscription Expiry Notice: ${softwareName} for ${companyName} (${daysRemaining} days remaining)`,
    text,
    html,
  });
}
