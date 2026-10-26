"use client";
import { Button, inputClass } from "@/components/ui";
import { TargetedCategory } from "@/lib/types";

export interface TargetedFilters {
  search: string;
  category: string;
  priority: string;
  district: string;
  subDistrict: string;
  status: string; // "active" | "archived" | "all"
}

interface Props {
  filters: TargetedFilters;
  onChange: (f: TargetedFilters) => void;
  onReset: () => void;
  categories: TargetedCategory[];
  districts: string[];
  subDistricts: string[];
}

export function TargetedFilterBar({
  filters,
  onChange,
  onReset,
  categories,
  districts,
  subDistricts,
}: Props) {
  function update(key: keyof TargetedFilters, val: string) {
    onChange({ ...filters, [key]: val });
  }

  const hasActiveFilters =
    filters.search ||
    filters.category ||
    filters.priority ||
    filters.district ||
    filters.subDistrict ||
    filters.status !== "active";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Search
          </label>
          <input
            type="text"
            placeholder="Name, phone, location…"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => update("category", e.target.value)}
            className={inputClass}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Priority
          </label>
          <select
            value={filters.priority}
            onChange={(e) => update("priority", e.target.value)}
            className={inputClass}
          >
            <option value="">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Default">Default Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Archive Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
            className={inputClass}
          >
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
            <option value="all">All (Active & Archived)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            District
          </label>
          <select
            value={filters.district}
            onChange={(e) => update("district", e.target.value)}
            className={inputClass}
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Sub District
          </label>
          <select
            value={filters.subDistrict}
            onChange={(e) => update("subDistrict", e.target.value)}
            className={inputClass}
          >
            <option value="">All Sub-Districts</option>
            {subDistricts.map((sd) => (
              <option key={sd} value={sd}>
                {sd}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-3 text-xs text-slate-500 font-medium">
          <span>Filters applied</span>
          <Button variant="ghost" onClick={onReset} className="h-7 text-xs font-semibold text-brass-600 dark:text-brass-400">
            Reset All Filters
          </Button>
        </div>
      )}
    </div>
  );
}
