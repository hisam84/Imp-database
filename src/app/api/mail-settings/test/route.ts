import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import { formatDhakaDateTime } from "@/lib/dateUtils";
import {
  getSmtpConfig,
  createSmtpTransporter,
  verifySmtpConnection,
} from "@/lib/smtpService";
import { SmtpConfig } from "@/lib/smtpTypes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetEmail, verifyOnly, smtpConfig: formSmtp } = body;

    // 1. Handshake-only verification requested
    if (verifyOnly) {
      const current = await getSmtpConfig();
      const configToTest: SmtpConfig = {
        ...current,
        ...(formSmtp || {}),
        pass: formSmtp?.pass && formSmtp.pass.trim().length > 0 ? formSmtp.pass.trim() : current.pass,
      };

      const verifyRes = await verifySmtpConnection(configToTest);
      return NextResponse.json(verifyRes, { status: verifyRes.success ? 200 : 400 });
    }

    // 2. Email delivery test requested
    const recipient = (targetEmail || "").trim();
    if (!recipient) {
      return NextResponse.json(
        { success: false, message: "Target recipient email address is required" },
        { status: 400 }
      );
    }

    const currentSmtp = await getSmtpConfig();
    const effectiveSmtp: SmtpConfig = formSmtp
      ? {
          ...currentSmtp,
          ...formSmtp,
          pass: formSmtp.pass && formSmtp.pass.trim().length > 0 ? formSmtp.pass.trim() : currentSmtp.pass,
        }
      : currentSmtp;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>SMTP Mailer Connectivity Test</title></head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #0D47A1, #2196F3); padding: 20px 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700;">✅ SMTP Mailer Test Success</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Client Registry Management System</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
        This test email confirms that your outgoing mail server configuration is fully operational.
      </p>
      <div style="background-color: #f1f5f9; border-left: 4px solid #2196F3; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #1e293b; margin-bottom: 20px;">
        <div><strong>Status:</strong> Connected & Dispatched</div>
        <div><strong>SMTP Host:</strong> ${effectiveSmtp.isEnabled && effectiveSmtp.host ? effectiveSmtp.host : "Brevo Relay (smtp-relay.brevo.com)"}</div>
        <div><strong>Port:</strong> ${effectiveSmtp.isEnabled && effectiveSmtp.port ? effectiveSmtp.port : 587}</div>
        <div><strong>Sender:</strong> ${effectiveSmtp.fromEmail || effectiveSmtp.user || "imperialitbd2011@gmail.com"}</div>
        <div><strong>Timestamp:</strong> ${formatDhakaDateTime(new Date())} (BST / Dhaka)</div>
      </div>
      <p style="font-size: 12px; color: #64748b; margin: 0;">
        Your email server is configured to deliver task assignment notifications, 2-hour reminders, monthly recurring notices, and password reset OTPs.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // If explicit form SMTP is provided with host and user, test directly through it
    if (effectiveSmtp.host && effectiveSmtp.user && effectiveSmtp.pass) {
      try {
        const transporter = createSmtpTransporter(effectiveSmtp);
        const fromName = effectiveSmtp.fromName || "Imperial IT";
        const fromEmail = effectiveSmtp.fromEmail || effectiveSmtp.user;

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          replyTo: effectiveSmtp.replyTo || fromEmail,
          to: recipient,
          subject: `Test Email from Client Registry (${effectiveSmtp.host})`,
          text: `Test email successfully sent from ${effectiveSmtp.host} to ${recipient}.`,
          html,
        });

        return NextResponse.json({
          success: true,
          message: `Test email successfully delivered to ${recipient} via ${effectiveSmtp.host}:${effectiveSmtp.port}!`,
        });
      } catch (smtpErr: any) {
        console.error("Direct SMTP test error:", smtpErr);
        let errorMsg = smtpErr?.message || "Failed to deliver test email via SMTP";
        if (smtpErr?.code === "EAUTH") {
          errorMsg = "Authentication failed: Invalid SMTP username or password. Check credentials or Google App Password.";
        } else if (smtpErr?.code === "ESOCKET" || smtpErr?.code === "ETIMEDOUT") {
          errorMsg = `Connection timed out connecting to ${effectiveSmtp.host}:${effectiveSmtp.port}. Check host, port, or firewall.`;
        }
        return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
      }
    }

    // Otherwise, dispatch using standard system sender (which checks DB SMTP and then Brevo)
    const result = await sendEmail({
      to: recipient,
      subject: "Test Email from Client Registry",
      html,
      text: "Test email successfully received from Client Registry.",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error || "Failed to deliver test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email successfully sent to ${recipient}!`,
    });
  } catch (error: any) {
    console.error("POST /api/mail-settings/test error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to send test email" },
      { status: 500 }
    );
  }
}
