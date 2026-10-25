import { NextResponse } from "next/server";
import {
  sendEmail,
  buildOptimizedEmailHtml,
  buildOptimizedEmailText,
  getAppBaseUrl,
  getDisplayHost,
} from "@/lib/mailer";
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

    const appBaseUrl = await getAppBaseUrl();
    const displayHost = getDisplayHost(appBaseUrl);

    const testOptions = {
      title: "SMTP Mailer Connectivity Test",
      preheader: "Outgoing mail server connection verified successfully.",
      badgeLabel: "SMTP Verified",
      badgeVariant: "emerald" as const,
      heading: "SMTP Mail Server Test Success",
      recipientName: "System Administrator",
      leadHtml: "This automated test email confirms that your outgoing mail server configuration is fully operational and deliverability-optimized.",
      leadTextPlain: "This test email confirms that your outgoing mail server configuration is fully operational.",
      callout: {
        title: "Connection Status: Verified",
        text: `Successfully connected and dispatched via ${effectiveSmtp.isEnabled && effectiveSmtp.host ? effectiveSmtp.host : "Brevo SMTP Relay"}.`,
        variant: "emerald" as const,
      },
      keyValues: [
        { label: "Delivery Status", value: "Connected & Verified", isBadge: true, badgeVariant: "emerald" as const },
        { label: "SMTP Host", value: effectiveSmtp.isEnabled && effectiveSmtp.host ? effectiveSmtp.host : "Brevo Relay (smtp-relay.brevo.com)" },
        { label: "Port", value: String(effectiveSmtp.isEnabled && effectiveSmtp.port ? effectiveSmtp.port : 587) },
        { label: "Sender", value: effectiveSmtp.fromEmail || effectiveSmtp.user || "imperialitbd2011@gmail.com" },
        { label: "Timestamp", value: `${formatDhakaDateTime(new Date())} (BST / Dhaka)` },
      ],
      noteHtml: "Your mail server is configured to deliver task assignments, 2-hour deadline reminders, monthly recurring notices, expiry alerts, and password reset OTPs.",
      noteTextPlain: "Your mail server is configured to deliver task assignments, 2-hour deadline reminders, monthly recurring notices, expiry alerts, and password reset OTPs.",
      cta: {
        label: "Open Mail Settings",
        url: `${appBaseUrl}/mail-settings`,
      },
      appBaseUrl,
      displayHost,
    };

    const html = buildOptimizedEmailHtml(testOptions);
    const text = buildOptimizedEmailText(testOptions);

    // If explicit form SMTP is provided with host and user, test directly through it
    if (effectiveSmtp.host && effectiveSmtp.user && effectiveSmtp.pass) {
      try {
        const transporter = createSmtpTransporter(effectiveSmtp);
        const fromName = effectiveSmtp.fromName || "Imperial IT";
        const fromEmail = effectiveSmtp.fromEmail || effectiveSmtp.user;
        const domain = fromEmail.includes("@") ? fromEmail.split("@")[1] : "imperialitbd.com";
        const uniqueId = `${Date.now()}.${Math.random().toString(36).substring(2, 10)}`;
        const messageId = `<${uniqueId}@${domain}>`;

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          replyTo: effectiveSmtp.replyTo || fromEmail,
          to: recipient,
          subject: `Test Email: Outbound SMTP Verified (${effectiveSmtp.host})`,
          text,
          html,
          headers: {
            "Message-ID": messageId,
            "Date": new Date().toUTCString(),
            "MIME-Version": "1.0",
            "X-Mailer": "Imperial-IT-Mailer/2.0",
            "Auto-Submitted": "auto-generated",
            "X-Auto-Response-Suppress": "All, OOF, AutoReply",
            "Precedence": "bulk",
            "List-Unsubscribe": `<mailto:${fromEmail}?subject=unsubscribe>`,
          },
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
      subject: "Test Email: Outbound Mailer Verified",
      html,
      text,
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
