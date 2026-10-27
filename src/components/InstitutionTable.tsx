"use client";
import { useState, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  computeStatus,
  DETAIL_FIELD_ORDER,
  FIELD_LABELS,
  Institution,
  isInternalOrMigratedCustomField,
  getGoogleMapsEmbedSrc,
  STATUS_COLOR,
  STATUS_LABEL,
  CallUpdate,
  CommunicationLog,
} from "@/lib/types";
import { Badge, Button } from "./ui";
import { CustomFieldDef } from "@/lib/types";
import { formatDhakaDate } from "@/lib/dateUtils";
import { CallUpdateModal } from "./CallUpdateModal";
import { InstitutionCommunicationModal } from "./InstitutionCommunicationModal";
import { InstitutionCommunicationSection } from "./InstitutionCommunicationSection";

function InstitutionMapEmbed({ inst }: { inst: Institution }) {
  const customMapUrl = (inst.googleMapsUrl || (inst.customFields as any)?.googleMapsUrl || "").trim();

  // If no map is provided, do NOT show the map at all!
  if (!customMapUrl) return null;

  const embedSrc = getGoogleMapsEmbedSrc(customMapUrl);
  if (!embedSrc) return null;

  const directMapLink =
    !customMapUrl.includes("<iframe") && (customMapUrl.startsWith("http://") || customMapUrl.startsWith("https://"))
      ? customMapUrl
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inst.instituteName + (inst.district ? `, ${inst.district}` : ""))}`;

  return (
    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Google Map
          </span>
        </div>

        <a
          href={directMapLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>Open in Google Maps</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <div className="relative w-full h-52 sm:h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-slate-100 dark:bg-slate-900">
        <iframe
          src={embedSrc}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${inst.instituteName} Location Map`}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}

function fmtDate(v: string | null) {
  return formatDhakaDate(v, { day: "2-digit", month: "short", year: "numeric" });
}

function getDomainUrl(domain: string | null): string {
  if (!domain) return "";
  const trimmed = domain.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function getInstitutionFieldValue(inst: any, key: string) {
  if (key === "inChargeTeacher2") {
    return (
      inst.inChargeTeacher2 ||
      inst.customFields?.inChargeTeacher2 ||
      inst.customFields?.cf_in_charge_2 ||
      inst.customFields?.in_charge_2 ||
      inst.customFields?.["IN CHARGE 2"] ||
      null
    );
  }
  if (key === "inChargeTeacher2Contact") {
    return (
      inst.inChargeTeacher2Contact ||
      inst.customFields?.inChargeTeacher2Contact ||
      inst.customFields?.cf_in_charge_2_contact ||
      inst.customFields?.in_charge_2_contact ||
      inst.customFields?.["IN CHARGE 2 CONTACT"] ||
      null
    );
  }
  return inst[key];
}

function TableTooltip({
  text,
  children,
  className = "",
}: {
  text: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: false,
  });
  const triggerRef = useRef<HTMLDivElement>(null);

  if (!text) {
    return <div className={`min-w-0 max-w-full truncate ${className}`}>{children}</div>;
  }

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    const el = triggerRef.current;
    const isTruncated =
      el.scrollWidth > el.clientWidth ||
      (el.firstElementChild && el.firstElementChild.scrollWidth > el.firstElementChild.clientWidth);
    if (!isTruncated) return;

    const rect = el.getBoundingClientRect();
    const placeAbove = rect.bottom + 65 > window.innerHeight;
    setCoords({
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 320)),
      placeAbove,
    });
    setShow(true);
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      className={`min-w-0 max-w-full truncate ${className}`}
      title={text}
    >
      {children}
      {show &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.placeAbove ? undefined : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : undefined,
              left: `${coords.left}px`,
            }}
            className="z-[9999] pointer-events-none max-w-sm rounded-lg bg-slate-900/95 text-white text-xs px-3 py-1.5 shadow-2xl border border-slate-700/80 backdrop-blur-sm whitespace-normal break-words leading-relaxed"
          >
            {text}
          </div>,
          document.body
        )}
    </div>
  );
}

function ActionMenu({
  inst,
  onEdit,
  onDelete,
  onAddTask,
  onToggleDeactivate,
  onCallUpdate,
  onViewLogs,
}: {
  inst: Institution;
  onEdit: (i: Institution) => void;
  onDelete: (i: Institution) => void;
  onAddTask?: (i: Institution) => void;
  onToggleDeactivate?: (i: Institution) => void;
  onCallUpdate?: (i: Institution) => void;
  onViewLogs?: (i: Institution) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; right: number; placeAbove: boolean }>({
    top: 0,
    right: 0,
    placeAbove: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDeactivated = Boolean(inst.customFields?.isDeactivated);
  const callCount = getCallCount(inst);
  const commCount = getCommunicationCount(inst);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 220;
      const placeAbove = rect.bottom + menuHeight > window.innerHeight;

      setMenuCoords({
        top: placeAbove ? rect.top - 6 : rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
        placeAbove,
      });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const portal = document.getElementById(`action-menu-portal-${inst.id}`);
        if (portal && portal.contains(e.target as Node)) return;
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      setIsOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, inst.id]);

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-xs cursor-pointer ${
          isOpen
            ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
        title="Actions"
        aria-label="Actions"
      >
        <span>Actions</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={`action-menu-portal-${inst.id}`}
            style={{
              position: "fixed",
              top: menuCoords.placeAbove ? undefined : `${menuCoords.top}px`,
              bottom: menuCoords.placeAbove ? `${window.innerHeight - menuCoords.top}px` : undefined,
              right: `${menuCoords.right}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="z-[9999] w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-1.5 shadow-xl text-left backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="space-y-0.5">
              {onCallUpdate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCallUpdate(inst);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Call Update</span>
                  </div>
                  {callCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                      {callCount > 99 ? "99+" : callCount}
                    </span>
                  )}
                </button>
              )}

              {onViewLogs && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onViewLogs(inst);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span>Email & SMS Logs</span>
                  </div>
                  {commCount.total > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                      {commCount.total > 99 ? "99+" : commCount.total}
                    </span>
                  )}
                </button>
              )}

              {onAddTask && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddTask(inst);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors text-left cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Task</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onEdit(inst);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Client</span>
              </button>

              {onToggleDeactivate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onToggleDeactivate(inst);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                    isDeactivated
                      ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      : "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50"
                  }`}
                >
                  {isDeactivated ? (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Activate</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>Deactivate</span>
                    </>
                  )}
                </button>
              )}

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onDelete(inst);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors text-left cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function InstitutionTable({
  institutions,
  customFieldDefs,
  onEdit,
  onDelete,
  onAddTask,
  onToggleDeactivate,
  onCallUpdateAdded,
  onCommunicationLogsUpdated,
}: {
  institutions: Institution[];
  customFieldDefs: CustomFieldDef[];
  onEdit: (i: Institution) => void;
  onDelete: (i: Institution) => void;
  onAddTask?: (i: Institution) => void;
  onToggleDeactivate?: (i: Institution) => void;
  onCallUpdateAdded?: (instId: string, updatedList: CallUpdate[]) => void;
  onCommunicationLogsUpdated?: (instId: string, updatedLogs: CommunicationLog[]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inst_ledger_pageSize");
      if (saved === "all") return "all";
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return 25;
  });
  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inst_ledger_page");
      if (saved && !isNaN(Number(saved))) return Math.max(1, Number(saved));
    }
    return 1;
  });
  const [selectedCallInst, setSelectedCallInst] = useState<Institution | null>(null);
  const [selectedLogsInst, setSelectedLogsInst] = useState<Institution | null>(null);
  const [commLogsOverrides, setCommLogsOverrides] = useState<Record<string, CommunicationLog[]>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inst_ledger_page", String(currentPage));
    }
  }, [currentPage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inst_ledger_pageSize", String(pageSize));
    }
  }, [pageSize]);

  const totalCount = institutions.length;
  const effectivePageSize = pageSize === "all" ? (totalCount || 1) : pageSize;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalCount / effectivePageSize));

  // Auto-clamp current page if total pages decreases
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  if (totalCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 py-16 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        <p className="font-display text-lg text-slate-800 dark:text-slate-300">No institutions match these filters</p>
        <p className="mt-1 text-sm">Try clearing a filter, or add a new institution to the registry.</p>
      </div>
    );
  }

  const validPage = Math.min(currentPage, totalPages);
  const startIndex = pageSize === "all" ? 0 : (validPage - 1) * (typeof pageSize === "number" ? pageSize : 25);
  const endIndex = pageSize === "all" ? totalCount : Math.min(totalCount, startIndex + (typeof pageSize === "number" ? pageSize : 25));
  const paginatedInstitutions = pageSize === "all" ? institutions : institutions.slice(startIndex, endIndex);

  return (
    <div className="space-y-3">
      {/* Top Pagination & Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-900 dark:text-slate-100">{totalCount > 0 ? startIndex + 1 : 0}</span> to{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">{endIndex}</span> of{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">{totalCount}</span> institutions
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Show per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === "all" ? "all" : Number(e.target.value);
              setPageSize(val);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value="all">All ({totalCount})</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE VIEW (< md) - Clean, 100% Full-Width Responsive Cards with Zero Empty Space */}
      {/* ========================================================================= */}
      <div className="md:hidden space-y-2.5 max-w-full overflow-hidden">
        {paginatedInstitutions.map((inst, index) => {
          const isDeactivated = Boolean(inst.customFields?.isDeactivated);
          const status = computeStatus(inst.expireDate, inst.actualExpireDate, 60, isDeactivated);
          const isOpen = expanded === inst.id;
          const domainUrl = getDomainUrl(inst.domain);
          const serialNumber = startIndex + index + 1;
          const callCount = getCallCount(inst);
          const commCount = getCommunicationCount(inst, commLogsOverrides);

          return (
            <div
              key={inst.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isDeactivated
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
              } ${isOpen ? "ring-2 ring-blue-500/20 border-blue-500/40 dark:border-blue-500/40" : ""}`}
            >
              {/* Main Card Header (Tappable Row) */}
              <div
                onClick={() => setExpanded(isOpen ? null : inst.id)}
                className="p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors"
              >
                {/* Serial Number & Chevron */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 min-w-[18px] text-center">
                    {serialNumber}
                  </span>
                  <span
                    className={`inline-block transition-transform text-sm font-bold ${
                      isOpen ? "rotate-90 text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    ›
                  </span>
                </div>

                {/* Institution Details Header */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                          {inst.instituteName}
                        </h3>
                        {isDeactivated && (
                          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Deactivated
                          </span>
                        )}
                      </div>
                      {inst.instituteNameBangla && (
                        <p className="bn text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {inst.instituteNameBangla}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
                        <span className="truncate flex-1 min-w-0">{inst.instituteType} · {inst.category}</span>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Badge className={`text-[10px] px-2 py-0.5 ${STATUS_COLOR[status]}`}>
                            {STATUS_LABEL[status]}
                          </Badge>
                          <ActionMenu
                            inst={inst}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onAddTask={onAddTask}
                            onToggleDeactivate={onToggleDeactivate}
                            onCallUpdate={(i) => setSelectedCallInst(i)}
                            onViewLogs={(i) => setSelectedLogsInst(i)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dropdown Accordion Content (Visible when Expanded) */}
              {isOpen && (
                <div className="p-3.5 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
                  {/* Quick Action Bar for Mobile */}
                  <div className="flex items-center justify-between gap-2 my-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCallInst(inst);
                      }}
                      className="relative flex-1 py-2 px-2.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>Call</span>
                      {callCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900 pointer-events-none">
                          {callCount > 99 ? "99+" : callCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLogsInst(inst);
                      }}
                      className="relative flex-1 py-2 px-2.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span>Logs</span>
                      {commCount.total > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900 pointer-events-none">
                          {commCount.total > 99 ? "99+" : commCount.total}
                        </span>
                      )}
                    </button>

                    {onAddTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddTask(inst);
                        }}
                        className="flex-1 py-2 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Task</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(inst);
                      }}
                      className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors active:scale-95"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* Quick Key Dates & Domain */}
                  <div className="grid grid-cols-2 gap-3 text-xs mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium text-[10px]">
                        Issue Date
                      </span>
                      <div className="text-slate-800 dark:text-slate-200 mt-0.5 text-xs font-semibold">
                        {fmtDate(inst.issueDate)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium text-[10px]">
                        Expire Date
                      </span>
                      <div className="text-slate-800 dark:text-slate-200 mt-0.5 text-xs font-semibold">
                        {fmtDate(inst.expireDate)}
                      </div>
                    </div>
                    {inst.domain && (
                      <div className="col-span-2 pt-1">
                        <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium text-[10px]">
                          Website / Domain
                        </span>
                        <div className="mt-0.5">
                          <a
                            href={domainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-sans text-xs break-all font-medium"
                          >
                            <span>{inst.domain}</span>
                            <svg className="w-3.5 h-3.5 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detailed Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                    {DETAIL_FIELD_ORDER.map((key) => {
                      const value = getInstitutionFieldValue(inst, key);
                      if (!value) return null;
                      return (
                        <div key={key} className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                            {FIELD_LABELS[key] || key}
                          </div>
                          <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100 break-words break-all text-xs">
                            {fmtMaybeDate(key, value)}
                          </div>
                        </div>
                      );
                    })}
                    {customFieldDefs.map((f) => {
                      if (isInternalOrMigratedCustomField(f.key)) return null;
                      const value = inst.customFields?.[f.key];
                      if (!value) return null;
                      return (
                        <div key={f.key} className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                            {f.label}
                          </div>
                          <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100 break-words break-all text-xs">
                            {value}
                          </div>
                        </div>
                      );
                    })}
                    {/* Render any institution-specific custom fields not in global defs */}
                    {Object.entries(inst.customFields || {}).map(([k, val]) => {
                      if (!val || isInternalOrMigratedCustomField(k) || customFieldDefs.some((d) => d.key === k)) return null;
                      const label = k.replace(/^cf_/, "").replace(/_/g, " ").toUpperCase();
                      return (
                        <div key={k} className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                            {label}
                          </div>
                          <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100 break-words break-all text-xs">
                            {String(val)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Render Communication History (Emails & SMS) */}
                  <InstitutionCommunicationSection
                    inst={inst}
                    onOpenModal={() => setSelectedLogsInst(inst)}
                  />

                  {/* Render Google Map Embed at the bottom */}
                  <InstitutionMapEmbed inst={inst} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (md:block) - Complete Full-Featured Desktop Table */}
      {/* ========================================================================= */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full border-collapse text-sm table-fixed min-w-[1040px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
              <th className="w-12 px-3 py-3 text-center">SL #</th>
              <th className="w-8 px-2 py-3 text-center"></th>
              <th className="w-[220px] lg:w-[250px] px-3 py-3 text-left">Institute Name</th>
              <th className="px-3 py-3 text-left">Website / Domain</th>
              <th className="w-28 px-3 py-3 text-center">Issue Date</th>
              <th className="w-28 px-3 py-3 text-center">Expire Date</th>
              <th className="w-32 px-3 py-3 text-center">Status</th>
              <th className="w-44 px-3 py-3 text-center">Call & Logs</th>
              <th className="w-28 px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
            {paginatedInstitutions.map((inst, index) => {
              const isDeactivated = Boolean(inst.customFields?.isDeactivated);
              const status = computeStatus(inst.expireDate, inst.actualExpireDate, 60, isDeactivated);
              const isOpen = expanded === inst.id;
              const domainUrl = getDomainUrl(inst.domain);
              const serialNumber = startIndex + index + 1;
              const callCount = getCallCount(inst);
              const commCount = getCommunicationCount(inst, commLogsOverrides);

              return (
                <Fragment key={inst.id}>
                  <tr
                    className={`cursor-pointer border-b border-slate-200 dark:border-slate-800/70 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      isDeactivated ? "opacity-75 bg-slate-50/40 dark:bg-slate-900/40" : ""
                    } ${
                      isOpen ? "bg-slate-50 dark:bg-slate-900/60" : ""
                    }`}
                    onClick={() => setExpanded(isOpen ? null : inst.id)}
                  >
                    <td className="w-12 px-3 py-3 text-center text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                      {serialNumber}
                    </td>
                    <td className="w-8 px-2 py-3 text-center text-slate-400 dark:text-slate-500">
                      <span className={`inline-block transition-transform text-sm ${isOpen ? "rotate-90 text-blue-600 dark:text-blue-400 font-bold" : ""}`}>›</span>
                    </td>
                    <td className="w-[220px] lg:w-[250px] px-3 py-3 overflow-hidden text-left">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <TableTooltip text={inst.instituteName} className="font-medium text-slate-900 dark:text-slate-100">
                            <span className="truncate block font-semibold">{inst.instituteName}</span>
                          </TableTooltip>
                          {isDeactivated && (
                            <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                              Deactivated
                            </span>
                          )}
                        </div>
                        {inst.instituteNameBangla && (
                          <TableTooltip text={inst.instituteNameBangla} className="bn text-xs text-slate-600 dark:text-slate-400">
                            <span className="truncate block">{inst.instituteNameBangla}</span>
                          </TableTooltip>
                        )}
                        <TableTooltip text={`${inst.instituteType} · ${inst.category}`} className="mt-0.5 text-xs text-slate-500">
                          <span className="truncate block">{inst.instituteType} · {inst.category}</span>
                        </TableTooltip>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-sans text-xs text-slate-700 dark:text-slate-300 overflow-hidden text-left">
                      {inst.domain ? (
                        <TableTooltip text={inst.domain}>
                          <a
                            href={domainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-medium font-sans max-w-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{inst.domain}</span>
                            <svg className="w-3 h-3 opacity-80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </TableTooltip>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="w-28 px-3 py-3 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(inst.issueDate)}</td>
                    <td className="w-28 px-3 py-3 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(inst.expireDate)}</td>
                    <td className="w-32 px-3 py-3 text-center whitespace-nowrap">
                      <Badge className={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                    </td>
                    <td className="w-44 px-3 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCallInst(inst);
                          }}
                          className={`relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs border cursor-pointer ${
                            callCount > 0
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50"
                              : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          title="View & Log Call Updates"
                        >
                          <svg
                            className={`w-3.5 h-3.5 shrink-0 ${callCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span>Call</span>
                          {callCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900 pointer-events-none">
                              {callCount > 99 ? "99+" : callCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogsInst(inst);
                          }}
                          className={`relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs border cursor-pointer ${
                            commCount.total > 0
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50"
                              : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          title="View Email & SMS Sent Logs"
                        >
                          <svg
                            className={`w-3.5 h-3.5 shrink-0 ${commCount.total > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                            />
                          </svg>
                          <span>Logs</span>
                          {commCount.total > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900 pointer-events-none">
                              {commCount.total > 99 ? "99+" : commCount.total}
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="w-28 px-3 py-3 whitespace-nowrap text-right">
                      <ActionMenu
                        inst={inst}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAddTask={onAddTask}
                        onToggleDeactivate={onToggleDeactivate}
                        onCallUpdate={(i) => setSelectedCallInst(i)}
                        onViewLogs={(i) => setSelectedLogsInst(i)}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-slate-200 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-950/60">
                      <td colSpan={9} className="px-6 py-5">
                        {/* Detailed Fields Grid for Desktop */}
                        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                          {DETAIL_FIELD_ORDER.map((key) => {
                            const value = getInstitutionFieldValue(inst, key);
                            if (!value) return null;
                            return (
                              <div key={key}>
                                <div className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">
                                  {FIELD_LABELS[key] || key}
                                </div>
                                <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{fmtMaybeDate(key, value)}</div>
                              </div>
                            );
                          })}
                          {customFieldDefs.map((f) => {
                            if (isInternalOrMigratedCustomField(f.key)) return null;
                            const value = inst.customFields?.[f.key];
                            if (!value) return null;
                            return (
                              <div key={f.key}>
                                <div className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">
                                  {f.label}
                                </div>
                                <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{value}</div>
                              </div>
                            );
                          })}
                          {/* Render any institution-specific custom fields not in global defs */}
                          {Object.entries(inst.customFields || {}).map(([k, val]) => {
                            if (!val || isInternalOrMigratedCustomField(k) || customFieldDefs.some((d) => d.key === k)) return null;
                            const label = k.replace(/^cf_/, "").replace(/_/g, " ").toUpperCase();
                            return (
                              <div key={k}>
                                <div className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">
                                  {label}
                                </div>
                                <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{String(val)}</div>
                              </div>
                            );
                          })}

                          {/* Render Email & SMS Communication History */}
                          <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                            <InstitutionCommunicationSection
                              inst={inst}
                              onOpenModal={() => setSelectedLogsInst(inst)}
                            />
                          </div>

                          {/* Render Google Map Embed at the bottom */}
                          <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                            <InstitutionMapEmbed inst={inst} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination & Navigation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 px-1 border-t border-slate-200 dark:border-slate-800">
        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-900 dark:text-slate-100">{totalCount > 0 ? startIndex + 1 : 0}</span> to{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">{endIndex}</span> of{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">{totalCount}</span> institutions
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === "all" ? "all" : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Navigation buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={validPage === 1}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="First Page"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ‹ Prev
              </button>

              {getPageNumbers(validPage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-slate-400 text-xs font-bold">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(Number(p))}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      validPage === p
                        ? "bg-blue-600 text-white shadow-xs"
                        : "border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validPage === totalPages}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Last Page"
              >
                »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Call Update Modal */}
      {selectedCallInst && (
        <CallUpdateModal
          inst={selectedCallInst}
          onClose={() => setSelectedCallInst(null)}
          onCallUpdateAdded={(instId, updatedCalls) => {
            setSelectedCallInst((prev) =>
              prev && prev.id === instId
                ? {
                    ...prev,
                    callUpdates: updatedCalls,
                    customFields: {
                      ...(prev.customFields || {}),
                      callUpdates: updatedCalls,
                    },
                  }
                : prev
            );
            if (onCallUpdateAdded) {
              onCallUpdateAdded(instId, updatedCalls);
            }
          }}
        />
      )}

      {/* Institution Communication (Email & SMS) Logs Modal */}
      {selectedLogsInst && (
        <InstitutionCommunicationModal
          inst={selectedLogsInst}
          onClose={() => setSelectedLogsInst(null)}
          onLogsUpdated={(instId, updatedLogs) => {
            setCommLogsOverrides((prev) => ({
              ...prev,
              [instId]: updatedLogs,
            }));
            setSelectedLogsInst((prev) =>
              prev && prev.id === instId
                ? {
                    ...prev,
                    communicationLogs: updatedLogs,
                    customFields: {
                      ...(prev.customFields || {}),
                      communicationLogs: updatedLogs,
                    },
                  }
                : prev
            );
            if (onCommunicationLogsUpdated) {
              onCommunicationLogsUpdated(instId, updatedLogs);
            }
          }}
        />
      )}
    </div>
  );
}

function getCallCount(inst: Institution): number {
  const cf = (inst.customFields as any) || {};
  if (Array.isArray(inst.callUpdates)) return inst.callUpdates.length;
  if (Array.isArray(cf.callUpdates)) return cf.callUpdates.length;
  return 0;
}

function getCommunicationCount(
  inst: Institution,
  overrides?: Record<string, CommunicationLog[]>
): { total: number; email: number; sms: number } {
  const overridden = overrides && overrides[inst.id];
  const cf = (inst.customFields as any) || {};
  const logs = Array.isArray(overridden)
    ? overridden
    : Array.isArray(inst.communicationLogs)
    ? inst.communicationLogs
    : Array.isArray(cf.communicationLogs)
    ? cf.communicationLogs
    : [];
  return {
    total: logs.length,
    email: logs.filter((l: any) => l.type === "EMAIL" || l.channel === "EMAIL").length,
    sms: logs.filter((l: any) => l.type === "SMS" || l.channel === "SMS").length,
  };
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function fmtMaybeDate(key: string, value: string) {
  if (key.toLowerCase().includes("date")) return fmtDate(value);
  return value;
}
