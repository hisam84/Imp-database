"use client";
import { INSTITUTE_TYPE_OPTIONS, CATEGORY_OPTIONS } from "@/lib/types";
import { inputClass } from "./ui";

export interface Filters {
  search: string;
  type: string;
  category: string;
  subDistrict: string;
  district: string;
  status: string;
}

export function FilterBar({
  filters,
  onChange,
  onReset,
  districts,
  subDistricts,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset?: () => void;
  districts: string[];
  subDistricts: string[];
}) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-sm">
      <div className="flex gap-2 sm:gap-3 min-w-0">
        <input
          className={`${inputClass} min-w-0 flex-1 text-xs sm:text-sm`}
          placeholder="Search by name, phone, website, or head of institute…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shadow-sm cursor-pointer"
          >
            <span className="hidden sm:inline">Reset Filters</span>
            <span className="sm:hidden">Reset</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <select className={`${inputClass} text-xs sm:text-sm`} value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring Soon (Within 60 Days)</option>
          <option value="expired">Expired</option>
          <option value="actual_expired">Actual Expired</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select className={`${inputClass} text-xs sm:text-sm`} value={filters.type} onChange={(e) => set("type", e.target.value)}>
          <option value="">All Types</option>
          {INSTITUTE_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className={`${inputClass} text-xs sm:text-sm`} value={filters.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} text-xs sm:text-sm`}
          value={filters.district}
          onChange={(e) => {
            onChange({
              ...filters,
              district: e.target.value,
              subDistrict: "",
            });
          }}
        >
          <option value="">All Districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} col-span-2 sm:col-span-1 text-xs sm:text-sm`}
          value={filters.subDistrict}
          onChange={(e) => set("subDistrict", e.target.value)}
        >
          <option value="">All Sub Districts</option>
          {subDistricts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
