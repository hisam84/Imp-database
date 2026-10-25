import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInstitutionData } from "@/lib/institution";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const institution = await prisma.institution.findUnique({ where: { id: params.id } });
  if (!institution) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cf = (institution.customFields as any) || {};
  return NextResponse.json({
    ...institution,
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
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();

  // If toggling deactivated state
  if (body.toggleDeactivate !== undefined || body.isDeactivated !== undefined) {
    try {
      const existing = await prisma.institution.findUnique({ where: { id: params.id } });
      if (!existing) return NextResponse.json({ error: "Institution not found." }, { status: 404 });
      const currentCustom = (existing.customFields && typeof existing.customFields === "object") ? (existing.customFields as any) : {};
      const nextDeactivated = body.isDeactivated !== undefined ? Boolean(body.isDeactivated) : !Boolean(currentCustom.isDeactivated);
      const updated = await prisma.institution.update({
        where: { id: params.id },
        data: {
          customFields: {
            ...currentCustom,
            isDeactivated: nextDeactivated,
          },
        },
      });
      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Failed to update institution status" }, { status: 500 });
    }
  }

  // If restoring soft deleted institution
  if (body.restore === true) {
    try {
      const restored = await (prisma as any).institution.update({
        where: { id: params.id },
        data: { deletedAt: null },
      });
      return NextResponse.json(restored);
    } catch (err) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 });
    }
  }

  if (!body.instituteName || typeof body.instituteName !== "string") {
    return NextResponse.json({ error: "Institute name is required." }, { status: 400 });
  }

  try {
    const data = buildInstitutionData(body);
    const updated = await prisma.institution.update({ where: { id: params.id }, data });
    const cf = (updated.customFields as any) || {};
    return NextResponse.json({
      ...updated,
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
    });
  } catch (err) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const isPermanent = req.nextUrl.searchParams.get("permanent") === "true";

  try {
    if (isPermanent) {
      await prisma.institution.delete({ where: { id: params.id } });
    } else {
      // Soft delete: move to Trash Bin for 30 days
      await (prisma as any).institution.update({
        where: { id: params.id },
        data: { deletedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 });
  }
}
