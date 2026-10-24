import { NextRequest, NextResponse } from "next/server";
import {
  getRecentSmsLogs,
  clearPersistedSmsExpiryAlerts,
} from "@/lib/smsExpiryNotificationService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await getRecentSmsLogs();
    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error("GET /api/sms/logs error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch SMS logs" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const clearLogs = searchParams.get("clearLogs") === "true";

    await clearPersistedSmsExpiryAlerts({ clearLogs });

    return NextResponse.json({
      success: true,
      message: clearLogs
        ? "SMS deduplication cache and recent logs cleared."
        : "SMS deduplication cache reset.",
    });
  } catch (error: any) {
    console.error("DELETE /api/sms/logs error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to reset SMS logs" },
      { status: 500 }
    );
  }
}
