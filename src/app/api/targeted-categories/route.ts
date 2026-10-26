import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTargetedTables } from "@/lib/ensureTargetedTables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/targeted-categories
export async function GET() {
  try {
    await ensureTargetedTables();

    let categories: any[] = [];
    try {
      categories = await prisma.targetedCategory.findMany({
        orderBy: { name: "asc" },
      });
    } catch (catErr: any) {
      console.warn("prisma.targetedCategory.findMany error:", catErr?.message);
      categories = [];
    }

    // Count clients for each category
    const countMap: Record<string, number> = {};
    try {
      const clients = await prisma.targetedClient.findMany({
        where: { deletedAt: null },
        select: { category: true },
      });

      for (const c of clients) {
        if (c.category) {
          countMap[c.category] = (countMap[c.category] || 0) + 1;
        }
      }
    } catch (clientErr: any) {
      console.warn("Failed to get client category counts:", clientErr?.message);
    }

    const result = categories.map((cat) => ({
      ...cat,
      clientCount: countMap[cat.name] || 0,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/targeted-categories error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/targeted-categories
export async function POST(req: NextRequest) {
  try {
    await ensureTargetedTables();
    const body = await req.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check duplicate case-insensitively
    const existing = await prisma.targetedCategory.findFirst({
      where: {
        name: { equals: name },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Category "${name}" already exists` },
        { status: 400 }
      );
    }

    const created = await prisma.targetedCategory.create({
      data: { name },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/targeted-categories error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create category" },
      { status: 500 }
    );
  }
}
