import { NextRequest, NextResponse } from "next/server";
import { sendAdnSms, normalizeBdPhoneNumber } from "@/lib/adnSmsService";
import { getSmsSettings } from "@/lib/smsSettings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, message, apiKey, apiSecret, apiDomain, campaignTitle } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid recipient phone number." },
        { status: 400 }
      );
    }

    const normalized = normalizeBdPhoneNumber(phone);
    if (!normalized) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Bangladeshi mobile number: "${phone}". Please enter an 11-digit mobile number (e.g. 01712345678).`,
        },
        { status: 400 }
      );
    }

    const settings = await getSmsSettings();

    const activeApiKey = apiKey && !apiKey.includes("••••") ? apiKey.trim() : settings.apiKey;
    const activeApiSecret = apiSecret && !apiSecret.includes("••••") ? apiSecret.trim() : settings.apiSecret;
    const activeApiDomain = apiDomain && apiDomain.trim() ? apiDomain.trim() : settings.apiDomain;
    const activeCampaign = campaignTitle && campaignTitle.trim() ? campaignTitle.trim() : settings.campaignTitle;

    if (!activeApiKey || !activeApiSecret) {
      return NextResponse.json(
        { success: false, error: "ADN SMS API Key and Secret are not configured." },
        { status: 400 }
      );
    }

    const testMessage =
      message && message.trim()
        ? message.trim()
        : `[Imperial IT] এটি একটি টেস্ট এসএমএস। ADN SMS গেটওয়ে সফলভাবে কনফিগার করা হয়েছে। তারিখ: ${new Date().toLocaleDateString("en-GB")}`;

    const res = await sendAdnSms({
      to: normalized,
      message: testMessage,
      requestType: "SINGLE_SMS",
      messageType: "AUTO",
      campaignTitle: activeCampaign,
      credentials: {
        apiKey: activeApiKey,
        apiSecret: activeApiSecret,
        apiDomain: activeApiDomain,
      },
    });

    return NextResponse.json({
      ...res,
      recipient: normalized,
      testMessage,
    });
  } catch (error: any) {
    console.error("POST /api/sms/send-test error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to send test SMS" },
      { status: 500 }
    );
  }
}
