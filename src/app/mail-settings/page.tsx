"use client";

import { useEffect, useState } from "react";
import { SidebarLayout } from "@/components/SidebarLayout";
import { useUserSession } from "@/lib/userSession";
import { MailServiceSettings, DEFAULT_MAIL_SETTINGS } from "@/lib/mailTypes";
import {
  SmtpConfig,
  SmtpPublicConfig,
  DEFAULT_SMTP_CONFIG,
  SMTP_PRESETS,
  SmtpProviderType,
} from "@/lib/smtpTypes";

export default function MailSettingsPage() {
  const { isSuperAdmin } = useUserSession();

  // Tab State
  const [activeTab, setActiveTab] = useState<"smtp" | "rules">("smtp");

  // Notification Rules State
  const [settings, setSettings] = useState<MailServiceSettings>(DEFAULT_MAIL_SETTINGS);
  const [providerInfo, setProviderInfo] = useState<{
    name: string;
    senderEmail: string;
    restApiConfigured: boolean;
    smtpRelayConfigured: boolean;
    customSmtpActive?: boolean;
  } | null>(null);

  // SMTP Settings State
  const [smtpConfig, setSmtpConfig] = useState<SmtpPublicConfig>(DEFAULT_SMTP_CONFIG);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState(false);
  const [smtpError, setSmtpError] = useState("");

  // Verification & Test State
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // General Loading & Notification Rules Save State
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSuccess, setRulesSuccess] = useState(false);
  const [rulesError, setRulesError] = useState("");

  // Cron Dispatch State
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronResult, setCronResult] = useState<{
    success: boolean;
    checkedCount?: number;
    overdueSent?: number;
    remindersSent?: number;
    errors?: string[];
    message?: string;
  } | null>(null);

  useEffect(() => {
    loadAllSettings();
  }, []);

  async function loadAllSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/mail-settings");
      const data = await res.json();
      if (data.success) {
        if (data.settings) setSettings(data.settings);
        if (data.smtp) {
          setSmtpConfig(data.smtp);
          if (data.smtp.fromEmail && !testEmail) {
            setTestEmail(data.smtp.fromEmail);
          }
        }
        if (data.provider) {
          setProviderInfo(data.provider);
          if (!testEmail && data.provider.senderEmail) {
            setTestEmail(data.provider.senderEmail);
          }
        }
      }
    } catch (err: any) {
      setSmtpError(err.message || "Failed to load mail configurations");
    } finally {
      setLoading(false);
    }
  }

  // --- Notification Rules Handlers ---
  async function handleToggleRule(key: keyof MailServiceSettings) {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    await persistRules(updated);
  }

  async function persistRules(newSettings: MailServiceSettings) {
    setSavingRules(true);
    setRulesSuccess(false);
    setRulesError("");

    try {
      const res = await fetch("/api/mail-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });
      const data = await res.json();
      if (data.success) {
        setRulesSuccess(true);
        setTimeout(() => setRulesSuccess(false), 3000);
      } else {
        setRulesError(data.error || "Failed to save settings");
      }
    } catch (err: any) {
      setRulesError(err.message || "Failed to save settings");
    } finally {
      setSavingRules(false);
    }
  }

  // --- SMTP Settings Handlers ---
  function handleSelectPreset(presetKey: SmtpProviderType) {
    const preset = SMTP_PRESETS[presetKey];
    if (!preset) return;

    setSmtpConfig((prev) => ({
      ...prev,
      provider: presetKey,
      host: preset.host || prev.host,
      port: preset.port,
      secure: preset.secure,
    }));
    setVerifyResult(null);
    setTestResult(null);
  }

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSavingSmtp(true);
    setSmtpSuccess(false);
    setSmtpError("");
    setVerifyResult(null);

    const payload: Partial<SmtpConfig> = {
      isEnabled: smtpConfig.isEnabled,
      provider: smtpConfig.provider,
      host: smtpConfig.host,
      port: Number(smtpConfig.port) || 587,
      secure: Boolean(smtpConfig.secure),
      user: smtpConfig.user,
      fromEmail: smtpConfig.fromEmail,
      fromName: smtpConfig.fromName,
      replyTo: smtpConfig.replyTo,
      useBrevoFallback: smtpConfig.useBrevoFallback,
    };

    if (smtpPassword.trim()) {
      payload.pass = smtpPassword.trim();
    }

    try {
      const res = await fetch("/api/mail-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp: payload }),
      });
      const data = await res.json();
      if (data.success && data.smtp) {
        setSmtpConfig(data.smtp);
        setSmtpPassword(""); // clear input after save
        setSmtpSuccess(true);
        setTimeout(() => setSmtpSuccess(false), 4000);
        // refresh provider summary
        loadAllSettings();
      } else {
        setSmtpError(data.error || "Failed to save SMTP configuration");
      }
    } catch (err: any) {
      setSmtpError(err.message || "Network error while saving SMTP settings");
    } finally {
      setSavingSmtp(false);
    }
  }

  // --- Verification Handshake Handler ---
  async function handleVerifyConnection() {
    setVerifying(true);
    setVerifyResult(null);
    setTestResult(null);

    const payloadSmtp: Partial<SmtpConfig> = {
      ...smtpConfig,
      port: Number(smtpConfig.port) || 587,
    };
    if (smtpPassword.trim()) {
      payloadSmtp.pass = smtpPassword.trim();
    }

    try {
      const res = await fetch("/api/mail-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifyOnly: true,
          smtpConfig: payloadSmtp,
        }),
      });
      const data = await res.json();
      setVerifyResult({
        success: data.success,
        message: data.message || (data.success ? "SMTP connection successful!" : "Verification failed"),
      });
    } catch (err: any) {
      setVerifyResult({
        success: false,
        message: err.message || "Failed to verify SMTP connection",
      });
    } finally {
      setVerifying(false);
    }
  }

  // --- Send Test Email Handler ---
  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setSendingTest(true);
    setTestResult(null);

    const payloadSmtp: Partial<SmtpConfig> = {
      ...smtpConfig,
      port: Number(smtpConfig.port) || 587,
    };
    if (smtpPassword.trim()) {
      payloadSmtp.pass = smtpPassword.trim();
    }

    try {
      const res = await fetch("/api/mail-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: testEmail.trim(),
          smtpConfig: payloadSmtp,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? "Test email sent successfully!" : "Failed to send test email"),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Network error while sending test email",
      });
    } finally {
      setSendingTest(false);
    }
  }

  // --- Cron Alert Trigger Handler ---
  async function handleRunTaskAlertCheck(reset: boolean = false) {
    setTriggeringCron(true);
    setCronResult(null);
    try {
      const url = reset ? "/api/cron/tasks?reset=true" : "/api/cron/tasks?force=true";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCronResult({
          success: true,
          checkedCount: data.checkedCount,
          overdueSent: data.overdueSent,
          remindersSent: data.remindersSent,
          errors: data.errors || [],
          message: `Check completed: ${data.checkedCount} active tasks scanned. ${data.overdueSent} overdue alerts and ${data.remindersSent} 2h reminders dispatched.`,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-changed"));
        }
      } else {
        setCronResult({
          success: false,
          message: data.error || "Failed to execute task alert check",
          errors: data.errors || [],
        });
      }
    } catch (err: any) {
      setCronResult({
        success: false,
        message: err.message || "Network error while triggering task alerts",
      });
    } finally {
      setTriggeringCron(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <SidebarLayout title="Mail Settings" subtitle="Super Admin Access Only">
        <div className="p-8 text-center max-w-md mx-auto">
          <div className="p-6 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-bold text-base mb-1">Access Restricted</h3>
            <p className="text-xs">Only the Super Administrator can configure SMTP and mail services.</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const notificationServices = [
    {
      key: "taskAssignment" as keyof MailServiceSettings,
      name: "Task Assignment Notification",
      badge: "Rule 1",
      description: "Automatically dispatches an email to an employee whenever a task is created or reassigned to them.",
      target: "Assigned Employee",
    },
    {
      key: "passwordReset" as keyof MailServiceSettings,
      name: "Password Reset OTP Verification",
      badge: "Rule 2",
      description: "Sends a secure 6-digit one-time verification code to an employee's registered email to reset their password.",
      target: "Employee's Registered Email",
    },
    {
      key: "taskOverdue" as keyof MailServiceSettings,
      name: "Task Overdue Alert",
      badge: "Rule 3",
      description: "Triggered strictly once per task when the deadline has passed. Dispatches an urgent alert to the assigned employee and assigner.",
      target: "Assigned Employee & Assigner",
    },
    {
      key: "taskDueSoon" as keyof MailServiceSettings,
      name: "2-Hour Deadline Reminder",
      badge: "Rule 4",
      description: "Sends an alert strictly once to the assigned employee exactly 2 hours before the scheduled deadline.",
      target: "Assigned Employee (Strictly Once)",
    },
    {
      key: "taskCompletion" as keyof MailServiceSettings,
      name: "Task Completion Confirmation",
      badge: "Rule 5",
      description: "Enables an optional confirmation email to be sent exclusively to the task assigner when a task is marked completed.",
      target: "Task Assigner (Optional)",
    },
  ];

  return (
    <SidebarLayout
      title="Mail & SMTP Settings"
      subtitle="Configure outgoing SMTP mail server and automated notification channels"
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("smtp")}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "smtp"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>SMTP Server Setup (Super Admin)</span>
            {smtpConfig.isEnabled ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Custom SMTP
              </span>
            ) : (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Default Brevo
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "rules"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Notification Services & Toggles</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              5 Rules
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SMTP CONFIGURATION */}
        {/* ========================================================================= */}
        {activeTab === "smtp" && (
          <div className="space-y-6">
            {/* Status alerts */}
            {smtpSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-sm">
                <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>SMTP configuration updated successfully! All outbound emails will now route through this server.</span>
              </div>
            )}

            {smtpError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{smtpError}</span>
              </div>
            )}

            {/* Provider Overview Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Active Email Dispatch Engine
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      {smtpConfig.isEnabled ? "Custom SMTP Active" : "Default Brevo Active"}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {smtpConfig.isEnabled ? (
                      <>
                        <span>{smtpConfig.host || "Custom Host"}</span>
                        <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                          (Port {smtpConfig.port} &middot; {smtpConfig.secure ? "SSL" : "TLS/STARTTLS"})
                        </span>
                      </>
                    ) : (
                      <span>Brevo (Sendinblue) Default Relay</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Effective Sender:{" "}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      {smtpConfig.isEnabled
                        ? smtpConfig.fromEmail || smtpConfig.user || "Not configured"
                        : providerInfo?.senderEmail || "imperialitbd2011@gmail.com"}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Custom SMTP Mode
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {smtpConfig.isEnabled ? "Routing via your SMTP" : "Using system fallback"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSmtpConfig((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
                    }
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                      smtpConfig.isEnabled ? "bg-[#2196F3]" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                    title={smtpConfig.isEnabled ? "Disable Custom SMTP" : "Enable Custom SMTP"}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                        smtpConfig.isEnabled ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Presets Section */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Quick Server Presets
                </span>
                <span className="text-[11px] text-slate-500">
                  Click to auto-fill host, port and security
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {(Object.keys(SMTP_PRESETS) as SmtpProviderType[]).map((key) => {
                  const preset = SMTP_PRESETS[key];
                  const isSelected = smtpConfig.provider === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-sm"
                          : "border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{preset.name.split("/")[0]}</span>
                        {isSelected && <span className="text-blue-500 text-[10px]">●</span>}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 mt-1 truncate">
                        {preset.host || "Custom host"}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preset Helpful Hint */}
              {smtpConfig.provider && SMTP_PRESETS[smtpConfig.provider]?.hint && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
                  <span className="text-sm shrink-0">💡</span>
                  <div className="leading-relaxed">
                    <strong>{SMTP_PRESETS[smtpConfig.provider].name} Guide:</strong>{" "}
                    {SMTP_PRESETS[smtpConfig.provider].hint}
                  </div>
                </div>
              )}
            </div>

            {/* SMTP Configuration Form */}
            <form onSubmit={handleSaveSmtp} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    SMTP Credentials & Connection Settings
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure host, port, authentication credentials, and sender headers
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {smtpConfig.provider.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* SMTP Host */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    SMTP Server / Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="e.g. smtp.gmail.com or mail.yourdomain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Port */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                    placeholder="587 / 465 / 25"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Encryption & Security Mode */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Security & Encryption Protocol
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      !smtpConfig.secure
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
                        : "border-slate-200 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="secure"
                        checked={!smtpConfig.secure}
                        onChange={() => setSmtpConfig({ ...smtpConfig, secure: false })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-bold">STARTTLS / TLS (Port 587)</div>
                        <div className="text-[11px] opacity-75">Recommended for Gmail, Brevo, Outlook</div>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      smtpConfig.secure
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
                        : "border-slate-200 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="secure"
                        checked={smtpConfig.secure}
                        onChange={() => setSmtpConfig({ ...smtpConfig, secure: true })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-bold">SSL / Direct TLS (Port 465)</div>
                        <div className="text-[11px] opacity-75">Common for cPanel, Titan, Hostinger</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Username and Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    SMTP Username / Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpConfig.user}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                    placeholder="e.g. user@gmail.com or info@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      SMTP Password / App Password
                    </label>
                    {smtpConfig.hasPassword && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span>✓ Password Saved</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={
                        smtpConfig.hasPassword
                          ? "•••••••• (Leave blank to keep existing)"
                          : "Enter SMTP or App Password"
                      }
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Name, Sender Email & Reply-To */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sender Name ("From Name")
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.fromName}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                    placeholder="e.g. Imperial IT"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sender Email ("From Address")
                  </label>
                  <input
                    type="email"
                    value={smtpConfig.fromEmail}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                    placeholder="Defaults to SMTP Username"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Reply-To Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={smtpConfig.replyTo || ""}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, replyTo: e.target.value })}
                    placeholder="e.g. support@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Application Base URL for Email Links */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Application Live URL / Domain (Email & Notification Links)
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      This URL is used in email dashboard buttons, task links, and footer links (e.g. VPS IP or custom domain).
                    </p>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    Optional
                  </span>
                </div>
                <input
                  type="text"
                  value={smtpConfig.appUrl || ""}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, appUrl: e.target.value })}
                  placeholder="https://hisam.beepsystems.com.bd/database"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  If left empty, environment variables <code>APP_URL</code> or <code>NEXT_PUBLIC_APP_URL</code> will be used automatically (ensuring the /database path).
                </p>
              </div>

              {/* Brevo Fallback Toggle */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Fallback to Brevo on Failure (Recommended)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    If custom SMTP encounters temporary downtime or connection errors, automatically fallback to Brevo relay so critical OTPs & task notifications never fail.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={smtpConfig.useBrevoFallback}
                  onChange={(e) =>
                    setSmtpConfig({ ...smtpConfig, useBrevoFallback: e.target.checked })
                  }
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 shrink-0"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyConnection}
                  disabled={verifying || savingSmtp || !smtpConfig.host || !smtpConfig.user}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {verifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      <span>Testing Handshake...</span>
                    </>
                  ) : (
                    <>
                      <span>🔌 Test Connection Handshake</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={savingSmtp || verifying}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingSmtp ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving SMTP Settings...</span>
                    </>
                  ) : (
                    <span>Save SMTP Configuration</span>
                  )}
                </button>
              </div>
            </form>

            {/* Handshake Verification Result Notice */}
            {verifyResult && (
              <div
                className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 ${
                  verifyResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                }`}
              >
                <span className="text-base leading-none">
                  {verifyResult.success ? "✅" : "❌"}
                </span>
                <div className="leading-relaxed">
                  <div className="font-bold mb-0.5">
                    {verifyResult.success ? "Connection Verified" : "Connection Failed"}
                  </div>
                  <div>{verifyResult.message}</div>
                </div>
              </div>
            )}

            {/* Send Live Test Email Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Send Live Test Email via Configured SMTP
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Verify end-to-end email delivery directly into your inbox from the configured SMTP server.
              </p>

              <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row gap-2 max-w-lg">
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email address..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-5 py-2.5 bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
                >
                  {sendingTest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <span>Send Test Email</span>
                  )}
                </button>
              </form>

              {testResult && (
                <div
                  className={`mt-3 p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                  }`}
                >
                  <span className="text-base leading-none">
                    {testResult.success ? "✅" : "❌"}
                  </span>
                  <div className="leading-relaxed">{testResult.message}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: NOTIFICATION RULES & CRON DISPATCHER */}
        {/* ========================================================================= */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            {/* Rules save status */}
            {rulesSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Notification rules updated successfully!</span>
              </div>
            )}

            {rulesError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{rulesError}</span>
              </div>
            )}

            {/* Master Switch Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Master Email Switch
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Turn all outbound system emails ON or OFF with a single global toggle.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleRule("masterEnabled")}
                  disabled={savingRules}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                    settings.masterEnabled ? "bg-[#2196F3]" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  title={settings.masterEnabled ? "Disable All Emails" : "Enable All Emails"}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      settings.masterEnabled ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 5 Distinct Service Toggles */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Authorized Notification Channels
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Enable or disable individual notification channels based on your workflow requirements.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  5 Services
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notificationServices.map((svc) => {
                  const isEnabled = settings[svc.key] && settings.masterEnabled;

                  return (
                    <div
                      key={svc.key}
                      className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {svc.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                            {svc.badge}
                          </span>
                          {isEnabled ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                              Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-semibold">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {svc.description}
                        </p>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Target:</span>
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {svc.target}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleRule(svc.key)}
                        disabled={savingRules || !settings.masterEnabled}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                          settings[svc.key] && settings.masterEnabled
                            ? "bg-[#2196F3]"
                            : "bg-slate-200 dark:bg-slate-700 opacity-60"
                        }`}
                        title={settings[svc.key] ? "Disable Service" : "Enable Service"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                            settings[svc.key] && settings.masterEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Alert & Overdue Notification Dispatcher */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Task Alert & Overdue Notification Dispatcher</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      Real-time Cron
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Trigger background scanning for approaching deadlines (2-hour notice) and overdue task email alerts immediately.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRunTaskAlertCheck(false)}
                    disabled={triggeringCron}
                    className="px-3.5 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {triggeringCron ? "Scanning..." : "⚡ Run Alert Check Now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunTaskAlertCheck(true)}
                    disabled={triggeringCron}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                    title="Clears sent memory and re-evaluates all active tasks"
                  >
                    Reset & Rescan
                  </button>
                </div>
              </div>

              {cronResult && (
                <div
                  className={`mt-3 p-3.5 rounded-xl text-xs ${
                    cronResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <span>{cronResult.success ? "✅ Dispatch Report" : "❌ Dispatch Failed"}</span>
                  </div>
                  <p className="text-xs">{cronResult.message}</p>
                  {cronResult.errors && cronResult.errors.length > 0 && (
                    <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 space-y-0.5">
                      {cronResult.errors.map((err, idx) => (
                        <div key={idx}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
