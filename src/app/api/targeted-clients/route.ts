import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractNotesAndCalls } from "@/lib/callUpdatesStorage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/targeted-clients?search=&priority=&category=&district=&subDistrict=&status=
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const search = params.get("search")?.trim();
    const priority = params.get("priority");
    const category = params.get("category");
    const district = params.get("district");
    const subDistrict = params.get("subDistrict");
    const status = params.get("status"); // "active" | "archived" | "all"

    const and: any[] = [{ deletedAt: null }];

    if (search) {
      and.push({
        OR: [
          { instituteName: { contains: search } },
          { instituteNameBangla: { contains: search } },
          { contactPerson: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          { district: { contains: search } },
          { subDistrict: { contains: search } },
          { address: { contains: search } },
          { category: { contains: search } },
        ],
      });
    }

    if (priority && priority !== "all") {
      and.push({ priority });
    }

    if (category && category !== "all") {
      and.push({ category: { equals: category } });
    }

    if (district) {
      and.push({ district: { equals: district } });
    }

    if (subDistrict) {
      and.push({ subDistrict: { equals: subDistrict } });
    }

    if (status === "archived") {
      and.push({ isArchived: true });
    } else if (status === "active" || !status) {
      // Matches both false and null (ensures legacy/unmigrated records show)
      and.push({
        OR: [
          { isArchived: false },
          { isArchived: null },
        ],
      });
    }
    // if status === "all", don't filter by isArchived

    const where: any = { AND: and };

    let clients: any[] = [];
    try {
      clients = await prisma.targetedClient.findMany({
        where,
        orderBy: [
          { isArchived: "asc" },
          { createdAt: "desc" },
        ],
      });
    } catch (primaryErr: any) {
      console.warn("targetedClient.findMany with AND where failed, trying without deletedAt filter:", primaryErr?.message);
      try {
        const fallbackAnd = and.filter((item) => !item.deletedAt);
        clients = await prisma.targetedClient.findMany({
          where: fallbackAnd.length > 0 ? { AND: fallbackAnd } : {},
          orderBy: [
            { isArchived: "asc" },
            { createdAt: "desc" },
          ],
        });
      } catch (secErr: any) {
        console.warn("targetedClient.findMany fallback failed, fetching without filters:", secErr?.message);
        try {
          clients = await prisma.targetedClient.findMany({
            orderBy: { createdAt: "desc" },
          });
        } catch (minErr: any) {
          console.error("targetedClient.findMany minimal query failed:", minErr?.message);
          clients = [];
        }
      }
    }

    const PRIORITY_ORDER: Record<string, number> = {
      High: 1,
      Default: 2,
      Low: 3,
    };

    clients.sort((a: any, b: any) => {
      const isArchivedA = Boolean(a.isArchived);
      const isArchivedB = Boolean(b.isArchived);
      if (isArchivedA !== isArchivedB) {
        return isArchivedA ? 1 : -1;
      }
      const pA = PRIORITY_ORDER[a.priority] || 99;
      const pB = PRIORITY_ORDER[b.priority] || 99;
      if (pA !== pB) return pA - pB;
      return (a.instituteName || "").localeCompare(b.instituteName || "");
    });

    const mapped = clients.map((c) => {
      const { userNotes, callUpdates } = extractNotesAndCalls(c.notes);
      return {
        ...c,
        notes: userNotes || null,
        callUpdates,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("GET /api/targeted-clients error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch targeted clients" }, { status: 500 });
  }
}

// POST /api/targeted-clients
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.instituteName || typeof body.instituteName !== "string" || !body.instituteName.trim()) {
      return NextResponse.json({ error: "Institute name is required." }, { status: 400 });
    }

    const priority = ["High", "Default", "Low"].includes(body.priority) ? body.priority : "Default";

    const created = await prisma.targetedClient.create({
      data: {
        instituteName: body.instituteName.trim(),
        instituteNameBangla: body.instituteNameBangla?.trim() || null,
        contactPerson: body.contactPerson?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        district: body.district?.trim() || null,
        subDistrict: body.subDistrict?.trim() || null,
        address: body.address?.trim() || null,
        category: body.category?.trim() || null,
        priority: priority,
        isArchived: Boolean(body.isArchived),
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/targeted-clients error:", error);
    return NextResponse.json({ error: error.message || "Failed to create targeted client" }, { status: 500 });
  }
}
