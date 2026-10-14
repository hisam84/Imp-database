import { NextResponse } from "next/server";
import {
  getSubscriptionExpirySettings,
  saveSubscriptionExpirySettings,
  DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS,
} from "@/lib/subscriptionSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSubscriptionExpirySettings();
    return NextResponse.json({
      success: true,
      settings,
      defaults: DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS,
    });
  } catch (error: any) {
    console.error("GET /api/subscription-settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to load subscription settings",
        settings: DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      monthlyDays,
      halfYearlyDays,
      yearlyDays,
      defaultDays,
      websiteDays,
      softwareDays,
      autoEmailEnabled,
      websiteExpiryEmailEnabled,
      companyExpiryEmailEnabled,
      notifyAdminOnExpiry,
      adminNotificationEmail,
    } = body;

    const parsedMonthly = Number(monthlyDays);
    const parsedHalfYearly = Number(halfYearlyDays);
    const parsedYearly = Number(yearlyDays);
    const parsedDefault = defaultDays !== undefined ? Number(defaultDays) : undefined;
    const parsedWebsite = websiteDays !== undefined ? Number(websiteDays) : undefined;
    const parsedSoftware = softwareDays !== undefined ? Number(softwareDays) : undefined;

    const payloadToSave: any = {};

    if (!isNaN(parsedMonthly) && parsedMonthly >= 0) payloadToSave.monthlyDays = parsedMonthly;
    if (!isNaN(parsedHalfYearly) && parsedHalfYearly >= 0) payloadToSave.halfYearlyDays = parsedHalfYearly;
    if (!isNaN(parsedYearly) && parsedYearly >= 0) payloadToSave.yearlyDays = parsedYearly;
    if (parsedDefault !== undefined && !isNaN(parsedDefault) && parsedDefault >= 0) payloadToSave.defaultDays = parsedDefault;

    if (parsedWebsite !== undefined && !isNaN(parsedWebsite) && parsedWebsite >= 0) payloadToSave.websiteDays = parsedWebsite;
    if (parsedSoftware !== undefined && !isNaN(parsedSoftware) && parsedSoftware >= 0) payloadToSave.softwareDays = parsedSoftware;

    if (typeof autoEmailEnabled === "boolean") payloadToSave.autoEmailEnabled = autoEmailEnabled;
    if (typeof websiteExpiryEmailEnabled === "boolean") payloadToSave.websiteExpiryEmailEnabled = websiteExpiryEmailEnabled;
    if (typeof companyExpiryEmailEnabled === "boolean") payloadToSave.companyExpiryEmailEnabled = companyExpiryEmailEnabled;
    if (typeof notifyAdminOnExpiry === "boolean") payloadToSave.notifyAdminOnExpiry = notifyAdminOnExpiry;
    if (typeof adminNotificationEmail === "string") payloadToSave.adminNotificationEmail = adminNotificationEmail.trim();

    const updated = await saveSubscriptionExpirySettings(payloadToSave);

    return NextResponse.json({
      success: true,
      message: "Subscription and website expiry settings updated successfully",
      settings: updated,
    });
  } catch (error: any) {
    console.error("PUT /api/subscription-settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update subscription settings",
      },
      { status: 500 }
    );
  }
}
