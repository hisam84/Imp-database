import { NextRequest, NextResponse } from "next/server";
import {
  checkAndSendSmsExpiryAlerts,
  clearPersistedSmsExpiryAlerts,
} from "@/lib/smsExpiryNotificationService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const siteAuthVal = req.cookies.get("site-auth")?.value;
    const isSiteAuth = !!siteAuthVal && siteAuthVal !== "false";

    // Allow execution if:
    // 1. Cron secret matches Bearer header
    // 2. User is authenticated in the dashboard
    // 3. No cronSecret is configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isSiteAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const reset = searchParams.get("reset") === "true";
    const force = searchParams.get("force") === "true" || reset;

    if (reset) {
      await clearPersistedSmsExpiryAlerts();
    }

    const result = await checkAndSendSmsExpiryAlerts({ force });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      forced: force,
      ...result,
    });
  } catch (error: any) {
    console.error("Cron SMS expiry alert processing error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process SMS expiry alerts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
