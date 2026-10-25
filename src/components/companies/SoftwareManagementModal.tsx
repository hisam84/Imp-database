"use client";
import { useEffect, useState, useRef } from "react";
import { Software, SOFTWARE_CATEGORY_OPTIONS } from "@/lib/types";

interface SoftwareManagementModalProps {
  onClose: () => void;
  onChanged?: () => void;
}

export function SoftwareManagementModal({ onClose, onChanged }: SoftwareManagementModalProps) {
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<Software | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<string>("Web App");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Refs for smooth scroll and focus
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);

  async function fetchSoftwares() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/softwares");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSoftwares(data);
      } else {
        setError(data.error || "Failed to load software products.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load software products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSoftwares();
  }, []);

  function resetForm() {
    setEditingItem(null);
    setName("");
    setCode("");
    setCategory("Web App");
    setDescription("");
    setDefaultPrice("");
    setStatus("Active");
  }

  function handleEdit(sw: Software) {
    setEditingItem(sw);
    setName(sw.name || "");
    setCode(sw.code || "");
    setCategory(sw.category || "Web App");
    setDescription(sw.description || "");
    setDefaultPrice(sw.defaultPrice !== undefined && sw.defaultPrice !== null ? String(sw.defaultPrice) : "");
    setStatus(sw.status || "Active");

    // Smoothly scroll the container to the top edit form
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else if (formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    // Trigger visual highlight pulse and focus input
    setIsHighlighting(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 280);
    setTimeout(() => {
      setIsHighlighting(false);
    }, 1200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      alert("Software Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      category,
      description: description.trim() || null,
      defaultPrice: defaultPrice ? parseFloat(defaultPrice) : null,
      status,
    };

    try {
      const url = editingItem ? `/api/softwares/${editingItem.id}` : "/api/softwares";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save software product.");
      }

      resetForm();
      fetchSoftwares();
      if (onChanged) onChanged();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sw: Software) {
    if (!confirm(`Are you sure you want to delete "${sw.name}" from your catalog?`)) return;

    try {
      const res = await fetch(`/api/softwares/${sw.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete software.");
      }
      fetchSoftwares();
      if (onChanged) onChanged();
    } catch (err: any) {
      alert(err.message || "Could not delete software.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">💻</span>
              <span>Software Product Catalog</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage all software applications offered by Imperial IT
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div ref={scrollContainerRef} className="p-6 overflow-y-auto space-y-6 flex-1 scroll-smooth">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="text-xs font-bold hover:underline">Dismiss</button>
            </div>
          )}

          {/* Form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className={`p-4 rounded-xl border transition-all duration-500 space-y-4 ${
              isHighlighting
                ? "border-blue-500 bg-blue-100/70 dark:bg-blue-900/40 ring-4 ring-blue-500/25 shadow-lg scale-[1.005]"
                : editingItem
                ? "border-blue-500/50 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-500/20 shadow-sm"
                : "border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20"
            }`}
          >
            <div className="flex items-center justify-between border-b border-blue-500/10 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                {editingItem ? (
                  <>
                    <span>✏️</span>
                    <span>Edit: {editingItem.name}</span>
                  </>
                ) : (
                  <span>+ Add New Software Product</span>
                )}
              </h3>
              {editingItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline font-medium"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Software Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  placeholder="e.g. School Management System"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Code / Short Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. SMS, POS, MMS"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {SOFTWARE_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Price (BDT)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Features
                </label>
                <input
                  type="text"
                  placeholder="Short description or key features..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {saving ? "Saving..." : editingItem ? "Update Software" : "+ Save Software"}
              </button>
            </div>
          </form>

          {/* Software Catalog Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Existing Softwares ({softwares.length})
            </h3>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading catalog…</div>
            ) : softwares.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                No software products found in catalog. Add one above!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 uppercase font-semibold text-[11px] text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-3">Software</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Default Price</th>
                      <th className="p-3">Active Companies</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {softwares.map((sw) => (
                      <tr key={sw.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{sw.name}</span>
                            {sw.code && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                                {sw.code}
                              </span>
                            )}
                          </div>
                          {sw.description && (
                            <p className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                              {sw.description}
                            </p>
                          )}
                        </td>
                        <td className="p-3">{sw.category || "—"}</td>
                        <td className="p-3 font-mono font-medium">
                          {sw.defaultPrice !== undefined && sw.defaultPrice !== null
                            ? `BDT ${sw.defaultPrice.toLocaleString()}`
                            : "Flexible"}
                        </td>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">
                          {sw._count?.subscriptions || 0}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              sw.status === "Active"
                                ? "bg-moss-500/15 text-moss-400 border-moss-500/30"
                                : "bg-slate-500/15 text-slate-400 border-slate-400/30"
                            }`}
                          >
                            {sw.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleEdit(sw)}
                            className="px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(sw)}
                            className="px-2 py-1 text-xs font-semibold text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors"
          >
            Close Catalog
          </button>
        </div>
      </div>
    </div>
  );
}
