"use client";
import React, { useState } from "react";
import { TaskItem } from "@/lib/types";
import { Button, Modal } from "@/components/ui";
import { getDhakaDayDiff, formatDhakaDate } from "@/lib/dateUtils";

interface TaskCompletionModalProps {
  task: any;
  onClose: () => void;
  onCompleted: () => void;
}

export function TaskCompletionModal({
  task,
  onClose,
  onCompleted,
}: TaskCompletionModalProps) {
  const [note, setNote] = useState<string>(task.completionNote || "");
  const [sendEmailNotification, setSendEmailNotification] = useState<boolean>(true);
  const defaultRecipient =
    task.assignedBy?.email || "imperialitbd2011@gmail.com";
  const [customRecipient, setCustomRecipient] = useState<string>(defaultRecipient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isMonthly = Boolean(task.isMonthly);
  const diffDays = task.dueDate ? getDhakaDayDiff(task.dueDate, new Date()) : 0;
  const isLocked = isMonthly && diffDays > 0;

  const instName = task.institution?.instituteName || task.institutionName || "General Task";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) {
      setError(`A monthly recurring task cannot be marked as complete before its scheduled date (${formatDhakaDate(task.dueDate)}).`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          progress: 100,
          completionNote: note.trim() || null,
          sendCompletionEmail: sendEmailNotification,
          notifyEmail: sendEmailNotification ? customRecipient.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete task");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("task-changed"));
      }

      onCompleted();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while completing task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Task Completion & Confirmation Mail" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        {/* Minimal Task Details */}
        <div className="pb-1">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {task.title}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-brass-700 dark:text-brass-400">
              🏛️ {instName}
            </span>
            {(() => {
              const assigneesList = (task.assignees && task.assignees.length > 0)
                ? task.assignees.map((a: any) => a.employee).filter(Boolean)
                : (task.assignedTo ? [task.assignedTo] : []);
              if (assigneesList.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <span>•</span>
                  {assigneesList.map((emp: any) => (
                    <span key={emp.id} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                      #{emp.orderSerial} {emp.name}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          {isMonthly && (
            <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
              isLocked
                ? "bg-sky-500/10 border-sky-500/30 text-sky-800 dark:text-sky-300"
                : "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300"
            }`}>
              <span className="text-base">{isLocked ? "🔒" : "🔁"}</span>
              <div>
                <span className="font-bold">Monthly Recurring Task:</span>{" "}
                {isLocked ? (
                  <span>
                    This task is scheduled for <strong>{formatDhakaDate(task.dueDate)}</strong>. It can only be marked as completed on or after its due date.
                  </span>
                ) : (
                  <span>
                    Completing this task will automatically schedule next month&apos;s task instance.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Remarks (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Remarks (Optional)
          </label>
          <textarea
            rows={2}
            value={note}
            disabled={isLocked}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any remarks..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        {/* Optional Email Checkbox */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={isLocked}
              checked={sendEmailNotification}
              onChange={(e) => setSendEmailNotification(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4 disabled:opacity-50"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Send email notification (Optional)
            </span>
          </label>

          {sendEmailNotification && !isLocked && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/60">
              <input
                type="email"
                required
                value={customRecipient}
                onChange={(e) => setCustomRecipient(e.target.value)}
                placeholder="Recipient email address"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={saving || isLocked}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? "Saving..."
              : isLocked
              ? `Locked until ${formatDhakaDate(task.dueDate, { month: "short", day: "numeric" })}`
              : sendEmailNotification
              ? "Complete & Send Email"
              : "Complete Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
