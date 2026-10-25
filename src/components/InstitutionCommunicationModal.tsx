"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Institution, CommunicationLog } from "@/lib/types";
import { formatDhakaDate } from "@/lib/dateUtils";

interface Props {
  inst: Institution;
  onClose: () => void;
  onLogsUpdated?: (institutionId: string, updatedLogs: CommunicationLog[]) => void;
}

function formatLogTimestamp(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDhakaDate(d, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export function InstitutionCommunicationModal({ inst, onClose, onLogsUpdated }: Props) {
  const [logs, setLogs] = useState<CommunicationLog[]>(() => {
    const cf = (inst.customFields as any) || {};
    if (Array.isArray(inst.communicationLogs)) return inst.communicationLogs;
    if (Array.isArray(cf.communicationLogs)) return cf.communicationLogs;
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [channelFilter, setChannelFilter] = useState<"ALL" | "EMAIL" | "SMS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch updated logs from API
  async function fetchLogs() {
    if (!inst.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/institutions/${inst.id}/communication-logs`);
      if (!res.ok) throw new Error("Failed to load communication logs");
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        setLogs(data.logs);
        if (onLogsUpdated) {
          onLogsUpdated(inst.id, data.logs);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Could not retrieve logs from server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [inst.id]);

  function handleCopy(text: string, id: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  const emailCount = useMemo(() => logs.filter((l) => l.type === "EMAIL").length, [logs]);
  const smsCount = useMemo(() => logs.filter((l) => l.type === "SMS").length, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (channelFilter !== "ALL" && log.type !== channelFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSubject = (log.subject || "").toLowerCase().includes(query);
        const matchesContent = (log.content || "").toLowerCase().includes(query);
        const matchesRecipient = (log.recipient || "").toLowerCase().includes(query);
        const matchesTrigger = (log.trigger || "").toLowerCase().includes(query);
        return matchesSubject || matchesContent || matchesRecipient || matchesTrigger;
      }
      return true;
    });
  }, [logs, channelFilter, searchQuery]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Communication Logs
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {logs.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {inst.instituteName} {inst.domain ? `· ${inst.domain}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Refresh Logs"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* Channel Tabs */}
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChannelFilter("ALL")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                channelFilter === "ALL"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter("EMAIL")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                channelFilter === "EMAIL"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>✉️ Email</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {emailCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter("SMS")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                channelFilter === "SMS"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>💬 SMS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {smsCount}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              placeholder="Search in logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content Body / Logs List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {filteredLogs.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Communication Logs Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? "No logs matched your search terms."
                  : "Automated expiry notices and SMS alerts sent to this institution will be logged and visible here."}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isEmail = log.type === "EMAIL";
              const isSuccess = log.status === "SUCCESS";

              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs"
                >
                  {/* Top Row: Badges, Trigger, Timestamp */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${
                          isEmail
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isEmail ? "✉️ EMAIL" : "💬 SMS"}
                      </span>

                      {log.trigger && (
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {log.trigger}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                          isSuccess
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSuccess ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        {isSuccess ? "Sent" : "Failed"}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {formatLogTimestamp(log.createdAt)}
                    </span>
                  </div>

                  {/* Recipient & Subject Header */}
                  <div className="mb-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{log.subject}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>
                        Recipient: <strong className="font-mono text-slate-700 dark:text-slate-300">{log.recipient}</strong>
                      </span>
                      {log.recipientLabel && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {log.recipientLabel}
                        </span>
                      )}
                      {log.recipientName && (
                        <span className="text-slate-600 dark:text-slate-400">({log.recipientName})</span>
                      )}
                    </div>
                  </div>

                  {/* Message Content Bubble */}
                  <div className="relative rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-3 text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed whitespace-pre-wrap break-words">
                    {log.content}

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(log.content, log.id)}
                      className="absolute top-2 right-2 p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-[10px] font-semibold flex items-center gap-1"
                      title="Copy content"
                    >
                      {copiedId === log.id ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Error Notification if failed */}
                  {log.error && (
                    <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-mono bg-rose-50/60 dark:bg-rose-950/30 p-2 rounded border border-rose-200/50 dark:border-rose-900/30">
                      Error: {log.error}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Total Records: {filteredLogs.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-xs shadow-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
