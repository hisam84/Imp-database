import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// PUT /api/targeted-categories/[id] - Rename category & cascade to clients
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const newName = body.name?.trim();

    if (!newName) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.targetedCategory.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check duplicate if name changed
    if (existing.name !== newName) {
      const duplicate = await prisma.targetedCategory.findFirst({
        where: {
          name: { equals: newName },
          id: { not: params.id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `Category "${newName}" already exists` },
          { status: 400 }
        );
      }

      // Update clients with the old category name
      await prisma.targetedClient.updateMany({
        where: { category: existing.name },
        data: { category: newName },
      });
    }

    const updated = await prisma.targetedCategory.update({
      where: { id: params.id },
      data: { name: newName },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT /api/targeted-categories/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/targeted-categories/[id] - Prevent deletion if assigned to any client
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.targetedCategory.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check how many non-deleted clients have this category
    const assignedCount = await prisma.targetedClient.count({
      where: {
        category: existing.name,
        deletedAt: null,
      },
    });

    if (assignedCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category "${existing.name}" because it is currently assigned to ${assignedCount} client(s). Please reassign those clients first.`,
        },
        { status: 400 }
      );
    }

    await prisma.targetedCategory.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: `Category "${existing.name}" deleted successfully` });
  } catch (error: any) {
    console.error("DELETE /api/targeted-categories/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
