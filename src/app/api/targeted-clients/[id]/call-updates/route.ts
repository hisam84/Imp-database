import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CallUpdate } from "@/lib/types";
import { extractNotesAndCalls, packNotesAndCalls } from "@/lib/callUpdatesStorage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/targeted-clients/[id]/call-updates
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await prisma.targetedClient.findUnique({
      where: { id: params.id },
      select: { id: true, notes: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Targeted client not found" }, { status: 404 });
    }

    const { callUpdates } = extractNotesAndCalls(client.notes);
    return NextResponse.json({ callUpdates });
  } catch (error: any) {
    console.error("GET /api/targeted-clients/[id]/call-updates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch call updates" },
      { status: 500 }
    );
  }
}

// POST /api/targeted-clients/[id]/call-updates
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { employeeId, employeeName, subject, details } = body;

    if (!employeeName || !employeeName.trim()) {
      return NextResponse.json(
        { error: "Employee selection is required" },
        { status: 400 }
      );
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json(
        { error: "Call subject is required" },
        { status: 400 }
      );
    }

    if (!details || !details.trim()) {
      return NextResponse.json(
        { error: "Call description/notes are required" },
        { status: 400 }
      );
    }

    const client = await prisma.targetedClient.findUnique({
      where: { id: params.id },
    });

    if (!client) {
      return NextResponse.json({ error: "Targeted client not found" }, { status: 404 });
    }

    const { userNotes, callUpdates: existingCalls } = extractNotesAndCalls(client.notes);

    const newCallUpdate: CallUpdate = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      employeeId: employeeId || null,
      employeeName: employeeName.trim(),
      subject: subject.trim(),
      details: details.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedCalls = [newCallUpdate, ...existingCalls];
    const packed = packNotesAndCalls(userNotes, updatedCalls);

    const updated = await prisma.targetedClient.update({
      where: { id: params.id },
      data: {
        notes: packed,
      },
    });

    return NextResponse.json({
      success: true,
      callUpdate: newCallUpdate,
      callUpdates: updatedCalls,
      client: {
        ...updated,
        notes: userNotes || null,
        callUpdates: updatedCalls,
      },
    });
  } catch (error: any) {
    console.error("POST /api/targeted-clients/[id]/call-updates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save call update" },
      { status: 500 }
    );
  }
}
