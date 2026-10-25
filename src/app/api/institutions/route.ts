import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildInstitutionData } from "@/lib/institution";

import { computeStatus } from "@/lib/types";

// GET /api/institutions?search=&type=&category=&subDistrict=&district=&status=
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const search = params.get("search")?.trim();
    const type = params.get("type")?.trim();
    const category = params.get("category")?.trim();
    const subDistrict = params.get("subDistrict")?.trim();
    const district = params.get("district")?.trim();
    const status = params.get("status")?.trim(); // active | expiring_soon | expired | actual_expired | deactivated

    const where: any = { AND: [{ deletedAt: null }] };
    const and = where.AND as any[];

    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      for (const term of searchTerms) {
        and.push({
          OR: [
            { instituteName: { contains: term } },
            { instituteNameBangla: { contains: term } },
            { domain: { contains: term } },
            { instituteHead: { contains: term } },
            { contact1: { contains: term } },
            { contact2: { contains: term } },
            { inChargeTeacher: { contains: term } },
            { inChargeTeacherContact: { contains: term } },
            { subDistrict: { contains: term } },
            { district: { contains: term } },
            { address: { contains: term } },
            { btclUsername: { contains: term } },
            { btclMobileNo: { contains: term } },
            { btclEmail: { contains: term } },
          ],
        });
      }
    }

    if (type) {
      and.push({ instituteType: type });
    }

    if (category) {
      and.push({ category: category });
    }

    if (subDistrict) {
      const normalizedSub = subDistrict.replace(/\s+/g, " ").trim();
      and.push({
        OR: [
          { subDistrict: { equals: subDistrict } },
          { subDistrict: { equals: normalizedSub } },
          { subDistrict: { contains: normalizedSub } },
        ],
      });
    }

    if (district) {
      const normalizedDistrict = district.trim();
      and.push({
        OR: [
          { district: { equals: district } },
          { district: { equals: normalizedDistrict } },
          { district: { contains: normalizedDistrict } },
        ],
      });
    }

    let institutions = await prisma.institution.findMany({
      where,
      orderBy: { instituteName: "asc" },
    });

    let mapped = institutions.map((inst: any) => {
      const cf = (inst.customFields as any) || {};
      return {
        ...inst,
        inChargeTeacher2:
          cf.inChargeTeacher2 ||
          cf.cf_in_charge_2 ||
          cf.in_charge_2 ||
          cf["IN CHARGE 2"] ||
          null,
        inChargeTeacher2Contact:
          cf.inChargeTeacher2Contact ||
          cf.cf_in_charge_2_contact ||
          cf.in_charge_2_contact ||
          cf["IN CHARGE 2 CONTACT"] ||
          null,
        googleMapsUrl: cf.googleMapsUrl || null,
        communicationLogs: Array.isArray(cf.communicationLogs) ? cf.communicationLogs : [],
      };
    });

    if (status) {
      mapped = mapped.filter((inst: any) => {
        const isDeactivated = Boolean(
          (inst.customFields as any)?.isDeactivated === true ||
          (inst.customFields as any)?.isDeactivated === "true"
        );
        const computed = computeStatus(inst.expireDate, inst.actualExpireDate, 60, isDeactivated);
        return computed === status;
      });
    }

    const TYPE_PRIORITY: Record<string, number> = {
      University: 1,
      College: 2,
      Polytechnic: 3,
      School: 4,
      Madrasah: 5,
      Kindergarten: 6,
      Other: 7,
    };

    mapped.sort((a: any, b: any) => {
      const pA = TYPE_PRIORITY[a.instituteType] || 99;
      const pB = TYPE_PRIORITY[b.instituteType] || 99;
      if (pA !== pB) return pA - pB;
      return a.instituteName.localeCompare(b.instituteName);
    });

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error("GET /api/institutions error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch institutions" },
      { status: 500 }
    );
  }
}

// POST /api/institutions
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.instituteName || typeof body.instituteName !== "string") {
    return NextResponse.json({ error: "Institute name is required." }, { status: 400 });
  }

  const data = buildInstitutionData(body);

  const created = await prisma.institution.create({ data });
  return NextResponse.json(created, { status: 201 });
}
