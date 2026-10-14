"use client";
import React, { useState, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import { TargetedClient, CallUpdate } from "@/lib/types";
import { formatDhakaDateTime } from "@/lib/dateUtils";
import { CallUpdateModal } from "@/components/CallUpdateModal";

interface Props {
  clients: TargetedClient[];
  onEdit: (client: TargetedClient) => void;
  onToggleArchive: (client: TargetedClient) => void;
  onDelete: (client: TargetedClient) => void;
  onConvertToMain?: (client: TargetedClient) => void;
  onAddTask?: (client: TargetedClient) => void;
  onCallUpdateAdded?: (clientId: string, updatedList: CallUpdate[]) => void;
}

function getPriorityBadge(priority: string) {
  if (priority === "High") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 whitespace-nowrap">
        High
      </span>
    );
  }
  if (priority === "Low") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 whitespace-nowrap">
        Low
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
      {priority || "Default"}
    </span>
  );
}

function ActionMenu({
  client,
  onEdit,
  onDelete,
  onToggleArchive,
  onConvertToMain,
  onAddTask,
  onCallUpdate,
}: {
  client: TargetedClient;
  onEdit: (c: TargetedClient) => void;
  onDelete: (c: TargetedClient) => void;
  onToggleArchive: (c: TargetedClient) => void;
  onConvertToMain?: (c: TargetedClient) => void;
  onAddTask?: (c: TargetedClient) => void;
  onCallUpdate?: (c: TargetedClient) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; right: number; placeAbove: boolean }>({
    top: 0,
    right: 0,
    placeAbove: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const callCount = Array.isArray(client.callUpdates) ? client.callUpdates.length : 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 240;
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
        const portal = document.getElementById(`targeted-action-portal-${client.id}`);
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
  }, [isOpen, client.id]);

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
            id={`targeted-action-portal-${client.id}`}
            style={{
              position: "fixed",
              top: menuCoords.placeAbove ? undefined : `${menuCoords.top}px`,
              bottom: menuCoords.placeAbove ? `${window.innerHeight - menuCoords.top}px` : undefined,
              right: `${menuCoords.right}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="z-[9999] w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-1.5 shadow-xl text-left backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="space-y-0.5">
              {onCallUpdate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCallUpdate(client);
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
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      {callCount}
                    </span>
                  )}
                </button>
              )}

              {onAddTask && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddTask(client);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors text-left cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Task</span>
                </button>
              )}

              {onConvertToMain && !client.isArchived && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onConvertToMain(client);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors text-left cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span>Promote to Main</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onEdit(client);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Client</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onToggleArchive(client);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span>{client.isArchived ? "Restore Client" : "Archive Client"}</span>
              </button>

              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onDelete(client);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors text-left cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete Client</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function TargetedClientTable({
  clients,
  onEdit,
  onToggleArchive,
  onDelete,
  onConvertToMain,
  onAddTask,
  onCallUpdateAdded,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCallClient, setSelectedCallClient] = useState<TargetedClient | null>(null);

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500 shadow-sm">
        No targeted clients found. Click "+ Add Targeted Client" to create one.
      </div>
    );
  }

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE VIEW (< md) - Clean Cards with Dropdown                            */}
      {/* ========================================================================= */}
      <div className="md:hidden space-y-2.5 max-w-full overflow-hidden">
        {clients.map((client, index) => {
          const isOpen = expandedId === client.id;
          const callCount = Array.isArray(client.callUpdates) ? client.callUpdates.length : 0;
          const calls = Array.isArray(client.callUpdates) ? client.callUpdates : [];

          return (
            <div
              key={client.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                client.isArchived
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-75"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
              } ${isOpen ? "ring-2 ring-blue-500/20 border-blue-500/40 dark:border-blue-500/40" : ""}`}
            >
              {/* Main Card Header (Tappable Row) */}
              <div
                onClick={() => setExpandedId(isOpen ? null : client.id)}
                className="p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors"
              >
                {/* Serial Number & Chevron */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 min-w-[18px] text-center">
                    {index + 1}
                  </span>
                  <span
                    className={`inline-block transition-transform text-sm font-bold ${
                      isOpen ? "rotate-90 text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    ›
                  </span>
                </div>

                {/* Targeted Client Header Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                          {client.instituteName}
                        </h3>
                        {getPriorityBadge(client.priority)}
                      </div>
                      {client.instituteNameBangla && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bengali mt-0.5">
                          {client.instituteNameBangla}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        {client.contactPerson && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{client.contactPerson}</span>
                          </span>
                        )}
                        {client.phone && (
                          <span className="inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{client.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Call Update Button on Mobile Header */}
                      <button
                        type="button"
                        onClick={() => setSelectedCallClient(client)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          callCount > 0
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                        title="Call Update"
                      >
                        <svg className={`w-3.5 h-3.5 ${callCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {callCount > 0 && <span className="font-bold">{callCount}</span>}
                      </button>

                      <ActionMenu
                        client={client}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleArchive={onToggleArchive}
                        onConvertToMain={onConvertToMain}
                        onAddTask={onAddTask}
                        onCallUpdate={(c) => setSelectedCallClient(c)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Expanded Information Dropdown */}
              {isOpen && (
                <div className="p-3.5 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-xs space-y-3">
                  <div className="grid grid-cols-1 gap-2 pt-2 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="font-medium text-slate-500">Location:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {[client.subDistrict, client.district].filter(Boolean).join(", ") || "—"}
                      </span>
                    </div>

                    {client.address && (
                      <div className="py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="font-medium text-slate-500 block mb-0.5">Address:</span>
                        <p className="text-slate-800 dark:text-slate-200">{client.address}</p>
                      </div>
                    )}

                    {client.email && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="font-medium text-slate-500">Email:</span>
                        <a href={`mailto:${client.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {client.email}
                        </a>
                      </div>
                    )}

                    {client.notes && (
                      <div className="mt-2 rounded-lg bg-sky-500/5 dark:bg-sky-950/20 p-3 border border-sky-500/20">
                        <span className="font-bold text-sky-700 dark:text-sky-400 block mb-1">Notes / Remarks:</span>
                        <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed">
                          {client.notes}
                        </p>
                      </div>
                    )}

                    {/* Recent Call Log in Dropdown */}
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-xs">
                          <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>Recent Call Updates ({callCount}):</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCallClient(client)}
                          className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          + Log Call
                        </button>
                      </div>

                      {calls.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px]">No call updates logged yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {calls.slice(0, 3).map((call, idx) => (
                            <div key={call.id || idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-slate-900 dark:text-slate-100">{call.subject}</span>
                                <span className="text-slate-400 font-mono text-[10px]">{formatDhakaDateTime(call.createdAt)}</span>
                              </div>
                              <div className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 mb-1">
                                <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>Spoke with: <strong>{call.employeeName}</strong></span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 text-[11px]">{call.details}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (>= md) - Clean Table with Actions Button & Info Dropdown    */}
      {/* ========================================================================= */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse table-fixed">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            <tr>
              <th className="w-12 px-3 py-3.5 text-center">SL #</th>
              <th className="w-8 px-2 py-3.5 text-center"></th>
              <th className="w-24 px-3 py-3.5 text-center">Priority</th>
              <th className="px-4 py-3.5 text-left">Institute Name</th>
              <th className="w-44 px-3 py-3.5 text-left">Contact Person</th>
              <th className="w-48 px-3 py-3.5 text-left">Phone & Email</th>
              <th className="w-28 px-3 py-3.5 text-center">Status</th>
              <th className="w-36 px-3 py-3.5 text-center">Call Update</th>
              <th className="w-28 px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {clients.map((client, index) => {
              const isOpen = expandedId === client.id;
              const callCount = Array.isArray(client.callUpdates) ? client.callUpdates.length : 0;
              const calls = Array.isArray(client.callUpdates) ? client.callUpdates : [];

              return (
                <Fragment key={client.id}>
                  <tr
                    onClick={() => setExpandedId(isOpen ? null : client.id)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      client.isArchived ? "opacity-60 bg-slate-100/50 dark:bg-slate-950/40" : ""
                    } ${isOpen ? "bg-slate-50/90 dark:bg-slate-850/60" : ""}`}
                  >
                    {/* SL # */}
                    <td className="w-12 px-3 py-3.5 text-center font-mono font-medium text-slate-500 dark:text-slate-400">
                      {index + 1}
                    </td>

                    {/* Chevron Dropdown Trigger */}
                    <td className="w-8 px-2 py-3.5 text-center text-slate-400 dark:text-slate-500">
                      <span className={`inline-block transition-transform text-sm ${isOpen ? "rotate-90 text-blue-600 dark:text-blue-400 font-bold" : ""}`}>
                        ›
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="w-24 px-3 py-3.5 text-center whitespace-nowrap">
                      {getPriorityBadge(client.priority)}
                    </td>

                    {/* Institute Name */}
                    <td className="px-4 py-3.5 text-left overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                        {client.instituteName}
                      </div>
                      {client.instituteNameBangla && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bengali truncate mt-0.5">
                          {client.instituteNameBangla}
                        </div>
                      )}
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-full">
                        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">
                          {[client.subDistrict, client.district].filter(Boolean).join(", ") || "No location specified"}
                        </span>
                      </div>
                    </td>

                    {/* Contact Person */}
                    <td className="w-44 px-3 py-3.5 text-left font-medium overflow-hidden">
                      {client.contactPerson ? (
                        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">
                          {client.contactPerson}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Phone & Email */}
                    <td className="w-48 px-3 py-3.5 text-left overflow-hidden">
                      {client.phone ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 font-medium truncate">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="truncate">{client.phone}</span>
                        </div>
                      ) : null}
                      {client.email ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{client.email}</span>
                        </div>
                      ) : null}
                      {!client.phone && !client.email && <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>

                    {/* Status */}
                    <td className="w-28 px-3 py-3.5 text-center whitespace-nowrap">
                      {client.isArchived ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 whitespace-nowrap">
                          Archived
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Dedicated Call Update Button */}
                    <td className="w-36 px-3 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedCallClient(client)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs border cursor-pointer ${
                          callCount > 0
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50"
                            : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title="View & Log Call Updates"
                      >
                        <svg
                          className={`w-3.5 h-3.5 ${callCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}
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
                        <span>Call Update</span>
                        {callCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-tight">
                            {callCount}
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Actions Dropdown Button */}
                    <td className="w-28 px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        client={client}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleArchive={onToggleArchive}
                        onConvertToMain={onConvertToMain}
                        onAddTask={onAddTask}
                        onCallUpdate={(c) => setSelectedCallClient(c)}
                      />
                    </td>
                  </tr>

                  {/* ================================================================= */}
                  {/* EXPANDABLE INFORMATION DROPDOWN (তথ্য ড্রপডাউন)                     */}
                  {/* ================================================================= */}
                  {isOpen && (
                    <tr className="border-b border-slate-200 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-950/60 animate-in fade-in duration-100">
                      <td colSpan={9} className="px-6 py-5">
                        <div className="space-y-4">
                          {/* Top Quick Actions in Expanded View */}
                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Detailed Information:
                              </span>
                              <span className="text-xs text-slate-500">
                                {client.instituteName} {client.instituteNameBangla ? `(${client.instituteNameBangla})` : ""}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedCallClient(client)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>Call Update ({callCount})</span>
                              </button>

                              {onAddTask && (
                                <button
                                  type="button"
                                  onClick={() => onAddTask(client)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span>Add Task</span>
                                </button>
                              )}

                              {onConvertToMain && !client.isArchived && (
                                <button
                                  type="button"
                                  onClick={() => onConvertToMain(client)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                  </svg>
                                  <span>Promote to Main Ledger</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onEdit(client)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            {/* District & Sub-District */}
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                                Location (District & Sub-District)
                              </span>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {[client.subDistrict, client.district].filter(Boolean).join(", ") || "—"}
                              </div>
                            </div>

                            {/* Full Address */}
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                                Full Address
                              </span>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {client.address || "—"}
                              </div>
                            </div>

                            {/* Contact Person */}
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                                Contact Person & Phone
                              </span>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {client.contactPerson || "—"}
                              </div>
                              {client.phone && (
                                <a
                                  href={`tel:${client.phone}`}
                                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-[11px] block mt-0.5"
                                >
                                  {client.phone}
                                </a>
                              )}
                            </div>

                            {/* Added By & Email */}
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                                Added By & Email
                              </span>
                              <div className="font-semibold text-purple-700 dark:text-purple-300">
                                {client.createdBy?.name || "Admin / System"}
                              </div>
                              {client.email && (
                                <a
                                  href={`mailto:${client.email}`}
                                  className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] block mt-0.5 truncate"
                                >
                                  {client.email}
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Notes / Remarks if present */}
                          {client.notes && (
                            <div className="rounded-xl bg-sky-500/5 dark:bg-sky-950/20 p-3.5 border border-sky-500/20">
                              <span className="font-bold text-sky-700 dark:text-sky-400 text-xs block mb-1">
                                Notes / Remarks:
                              </span>
                              <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                                {client.notes}
                              </p>
                            </div>
                          )}

                          {/* Recent Call Updates Section with Caller Info */}
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <div className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-xs">
                                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>Recent Communication & Call Updates ({callCount}):</span>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  (Showing latest discussions & caller names)
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedCallClient(client)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                              >
                                <span>+ Log New Call</span>
                              </button>
                            </div>

                            {calls.length === 0 ? (
                              <div className="py-4 text-center text-slate-400 text-xs">
                                No call updates logged yet for this client. Click &ldquo;+ Log New Call&rdquo; to record discussions.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {calls.slice(0, 6).map((call, idx) => (
                                  <div
                                    key={call.id || idx}
                                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 space-y-1.5"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                        {call.subject}
                                      </h5>
                                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                        {formatDhakaDateTime(call.createdAt)}
                                      </span>
                                    </div>

                                    {/* Caller Employee Badge */}
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                        <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span>Spoke with: <strong>{call.employeeName || "Employee"}</strong></span>
                                      </span>
                                    </div>

                                    <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/70 dark:bg-slate-900/70 p-2 rounded border border-slate-200/60 dark:border-slate-800/60">
                                      {call.details}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
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

      {/* ========================================================================= */}
      {/* UNIVERSAL CALL UPDATE MODAL                                               */}
      {/* ========================================================================= */}
      {selectedCallClient && (
        <CallUpdateModal
          inst={selectedCallClient}
          apiEndpoint={`/api/targeted-clients/${selectedCallClient.id}/call-updates`}
          onClose={() => setSelectedCallClient(null)}
          onCallUpdateAdded={(clientId, updatedCalls) => {
            setSelectedCallClient((prev) =>
              prev && prev.id === clientId ? { ...prev, callUpdates: updatedCalls } : prev
            );
            if (onCallUpdateAdded) {
              onCallUpdateAdded(clientId, updatedCalls);
            }
          }}
        />
      )}
    </>
  );
}
