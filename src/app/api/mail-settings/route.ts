import { NextResponse } from "next/server";
import { getMailSettings, saveMailSettings, DEFAULT_BREVO_CONFIG } from "@/lib/mailer";
import { getPublicSmtpConfig, saveSmtpConfig } from "@/lib/smtpService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getMailSettings();
    const smtp = await getPublicSmtpConfig();

    const brevoSenderEmail = "imperialitbd2011@gmail.com";
    const hasApiKey = Boolean(process.env.BREVO_API_KEY || DEFAULT_BREVO_CONFIG.apiKey);
    const hasSmtpUser = Boolean(process.env.BREVO_SMTP_USER || DEFAULT_BREVO_CONFIG.smtpUser);

    const activeProviderName = smtp.isEnabled
      ? `Custom SMTP (${smtp.provider.toUpperCase()} - ${smtp.host || "Configured"})`
      : "Brevo (Default Relay)";

    const activeSenderEmail = smtp.isEnabled
      ? (smtp.fromEmail || smtp.user || brevoSenderEmail)
      : brevoSenderEmail;

    return NextResponse.json({
      success: true,
      settings,
      smtp,
      provider: {
        name: activeProviderName,
        senderEmail: activeSenderEmail,
        restApiConfigured: hasApiKey,
        smtpRelayConfigured: hasSmtpUser,
        customSmtpActive: smtp.isEnabled,
      },
    });
  } catch (error: any) {
    console.error("GET /api/mail-settings error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch mail settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    let updatedSettings = null;
    let updatedSmtp = null;

    // Check if body is wrapped in { settings, smtp } or direct
    if (body.smtp) {
      updatedSmtp = await saveSmtpConfig(body.smtp);
    } else if (
      body.host !== undefined ||
      body.provider !== undefined ||
      body.isEnabled !== undefined
    ) {
      // Direct SMTP payload
      updatedSmtp = await saveSmtpConfig(body);
    }

    if (body.settings) {
      updatedSettings = await saveMailSettings(body.settings);
    } else if (
      body.masterEnabled !== undefined ||
      body.taskAssignment !== undefined ||
      body.passwordReset !== undefined
    ) {
      // Direct MailServiceSettings payload
      updatedSettings = await saveMailSettings(body);
    }

    const publicSmtp = updatedSmtp ? await getPublicSmtpConfig() : undefined;

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      smtp: publicSmtp,
    });
  } catch (error: any) {
    console.error("PUT /api/mail-settings error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update mail settings" },
      { status: 500 }
    );
  }
}
