import { NextRequest, NextResponse } from "next/server";
import {
  checkAndSendExpiryAlerts,
  clearPersistedExpiryAlerts,
} from "@/lib/expiryNotificationService";
import {
  checkAndSendSmsExpiryAlerts,
  clearPersistedSmsExpiryAlerts,
} from "@/lib/smsExpiryNotificationService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isSiteAuth = req.cookies.get("site-auth")?.value === "true";

    // Allow execution if:
    // 1. Cron secret matches Bearer header (Vercel Cron)
    // 2. User is authenticated in the dashboard
    // 3. No cronSecret is configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isSiteAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const reset = searchParams.get("reset") === "true";
    const force = searchParams.get("force") === "true" || reset;

    if (reset) {
      await clearPersistedExpiryAlerts();
      await clearPersistedSmsExpiryAlerts();
    }

    // Run email alerts
    const emailResult = await checkAndSendExpiryAlerts({ force });

    // Run SMS alerts
    const smsResult = await checkAndSendSmsExpiryAlerts({ force });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      forced: force,
      emails: emailResult,
      sms: {
        checkedWebsites: smsResult.checkedWebsites,
        smsSent: smsResult.smsSent,
        smsFailed: smsResult.smsFailed,
        skippedAlreadySent: smsResult.skippedAlreadySent,
        skippedNoPhone: smsResult.skippedNoPhone,
        errors: smsResult.errors,
      },
    });
  } catch (error: any) {
    console.error("Cron expiry alert processing error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process expiry alerts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
