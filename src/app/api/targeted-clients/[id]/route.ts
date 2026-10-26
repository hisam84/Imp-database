import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractNotesAndCalls, packNotesAndCalls } from "@/lib/callUpdatesStorage";
import { ensureTargetedTables } from "@/lib/ensureTargetedTables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/targeted-clients/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTargetedTables();
    const client = await prisma.targetedClient.findUnique({
      where: { id: params.id },
    });

    if (!client) {
      return NextResponse.json({ error: "Targeted client not found" }, { status: 404 });
    }
    const { userNotes, callUpdates } = extractNotesAndCalls(client.notes);
    return NextResponse.json({
      ...client,
      notes: userNotes || null,
      callUpdates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch targeted client" }, { status: 500 });
  }
}

// PUT /api/targeted-clients/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTargetedTables();
    const body = await req.json();

    const existing = await prisma.targetedClient.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Targeted client not found" }, { status: 404 });
    }

    const priority = ["High", "Default", "Low"].includes(body.priority)
      ? body.priority
      : existing.priority;

    let notesToSave = existing.notes;
    if (body.notes !== undefined) {
      const { callUpdates } = extractNotesAndCalls(existing.notes);
      notesToSave = packNotesAndCalls(body.notes?.trim() || null, callUpdates);
    }

    const updated = await (prisma as any).targetedClient.update({
      where: { id: params.id },
      data: {
        instituteName: typeof body.instituteName === "string" && body.instituteName.trim()
          ? body.instituteName.trim()
          : existing.instituteName,
        instituteNameBangla: body.instituteNameBangla !== undefined
          ? (body.instituteNameBangla?.trim() || null)
          : existing.instituteNameBangla,
        contactPerson: body.contactPerson !== undefined
          ? (body.contactPerson?.trim() || null)
          : existing.contactPerson,
        phone: body.phone !== undefined
          ? (body.phone?.trim() || null)
          : existing.phone,
        email: body.email !== undefined
          ? (body.email?.trim() || null)
          : existing.email,
        district: body.district !== undefined
          ? (body.district?.trim() || null)
          : existing.district,
        subDistrict: body.subDistrict !== undefined
          ? (body.subDistrict?.trim() || null)
          : existing.subDistrict,
        address: body.address !== undefined
          ? (body.address?.trim() || null)
          : existing.address,
        category: body.category !== undefined
          ? (body.category?.trim() || null)
          : existing.category,
        priority: priority,
        isArchived: body.isArchived !== undefined
          ? Boolean(body.isArchived)
          : existing.isArchived,
        notes: notesToSave,
      },
    });

    const { userNotes, callUpdates } = extractNotesAndCalls(updated.notes);
    return NextResponse.json({
      ...updated,
      notes: userNotes || null,
      callUpdates,
    });
  } catch (error: any) {
    console.error("PUT /api/targeted-clients/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update targeted client" }, { status: 500 });
  }
}

// DELETE /api/targeted-clients/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await (prisma as any).targetedClient.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/targeted-clients/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete targeted client" }, { status: 500 });
  }
}
