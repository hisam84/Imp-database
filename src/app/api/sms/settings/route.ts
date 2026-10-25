import { NextRequest, NextResponse } from "next/server";
import {
  getSmsSettings,
  saveSmsSettings,
  DEFAULT_SMS_SETTINGS,
  DEFAULT_SMS_TEMPLATE,
  DEFAULT_EXPIRED_SMS_TEMPLATE,
  SmsSettings,
} from "@/lib/smsSettings";
import { getServerOutboundIp } from "@/lib/adnSmsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSmsSettings();
    const serverPublicIp = await getServerOutboundIp().catch(() => null);

    // Mask secret for UI safety
    const maskedSecret = settings.apiSecret
      ? settings.apiSecret.length > 6
        ? `${settings.apiSecret.slice(0, 3)}••••••••${settings.apiSecret.slice(-3)}`
        : "••••••••"
      : "";

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        apiSecret: maskedSecret,
        hasApiSecret: Boolean(settings.apiSecret),
      },
      serverPublicIp,
      defaults: DEFAULT_SMS_SETTINGS,
      defaultTemplate: DEFAULT_SMS_TEMPLATE,
      defaultExpiredTemplate: DEFAULT_EXPIRED_SMS_TEMPLATE,
    });
  } catch (error: any) {
    console.error("GET /api/sms/settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to load SMS settings",
        settings: DEFAULT_SMS_SETTINGS,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await getSmsSettings();

    const payloadToSave: Partial<SmsSettings> = {};

    if (typeof body.enabled === "boolean") payloadToSave.enabled = body.enabled;
    if (typeof body.apiKey === "string") payloadToSave.apiKey = body.apiKey.trim();

    // Only update apiSecret if user provided a new non-masked value
    if (typeof body.apiSecret === "string") {
      const trimmed = body.apiSecret.trim();
      if (trimmed && !trimmed.includes("••••")) {
        payloadToSave.apiSecret = trimmed;
      }
    }

    if (typeof body.apiDomain === "string" && body.apiDomain.trim()) {
      payloadToSave.apiDomain = body.apiDomain.trim();
    }

    if (typeof body.senderId === "string") {
      payloadToSave.senderId = body.senderId.trim();
      payloadToSave.campaignTitle = body.senderId.trim();
    } else if (typeof body.campaignTitle === "string") {
      payloadToSave.senderId = body.campaignTitle.trim();
      payloadToSave.campaignTitle = body.campaignTitle.trim();
    }

    if (Array.isArray(body.expiryDaysMilestones)) {
      payloadToSave.expiryDaysMilestones = body.expiryDaysMilestones
        .map((m: any) => Number(m))
        .filter((m: number) => !isNaN(m) && m > 0)
        .sort((a: number, b: number) => b - a);
    }

    if (body.recipientTargets && typeof body.recipientTargets === "object") {
      payloadToSave.recipientTargets = {
        contact1: Boolean(body.recipientTargets.contact1),
        contact2: Boolean(body.recipientTargets.contact2),
        inChargeTeacher: Boolean(body.recipientTargets.inChargeTeacher),
        btclMobile: Boolean(body.recipientTargets.btclMobile),
      };
    }

    if (body.sendMode === "all_selected" || body.sendMode === "first_available") {
      payloadToSave.sendMode = body.sendMode;
    }

    if (typeof body.template === "string" && body.template.trim()) {
      payloadToSave.template = body.template;
    }

    if (typeof body.expiredTemplate === "string" && body.expiredTemplate.trim()) {
      payloadToSave.expiredTemplate = body.expiredTemplate;
    }

    if (typeof body.sendExpiredAlerts === "boolean") {
      payloadToSave.sendExpiredAlerts = body.sendExpiredAlerts;
    }

    if (typeof body.companyPhone === "string") {
      payloadToSave.companyPhone = body.companyPhone.trim();
    }

    if (typeof body.companyName === "string") {
      payloadToSave.companyName = body.companyName.trim();
    }

    if (typeof body.adminCopyPhone === "string") {
      payloadToSave.adminCopyPhone = body.adminCopyPhone.trim();
    }

    if (["AUTO", "TEXT", "UNICODE"].includes(body.messageType)) {
      payloadToSave.messageType = body.messageType;
    }

    const updated = await saveSmsSettings(payloadToSave);

    const maskedSecret = updated.apiSecret
      ? updated.apiSecret.length > 6
        ? `${updated.apiSecret.slice(0, 3)}••••••••${updated.apiSecret.slice(-3)}`
        : "••••••••"
      : "";

    return NextResponse.json({
      success: true,
      message: "SMS settings saved successfully",
      settings: {
        ...updated,
        apiSecret: maskedSecret,
        hasApiSecret: Boolean(updated.apiSecret),
      },
    });
  } catch (error: any) {
    console.error("PUT /api/sms/settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update SMS settings",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
