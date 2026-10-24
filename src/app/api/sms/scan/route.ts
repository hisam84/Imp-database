import { NextRequest, NextResponse } from "next/server";
import {
  checkAndSendSmsExpiryAlerts,
  clearPersistedSmsExpiryAlerts,
} from "@/lib/smsExpiryNotificationService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const reset = searchParams.get("reset") === "true";
    const force = searchParams.get("force") === "true" || reset || true; // Manual scan always forces

    if (reset) {
      await clearPersistedSmsExpiryAlerts();
    }

    const result = await checkAndSendSmsExpiryAlerts({ force });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      forced: force,
      checkedWebsites: result.checkedWebsites,
      smsSent: result.smsSent,
      smsFailed: result.smsFailed,
      skippedAlreadySent: result.skippedAlreadySent,
      skippedNoPhone: result.skippedNoPhone,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("Manual SMS expiry alert scan error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to execute manual SMS expiry scan",
        errors: [error?.message || "Internal server error"],
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
