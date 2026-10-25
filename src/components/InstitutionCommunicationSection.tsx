"use client";
import React, { useState } from "react";
import { Institution, CommunicationLog } from "@/lib/types";
import { formatDhakaDate } from "@/lib/dateUtils";

interface Props {
  inst: Institution;
  onOpenModal?: () => void;
}

function formatLogTimestamp(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDhakaDate(d, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export function InstitutionCommunicationSection({ inst, onOpenModal }: Props) {
  const cf = (inst.customFields as any) || {};
  const logs: CommunicationLog[] = Array.isArray(inst.communicationLogs)
    ? inst.communicationLogs
    : Array.isArray(cf.communicationLogs)
    ? cf.communicationLogs
    : [];

  const [filter, setFilter] = useState<"ALL" | "EMAIL" | "SMS">("ALL");

  const emailCount = logs.filter((l) => l.type === "EMAIL").length;
  const smsCount = logs.filter((l) => l.type === "SMS").length;

  const filteredLogs = logs.filter((log) => {
    if (filter !== "ALL" && log.type !== filter) return false;
    return true;
  });

  const previewLogs = filteredLogs.slice(0, 3);

  return (
    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Email & SMS Logs
          </span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {logs.length}
          </span>
        </div>

        {/* Channel Filters & Modal Launcher */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-2 py-0.5 rounded transition-all ${
                filter === "ALL"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              All ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("EMAIL")}
              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                filter === "EMAIL"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-blue-600"
              }`}
            >
              <span>✉️</span>
              <span>{emailCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("SMS")}
              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                filter === "SMS"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-emerald-600"
              }`}
            >
              <span>💬</span>
              <span>{smsCount}</span>
            </button>
          </div>

          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0 ml-1"
            >
              <span>View All ({logs.length})</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Logs Preview List */}
      {previewLogs.length === 0 ? (
        <div className="py-3 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            No {filter === "ALL" ? "email or SMS" : filter} communications recorded for this institution yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {previewLogs.map((log) => {
            const isEmail = log.type === "EMAIL";
            const isSuccess = log.status === "SUCCESS";

            return (
              <div
                key={log.id}
                onClick={onOpenModal}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wide uppercase border ${
                        isEmail
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {isEmail ? "✉️ EMAIL" : "💬 SMS"}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-xs">
                      {log.subject}
                    </span>
                    {log.trigger && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                        {log.trigger}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono shrink-0">
                    <span className={`inline-flex items-center gap-1 font-semibold ${isSuccess ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {isSuccess ? "Sent" : "Failed"}
                    </span>
                    <span>{formatLogTimestamp(log.createdAt)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  To: <span className="font-mono text-slate-700 dark:text-slate-300">{log.recipient}</span>
                  {log.recipientLabel && <span className="ml-1 text-[10px] opacity-80">({log.recipientLabel})</span>}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-slate-850 p-2 rounded-md font-sans border border-slate-100 dark:border-slate-800/60">
                  {log.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
