import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SmsLogEntry,
  getRecentSmsLogs,
} from "@/lib/smsExpiryNotificationService";
import { saveSiteSettingsPayload } from "@/lib/siteSettingsStorage";

export const dynamic = "force-dynamic";

const RECENT_SMS_LOGS_KEY = "recent_sms_logs";
const MAX_LOG_ENTRIES = 200;

/**
 * ADN SMS PULL API (Callback Webhook Endpoint)
 *
 * Receives incoming SMS replies forwarded by ADN SMS Gateway:
 * POST /api/sms/callback
 * Body payload sample:
 * {
 *   "sms": [
 *     {
 *       "campaign_id": "IC34567449776",
 *       "To": "8801969900365",
 *       "From": "8801755881139",
 *       "message": "Ok, thanks"
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);

    if (!rawBody) {
      return NextResponse.json(
        { success: false, error: "Empty or invalid JSON body" },
        { status: 400 }
      );
    }

    // ADN SMS provides incoming array in rawBody.sms or direct array
    const incomingList: any[] = Array.isArray(rawBody.sms)
      ? rawBody.sms
      : Array.isArray(rawBody)
      ? rawBody
      : [rawBody];

    const newLogs: SmsLogEntry[] = [];

    for (const item of incomingList) {
      const fromPhone = item.From || item.from || item.mobile || "";
      const toPhone = item.To || item.to || "";
      const messageText = item.message || item.text || item.message_body || "";
      const campaignId = item.campaign_id || item.campaignId || "";

      if (!fromPhone && !messageText) continue;

      // Clean sender phone
      const cleanPhone = String(fromPhone).replace(/[^0-9]/g, "");

      // Try to find matching institution by phone
      let matchedInstitution: any = null;
      if (cleanPhone) {
        const last10 = cleanPhone.slice(-10);
        matchedInstitution = await prisma.institution.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { contact1: { contains: last10 } },
              { contact2: { contains: last10 } },
              { inChargeTeacherContact: { contains: last10 } },
              { btclMobileNo: { contains: last10 } },
            ],
          },
          select: { id: true, instituteName: true, domain: true },
        });
      }

      const logItem: SmsLogEntry = {
        id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        institutionId: matchedInstitution?.id,
        institutionName: matchedInstitution?.instituteName || "Incoming Reply",
        domain: matchedInstitution?.domain || null,
        recipientPhone: cleanPhone,
        recipientLabel: `To: ${toPhone || "Imperial IT"}`,
        milestoneDays: 0,
        daysRemaining: 0,
        messageText: messageText,
        status: "INCOMING" as any,
        smsUid: campaignId || null,
        apiResponseCode: 200,
        apiResponseMessage: "INCOMING_REPLY",
        error: null,
      };

      newLogs.push(logItem);
    }

    if (newLogs.length > 0) {
      const existing = await getRecentSmsLogs();
      const combined = [...newLogs, ...existing].slice(0, MAX_LOG_ENTRIES);
      await saveSiteSettingsPayload(
        RECENT_SMS_LOGS_KEY,
        JSON.stringify({ logs: combined, updatedAt: new Date().toISOString() }),
        "recent_sms_logs"
      );
    }

    return NextResponse.json({
      success: true,
      received: newLogs.length,
      message: "Incoming SMS callback received successfully",
    });
  } catch (error: any) {
    console.error("POST /api/sms/callback error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process callback" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/sms/callback",
    description: "ADN SMS PULL API Callback Webhook Receiver",
  });
}
