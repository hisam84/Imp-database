"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserSession, clearStoredUser } from "@/lib/userSession";
import { formatDhakaDate, formatDhakaTime } from "@/lib/dateUtils";

interface SidebarLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  totalCountText?: string;
  onAddTaskClick?: () => void;
  headerActions?: ReactNode;
}

export function SidebarLayout({
  children,
  title,
  subtitle,
  totalCountText,
  onAddTaskClick,
  headerActions,
}: SidebarLayoutProps) {
  const { currentUser, isSuperAdmin } = useUserSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dismissed_task_alerts");
      if (stored) {
        setDismissedAlertIds(JSON.parse(stored));
      }
      const savedCollapsed = localStorage.getItem("imperial_sidebar_collapsed");
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === "true");
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("imperial_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const pathname = usePathname();
  const router = useRouter();

  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    setNavLoading(false);
  }, [pathname]);

  async function handleLogout() {
    setNavLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredUser();
    router.push("/login");
    router.refresh();
  }

  // Load approaching and overdue task notifications
  async function loadNotifications() {
    try {
      const res = await fetch("/api/tasks?alerts=true");
      const data = await res.json();
      if (Array.isArray(data)) {
        const now = new Date();
        const urgent = data.filter((t: any) => {
          if (t.status === "Completed" || t.status === "Canceled" || t.status === "Cancelled") return false;
          const due = new Date(t.dueDate);
          const diffMs = due.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          return diffHours <= 24; // Diff <= 24 includes all overdue (<0) and due within next 24h
        });

        // Overdue tasks at the very top, then ascending by nearest deadline
        urgent.sort((a: any, b: any) => {
          const dueA = new Date(a.dueDate).getTime();
          const dueB = new Date(b.dueDate).getTime();
          return dueA - dueB;
        });

        setUrgentTasks(urgent);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);

    // Periodically trigger background task alert email checks
    function triggerAlertCheck() {
      fetch("/api/cron/tasks").catch(() => {});
    }
    triggerAlertCheck();
    const alertInterval = setInterval(triggerAlertCheck, 120000);

    function handleTaskChange() {
      loadNotifications();
    }
    window.addEventListener("task-changed", handleTaskChange);

    return () => {
      clearInterval(interval);
      clearInterval(alertInterval);
      window.removeEventListener("task-changed", handleTaskChange);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const isOutsideDesktop = !notifRef.current || !notifRef.current.contains(target);
      const isOutsideMobile = !mobileNotifRef.current || !mobileNotifRef.current.contains(target);
      if (isOutsideDesktop && isOutsideMobile) {
        setShowNotifPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleDismissAlert(taskOrId: any) {
    const taskId = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    setDismissedAlertIds((prev) => {
      const next = prev.includes(taskId) ? prev : [...prev, taskId];
      try {
        localStorage.setItem("dismissed_task_alerts", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function handleDismissAllAlerts() {
    const ids = urgentTasks.map((t) => t.id);
    setDismissedAlertIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids]));
      try {
        localStorage.setItem("dismissed_task_alerts", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function handleQuickComplete(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to complete task");
        return;
      }
      handleDismissAlert(taskId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("task-changed"));
      }
      loadNotifications();
    } catch (err) {
      console.error("Failed to mark completed:", err);
    }
  }

  const allNavItems = [
    {
      label: "Main Dashboard",
      href: "/dashboard",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
        </svg>
      ),
    },
    {
      label: "Institutions Ledger",
      href: "/",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
        </svg>
      ),
    },
    {
      label: "Company Ledger",
      href: "/companies",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Targeted Clients",
      href: "/targeted-clients",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: "Tasks & Schedule",
      href: "/tasks",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: "My Profile",
      href: "/profile",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: "Logo & Banner Tool",
      href: "/image-tools",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Frame Generator",
      href: "/frame-generator",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            label: "Employee Management",
            href: "/employees",
            iconSvg: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
          {
            label: "Subscription Settings",
            href: "/settings",
            iconSvg: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: "SMTP & Mail Settings",
            href: "/mail-settings",
            iconSvg: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
        ]
      : []),
    {
      label: "Change Password",
      href: "/change-password",
      iconSvg: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
  ];

  const navItems = allNavItems;

  const activeUrgentTasks = urgentTasks.filter((t) => !dismissedAlertIds.includes(t.id));
  const urgentCount = activeUrgentTasks.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors relative">
      {/* GLOBAL TOP LOADING PROGRESS BAR */}
      {navLoading && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gradient-to-r from-[#0D47A1] via-[#2196F3] to-[#90CAF9] animate-pulse shadow-md" />
      )}

      {/* MOBILE TOP BAR (md:hidden) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
            aria-label="Open Navigation Menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/database/pad.png" alt="Imperial IT Logo" className="w-7 h-7 object-contain rounded-md" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0D47A1] dark:text-[#90CAF9] block leading-none">
                Imperial IT
              </span>
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[130px] leading-tight">
                {title || "Client Registry"}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Notification Bell */}
          <div className="relative md:hidden" ref={mobileNotifRef}>
            <button
              onClick={() => setShowNotifPopover(!showNotifPopover)}
              className="relative p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              title="Task Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {urgentCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                  {urgentCount}
                </span>
              )}
            </button>

            {showNotifPopover && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[300px] sm:w-[340px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Urgent Task Alerts</span>
                    {urgentCount > 0 && (
                      <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                        {urgentCount}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeUrgentTasks.length > 0 && (
                      <button
                        onClick={handleDismissAllAlerts}
                        className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline transition-colors"
                        title="Dismiss all alerts"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifPopover(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {urgentCount === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No urgent or overdue tasks.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {activeUrgentTasks.map((t) => {
                      const due = new Date(t.dueDate);
                      const now = new Date();
                      const diffMs = due.getTime() - now.getTime();
                      const isOverdue = diffMs < 0;
                      const instName = t.institution?.instituteName || t.institutionName || "General Task";

                      return (
                        <div
                          key={t.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-2 shadow-xs transition-all ${
                            isOverdue
                              ? "border-red-300 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/40"
                              : "border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isOverdue && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wider shrink-0">
                                  Overdue
                                </span>
                              )}
                              {Boolean(t.isMonthly) && !isOverdue && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600 text-white tracking-wider shrink-0 flex items-center gap-0.5">
                                  <span>🔁</span>
                                  <span>Monthly (1-day reminder)</span>
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {t.title}
                              </span>
                            </div>
                            <span className="text-[11px] text-brass-600 dark:text-brass-400 font-medium block truncate mt-0.5">
                              {instName}
                            </span>
                            <span
                              className={`text-[10px] font-semibold block mt-1 ${
                                isOverdue
                                  ? "text-red-600 dark:text-red-400 font-bold"
                                  : t.isMonthly
                                  ? "text-purple-600 dark:text-purple-400 font-bold"
                                  : "text-sky-600 dark:text-sky-400"
                              }`}
                            >
                              {isOverdue ? "Deadline was: " : t.isMonthly ? "📅 Due Tomorrow (1-Day Notice): " : "Due: "}
                              {formatDhakaDate(due, { month: "short", day: "numeric" })},{" "}
                              {formatDhakaTime(due, { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleQuickComplete(t.id)}
                              className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition-colors"
                              title="Mark task completed"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleDismissAlert(t.id)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                              title="Dismiss alert"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
                  <Link
                    href="/tasks"
                    onClick={() => setShowNotifPopover(false)}
                    className="text-xs font-bold text-brass-600 dark:text-brass-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Go to Tasks & Schedule</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {onAddTaskClick && (
            <button
              onClick={onAddTaskClick}
              className="px-3 py-1.5 bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs rounded-lg shadow-sm shadow-blue-500/25 border border-blue-600/30 flex items-center gap-1 active:scale-95 transition-all"
            >
              <span>+ Task</span>
            </button>
          )}
        </div>
      </div>

      {/* MOBILE DRAWER OVERLAY & BACKDROP WITH SLIDE ANIMATION */}
      <div className={`fixed inset-0 z-50 flex md:hidden transition-all duration-300 ${mobileMenuOpen ? "visible" : "invisible pointer-events-none"}`}>
        <div
          className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          className={`relative flex w-full max-w-xs flex-col bg-white dark:bg-slate-900 p-5 shadow-2xl z-10 border-r border-slate-200 dark:border-slate-800 justify-between transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <img src="/database/pad.png" alt="Imperial IT Logo" className="w-8 h-8 object-contain rounded-md" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-brass-600 dark:text-brass-400 block">
                    Imperial IT
                  </span>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                    The complete IT solution
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {onAddTaskClick && (
              <div className="mb-5">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onAddTaskClick();
                  }}
                  className="w-full py-2.5 bg-brass-500 hover:bg-brass-400 text-slate-950 font-bold text-xs rounded-lg shadow hover:shadow-md transition-all flex items-center justify-center gap-2 border border-brass-600/30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Task</span>
                </button>
              </div>
            )}

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#E3F2FD] dark:bg-[#2196F3]/20 text-[#0D47A1] dark:text-[#90CAF9] border border-[#90CAF9] dark:border-[#2196F3]/40 font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <span className="shrink-0">{item.iconSvg}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-6 space-y-3">
            {/* Theme Mode Switch in Mobile Drawer Sidebar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shadow-xs">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Theme</span>
              <ThemeToggle />
            </div>

            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                pathname === "/profile"
                  ? "bg-brass-500/15 border border-brass-500/30 font-semibold"
                  : "bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-xl object-cover border border-brass-500/40 shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0"
                  style={{ backgroundColor: currentUser.avatarColor || "#0b7677" }}
                >
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {currentUser.name}
                </h4>
                <p className="text-[10px] text-brass-600 dark:text-brass-400 truncate">
                  {currentUser.designation || (currentUser.role === "SUPER_ADMIN" ? "Super Admin" : "Employee")}
                </p>
              </div>

              <span className="text-xs text-brass-600 dark:text-brass-400 font-semibold underline">Profile →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* DESKTOP FIXED MINIMAL SIDEBAR (md:flex) */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 justify-between backdrop-blur-md transition-all duration-300 ${
          isCollapsed ? "md:w-[72px] p-2.5" : "md:w-60 p-4"
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Logo & Brand Header */}
          <div
            className={`border-b border-slate-200 dark:border-slate-800/80 pb-3.5 mb-4 flex items-center ${
              isCollapsed ? "flex-col justify-center gap-2" : "justify-between gap-2"
            }`}
          >
            <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? "justify-center" : ""}`}>
              <img
                src="/database/pad.png"
                alt="Imperial IT Logo"
                className="w-9 h-9 object-contain rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-1 shrink-0"
              />
              {!isCollapsed && (
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0D47A1] dark:text-[#90CAF9] block truncate">
                    Imperial IT
                  </span>
                  <h2 className="font-display text-sm text-slate-900 dark:text-slate-50 font-bold leading-tight truncate">
                    Client Registry
                  </h2>
                </div>
              )}
            </div>

            {/* Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer shrink-0"
              title={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Action Button: + Add Task */}
          {onAddTaskClick && (
            <div className="mb-4">
              {isCollapsed ? (
                <button
                  type="button"
                  onClick={onAddTaskClick}
                  className="w-10 h-10 mx-auto bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold rounded-xl shadow-sm shadow-blue-500/25 transition-all flex items-center justify-center active:scale-95 border border-blue-600/30 cursor-pointer"
                  title="Add Task"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onAddTaskClick}
                  className="w-full py-2.5 px-3 bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs rounded-lg shadow-sm shadow-blue-500/25 hover:shadow transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-blue-600/30 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Task</span>
                </button>
              )}
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 overflow-y-auto flex-1 pr-0.5">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavLoading(true)}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl text-xs font-medium transition-all ${
                    isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2"
                  } ${
                    isActive
                      ? "bg-[#E3F2FD] dark:bg-[#2196F3]/20 text-[#0D47A1] dark:text-[#90CAF9] border border-[#90CAF9] dark:border-[#2196F3]/40 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className="shrink-0">{item.iconSvg}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Theme Mode Footer Card */}
        <div className={`border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 shrink-0 ${isCollapsed ? "px-1" : "p-1"}`}>
          {/* Theme Mode Toggle in Desktop Sidebar */}
          {isCollapsed ? (
            <div className="flex justify-center p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shadow-xs" title="Theme">
              <ThemeToggle />
            </div>
          ) : (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shadow-xs">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Theme</span>
              <ThemeToggle />
            </div>
          )}

          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1.5 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
              <Link
                href="/profile"
                onClick={() => setNavLoading(true)}
                className="group"
                title={`${currentUser.name} (${currentUser.designation || (currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Employee')})`}
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-lg object-cover border border-brass-500/40 shrink-0 group-hover:border-brass-500 transition-colors"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0 group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: currentUser.avatarColor || "#0b7677" }}
                  >
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-red-500/80 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 transition-all shrink-0 cursor-pointer"
                title="Log out of account"
                aria-label="Logout"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 hover:border-brass-500/30 transition-all">
              <Link
                href="/profile"
                onClick={() => setNavLoading(true)}
                className="flex items-center gap-2.5 min-w-0 flex-1 group"
                title="View & Edit Profile"
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-xl object-cover border border-brass-500/40 shrink-0 group-hover:border-brass-500 transition-colors"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0 group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: currentUser.avatarColor || "#0b7677" }}
                  >
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-brass-600 dark:group-hover:text-brass-400 transition-colors">
                    {currentUser.name}
                  </h4>
                  <p className="text-[10px] text-brass-600 dark:text-brass-400 truncate">
                    {currentUser.designation || (currentUser.role === "SUPER_ADMIN" ? "Super Admin" : "Employee")}
                  </p>
                </div>
              </Link>

              {/* Dedicated Logout Button in User Card Footer */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-red-500/80 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all shrink-0 cursor-pointer"
                title="Log out of account"
                aria-label="Logout"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 max-w-full transition-all duration-300 ${
          isCollapsed ? "md:pl-[72px]" : "md:pl-60"
        }`}
      >
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 flex-1 min-w-0 max-w-full">
          {/* Header section inside main content with Notification Bell and Logout top right */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div>
              {title && (
                <h1 className="font-display text-2xl sm:text-3xl text-slate-900 dark:text-slate-50 font-bold">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
              {totalCountText && (
                <p className="mt-1 text-xs text-brass-600 dark:text-brass-400 font-medium">
                  {totalCountText}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 justify-start sm:justify-end">
              {headerActions}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                title="Log out of account"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>

              {/* Notification Bell in Main Page Header - DESKTOP ONLY */}
              <div className="relative hidden md:block" ref={notifRef}>
                <button
                  onClick={() => setShowNotifPopover((prev) => !prev)}
                  className="relative p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors shadow-xs"
                  title="Task Deadline Alerts"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {urgentCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                      {urgentCount}
                    </span>
                  )}
                </button>

                {/* NOTIFICATION POPOVER DROPDOWN - DIRECTLY ALIGNED UNDER BELL ICON */}
                {showNotifPopover && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-[320px] sm:w-[360px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>Urgent Task Alerts</span>
                        {urgentCount > 0 && (
                          <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                            {urgentCount}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2">
                        {activeUrgentTasks.length > 0 && (
                          <button
                            onClick={handleDismissAllAlerts}
                            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline transition-colors"
                            title="Dismiss all alerts"
                          >
                            Clear all
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifPopover(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                          title="Close"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {urgentCount === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No urgent or overdue tasks.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {activeUrgentTasks.map((t) => {
                          const due = new Date(t.dueDate);
                          const now = new Date();
                          const diffMs = due.getTime() - now.getTime();
                          const isOverdue = diffMs < 0;
                          const instName = t.institution?.instituteName || t.institutionName || "General Task";

                          return (
                            <div
                              key={t.id}
                              className={`p-3 rounded-xl border flex items-start justify-between gap-2 shadow-xs transition-all ${
                                isOverdue
                                  ? "border-red-300 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/40"
                                  : "border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isOverdue && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wider shrink-0">
                                      Overdue
                                    </span>
                                  )}
                                  {Boolean(t.isMonthly) && !isOverdue && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600 text-white tracking-wider shrink-0 flex items-center gap-0.5">
                                      <span>🔁</span>
                                      <span>Monthly (1-day reminder)</span>
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {t.title}
                                  </span>
                                </div>
                                <span className="text-[11px] text-brass-600 dark:text-brass-400 font-medium block truncate mt-0.5">
                                  {instName}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold block mt-1 ${
                                    isOverdue
                                      ? "text-red-600 dark:text-red-400 font-bold"
                                      : t.isMonthly
                                      ? "text-purple-600 dark:text-purple-400 font-bold"
                                      : "text-sky-600 dark:text-sky-400"
                                  }`}
                                >
                                  {isOverdue ? "Deadline was: " : t.isMonthly ? "📅 Due Tomorrow (1-Day Notice): " : "Due: "}
                                  {formatDhakaDate(due, { month: "short", day: "numeric" })},{" "}
                                  {formatDhakaTime(due, { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleQuickComplete(t.id)}
                                  className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition-colors"
                                  title="Mark task completed"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => handleDismissAlert(t.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                  title="Dismiss alert"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
                      <Link
                        href="/tasks"
                        onClick={() => setShowNotifPopover(false)}
                        className="text-xs font-bold text-brass-600 dark:text-brass-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Go to Tasks & Schedule</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
