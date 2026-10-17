import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { name, code, category, description, defaultPrice, status } = body;

    const existing = await (prisma as any).software.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Software product not found" }, { status: 404 });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await (prisma as any).software.findFirst({
        where: {
          name: { equals: name.trim() },
          id: { not: params.id },
          deletedAt: null,
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Another software product with this name already exists" }, { status: 400 });
      }
    }

    const updated = await (prisma as any).software.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : existing.name,
        code: code !== undefined ? (code ? code.trim() : null) : existing.code,
        category: category !== undefined ? category : existing.category,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        defaultPrice: defaultPrice !== undefined ? (defaultPrice ? parseFloat(defaultPrice) : null) : existing.defaultPrice,
        status: status !== undefined ? status : existing.status,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT /api/softwares/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update software product" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const existing = await (prisma as any).software.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Software product not found" }, { status: 404 });
    }

    await (prisma as any).software.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/softwares/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete software product" }, { status: 500 });
  }
}
