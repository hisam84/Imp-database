import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildInstitutionData } from "@/lib/institution";

import { computeStatus } from "@/lib/types";
import { loadSiteSettingsPayload } from "@/lib/siteSettingsStorage";

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

    // Load global logs to ensure institutions have real-time merged communication logs
    let globalCommLogs: any[] = [];
    try {
      const rawComm = await loadSiteSettingsPayload("recent_communication_logs");
      if (rawComm) {
        const parsed = JSON.parse(rawComm);
        if (Array.isArray(parsed.logs)) globalCommLogs = parsed.logs;
      }
    } catch {}

    let globalSmsLogs: any[] = [];
    try {
      const rawSms = await loadSiteSettingsPayload("recent_sms_logs");
      if (rawSms) {
        const parsed = JSON.parse(rawSms);
        if (Array.isArray(parsed.logs)) globalSmsLogs = parsed.logs;
      }
    } catch {}

    const commByInstId = new Map<string, any[]>();
    const commByDomain = new Map<string, any[]>();
    const commByName = new Map<string, any[]>();

    for (const log of globalCommLogs) {
      if (!log) continue;
      if (log.institutionId) {
        if (!commByInstId.has(log.institutionId)) commByInstId.set(log.institutionId, []);
        commByInstId.get(log.institutionId)!.push(log);
      }
      if (log.domain) {
        const d = String(log.domain).trim().toLowerCase();
        if (!commByDomain.has(d)) commByDomain.set(d, []);
        commByDomain.get(d)!.push(log);
      }
      if (log.institutionName) {
        const n = String(log.institutionName).trim().toLowerCase();
        if (!commByName.has(n)) commByName.set(n, []);
        commByName.get(n)!.push(log);
      }
    }

    for (const sms of globalSmsLogs) {
      if (!sms) continue;
      const mappedSms = {
        id: sms.id || `sms_${sms.timestamp}_${Math.random().toString(36).slice(2, 6)}`,
        type: "SMS",
        institutionId: sms.institutionId,
        institutionName: sms.institutionName,
        domain: sms.domain,
        recipient: sms.recipientPhone,
        recipientLabel: sms.recipientLabel || "Phone",
        subject:
          sms.milestoneDays === 0
            ? "Domain Expired SMS Alert"
            : `Domain Expiry Reminder (${sms.milestoneDays} Days)`,
        content: sms.messageText,
        status: sms.status === "SUCCESS" ? "SUCCESS" : "FAILED",
        trigger:
          sms.milestoneDays === 0
            ? "Domain Expired Alert"
            : `Expiry Alert (${sms.milestoneDays} Days)`,
        milestoneDays: sms.milestoneDays,
        error: sms.error || null,
        createdAt: sms.timestamp || new Date().toISOString(),
      };

      if (sms.institutionId) {
        if (!commByInstId.has(sms.institutionId)) commByInstId.set(sms.institutionId, []);
        commByInstId.get(sms.institutionId)!.push(mappedSms);
      }
      if (sms.domain) {
        const d = String(sms.domain).trim().toLowerCase();
        if (!commByDomain.has(d)) commByDomain.set(d, []);
        commByDomain.get(d)!.push(mappedSms);
      }
      if (sms.institutionName) {
        const n = String(sms.institutionName).trim().toLowerCase();
        if (!commByName.has(n)) commByName.set(n, []);
        commByName.get(n)!.push(mappedSms);
      }
    }

    let mapped = institutions.map((inst: any) => {
      const cf =
        inst.customFields && typeof inst.customFields === "object"
          ? (inst.customFields as any)
          : typeof inst.customFields === "string"
          ? (() => {
              try {
                return JSON.parse(inst.customFields);
              } catch {
                return {};
              }
            })()
          : {};

      const directLogs: any[] = Array.isArray(cf.communicationLogs) ? cf.communicationLogs : [];
      const logMap = new Map<string, any>();
      for (const l of directLogs) {
        if (l && l.id) logMap.set(l.id, l);
      }

      if (commByInstId.has(inst.id)) {
        for (const l of commByInstId.get(inst.id)!) {
          if (l && l.id && !logMap.has(l.id)) logMap.set(l.id, l);
        }
      }
      if (inst.domain) {
        const d = String(inst.domain).trim().toLowerCase();
        if (commByDomain.has(d)) {
          for (const l of commByDomain.get(d)!) {
            if (l && l.id && !logMap.has(l.id)) logMap.set(l.id, l);
          }
        }
      }
      if (inst.instituteName) {
        const n = String(inst.instituteName).trim().toLowerCase();
        if (commByName.has(n)) {
          for (const l of commByName.get(n)!) {
            if (l && l.id && !logMap.has(l.id)) logMap.set(l.id, l);
          }
        }
      }

      const mergedLogs = Array.from(logMap.values());
      mergedLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
        communicationLogs: mergedLogs,
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
