import { NextRequest, NextResponse } from "next/server";
import { checkAdnBalance } from "@/lib/adnSmsService";
import { getSmsSettings } from "@/lib/smsSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSmsSettings();

    if (!settings.apiKey || !settings.apiSecret) {
      return NextResponse.json({
        success: false,
        error: "ADN SMS API Key and Secret are not configured yet in SMS Settings.",
      });
    }

    const res = await checkAdnBalance({
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
      apiDomain: settings.apiDomain,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("GET /api/sms/balance error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to check ADN SMS balance" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings = await getSmsSettings();

    // Use passed credentials if provided (for testing draft settings before save), otherwise saved
    const apiKey = body.apiKey && !body.apiKey.includes("••••") ? body.apiKey.trim() : settings.apiKey;
    const apiSecret = body.apiSecret && !body.apiSecret.includes("••••") ? body.apiSecret.trim() : settings.apiSecret;
    const apiDomain = body.apiDomain && body.apiDomain.trim() ? body.apiDomain.trim() : settings.apiDomain;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({
        success: false,
        error: "Please enter both API Key and API Secret to check balance.",
      });
    }

    const res = await checkAdnBalance({
      apiKey,
      apiSecret,
      apiDomain,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("POST /api/sms/balance error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to check ADN SMS balance" },
      { status: 500 }
    );
  }
}
