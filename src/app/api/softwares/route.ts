import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCompanyTables } from "@/lib/ensureCompanyTables";

const DEFAULT_SOFTWARES = [
  { name: "School Management System", code: "SMS", category: "Web App", defaultPrice: 15000, description: "Complete school management & student portal" },
  { name: "College Management System", code: "CMS", category: "Web App", defaultPrice: 25000, description: "College admin, attendance & billing software" },
  { name: "Meal Manager Software", code: "MMS", category: "Web App", defaultPrice: 8000, description: "Mess & meal calculation system" },
  { name: "POS & Inventory Software", code: "POS", category: "Desktop App", defaultPrice: 12000, description: "Retail POS, barcode scanner & stock manager" },
  { name: "HRM & Payroll System", code: "HRM", category: "Web App", defaultPrice: 20000, description: "Employee attendance, salary & leave management" },
  { name: "Custom ERP Solution", code: "ERP", category: "SaaS", defaultPrice: 50000, description: "Tailored enterprise resource planning software" },
];

export async function GET() {
  try {
    await ensureCompanyTables();

    let softwares = await (prisma as any).software.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!softwares || softwares.length === 0) {
      for (const s of DEFAULT_SOFTWARES) {
        await (prisma as any).software.upsert({
          where: { name: s.name },
          update: {},
          create: s,
        });
      }
      softwares = await (prisma as any).software.findMany({
        where: { deletedAt: null },
        include: {
          _count: {
            select: { subscriptions: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(softwares);
  } catch (error: any) {
    console.error("GET /api/softwares error:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    await ensureCompanyTables();

    const body = await req.json();
    const { name, code, category, description, defaultPrice, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Software name is required" }, { status: 400 });
    }

    const existing = await (prisma as any).software.findFirst({
      where: {
        name: { equals: name.trim() },
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A software product with this name already exists" }, { status: 400 });
    }

    const created = await (prisma as any).software.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        category: category || "Web App",
        description: description?.trim() || null,
        defaultPrice: defaultPrice ? parseFloat(defaultPrice) : null,
        status: status || "Active",
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/softwares error:", error);
    return NextResponse.json({ error: error.message || "Failed to create software product" }, { status: 500 });
  }
}
