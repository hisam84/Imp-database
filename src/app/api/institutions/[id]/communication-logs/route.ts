import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getInstitutionCommunicationLogs,
  logInstitutionCommunication,
} from "@/lib/communicationLogsService";

export const dynamic = "force-dynamic";

// GET /api/institutions/[id]/communication-logs - List all communication logs for an institution
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const institutionId = params.id;
    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const institution = await (prisma as any).institution.findUnique({
      where: { id: institutionId },
      select: { id: true, instituteName: true, domain: true },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const logs = await getInstitutionCommunicationLogs(institutionId);

    const emailCount = logs.filter((l) => l.type === "EMAIL").length;
    const smsCount = logs.filter((l) => l.type === "SMS").length;

    return NextResponse.json({
      success: true,
      institution: {
        id: institution.id,
        instituteName: institution.instituteName,
        domain: institution.domain,
      },
      counts: {
        total: logs.length,
        email: emailCount,
        sms: smsCount,
      },
      logs,
    });
  } catch (error: any) {
    console.error("GET /api/institutions/[id]/communication-logs error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch communication logs" },
      { status: 500 }
    );
  }
}

// POST /api/institutions/[id]/communication-logs - Add a manual communication log entry
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const institutionId = params.id;
    const body = await req.json();
    const { type, recipient, recipientName, recipientLabel, subject, content, status, trigger } = body;

    if (!type || (type !== "EMAIL" && type !== "SMS")) {
      return NextResponse.json({ error: "Valid type (EMAIL or SMS) is required" }, { status: 400 });
    }

    if (!recipient || !recipient.trim()) {
      return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const institution = await (prisma as any).institution.findUnique({
      where: { id: institutionId },
      select: { id: true, instituteName: true, domain: true },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const log = await logInstitutionCommunication({
      type,
      institutionId,
      institutionName: institution.instituteName,
      domain: institution.domain,
      recipient: recipient.trim(),
      recipientName: recipientName?.trim() || null,
      recipientLabel: recipientLabel?.trim() || (type === "SMS" ? "Phone" : "Email"),
      subject: subject?.trim() || (type === "SMS" ? "SMS Communication" : "Email Communication"),
      content: content.trim(),
      status: status === "FAILED" ? "FAILED" : "SUCCESS",
      trigger: trigger?.trim() || "Manual Entry",
    });

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error: any) {
    console.error("POST /api/institutions/[id]/communication-logs error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add communication log" },
      { status: 500 }
    );
  }
}
