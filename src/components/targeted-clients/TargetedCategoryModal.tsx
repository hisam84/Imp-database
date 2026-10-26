"use client";

import React, { useState } from "react";
import { Modal, Field, inputClass } from "@/components/ui";
import { TargetedCategory } from "@/lib/types";

interface Props {
  categories: TargetedCategory[];
  onClose: () => void;
  onChanged: () => void;
}

export function TargetedCategoryModal({ categories, onClose, onChanged }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/targeted-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add category");
      }

      setName("");
      onChanged();
    } catch (err: any) {
      setError(err.message || "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCategory(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError("Category name cannot be empty");
      return;
    }

    setUpdatingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/targeted-categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update category");
      }

      setEditingId(null);
      setEditingName("");
      onChanged();
    } catch (err: any) {
      setError(err.message || "Failed to update category");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeleteCategory(cat: TargetedCategory) {
    if (cat.clientCount && cat.clientCount > 0) {
      setError(
        `Cannot delete "${cat.name}" because it is currently assigned to ${cat.clientCount} targeted client(s). Please reassign those clients first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return;
    }

    setDeletingId(cat.id);
    setError(null);

    try {
      const res = await fetch(`/api/targeted-categories/${cat.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      onChanged();
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal title="Manage Software Categories" onClose={onClose}>
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-xs font-medium text-red-600 dark:text-red-400 flex items-start justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 font-bold ml-1 text-sm leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
          <Field label="New Category Name">
            <input
              className={inputClass}
              placeholder="e.g. Education Management, ERP, Clinic Management"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={saving}
              autoFocus
            />
          </Field>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2.5 px-4 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white shadow-sm shadow-blue-500/20 active:scale-95 disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border disabled:border-slate-200 dark:disabled:border-slate-700 disabled:shadow-none disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>{saving ? "Adding..." : "Add Category"}</span>
          </button>
        </form>

        {/* Existing Categories List */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Existing Categories
            </h3>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {categories.length} {categories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          {categories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
              No software categories added yet. Create your first category above.
            </div>
          ) : (
            <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;
                const isUpdating = updatingId === cat.id;
                const isDeleting = deletingId === cat.id;
                const clientCount = cat.clientCount || 0;

                return (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className={`${inputClass} !py-1 !text-xs`}
                          autoFocus
                          disabled={isUpdating}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleUpdateCategory(cat.id);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat.id)}
                          disabled={isUpdating || !editingName.trim()}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdating ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={isUpdating}
                          className="px-2 py-1 text-xs font-medium rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {cat.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              clientCount > 0
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "bg-slate-200/60 dark:bg-slate-800 text-slate-500 border border-slate-300/40 dark:border-slate-700"
                            }`}
                          >
                            {clientCount} {clientCount === 1 ? "client" : "clients"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(cat.id);
                              setEditingName(cat.name);
                              setError(null);
                            }}
                            title="Rename Category"
                            className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            disabled={isDeleting}
                            title={
                              clientCount > 0
                                ? `In use by ${clientCount} client(s) - cannot delete`
                                : "Delete Category"
                            }
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              clientCount > 0
                                ? "text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-500/10"
                                : "text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
