import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import {
  SmtpConfig,
  SmtpPublicConfig,
  DEFAULT_SMTP_CONFIG,
} from "./smtpTypes";

export const SMTP_SETTINGS_KEY = "smtp_settings";

/**
 * Loads the active SMTP settings configured by the Super Admin from SiteSettings.
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  try {
    const record = await (prisma as any).siteSettings.findUnique({
      where: { id: SMTP_SETTINGS_KEY },
    });

    if (record) {
      let meta: Partial<SmtpConfig> = {};
      if (record.adminEmail) {
        try {
          meta = JSON.parse(record.adminEmail);
        } catch {
          // If not valid JSON, ignore
        }
      }

      const pass = record.password && record.password !== "smtp_config" ? record.password : "";

      return {
        isEnabled: typeof meta.isEnabled === "boolean" ? meta.isEnabled : false,
        provider: meta.provider || "custom",
        host: meta.host || "",
        port: typeof meta.port === "number" && meta.port > 0 ? meta.port : 587,
        secure: typeof meta.secure === "boolean" ? meta.secure : false,
        user: meta.user || "",
        pass: pass,
        fromEmail: meta.fromEmail || "",
        fromName: meta.fromName || "Imperial IT",
        replyTo: meta.replyTo || "",
        appUrl: meta.appUrl ? meta.appUrl.trim() : "",
        useBrevoFallback: typeof meta.useBrevoFallback === "boolean" ? meta.useBrevoFallback : true,
      };
    }
  } catch (err: any) {
    console.warn("Could not load SMTP config from database:", err?.message);
  }

  return { ...DEFAULT_SMTP_CONFIG };
}

/**
 * Returns SMTP configuration safe for public/frontend display (without exposing the raw password).
 */
export async function getPublicSmtpConfig(): Promise<SmtpPublicConfig> {
  const full = await getSmtpConfig();
  const { pass, ...rest } = full;
  return {
    ...rest,
    hasPassword: Boolean(pass && pass.length > 0),
  };
}

/**
 * Saves or updates SMTP configuration in SiteSettings.
 */
export async function saveSmtpConfig(
  newConfig: Partial<SmtpConfig>
): Promise<SmtpConfig> {
  const current = await getSmtpConfig();

  // If a new password is provided, use it; otherwise preserve current password
  const updatedPass =
    typeof newConfig.pass === "string" && newConfig.pass.trim().length > 0
      ? newConfig.pass.trim()
      : current.pass;

  const merged: SmtpConfig = {
    isEnabled: typeof newConfig.isEnabled === "boolean" ? newConfig.isEnabled : current.isEnabled,
    provider: newConfig.provider || current.provider,
    host: (newConfig.host ?? current.host).trim(),
    port: typeof newConfig.port === "number" && newConfig.port > 0 ? newConfig.port : current.port,
    secure: typeof newConfig.secure === "boolean" ? newConfig.secure : current.secure,
    user: (newConfig.user ?? current.user).trim(),
    pass: updatedPass,
    fromEmail: (newConfig.fromEmail ?? current.fromEmail).trim(),
    fromName: (newConfig.fromName ?? current.fromName).trim() || "Imperial IT",
    replyTo: (newConfig.replyTo ?? current.replyTo ?? "").trim(),
    appUrl: (newConfig.appUrl ?? current.appUrl ?? "").trim(),
    useBrevoFallback:
      typeof newConfig.useBrevoFallback === "boolean"
        ? newConfig.useBrevoFallback
        : current.useBrevoFallback,
  };

  const metadata = {
    isEnabled: merged.isEnabled,
    provider: merged.provider,
    host: merged.host,
    port: merged.port,
    secure: merged.secure,
    user: merged.user,
    fromEmail: merged.fromEmail,
    fromName: merged.fromName,
    replyTo: merged.replyTo,
    appUrl: merged.appUrl,
    useBrevoFallback: merged.useBrevoFallback,
  };

  try {
    const payload = JSON.stringify(metadata);
    await (prisma as any).siteSettings.upsert({
      where: { id: SMTP_SETTINGS_KEY },
      create: {
        id: SMTP_SETTINGS_KEY,
        password: merged.pass || "smtp_config",
        adminEmail: payload,
      },
      update: {
        password: merged.pass || "smtp_config",
        adminEmail: payload,
      },
    });
  } catch (err: any) {
    console.error("Could not save SMTP config to database:", err?.message);
    throw err;
  }

  return merged;
}

/**
 * Creates a Nodemailer transport from the given SMTP configuration.
 */
export function createSmtpTransporter(config: SmtpConfig) {
  const isPort465 = config.port === 465;
  const secure = typeof config.secure === "boolean" ? config.secure : isPort465;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      // Allow custom internal certificates while logging warnings
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Verifies SMTP connection handshake without sending an email.
 */
export async function verifySmtpConnection(
  config: SmtpConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.host || !config.host.trim()) {
    return { success: false, message: "SMTP Host is required" };
  }
  if (!config.user || !config.user.trim()) {
    return { success: false, message: "SMTP Username / Email is required" };
  }
  if (!config.pass || !config.pass.trim()) {
    return { success: false, message: "SMTP Password / App Password is required" };
  }

  try {
    const transporter = createSmtpTransporter(config);
    await transporter.verify();
    return {
      success: true,
      message: `SMTP connection verified successfully with ${config.host}:${config.port}! Handshake succeeded.`,
    };
  } catch (err: any) {
    console.error("SMTP verification error:", err);
    let friendly = err?.message || "Unknown SMTP handshake failure";
    if (err?.code === "EAUTH") {
      friendly = "Authentication failed: Invalid SMTP username or password. If using Gmail, ensure you are using a 16-character Google App Password.";
    } else if (err?.code === "ESOCKET" || err?.code === "ETIMEDOUT") {
      friendly = `Connection timed out connecting to ${config.host}:${config.port}. Check your firewall, hostname, or try switching port (465 SSL vs 587 TLS).`;
    } else if (err?.code === "ECONNREFUSED") {
      friendly = `Connection refused by ${config.host}:${config.port}. Please verify that the SMTP server and port are correct.`;
    }
    return {
      success: false,
      message: friendly,
    };
  }
}
