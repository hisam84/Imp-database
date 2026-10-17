import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCompanyTables } from "@/lib/ensureCompanyTables";
import {
  getSubscriptionExpirySettings,
  computeEffectiveSubscriptionStatus,
} from "@/lib/subscriptionSettings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureCompanyTables();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const district = searchParams.get("district")?.trim() || "";
    const softwareId = searchParams.get("softwareId")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "all";

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { companyNameBangla: { contains: search } },
        { contactPerson: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { district: { contains: search } },
      ];
    }

    if (district) {
      where.district = { equals: district };
    }

    if (softwareId) {
      where.subscriptions = {
        some: {
          softwareId: softwareId,
          deletedAt: null,
        },
      };
    }

    const companies = await (prisma as any).company.findMany({
      where,
      include: {
        subscriptions: {
          where: { deletedAt: null },
          include: {
            software: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const expirySettings = await getSubscriptionExpirySettings();
    const now = new Date();

    // Attach effectiveStatus to all subscriptions for consistent UI rendering
    companies.forEach((comp: any) => {
      (comp.subscriptions || []).forEach((sub: any) => {
        sub.effectiveStatus = computeEffectiveSubscriptionStatus(sub, expirySettings, now);
      });
    });

    let filtered = companies;

    if (status && status !== "all") {
      filtered = companies.filter((comp: any) => {
        const subs = comp.subscriptions || [];
        if (subs.length === 0) return status === "no_subscription";

        return subs.some((sub: any) => {
          const eff = sub.effectiveStatus || computeEffectiveSubscriptionStatus(sub, expirySettings, now);
          if (status === "active") return eff === "Active";
          if (status === "expiring_soon") return eff === "Expiring Soon";
          if (status === "expired") return eff === "Expired";
          if (status === "deactivated") return eff === "Deactivated" || eff === "Cancelled";
          return true;
        });
      });
    }

    return NextResponse.json(filtered);
  } catch (error: any) {
    console.error("GET /api/companies error:", error);
    // Return empty array on initial table creation gracefully
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    await ensureCompanyTables();

    const body = await req.json();
    const {
      companyName,
      companyNameBangla,
      contactPerson,
      designation,
      phone,
      email,
      address,
      district,
      subDistrict,
      website,
      notes,
      subscriptions,
    } = body;

    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ error: "Company Name is required" }, { status: 400 });
    }

    const createdCompany = await (prisma as any).company.create({
      data: {
        companyName: companyName.trim(),
        companyNameBangla: companyNameBangla?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        designation: designation?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        district: district?.trim() || null,
        subDistrict: subDistrict?.trim() || null,
        website: website?.trim() || null,
        notes: notes?.trim() || null,
        subscriptions: subscriptions && Array.isArray(subscriptions) && subscriptions.length > 0
          ? {
              create: subscriptions.map((sub: any) => ({
                softwareId: sub.softwareId,
                billingCycle: sub.billingCycle || "Yearly",
                price: sub.price ? parseFloat(sub.price) : null,
                status: sub.status || "Active",
                startDate: sub.startDate ? new Date(sub.startDate) : null,
                expireDate: sub.expireDate ? new Date(sub.expireDate) : null,
                actualExpireDate: sub.actualExpireDate ? new Date(sub.actualExpireDate) : null,
                notes: sub.notes?.trim() || null,
              })),
            }
          : undefined,
      },
      include: {
        subscriptions: {
          include: {
            software: true,
          },
        },
      },
    });

    return NextResponse.json(createdCompany, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/companies error:", error);
    return NextResponse.json({ error: error.message || "Failed to create company" }, { status: 500 });
  }
}
