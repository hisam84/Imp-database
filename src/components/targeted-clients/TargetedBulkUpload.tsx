"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button, Modal } from "@/components/ui";
import { useUserSession } from "@/lib/userSession";

const targetedTemplateHeaders = [
  "instituteName",
  "instituteNameBangla",
  "priority",
  "contactPerson",
  "phone",
  "email",
  "district",
  "subDistrict",
  "address",
  "notes",
];

export function TargetedBulkUpload({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentUser } = useUserSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      targetedTemplateHeaders,
      [
        "Dhaka Ideal Academy",
        "Dhaka Ideal Academy (Bengali Name)",
        "High",
        "Mr. Headmaster",
        "01711000000",
        "info@ideal.edu.bd",
        "Dhaka",
        "Mirpur",
        "Block D, Mirpur 10",
        "Requires website demo next week",
      ],
    ]);

    ws["!cols"] = targetedTemplateHeaders.map(() => ({ wch: 22 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Targeted_Clients_Template");
    XLSX.writeFile(wb, "Targeted_Clients_Bulk_Upload_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (data.length === 0) {
          throw new Error("The uploaded file is empty.");
        }

        const res = await fetch("/api/targeted-clients/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clients: data,
            createdById: currentUser.id,
          }),
        });

        const resData = await res.json();

        if (!res.ok) {
          throw new Error(resData.error || "Failed to upload targeted clients.");
        }

        setSuccessMsg(`Successfully imported ${resData.count} targeted clients!`);

        setTimeout(() => {
          onSaved();
        }, 1500);
      } catch (err: any) {
        setError(err.message || "An error occurred while parsing the file.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      setError("Failed to read the file.");
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <Modal title="Bulk Upload Targeted Clients" onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="text-slate-300 text-sm">
          <p className="mb-2">Upload multiple targeted clients at once using an Excel (.xlsx) file.</p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-400">
            <li>Download the essential template file.</li>
            <li>Fill in client details (Priority should be: High, Default, or Low).</li>
            <li>Do not change column names in the first row.</li>
            <li>Upload the completed file below.</li>
          </ol>
        </div>

        {error && (
          <div className="rounded-md border border-rust-500/30 bg-rust-500/10 px-3 py-2 text-sm text-rust-400">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-md border border-moss-500/30 bg-moss-500/10 px-3 py-2 text-sm text-moss-400">
            {successMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-center border-t border-slate-800 pt-6 mt-2">
          <Button variant="outline" onClick={handleDownloadTemplate} className="w-full sm:w-auto">
            Download Template (.xlsx)
          </Button>

          <div className="relative w-full sm:w-auto">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={loading}
            />
            <Button className="w-full sm:w-auto pointer-events-none" disabled={loading}>
              {loading ? "Uploading..." : "Select File & Upload"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
