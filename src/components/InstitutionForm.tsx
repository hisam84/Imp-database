"use client";
import React, { useState, ReactNode } from "react";
import { Button, Field, inputClass, Modal } from "./ui";
import { CATEGORY_OPTIONS, CustomFieldDef, INSTITUTE_TYPE_OPTIONS, Institution } from "@/lib/types";

function toDateInput(v: string | null) {
  if (!v) return "";
  return v.slice(0, 10);
}

const empty = {
  instituteName: "",
  instituteNameBangla: "",
  domain: "",
  category: "Website",
  instituteType: "School",
  issueDate: "",
  expireDate: "",
  actualExpireDate: "",
  student: "",
  condition: "",
  btclUsername: "",
  btclPassword: "",
  btclMobileNo: "",
  btclEmail: "",
  btclEmailPassword: "",
  instituteHead: "",
  contact1: "",
  contact2: "",
  inChargeTeacher: "",
  designation: "",
  inChargeTeacherContact: "",
  inChargeTeacher2: "",
  inChargeTeacher2Contact: "",
  subDistrict: "",
  district: "",
  address: "",
  googleMapsUrl: "",
};

function isInternalOrMigrated(key: string) {
  return (
    key === "isDeactivated" ||
    key === "callUpdates" ||
    key === "googleMapsUrl" ||
    key === "inChargeTeacher2" ||
    key === "inChargeTeacher2Contact" ||
    key === "cf_in_charge_2" ||
    key === "in_charge_2" ||
    key === "cf_in_charge_2_contact" ||
    key === "in_charge_2_contact" ||
    key === "IN CHARGE 2" ||
    key === "IN CHARGE 2 CONTACT"
  );
}

export function InstitutionForm({
  initial,
  customFieldDefs,
  onClose,
  onSaved,
  onRequestAddField,
}: {
  initial?: Institution | null;
  customFieldDefs: CustomFieldDef[];
  onClose: () => void;
  onSaved: () => void;
  onRequestAddField?: () => void;
}) {
  const initialInChargeTeacher2 =
    initial?.inChargeTeacher2 ||
    (initial?.customFields as any)?.inChargeTeacher2 ||
    (initial?.customFields as any)?.cf_in_charge_2 ||
    (initial?.customFields as any)?.in_charge_2 ||
    (initial?.customFields as any)?.["IN CHARGE 2"] ||
    "";

  const initialInChargeTeacher2Contact =
    initial?.inChargeTeacher2Contact ||
    (initial?.customFields as any)?.inChargeTeacher2Contact ||
    (initial?.customFields as any)?.cf_in_charge_2_contact ||
    (initial?.customFields as any)?.in_charge_2_contact ||
    (initial?.customFields as any)?.["IN CHARGE 2 CONTACT"] ||
    "";

  const initialGoogleMapsUrl =
    initial?.googleMapsUrl ||
    (initial?.customFields as any)?.googleMapsUrl ||
    "";

  const [form, setForm] = useState<any>(
    initial
      ? {
          ...empty,
          ...initial,
          inChargeTeacher2: initialInChargeTeacher2,
          inChargeTeacher2Contact: initialInChargeTeacher2Contact,
          googleMapsUrl: initialGoogleMapsUrl,
          issueDate: toDateInput(initial.issueDate),
          expireDate: toDateInput(initial.expireDate),
          actualExpireDate: toDateInput(initial.actualExpireDate),
        }
      : empty
  );

  const [customValues, setCustomValues] = useState<Record<string, string>>(
    (initial?.customFields as any) ?? {}
  );

  // Only show custom fields that actually have non-empty values on THIS institution
  const [activeKeys, setActiveKeys] = useState<string[]>(() => {
    if (!initial?.customFields) return [];
    return Object.keys(initial.customFields).filter((k) => {
      if (isInternalOrMigrated(k)) return false;
      const val = (initial.customFields as any)[k];
      return val !== undefined && val !== null && String(val).trim() !== "";
    });
  });

  const [localDefs, setLocalDefs] = useState<Record<string, { label: string; fieldType: string }>>({});
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedExistingKey, setSelectedExistingKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"text" | "number" | "date">("text");
  const [addingNewDef, setAddingNewDef] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, value: string) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function getFieldMeta(key: string) {
    const def = customFieldDefs.find((d) => d.key === key) || localDefs[key];
    if (def) return { label: def.label, fieldType: def.fieldType };
    const label = key.replace(/^cf_/, "").replace(/_/g, " ");
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      fieldType: "text",
    };
  }

  // Fields from global definitions not currently added to this institution
  const availableExistingDefs = customFieldDefs.filter(
    (d) => !isInternalOrMigrated(d.key) && !activeKeys.includes(d.key)
  );

  function handleAddExistingField() {
    if (!selectedExistingKey) return;
    if (!activeKeys.includes(selectedExistingKey)) {
      setActiveKeys((prev) => [...prev, selectedExistingKey]);
    }
    setSelectedExistingKey("");
    setShowAddPanel(false);
  }

  async function handleCreateAndAddField(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    if (!newLabel.trim()) return;
    setAddingNewDef(true);
    try {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), fieldType: newType }),
      });
      if (!res.ok) throw new Error("Could not add custom field.");
      const created = await res.json();
      setLocalDefs((prev) => ({
        ...prev,
        [created.key]: { label: created.label, fieldType: created.fieldType },
      }));
      if (!activeKeys.includes(created.key)) {
        setActiveKeys((prev) => [...prev, created.key]);
      }
      setNewLabel("");
      setShowAddPanel(false);
    } catch (err: any) {
      setError(err.message || "Failed to create custom field.");
    } finally {
      setAddingNewDef(false);
    }
  }

  function handleRemoveCustomField(key: string) {
    setActiveKeys((prev) => prev.filter((k) => k !== key));
    setCustomValues((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.instituteName.trim()) {
      setError("Institute name is required.");
      return;
    }
    setSaving(true);
    setError("");

    // Build scoped customFields for this institution only
    const cleanedCustom: Record<string, any> = {};
    if (customValues.isDeactivated) {
      cleanedCustom.isDeactivated = customValues.isDeactivated;
    }
    if (customValues.callUpdates || (initial?.customFields as any)?.callUpdates) {
      cleanedCustom.callUpdates = customValues.callUpdates || (initial?.customFields as any)?.callUpdates;
    }
    const existingCommLogs =
      customValues.communicationLogs ||
      (initial?.customFields as any)?.communicationLogs ||
      initial?.communicationLogs;
    if (existingCommLogs && Array.isArray(existingCommLogs)) {
      cleanedCustom.communicationLogs = existingCommLogs;
    }
    activeKeys.forEach((key) => {
      const v = customValues[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        cleanedCustom[key] = String(v).trim();
      }
    });

    const payload = { ...form, customFields: cleanedCustom };
    const isEditing = Boolean(initial && initial.id);
    const url = isEditing ? `/api/institutions/${initial!.id}` : "/api/institutions";
    const method = isEditing ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed.");
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const isEditing = Boolean(initial && initial.id);

  return (
    <Modal title={isEditing ? "Edit Institution" : "Add New Institution"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <p className="rounded-md border border-rust-500/30 bg-rust-500/10 px-3 py-2 text-sm text-rust-400">
            {error}
          </p>
        )}

        <Section title="Core Information">
          <Field label="Institute Name" full>
            <input
              className={inputClass}
              value={form.instituteName}
              onChange={(e) => set("instituteName", e.target.value)}
              required
            />
          </Field>
          <Field label="Institute Name (Bangla)" full>
            <input
              className={`${inputClass} bn`}
              value={form.instituteNameBangla ?? ""}
              onChange={(e) => set("instituteNameBangla", e.target.value)}
            />
          </Field>
          <Field label="Domain / Website Address">
            <input
              className={`${inputClass} font-mono`}
              placeholder="example.edu.bd"
              value={form.domain ?? ""}
              onChange={(e) => set("domain", e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Institute Type">
            <select
              className={inputClass}
              value={form.instituteType}
              onChange={(e) => set("instituteType", e.target.value)}
            >
              {INSTITUTE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Dates">
          <Field label="Issue Date">
            <input type="date" className={inputClass} value={form.issueDate ?? ""} onChange={(e) => set("issueDate", e.target.value)} />
          </Field>
          <Field label="Expire Date">
            <input type="date" className={inputClass} value={form.expireDate ?? ""} onChange={(e) => set("expireDate", e.target.value)} />
          </Field>
          <Field label="Actual Expire Date">
            <input
              type="date"
              className={inputClass}
              value={form.actualExpireDate ?? ""}
              onChange={(e) => set("actualExpireDate", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Status & Notes">
          <Field label="Student">
            <input className={inputClass} value={form.student ?? ""} onChange={(e) => set("student", e.target.value)} />
          </Field>
          <Field label="Condition">
            <input className={inputClass} value={form.condition ?? ""} onChange={(e) => set("condition", e.target.value)} />
          </Field>
          <div className="sm:col-span-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(customValues.isDeactivated)}
                onChange={(e) =>
                  setCustomValues((prev) => ({
                    ...prev,
                    isDeactivated: e.target.checked as any,
                  }))
                }
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Deactivate Client
              </span>
              <span className="text-xs text-slate-500">
                (Mark this client as deactivated)
              </span>
            </label>
          </div>
        </Section>

        <Section title="BTCL Credentials">
          <Field label="BTCL Username">
            <input className={inputClass} value={form.btclUsername ?? ""} onChange={(e) => set("btclUsername", e.target.value)} />
          </Field>
          <Field label="BTCL Password">
            <input className={inputClass} value={form.btclPassword ?? ""} onChange={(e) => set("btclPassword", e.target.value)} />
          </Field>
          <Field label="BTCL Mobile No">
            <input className={inputClass} value={form.btclMobileNo ?? ""} onChange={(e) => set("btclMobileNo", e.target.value)} />
          </Field>
          <Field label="BTCL E-mail">
            <input className={inputClass} value={form.btclEmail ?? ""} onChange={(e) => set("btclEmail", e.target.value)} />
          </Field>
          <Field label="BTCL E-mail Password">
            <input className={inputClass} value={form.btclEmailPassword ?? ""} onChange={(e) => set("btclEmailPassword", e.target.value)} />
          </Field>
        </Section>

        <Section title="Contacts">
          <Field label="Institute Head">
            <input className={inputClass} value={form.instituteHead ?? ""} onChange={(e) => set("instituteHead", e.target.value)} />
          </Field>
          <Field label="Contact-1">
            <input className={inputClass} value={form.contact1 ?? ""} onChange={(e) => set("contact1", e.target.value)} />
          </Field>
          <Field label="Contact-2">
            <input className={inputClass} value={form.contact2 ?? ""} onChange={(e) => set("contact2", e.target.value)} />
          </Field>
          <Field label="In Charge Teacher">
            <input className={inputClass} value={form.inChargeTeacher ?? ""} onChange={(e) => set("inChargeTeacher", e.target.value)} />
          </Field>
          <Field label="Designation">
            <input className={inputClass} value={form.designation ?? ""} onChange={(e) => set("designation", e.target.value)} />
          </Field>
          <Field label="In Charge Teacher Contact">
            <input
              className={inputClass}
              value={form.inChargeTeacherContact ?? ""}
              onChange={(e) => set("inChargeTeacherContact", e.target.value)}
            />
          </Field>
          <Field label="In Charge Teacher 2">
            <input
              className={inputClass}
              value={form.inChargeTeacher2 ?? ""}
              onChange={(e) => set("inChargeTeacher2", e.target.value)}
              placeholder="e.g. In Charge Teacher Name"
            />
          </Field>
          <Field label="In Charge Teacher 2 Contact">
            <input
              className={inputClass}
              value={form.inChargeTeacher2Contact ?? ""}
              onChange={(e) => set("inChargeTeacher2Contact", e.target.value)}
              placeholder="e.g. 017XXXXXXXX"
            />
          </Field>
        </Section>

        <Section title="Location">
          <Field label="Sub District">
            <input className={inputClass} value={form.subDistrict ?? ""} onChange={(e) => set("subDistrict", e.target.value)} />
          </Field>
          <Field label="District">
            <input className={inputClass} value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} />
          </Field>
          <Field label="Address" full>
            <textarea
              className={inputClass}
              rows={2}
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="Google Maps (Embed Iframe Code / Share Link / Search Location)" full>
            <input
              className={inputClass}
              value={form.googleMapsUrl ?? ""}
              onChange={(e) => set("googleMapsUrl", e.target.value)}
              placeholder="e.g. <iframe src='https://www.google.com/maps/embed?...'></iframe> or https://maps.google.com/?q=..."
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Paste a Google Maps share link, embed iframe code, or location query. It will be rendered at the bottom of the institution details dropdown.
            </p>
          </Field>
        </Section>

        {/* Custom Fields - ONLY for this specific institution */}
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-display text-sm text-brass-400">
            Custom Fields {activeKeys.length > 0 && `(${activeKeys.length})`}
          </legend>

          {activeKeys.length === 0 && !showAddPanel && (
            <p className="text-xs text-slate-500 italic">
              No custom fields added for this institution yet.
            </p>
          )}

          {activeKeys.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {activeKeys.map((key) => {
                const meta = getFieldMeta(key);
                return (
                  <div key={key} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <Field label={meta.label}>
                        <input
                          type={meta.fieldType === "date" ? "date" : meta.fieldType === "number" ? "number" : "text"}
                          className={inputClass}
                          value={customValues[key] ?? ""}
                          onChange={(e) => setCustomValues((v) => ({ ...v, [key]: e.target.value }))}
                          placeholder={`Enter ${meta.label.toLowerCase()}`}
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(key)}
                      title="Remove field from this institution"
                      className="mb-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline Add Custom Field Panel */}
          {showAddPanel && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col gap-4 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Add Custom Field to this Institution
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddPanel(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {availableExistingDefs.length > 0 && (
                <div className="flex flex-col gap-2 pb-3 border-b border-blue-200/60 dark:border-blue-900/40">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Select an existing custom field:
                  </label>
                  <div className="flex gap-2">
                    <select
                      className={`${inputClass} flex-1`}
                      value={selectedExistingKey}
                      onChange={(e) => setSelectedExistingKey(e.target.value)}
                    >
                      <option value="">-- Choose field --</option>
                      {availableExistingDefs.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label} ({d.fieldType})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!selectedExistingKey}
                      onClick={handleAddExistingField}
                    >
                      Add Field
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Or create a new custom field:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      className={inputClass}
                      placeholder="Field name (e.g. Note, Contact- 2)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className={inputClass}
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddPanel(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={addingNewDef || !newLabel.trim()}
                    onClick={handleCreateAndAddField}
                  >
                    {addingNewDef ? "Creating..." : "Create & Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!showAddPanel && (
            <button
              type="button"
              onClick={() => setShowAddPanel(true)}
              className="self-start text-sm text-brass-400 hover:text-brass-300 hover:underline flex items-center gap-1 font-medium"
            >
              <span>+ Add a custom field</span>
            </button>
          )}
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Institution"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 font-display text-sm text-brass-400">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

