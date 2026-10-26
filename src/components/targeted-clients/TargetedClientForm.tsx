"use client";
import React, { useState } from "react";
import { TargetedClient, TargetedPriority, TARGETED_PRIORITY_OPTIONS, TargetedCategory } from "@/lib/types";
import { Button, Field, inputClass, Modal } from "@/components/ui";
import { useUserSession } from "@/lib/userSession";

interface Props {
  initial?: TargetedClient | null;
  categories?: TargetedCategory[];
  onManageCategories?: () => void;
  onClose: () => void;
  onSaved: () => void;
}

export function TargetedClientForm({ initial, categories = [], onManageCategories, onClose, onSaved }: Props) {
  const { currentUser } = useUserSession();
  const [form, setForm] = useState({
    instituteName: initial?.instituteName ?? "",
    instituteNameBangla: initial?.instituteNameBangla ?? "",
    category: initial?.category ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    district: initial?.district ?? "",
    subDistrict: initial?.subDistrict ?? "",
    address: initial?.address ?? "",
    priority: (initial?.priority as TargetedPriority) ?? "Default",
    isArchived: initial?.isArchived ?? false,
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key: string, val: any) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.instituteName.trim()) {
      setError("Institute name is required");
      return;
    }
    setSaving(true);
    setError("");

    const isEditing = Boolean(initial && initial.id);

    try {
      const url = isEditing ? `/api/targeted-clients/${initial!.id}` : "/api/targeted-clients";
      const method = isEditing ? "PUT" : "POST";
      const bodyPayload = {
        ...form,
        createdById: isEditing ? (initial?.createdById || currentUser.id) : currentUser.id,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save targeted client");
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  const isEditing = Boolean(initial && initial.id);

  return (
    <Modal
      wide
      title={isEditing ? "Edit Targeted Client" : "Add Targeted Client"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-rust-500/30 bg-rust-500/10 p-3 text-xs text-rust-400">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institute Name *" full>
            <input
              type="text"
              required
              placeholder="e.g. Dhaka High School"
              value={form.instituteName}
              onChange={(e) => update("instituteName", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Institute Name (Bangla)">
            <input
              type="text"
              placeholder="e.g. Dhaka High School (Bengali Name)"
              value={form.instituteNameBangla}
              onChange={(e) => update("instituteNameBangla", e.target.value)}
              className={`${inputClass} font-bengali`}
            />
          </Field>

          <Field label="Software Category">
            <div className="flex gap-2">
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className={inputClass}
              >
                <option value="">-- Select Category (Optional) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {onManageCategories && (
                <button
                  type="button"
                  onClick={onManageCategories}
                  title="Manage Software Categories"
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                >
                  + Manage
                </button>
              )}
            </div>
          </Field>

          <Field label="Priority Level">
            <select
              value={form.priority}
              onChange={(e) => update("priority", e.target.value as TargetedPriority)}
              className={inputClass}
            >
              {TARGETED_PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p} Priority
                </option>
              ))}
            </select>
          </Field>

          <Field label="Contact Person / Head">
            <input
              type="text"
              placeholder="Principal / Contact Person Name"
              value={form.contactPerson}
              onChange={(e) => update("contactPerson", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Phone Number">
            <input
              type="text"
              placeholder="017xxxxxxxx"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Email Address">
            <input
              type="email"
              placeholder="client@example.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="District">
            <input
              type="text"
              placeholder="e.g. Dhaka, Cumilla"
              value={form.district}
              onChange={(e) => update("district", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Sub District (Upazila)">
            <input
              type="text"
              placeholder="e.g. Mirpur, Sadar"
              value={form.subDistrict}
              onChange={(e) => update("subDistrict", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Full Address" full>
            <input
              type="text"
              placeholder="Road, Village, Ward info..."
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Notes / Remarks" full>
            <textarea
              rows={3}
              placeholder="Add any specific requirements, discussion details, or follow-up notes..."
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="sm:col-span-2 flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.isArchived}
                onChange={(e) => update("isArchived", e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brass-500 focus:ring-brass-400"
              />
              <span>Archive this client (Hide from active list)</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEditing ? "Update Client" : "Save Targeted Client"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
