import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const bodyData = await req.json();
    const items = Array.isArray(bodyData) ? bodyData : (Array.isArray(bodyData.clients) ? bodyData.clients : []);
    const defaultCreatedById = bodyData.createdById || null;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No client data provided." }, { status: 400 });
    }

    const recordsToCreate = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const instituteName = item.instituteName || item["Institute Name"] || item["institute_name"];

      if (!instituteName || typeof instituteName !== "string" || !instituteName.trim()) {
        continue; // Skip invalid rows without institute name
      }

      let priority = item.priority || item["Priority"] || "Default";
      if (!["High", "Default", "Low"].includes(priority)) {
        priority = "Default";
      }

      recordsToCreate.push({
        instituteName: String(instituteName).trim(),
        instituteNameBangla: item.instituteNameBangla || item["Institute Name Bangla"] || item["instituteName (Bangla)"] ? String(item.instituteNameBangla || item["Institute Name Bangla"] || item["instituteName (Bangla)"]).trim() : null,
        contactPerson: item.contactPerson || item["Contact Person"] || item["contact_person"] ? String(item.contactPerson || item["Contact Person"] || item["contact_person"]).trim() : null,
        phone: item.phone || item["Phone"] || item["Phone Number"] ? String(item.phone || item["Phone"] || item["Phone Number"]).trim() : null,
        email: item.email || item["Email"] || item["E-mail"] ? String(item.email || item["Email"] || item["E-mail"]).trim() : null,
        district: item.district || item["District"] ? String(item.district || item["District"]).trim() : null,
        subDistrict: item.subDistrict || item["Sub District"] || item["Upazila"] ? String(item.subDistrict || item["Sub District"] || item["Upazila"]).trim() : null,
        address: item.address || item["Address"] ? String(item.address || item["Address"]).trim() : null,
        category: item.category || item["Category"] || item["Software Category"] ? String(item.category || item["Category"] || item["Software Category"]).trim() : null,
        priority: priority,
        notes: item.notes || item["Notes"] || item["Remarks"] ? String(item.notes || item["Notes"] || item["Remarks"]).trim() : null,
        isArchived: false,
      });
    }

    if (recordsToCreate.length === 0) {
      return NextResponse.json({ error: "No valid client records found in uploaded file. Check 'instituteName' column." }, { status: 400 });
    }

    // Auto-register any new categories found in upload
    const uniqueCategories = Array.from(new Set(recordsToCreate.map((r) => r.category).filter(Boolean))) as string[];
    for (const catName of uniqueCategories) {
      const exists = await prisma.targetedCategory.findFirst({
        where: { name: { equals: catName } },
      });
      if (!exists) {
        try {
          await prisma.targetedCategory.create({ data: { name: catName } });
        } catch {
          // Ignore duplicate collision race condition
        }
      }
    }

    const created = await prisma.targetedClient.createMany({
      data: recordsToCreate,
    });

    return NextResponse.json({ count: created.count, message: `Successfully imported ${created.count} targeted clients.` }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/targeted-clients/bulk error:", error);
    return NextResponse.json({ error: error.message || "Failed to bulk upload targeted clients" }, { status: 500 });
  }
}
