"use client";
import React, { useState, useMemo } from "react";
import { Employee, TaskItem, TASK_PRIORITY_COLOR, TASK_STATUS_COLOR } from "@/lib/types";
import { useUserSession } from "@/lib/userSession";
import { StatusNoteModal } from "./StatusNoteModal";
import { RescheduleModal } from "./RescheduleModal";
import { TaskCompletionModal } from "./TaskCompletionModal";
import {
  formatDhakaDate,
  formatDhakaTime,
  getDhakaDayDiff,
  getDhakaMonthKeyAndLabel,
} from "@/lib/dateUtils";

interface UpcomingTasksListProps {
  tasks: TaskItem[];
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onToggleComplete: (task: TaskItem) => void;
  onRefresh?: () => void;
}

export function UpcomingTasksList({
  tasks,
  onEdit,
  onDelete,
  onToggleComplete,
  onRefresh,
}: UpcomingTasksListProps) {
  const { currentUser } = useUserSession();
  const [noteModalTask, setNoteModalTask] = useState<TaskItem | null>(null);
  const [rescheduleModalTask, setRescheduleModalTask] = useState<TaskItem | null>(null);
  const [completingTask, setCompletingTask] = useState<TaskItem | null>(null);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  // Subtask Interaction State
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});
  const [addingSubtaskForTask, setAddingSubtaskForTask] = useState<string | null>(null);
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  function toggleSubtaskExpand(taskId: string) {
    setExpandedSubtasks((prev) => ({
      ...prev,
      [taskId]: prev[taskId] === undefined ? false : !prev[taskId],
    }));
  }

  async function handleToggleSubtask(task: TaskItem, subtaskId: string, currentCompleted: boolean) {
    setUpdatingSubtaskId(subtaskId);
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCompleted: !currentCompleted,
          completedById: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-changed"));
        }
        if (onRefresh) onRefresh();

        if (data.allCompleted && task.status !== "Completed") {
          setCompletingTask(data.task || task);
        }
      }
    } catch (err) {
      console.error("Failed to toggle subtask:", err);
    } finally {
      setUpdatingSubtaskId(null);
    }
  }

  async function handleAddSubtask(taskId: string) {
    const text = (subtaskInputs[taskId] || "").trim();
    if (!text) return;
    setAddingSubtaskForTask(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: text,
          createdById: currentUser.id,
        }),
      });
      if (res.ok) {
        setSubtaskInputs((prev) => ({ ...prev, [taskId]: "" }));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-changed"));
        }
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to add subtask:", err);
    } finally {
      setAddingSubtaskForTask(null);
    }
  }

  async function handleDeleteSubtask(taskId: string, subtaskId: string) {
    if (!confirm("Are you sure you want to remove this subtask?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-changed"));
        }
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Failed to delete subtask:", err);
    }
  }

  function toggleMonthCollapse(monthKey: string) {
    setCollapsedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  }

  async function handleClaimTask(task: TaskItem) {
    if (currentUser.id === "super-admin") {
      alert("Please select a specific employee from the header account switcher to claim tasks for an employee.");
      return;
    }
    setClaimingTaskId(task.id);
    try {
      const existingAssigneeIds = (task.assignees && task.assignees.length > 0)
        ? task.assignees.map((a) => a.employeeId)
        : (task.assignedToId ? [task.assignedToId] : []);
      const newAssigneeIds = Array.from(new Set([...existingAssigneeIds, currentUser.id]));

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToIds: newAssigneeIds,
          assignedToId: newAssigneeIds[0] || currentUser.id,
        }),
      });
      if (res.ok && onRefresh) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-changed"));
        }
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to claim task:", err);
    } finally {
      setClaimingTaskId(null);
    }
  }

  function getRelativeTimeBadge(dueDateStr: string, status: string, isMonthly?: boolean) {
    if (status === "Completed") {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
          Completed
        </span>
      );
    }

    const due = new Date(dueDateStr);
    const now = new Date();

    const diffDays = getDhakaDayDiff(due, now);
    const timeStr = formatDhakaTime(due, { hour: "2-digit", minute: "2-digit" });

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 whitespace-nowrap">
          Overdue by {absDays}d ({formatDhakaDate(due, { month: "short", day: "numeric" })})
        </span>
      );
    }

    if (diffDays === 0) {
      const isPastTime = due.getTime() < now.getTime();
      if (isPastTime) {
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 whitespace-nowrap">
            Overdue Today ({timeStr})
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 whitespace-nowrap">
          Due Today ({timeStr})
        </span>
      );
    }

    if (diffDays === 1) {
      return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap border ${
          isMonthly
            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-bold"
            : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
        }`}>
          {isMonthly ? `Tomorrow • 1-Day Reminder (${timeStr})` : `Tomorrow (${timeStr})`}
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
        In {diffDays} days ({formatDhakaDate(due, { month: "short", day: "numeric" })})
      </span>
    );
  }

  // Group tasks by Month
  const monthGroups = useMemo(() => {
    const now = new Date();
    const currentMonthKey = getDhakaMonthKeyAndLabel(now).key;

    const groupsMap = new Map<
      string,
      {
        monthKey: string;
        label: string;
        isCurrentMonth: boolean;
        tasks: TaskItem[];
        stats: {
          total: number;
          pending: number;
          completed: number;
          overdue: number;
          cancelled: number;
        };
      }
    >();

    tasks.forEach((task) => {
      let monthKey = "undated";
      let label = "Undated Tasks";

      if (task.dueDate) {
        const { key, label: mLabel } = getDhakaMonthKeyAndLabel(task.dueDate);
        monthKey = key;
        label = mLabel;
      }

      if (!groupsMap.has(monthKey)) {
        groupsMap.set(monthKey, {
          monthKey,
          label,
          isCurrentMonth: monthKey === currentMonthKey,
          tasks: [],
          stats: { total: 0, pending: 0, completed: 0, overdue: 0, cancelled: 0 },
        });
      }

      const grp = groupsMap.get(monthKey)!;
      grp.tasks.push(task);
      grp.stats.total += 1;

      const isCompleted = task.status === "Completed";
      const isCancelled = task.status === "Canceled" || task.status === "Cancelled";
      const due = new Date(task.dueDate);
      const isOverdue = !isCompleted && !isCancelled && !isNaN(due.getTime()) && due.getTime() < Date.now();

      if (isCompleted) grp.stats.completed += 1;
      else if (isCancelled) grp.stats.cancelled += 1;
      else if (isOverdue) grp.stats.overdue += 1;
      else grp.stats.pending += 1;
    });

    const groups = Array.from(groupsMap.values());

    // Sort order: Current Month first -> Upcoming (chronological) -> Past (most recent first) -> Undated
    groups.sort((a, b) => {
      if (a.monthKey === "undated") return 1;
      if (b.monthKey === "undated") return -1;

      if (a.monthKey === currentMonthKey) return -1;
      if (b.monthKey === currentMonthKey) return 1;

      const isAFuture = a.monthKey > currentMonthKey;
      const isBFuture = b.monthKey > currentMonthKey;

      if (isAFuture && isBFuture) {
        return a.monthKey.localeCompare(b.monthKey); // Nearest upcoming first
      }
      if (!isAFuture && !isBFuture) {
        return b.monthKey.localeCompare(a.monthKey); // Most recent past first
      }

      return isAFuture ? -1 : 1;
    });

    return groups;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500">
        <p className="text-sm">No tasks found matching your criteria.</p>
        <p className="text-xs text-slate-400 mt-1">Click "+ Add Task" to create your first schedule.</p>
      </div>
    );
  }

  function renderTaskCard(task: TaskItem) {
    const isCompleted = task.status === "Completed";
    const isCancelled = task.status === "Canceled" || task.status === "Cancelled";
    const isMonthly = Boolean(task.isMonthly);
    const diffDays = task.dueDate ? getDhakaDayDiff(task.dueDate, new Date()) : 0;
    const isLockedMonthly = isMonthly && diffDays > 0 && !isCompleted;
    const instName = task.institution?.instituteName || task.institutionName || "General Task";
    const due = new Date(task.dueDate);
    const isOverdue = !isCompleted && !isCancelled && due.getTime() < Date.now();

    const assignerEmp = task.assignedBy;
    
    // Collect all assigned employees
    const assigneesList: Employee[] = [];
    if (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
      for (const a of task.assignees) {
        if (a.employee) assigneesList.push(a.employee);
      }
    }
    if (assigneesList.length === 0 && task.assignedTo) {
      assigneesList.push(task.assignedTo);
    }

    const isUnassigned = assigneesList.length === 0 && !task.assignedToId;
    const isAssignedToMe = assigneesList.some((e) => e.id === currentUser.id) || task.assignedToId === currentUser.id;

    return (
      <div
        key={task.id}
        className={`group rounded-xl border p-3.5 sm:p-4 transition-all duration-200 bg-white dark:bg-slate-900 ${
          isCompleted
            ? "border-slate-200 dark:border-slate-800 opacity-75"
            : isOverdue
            ? "border-red-300 dark:border-red-900/50 shadow-sm"
            : "border-slate-200 dark:border-slate-800 hover:border-brass-500/40 shadow-sm"
        }`}
      >
        {/* Top Container: Checkbox + Title/Pill on left, Action buttons on right */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
          
          {/* Left Content Area */}
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Complete checkbox */}
            <button
              type="button"
              disabled={isLockedMonthly}
              onClick={() => {
                if (isCompleted) {
                  onToggleComplete(task);
                } else if (isLockedMonthly) {
                  alert(`A monthly recurring task cannot be marked as complete before its scheduled date (${formatDhakaDate(task.dueDate)}).`);
                } else {
                  setCompletingTask(task);
                }
              }}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                isCompleted
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : isLockedMonthly
                  ? "border-purple-300 dark:border-purple-800 bg-purple-500/10 cursor-not-allowed opacity-60 text-purple-600 dark:text-purple-400"
                  : "border-slate-300 dark:border-slate-600 hover:border-emerald-500"
              }`}
              title={
                isCompleted
                  ? "Mark as pending"
                  : isLockedMonthly
                  ? `Locked until ${formatDhakaDate(task.dueDate)}`
                  : "Complete task (opens completion modal with email option)"
              }
            >
              {isCompleted ? (
                <svg className="h-3.5 w-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : isLockedMonthly ? (
                <span className="text-[10px]">🔒</span>
              ) : null}
            </button>

            <div className="min-w-0 flex-1">
              {/* Title & Institution Pill */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className={`text-sm font-semibold break-words ${
                    isCompleted
                      ? "line-through text-slate-400 dark:text-slate-500"
                      : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {task.title}
                </span>

                {/* Institution Name Pill */}
                <span className="inline-flex items-center text-[11px] font-medium text-brass-700 dark:text-brass-400 bg-brass-500/10 px-2 py-0.5 rounded-md break-all">
                  {instName}
                </span>

                {/* Monthly Recurring Pill */}
                {Boolean(task.isMonthly) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md">
                    <span className="text-[10px]">🔁</span>
                    <span>Monthly</span>
                  </span>
                )}
              </div>

              {/* Task details text */}
              {task.description && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 whitespace-pre-wrap">
                  {task.description}
                </p>
              )}

              {/* Visual Progress Bar */}
              {(() => {
                const prog = task.progress ?? (isCompleted ? 100 : 0);
                return (
                  <div className="mt-2 flex items-center gap-2 max-w-xs sm:max-w-md">
                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden border border-slate-300/30 dark:border-slate-700/50">
                      <div
                        className={`h-full transition-all duration-300 ${
                          prog === 100
                            ? "bg-emerald-500"
                            : prog >= 50
                            ? "bg-brass-500"
                            : prog > 0
                            ? "bg-sky-500"
                            : "bg-slate-400"
                        }`}
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
                      {prog}%
                    </span>
                  </div>
                );
              })()}

              {/* Subtasks Section */}
              {(() => {
                const subtasks = task.subtasks || [];
                const completedCount = subtasks.filter((s) => s.isCompleted).length;
                const totalCount = subtasks.length;

                // If task is completed and has no subtasks, do not show subtasks section at all
                if (isCompleted && totalCount === 0) return null;

                const isExpanded = expandedSubtasks[task.id] !== false;
                const isAllCompleted = totalCount > 0 && completedCount === totalCount;

                return (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-2.5 sm:p-3 space-y-2 max-w-2xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSubtaskExpand(task.id)}
                          className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#2196F3] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                          <span>Subtasks</span>
                        </button>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            isAllCompleted
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : totalCount > 0
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {completedCount}/{totalCount} done
                        </span>
                      </div>

                      {totalCount > 0 && !isExpanded && (
                        <button
                          type="button"
                          onClick={() => toggleSubtaskExpand(task.id)}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Show list ({totalCount})
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 pt-1">
                        {/* Subtasks List */}
                        {subtasks.length > 0 ? (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {subtasks.map((st) => {
                              const isUpdating = updatingSubtaskId === st.id;
                              return (
                                <div
                                  key={st.id}
                                  className={`group flex items-start justify-between gap-2.5 p-2 rounded-lg border text-xs transition-colors ${
                                    st.isCompleted
                                      ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500/20 text-slate-500 dark:text-slate-400"
                                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200"
                                  }`}
                                >
                                  <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={st.isCompleted}
                                      disabled={isCompleted || isUpdating}
                                      onChange={() => handleToggleSubtask(task, st.id, st.isCompleted)}
                                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`leading-snug break-words ${
                                          st.isCompleted ? "line-through text-slate-400 dark:text-slate-500" : "font-medium"
                                        }`}
                                      >
                                        {st.title}
                                      </p>
                                      {st.isCompleted && st.completedAt && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                                          ✓ Completed {formatDhakaTime(new Date(st.completedAt))}
                                        </p>
                                      )}
                                    </div>
                                  </label>

                                  {!isCompleted && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubtask(task.id, st.id)}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all shrink-0"
                                      title="Delete subtask"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No subtasks added yet.</p>
                        )}

                        {/* All Completed Banner */}
                        {isAllCompleted && !isCompleted && (
                          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>All subtasks completed!</span>
                            </span>
                            {isMonthly && diffDays > 0 ? (
                              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold text-[11px] border border-purple-500/30">
                                Locked until {formatDhakaDate(task.dueDate, { month: "short", day: "numeric" })}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCompletingTask(task)}
                                className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors shadow-xs"
                              >
                                Mark Task Completed
                              </button>
                            )}
                          </div>
                        )}

                        {/* Quick Inline Add Subtask Input - Hidden on completed tasks */}
                        {!isCompleted && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={subtaskInputs[task.id] || ""}
                              onChange={(e) =>
                                setSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddSubtask(task.id);
                                }
                              }}
                              placeholder="Add new subtask (Press Enter)..."
                              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2196F3]"
                            />
                            <button
                              type="button"
                              disabled={addingSubtaskForTask === task.id || !(subtaskInputs[task.id] || "").trim()}
                              onClick={() => handleAddSubtask(task.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-500/25 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {addingSubtaskForTask === task.id ? "Adding..." : "+ Add"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Completion Reason Box */}
              {task.completionNote && (
                <div className="mt-2.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 p-2.5 text-xs border border-blue-500/20 text-blue-900 dark:text-blue-200">
                  <span className="font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Reason / Outcome Note:</span>
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap">{task.completionNote}</p>
                </div>
              )}

              {/* Employee Assignment Badges & Meta Row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Employee Assignee Badges */}
                {isUnassigned ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 whitespace-nowrap flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Unassigned</span>
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {assigneesList.map((emp) => {
                      const isMe = emp.id === currentUser.id;
                      return (
                        <span
                          key={emp.id}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap flex items-center gap-1.5 ${
                            isMe
                              ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                          }`}
                          title={`${emp.name} (${emp.designation || emp.role})`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: emp.avatarColor || "#6366F1" }}
                          />
                          <span>#{emp.orderSerial || 0} {emp.name}</span>
                          {isMe && (
                            <span className="text-[9px] px-1 py-0.2 bg-purple-200/80 dark:bg-purple-900/80 rounded font-bold text-purple-800 dark:text-purple-200">
                              You
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Assigner Info Badge */}
                {(() => {
                  let assignerName = "";
                  if (assignerEmp) {
                    assignerName = `#${assignerEmp.orderSerial || 0} ${assignerEmp.name}`;
                  } else if (task.assignedById === "super-admin") {
                    assignerName = "Super Admin";
                  }

                  if (assignerName) {
                    const isSelf = (assigneesList.length === 1 && assigneesList[0].id === task.assignedById) || task.assignedById === task.assignedToId;
                    return (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap flex items-center gap-1 ${
                          isSelf
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                        }`}
                        title={`Task Assigner: ${assignerName}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>{isSelf ? "Self-Assigned" : `Assigned By: ${assignerName}`}</span>
                      </span>
                    );
                  }
                  return null;
                })()}

                {getRelativeTimeBadge(task.dueDate, task.status, task.isMonthly)}

                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${
                    TASK_PRIORITY_COLOR[task.priority] || "bg-slate-700/40 text-slate-400"
                  }`}
                >
                  {task.priority === "Argent" ? "Urgent" : task.priority} Priority
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${
                    TASK_STATUS_COLOR[task.status] || "bg-slate-700/40 text-slate-400"
                  }`}
                >
                  {task.status === "Pending" ? "To Do" : (task.status === "Cancelled" ? "Canceled" : task.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
            {/* Claim / Self Assign Task Button */}
            {(isUnassigned || (!isAssignedToMe && currentUser.id !== "super-admin")) && (
              <button
                onClick={() => handleClaimTask(task)}
                disabled={claimingTaskId === task.id}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-brass-500/20 text-brass-700 dark:text-brass-300 border border-brass-500/40 hover:bg-brass-500/30 transition-colors whitespace-nowrap flex items-center gap-1"
                title="Self-assign this task to your account"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>{claimingTaskId === task.id ? "Assigning..." : "Assign to Me"}</span>
              </button>
            )}

            {/* Complete Task Button with Email Notification */}
            {!isCompleted && (
              isMonthly && diffDays > 0 ? (
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 cursor-not-allowed whitespace-nowrap flex items-center gap-1 opacity-75"
                  title={`Monthly tasks can only be completed on or after ${formatDhakaDate(task.dueDate)}`}
                >
                  <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Locked until {formatDhakaDate(task.dueDate, { month: "short", day: "numeric" })}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCompletingTask(task)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors whitespace-nowrap flex items-center gap-1"
                  title="Mark task as completed and notify via email"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Complete</span>
                </button>
              )
            )}

            {/* Reschedule Button */}
            <button
              onClick={() => setRescheduleModalTask(task)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap flex items-center gap-1 ${
                isOverdue
                  ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/25"
                  : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 hover:bg-sky-500/20"
              }`}
              title="Reschedule task to a future date or time"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{isOverdue ? "Reschedule Overdue" : "Reschedule"}</span>
            </button>

            {/* Reason Note Button */}
            <button
              onClick={() => setNoteModalTask(task)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors whitespace-nowrap"
              title="Add or update completion/failure reason"
            >
              {task.completionNote ? "Edit Reason" : "+ Note / Reason"}
            </button>

            {/* Edit & Delete */}
            <button
              onClick={() => onEdit(task)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(task)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors whitespace-nowrap"
            >
              Delete
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {monthGroups.map((group) => {
        const isCollapsed = Boolean(collapsedMonths[group.monthKey]);

        return (
          <div key={group.monthKey} className="space-y-3">
            {/* Month Header Banner */}
            <div
              onClick={() => toggleMonthCollapse(group.monthKey)}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 backdrop-blur-sm cursor-pointer select-none hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brass-500/15 text-brass-700 dark:text-brass-400 flex items-center justify-center font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {group.label}
                  </span>
                </div>

                {group.isCurrentMonth && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    Current Month
                  </span>
                )}

                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                  {group.stats.total} {group.stats.total === 1 ? "Task" : "Tasks"}
                </span>

                {group.stats.overdue > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                    {group.stats.overdue} Overdue
                  </span>
                )}

                {group.stats.pending > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                    {group.stats.pending} Pending
                  </span>
                )}

                {group.stats.completed > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    {group.stats.completed} Completed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="hidden sm:inline text-[11px]">{isCollapsed ? "Click to expand" : "Click to collapse"}</span>
                <button
                  type="button"
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  aria-label={isCollapsed ? "Expand Month" : "Collapse Month"}
                >
                  <svg
                    className={`w-4 h-4 transform transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tasks of this month */}
            {!isCollapsed && (
              <div className="space-y-3">
                {group.tasks.map((task) => renderTaskCard(task))}
              </div>
            )}
          </div>
        );
      })}

      {/* Quick Status & Reason Modal */}
      {noteModalTask && (
        <StatusNoteModal
          task={noteModalTask}
          onClose={() => setNoteModalTask(null)}
          onSaved={() => {
            if (onRefresh) onRefresh();
            setNoteModalTask(null);
          }}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleModalTask && (
        <RescheduleModal
          task={rescheduleModalTask}
          onClose={() => setRescheduleModalTask(null)}
          onSaved={() => {
            if (onRefresh) onRefresh();
            setRescheduleModalTask(null);
          }}
        />
      )}

      {/* Task Completion Modal with Email Notification Option */}
      {completingTask && (
        <TaskCompletionModal
          task={completingTask}
          onClose={() => setCompletingTask(null)}
          onCompleted={() => {
            if (onRefresh) onRefresh();
            setCompletingTask(null);
          }}
        />
      )}
    </div>
  );
}
