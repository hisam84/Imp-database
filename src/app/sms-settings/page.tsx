"use client";

import { useEffect, useState } from "react";
import { SidebarLayout } from "@/components/SidebarLayout";
import { useUserSession } from "@/lib/userSession";
import {
  SmsSettings,
  DEFAULT_SMS_SETTINGS,
  DEFAULT_SMS_TEMPLATE,
  renderSmsTemplate,
} from "@/lib/smsSettings";
import { calculateSmsParts, normalizeBdPhoneNumber } from "@/lib/adnSmsService";
import { SmsLogEntry } from "@/lib/smsExpiryNotificationService";

export default function SmsSettingsPage() {
  const { isSuperAdmin } = useUserSession();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"gateway" | "rules" | "template" | "logs">("gateway");

  // Settings State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [settings, setSettings] = useState<SmsSettings>(DEFAULT_SMS_SETTINGS);
  const [apiSecretInput, setApiSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);

  // New milestone input
  const [newMilestoneInput, setNewMilestoneInput] = useState("");

  // Balance Check State
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balanceResult, setBalanceResult] = useState<{
    success: boolean;
    smsBalance?: number;
    error?: string;
  } | null>(null);

  // Test SMS State
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    smsUid?: string | null;
    recipient?: string;
    error?: string;
    message?: string;
  } | null>(null);

  // Logs & Manual Scan State
  const [logs, setLogs] = useState<SmsLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");
  const [scanningNow, setScanningNow] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    checkedWebsites?: number;
    smsSent?: number;
    smsFailed?: number;
    skippedAlreadySent?: number;
    skippedNoPhone?: number;
    errors?: string[];
  } | null>(null);

  const [serverPublicIp, setServerPublicIp] = useState<string>("");

  // Load Settings on Mount
  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setSaveError("");
    try {
      const res = await fetch("/api/sms/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setHasExistingSecret(data.settings.hasApiSecret);
        setApiSecretInput(data.settings.apiSecret || "");
      }
      if (data.serverPublicIp) {
        setServerPublicIp(data.serverPublicIp);
      }
    } catch (err: any) {
      setSaveError("Failed to load SMS settings: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/sms/logs");
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load SMS logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const payload: any = {
        ...settings,
      };

      // Only pass apiSecret if user typed a new unmasked string
      if (apiSecretInput && !apiSecretInput.includes("••••")) {
        payload.apiSecret = apiSecretInput.trim();
      }

      const res = await fetch("/api/sms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (data.settings) {
          setSettings(data.settings);
          setHasExistingSecret(data.settings.hasApiSecret);
          setApiSecretInput(data.settings.apiSecret || "");
        }
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(data.error || "Failed to save settings");
      }
    } catch (err: any) {
      setSaveError(err?.message || "Network error saving settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckBalance() {
    setCheckingBalance(true);
    setBalanceResult(null);
    try {
      const res = await fetch("/api/sms/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          apiSecret: apiSecretInput && !apiSecretInput.includes("••••") ? apiSecretInput : undefined,
          apiDomain: settings.apiDomain,
        }),
      });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned HTTP ${res.status}: ${raw.slice(0, 100)}`);
      }
      setBalanceResult(data);
    } catch (err: any) {
      setBalanceResult({ success: false, error: err?.message || "Failed to connect to gateway" });
    } finally {
      setCheckingBalance(false);
    }
  }

  async function handleSendTest() {
    if (!testPhone.trim()) {
      alert("Please enter a valid phone number to send test SMS.");
      return;
    }
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sms/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage || undefined,
          apiKey: settings.apiKey,
          apiSecret: apiSecretInput && !apiSecretInput.includes("••••") ? apiSecretInput : undefined,
          apiDomain: settings.apiDomain,
          campaignTitle: settings.campaignTitle,
        }),
      });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned HTTP ${res.status}: ${raw.slice(0, 100)}`);
      }
      setTestResult(data);
      if (data.success) {
        fetchLogs();
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || "Failed to send test SMS" });
    } finally {
      setSendingTest(false);
    }
  }

  async function handleTriggerScanNow() {
    if (!confirm("Are you sure you want to run an immediate domain expiry SMS scan? This will check all institutions nearing expiration and send messages to eligible contacts.")) {
      return;
    }
    setScanningNow(true);
    setScanResult(null);
    try {
      // 1. Try dedicated dashboard scan route first
      let res = await fetch("/api/sms/scan?force=true", { method: "POST" });
      if (res.status === 404) {
        // Fallback to cron endpoint if scan route not yet cached
        res = await fetch("/api/cron/sms-expiry-alerts?force=true", { method: "POST" });
      }

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Server returned HTTP ${res.status} (${res.statusText || "HTML"}). ` +
          `If you just pulled the latest code on your VPS, please run 'npm run build' and restart your Next.js process (e.g. pm2 restart).`
        );
      }

      if (!res.ok && !data.errors) {
        throw new Error(data.error || `HTTP ${res.status}: Scan failed`);
      }

      setScanResult(data);
      fetchLogs();
    } catch (err: any) {
      setScanResult({ success: false, errors: [err?.message || "Scan failed"] });
    } finally {
      setScanningNow(false);
    }
  }

  async function handleResetSentCache(clearLogsToo = false) {
    if (
      !confirm(
        clearLogsToo
          ? "Are you sure you want to clear both deduplication memory AND recent audit logs?"
          : "Are you sure you want to reset the sent SMS deduplication cache? This allows re-sending alerts for testing."
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/sms/logs?clearLogs=${clearLogsToo ? "true" : "false"}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Cache reset successful.");
        fetchLogs();
      }
    } catch (err: any) {
      alert("Error resetting cache: " + err?.message);
    }
  }

  function handleAddMilestone() {
    const val = parseInt(newMilestoneInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid positive number of days.");
      return;
    }
    if (settings.expiryDaysMilestones.includes(val)) {
      alert(`Milestone of ${val} days is already added.`);
      return;
    }
    const updated = [...settings.expiryDaysMilestones, val].sort((a, b) => b - a);
    setSettings({ ...settings, expiryDaysMilestones: updated });
    setNewMilestoneInput("");
  }

  function handleRemoveMilestone(day: number) {
    const updated = settings.expiryDaysMilestones.filter((m) => m !== day);
    setSettings({ ...settings, expiryDaysMilestones: updated });
  }

  function handleInsertPlaceholder(tag: string) {
    setSettings((prev) => ({
      ...prev,
      template: prev.template + " " + tag,
    }));
  }

  // Calculate SMS parts for current template
  const sampleRendered = renderSmsTemplate(settings.template, {
    instituteName: "Dhaka Model School & College",
    instituteNameBangla: "ঢাকা মডেল স্কুল অ্যান্ড কলেজ",
    domain: "dhakamodel.edu.bd",
    expireDate: new Date(Date.now() + 7 * 86400000),
    daysRemaining: 7,
    contactPerson: "Principal / In-Charge",
    companyName: settings.companyName || "Imperial IT",
    companyPhone: settings.companyPhone || "01711223344",
  });

  const smsMetrics = calculateSmsParts(sampleRendered);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (!logsSearch.trim()) return true;
    const q = logsSearch.toLowerCase();
    return (
      log.institutionName.toLowerCase().includes(q) ||
      (log.domain && log.domain.toLowerCase().includes(q)) ||
      log.recipientPhone.includes(q) ||
      log.status.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <SidebarLayout title="SMS & Gateway Settings" subtitle="Loading ADN SMS configuration...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#0D47A1] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Loading SMS settings...
            </span>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout
      title="SMS & Gateway Settings"
      subtitle="Configure ADN SMS API, auto-expiry alerts, template, and review dispatch logs"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D47A1] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>Save Settings</span>
          </button>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Alerts / Feedback Banners */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">✓</span>
              <span>SMS Gateway settings and notification rules updated successfully!</span>
            </div>
            <button onClick={() => setSaveSuccess(false)} className="text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        )}

        {saveError && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚠️</span>
              <span>{saveError}</span>
            </div>
            <button onClick={() => setSaveError("")} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Top Summary & Status Hero Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Master Switch Status */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Auto-Expire SMS System
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    settings.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {settings.enabled ? "System Active (ON)" : "System Disabled (OFF)"}
                </h3>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0D47A1]" />
            </label>
          </div>

          {/* ADN Gateway Live Balance Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ADN SMS Gateway Balance
              </span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-extrabold text-[#0D47A1] dark:text-[#90CAF9] truncate">
                  {balanceResult?.smsBalance !== undefined
                    ? `${balanceResult.smsBalance.toLocaleString()} SMS`
                    : hasExistingSecret
                    ? "Click Check"
                    : "Not Configured"}
                </h3>
              </div>
            </div>
            <button
              onClick={handleCheckBalance}
              disabled={checkingBalance}
              className="px-3 py-1.5 bg-[#0D47A1]/10 hover:bg-[#0D47A1]/20 text-[#0D47A1] dark:text-[#90CAF9] border border-[#0D47A1]/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Query live balance from ADN SMS API"
            >
              {checkingBalance ? (
                <span className="w-3.5 h-3.5 border-2 border-[#0D47A1] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>Check</span>
            </button>
          </div>

          {/* Quick Manual Scan Trigger Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Immediate Expiry Scan
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Trigger scan now without waiting for cron
              </p>
            </div>
            <button
              onClick={handleTriggerScanNow}
              disabled={scanningNow}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {scanningNow ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              <span>Scan Now</span>
            </button>
          </div>
        </div>

        {/* Balance Result Feedback */}
        {balanceResult && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
              balanceResult.success
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="text-base mt-0.5">{balanceResult.success ? "💳" : "⚠️"}</span>
                <div className="space-y-1">
                  <div className="font-bold">
                    {balanceResult.success
                      ? `ADN SMS API Connected! Remaining balance: ${balanceResult.smsBalance?.toLocaleString()} SMS credits.`
                      : `Balance Check Failed`}
                  </div>
                  {!balanceResult.success && (
                    <div className="text-xs text-red-800 dark:text-red-300">
                      {balanceResult.error}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setBalanceResult(null)} className="opacity-60 hover:opacity-100 p-1">✕</button>
            </div>

            {/* Error 9998: IP_NOT_WHITELISTED Guided Action Box */}
            {!balanceResult.success &&
              (String(balanceResult.error).includes("9998") ||
                String(balanceResult.error).includes("IP_NOT_WHITELISTED")) && (
                <div className="mt-2 p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                      <span>🛡️</span>
                      <span>আইপি অনুমোদনের সমাধান (IP Whitelist Required):</span>
                    </span>
                    {serverPublicIp && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(serverPublicIp);
                          alert(`সার্ভার আইপি (${serverPublicIp}) ক্লিপবোর্ডে কপি করা হয়েছে!`);
                        }}
                        className="px-2.5 py-1 rounded bg-[#0D47A1] text-white hover:bg-blue-700 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Copy Server IP ({serverPublicIp}) 📋
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                    ADN SMS আপনার নিরাপত্তা নিশ্চিত করতে শুধুমাত্র হোয়াইটলিস্টে থাকা আইপি থেকে রিকোয়েস্ট গ্রহণ করে।{" "}
                    <strong>portal.adnsms.com</strong>-এ লগইন করে <strong>API Settings / IP Whitelist</strong> মেন্যুতে যান এবং আপনার সার্ভারের পাবলিক আইপি{" "}
                    <strong className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded text-amber-900 dark:text-amber-100">
                      {serverPublicIp || "লিস্টেড আইপি"}
                    </strong>{" "}
                    যুক্ত করুন। আইপি যুক্ত করার পর অবিলম্বে গেটওয়ে সচল হয়ে যাবে।
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Scan Result Feedback */}
        {scanResult && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
              scanResult.success
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>{scanResult.success ? "✓ Expiry Scan Completed" : "✕ Expiry Scan Notice"}</span>
              <button onClick={() => setScanResult(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
              <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/40">
                Websites Scanned: <strong>{scanResult.checkedWebsites ?? 0}</strong>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/60 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300">
                SMS Dispatched: <strong>{scanResult.smsSent ?? 0}</strong>
              </div>
              <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/40">
                Already Sent (Skipped): <strong>{scanResult.skippedAlreadySent ?? 0}</strong>
              </div>
              <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-900/60 border border-amber-300/40 text-amber-800 dark:text-amber-300">
                No Valid Phone: <strong>{scanResult.skippedNoPhone ?? 0}</strong>
              </div>
            </div>
            {scanResult.errors && scanResult.errors.length > 0 && (
              <div className="text-red-700 dark:text-red-400 mt-2">
                <span className="font-bold">Errors:</span> {scanResult.errors.join("; ")}
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("gateway")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "gateway"
                ? "bg-[#0D47A1] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>🔑</span>
            <span>Gateway Credentials & Test</span>
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rules"
                ? "bg-[#0D47A1] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>⏰</span>
            <span>Milestones & Phone Targets</span>
          </button>

          <button
            onClick={() => setActiveTab("template")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "template"
                ? "bg-[#0D47A1] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>💬</span>
            <span>SMS Template & Preview</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "logs"
                ? "bg-[#0D47A1] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>📜</span>
            <span>Dispatch Logs ({logs.length})</span>
          </button>
        </div>

        {/* TAB 1: GATEWAY CREDENTIALS & CONNECTION */}
        {activeTab === "gateway" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* Credentials Configuration Form */}
            <div className="lg:col-span-2 space-y-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ADN SMS API Credentials
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Connect your ADN SMS Provider account (https://portal.adnsms.com)
                </p>
              </div>

              {/* Server Outbound IP Whitelist Callout */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-blue-900 dark:text-blue-100">
                    <span>🛡️</span>
                    <span>Server Outbound IP (For ADN Whitelist)</span>
                  </span>
                  {serverPublicIp ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(serverPublicIp);
                        alert(`Server IP (${serverPublicIp}) copied to clipboard! Paste it into ADN SMS portal.`);
                      }}
                      className="px-2.5 py-1 rounded bg-[#0D47A1] hover:bg-blue-700 text-white font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                    >
                      <span>Copy IP: {serverPublicIp}</span>
                      <span>📋</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500">Detecting server IP...</span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                  ADN SMS গেটওয়ে ব্যবহারের জন্য আপনার সার্ভার আইপি ADN পোর্টালে হোয়াইটলিস্ট থাকতে হয় (অন্যথায় এরর <strong>9998: IP_NOT_WHITELISTED</strong> আসে)।{" "}
                  <strong>portal.adnsms.com</strong>-এ লগইন করে <strong>API Settings / IP Whitelist</strong>-এ এই আইপিটি যুক্ত করে সেভ করুন।
                </p>
              </div>

              <div className="space-y-4">
                {/* API Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ADN API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="e.g. KEY-xxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                </div>

                {/* API Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      ADN API Secret <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-[11px] text-[#0D47A1] dark:text-[#90CAF9] hover:underline"
                    >
                      {showSecret ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showSecret ? "text" : "password"}
                    value={apiSecretInput}
                    onChange={(e) => setApiSecretInput(e.target.value)}
                    placeholder={hasExistingSecret ? "•••••••• (Leave blank to keep existing)" : "Enter API Secret"}
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  {hasExistingSecret && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block">
                      ✓ An API Secret is currently securely stored in database.
                    </span>
                  )}
                </div>

                {/* API Domain */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    API Domain URL
                  </label>
                  <input
                    type="text"
                    value={settings.apiDomain}
                    onChange={(e) => setSettings({ ...settings, apiDomain: e.target.value })}
                    placeholder="https://portal.adnsms.com"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Default is <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">https://portal.adnsms.com</code>
                  </span>
                </div>

                {/* PULL API Callback Webhook URL */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>📥</span>
                      <span>PULL API / Incoming SMS Callback URL</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          typeof window !== "undefined"
                            ? `${window.location.origin}${window.location.pathname.startsWith("/database") ? "/database" : ""}/api/sms/callback`
                            : "https://hisam.beepsystems.com.bd/database/api/sms/callback";
                        navigator.clipboard.writeText(url);
                        alert("Callback URL copied to clipboard: " + url);
                      }}
                      className="text-[11px] text-[#0D47A1] dark:text-[#90CAF9] font-semibold hover:underline cursor-pointer"
                    >
                      Copy URL
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    If your ADN SMS account supports PULL API (receiving replies from clients), enter this callback endpoint in your ADN SMS Portal:
                  </p>
                  <code className="block text-[11px] font-mono p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-blue-600 dark:text-blue-400 select-all">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}${window.location.pathname.startsWith("/database") ? "/database" : ""}/api/sms/callback`
                      : "https://hisam.beepsystems.com.bd/database/api/sms/callback"}
                  </code>
                </div>

                {/* Campaign Title & Message Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Campaign Title
                    </label>
                    <input
                      type="text"
                      value={settings.campaignTitle}
                      onChange={(e) => setSettings({ ...settings, campaignTitle: e.target.value })}
                      placeholder="Imperial_IT"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Encoding / Message Type
                    </label>
                    <select
                      value={settings.messageType}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          messageType: e.target.value as "AUTO" | "TEXT" | "UNICODE",
                        })
                      }
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                    >
                      <option value="AUTO">Auto-Detect (Bangla = Unicode, English = Text)</option>
                      <option value="UNICODE">Always Unicode (Supports Bengali & Special Chars)</option>
                      <option value="TEXT">Always Text (Standard GSM Only)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#0D47A1] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? "Saving..." : "Save Credentials"}
                  </button>
                </div>
              </div>
            </div>

            {/* Test SMS Dispatch Box */}
            <div className="space-y-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>📱</span>
                    <span>Send Test SMS</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Dispatch an instant test message to your personal mobile to verify ADN Gateway
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Bangladeshi 11 digits (e.g. 01712345678)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Custom Message (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Leave empty for default test message"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs animate-in fade-in ${
                      testResult.success
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                        : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                    }`}
                  >
                    <div className="font-bold">
                      {testResult.success ? "✓ Test SMS Sent Successfully!" : "✕ Test Failed"}
                    </div>
                    {testResult.smsUid && (
                      <div className="font-mono text-[10px] mt-0.5">UID: {testResult.smsUid}</div>
                    )}
                    {testResult.error && <div className="mt-1">{testResult.error}</div>}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSendTest}
                disabled={sendingTest}
                className="w-full mt-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {sendingTest ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                <span>Send Test SMS Now</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EXPIRY MILESTONES & RECIPIENT PHONE TARGETS */}
        {activeTab === "rules" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Expiry Reminder Milestones */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>📅</span>
                  <span>Domain Expiry Reminder Milestones</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select how many days prior to the domain expiration date automated SMS reminders will be dispatched.
                </p>
              </div>

              {/* Active Milestones Tags */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {settings.expiryDaysMilestones.map((day) => (
                  <div
                    key={day}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-[#0D47A1] dark:text-[#90CAF9] text-xs font-bold"
                  >
                    <span>{day} Days Before</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(day)}
                      className="text-blue-400 hover:text-red-500 transition-colors ml-1"
                      title="Remove milestone"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {settings.expiryDaysMilestones.length === 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ No milestones configured. Please add at least one reminder milestone.
                  </span>
                )}
              </div>

              {/* Add Custom Milestone & Presets */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={newMilestoneInput}
                    onChange={(e) => setNewMilestoneInput(e.target.value)}
                    placeholder="Enter days (e.g. 10)"
                    className="w-36 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="px-3 py-1.5 bg-[#0D47A1] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    + Add Day
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Presets:</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, expiryDaysMilestones: [30, 15, 7, 3, 1] })}
                    className="text-[#0D47A1] dark:text-[#90CAF9] hover:underline"
                  >
                    Standard [30, 15, 7, 3, 1]
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, expiryDaysMilestones: [15, 7, 1] })}
                    className="text-[#0D47A1] dark:text-[#90CAF9] hover:underline"
                  >
                    Short [15, 7, 1]
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, expiryDaysMilestones: [7, 3, 1] })}
                    className="text-[#0D47A1] dark:text-[#90CAF9] hover:underline"
                  >
                    Urgent [7, 3, 1]
                  </button>
                </div>
              </div>
            </div>

            {/* Recipient Number Selection & Mode */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>📞</span>
                  <span>Target Recipient Phone Numbers</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select which contact number fields stored on the Institution profile should receive expiry SMS.
                </p>
              </div>

              {/* Number Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={settings.recipientTargets.contact1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        recipientTargets: { ...settings.recipientTargets, contact1: e.target.checked },
                      })
                    }
                    className="mt-0.5 w-4 h-4 text-[#0D47A1] rounded border-slate-300 focus:ring-[#0D47A1]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      Primary Contact Number (contact1)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Primary institution head / official contact
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={settings.recipientTargets.contact2}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        recipientTargets: { ...settings.recipientTargets, contact2: e.target.checked },
                      })
                    }
                    className="mt-0.5 w-4 h-4 text-[#0D47A1] rounded border-slate-300 focus:ring-[#0D47A1]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      Secondary Contact Number (contact2)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Alternate institutional contact
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={settings.recipientTargets.inChargeTeacher}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        recipientTargets: { ...settings.recipientTargets, inChargeTeacher: e.target.checked },
                      })
                    }
                    className="mt-0.5 w-4 h-4 text-[#0D47A1] rounded border-slate-300 focus:ring-[#0D47A1]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      In-Charge Teacher Contact (inChargeTeacherContact)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Designated IT or website coordinator
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={settings.recipientTargets.btclMobile}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        recipientTargets: { ...settings.recipientTargets, btclMobile: e.target.checked },
                      })
                    }
                    className="mt-0.5 w-4 h-4 text-[#0D47A1] rounded border-slate-300 focus:ring-[#0D47A1]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      BTCL Registered Mobile (btclMobileNo)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mobile number registered on BTCL domain portal
                    </span>
                  </div>
                </label>
              </div>

              {/* Send Mode Radio */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Delivery Strategy (Send Mode)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      settings.sendMode === "first_available"
                        ? "border-[#0D47A1] bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sendMode"
                      value="first_available"
                      checked={settings.sendMode === "first_available"}
                      onChange={() => setSettings({ ...settings, sendMode: "first_available" })}
                      className="mt-0.5 text-[#0D47A1] focus:ring-[#0D47A1]"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        First Available Number Only (Recommended)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Sends strictly 1 SMS per milestone to the first valid phone found. Saves SMS credits.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      settings.sendMode === "all_selected"
                        ? "border-[#0D47A1] bg-blue-50/50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sendMode"
                      value="all_selected"
                      checked={settings.sendMode === "all_selected"}
                      onChange={() => setSettings({ ...settings, sendMode: "all_selected" })}
                      className="mt-0.5 text-[#0D47A1] focus:ring-[#0D47A1]"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Send to All Selected Numbers
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Broadcasts SMS to all available checked contact numbers for maximum visibility.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Brand Phone & Admin Copy Phone */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Helpline Phone
                  </label>
                  <input
                    type="text"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                    placeholder="01711223344"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Replaces <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">&#123;companyPhone&#125;</code> in template
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company Brand Name
                  </label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    placeholder="Imperial IT"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Replaces <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">&#123;companyName&#125;</code> in template
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Admin Copy Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.adminCopyPhone || ""}
                    onChange={(e) => setSettings({ ...settings, adminCopyPhone: e.target.value })}
                    placeholder="018XXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Receive SMS copy when expiry alerts trigger
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SMS TEMPLATE & REALTIME PHONE PREVIEW */}
        {activeTab === "template" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            {/* Template Editor Column */}
            <div className="lg:col-span-7 space-y-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>✏️</span>
                    <span>SMS Template Editor</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Customize the message sent to clients prior to domain expiration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, template: DEFAULT_SMS_TEMPLATE })}
                  className="text-xs font-semibold text-[#0D47A1] dark:text-[#90CAF9] hover:underline"
                >
                  Reset Default
                </button>
              </div>

              {/* Placeholder Pills */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                  Click to insert dynamic placeholder variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "{instituteName}", label: "Institution Name" },
                    { tag: "{domain}", label: "Domain Name" },
                    { tag: "{expireDate}", label: "Expire Date" },
                    { tag: "{daysRemaining}", label: "Days Left" },
                    { tag: "{companyPhone}", label: "Helpline Phone" },
                    { tag: "{companyName}", label: "Company Name" },
                    { tag: "{contactPerson}", label: "Contact Person" },
                    { tag: "{instituteNameBangla}", label: "Bangla Name" },
                  ].map((p) => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(p.tag)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-mono transition-colors cursor-pointer"
                    >
                      + {p.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <textarea
                  rows={6}
                  value={settings.template}
                  onChange={(e) => setSettings({ ...settings, template: e.target.value })}
                  placeholder="Enter SMS template..."
                  className="w-full p-4 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1] leading-relaxed"
                />

                {/* Character & Segment Count Bar */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        smsMetrics.isUnicode
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      }`}
                    >
                      {smsMetrics.isUnicode ? "Unicode (Bangla)" : "Standard (English)"}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono">
                      {sampleRendered.length} characters
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-500">
                      Remaining in part: <strong>{smsMetrics.charsRemainingInCurrentPart}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span
                      className={`font-bold ${
                        smsMetrics.smsCount > 1
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      Total: {smsMetrics.smsCount} SMS {smsMetrics.smsCount > 1 ? "(Multi-part)" : "(Single)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#0D47A1] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>

            {/* Smartphone Live Preview Mockup Column */}
            <div className="lg:col-span-5 flex flex-col items-center justify-start p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 block">
                Realistic Smartphone Live Preview
              </span>

              {/* Device Frame */}
              <div className="w-[280px] sm:w-[310px] rounded-[36px] p-3 bg-slate-900 shadow-2xl border-4 border-slate-800 relative">
                {/* Speaker notch */}
                <div className="w-24 h-4 bg-slate-900 rounded-b-xl mx-auto absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                  <div className="w-10 h-1 bg-slate-700 rounded-full" />
                </div>

                {/* Screen */}
                <div className="w-full rounded-[26px] bg-slate-100 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col min-h-[440px]">
                  {/* Status Bar */}
                  <div className="h-8 bg-slate-200/70 dark:bg-slate-900/80 px-4 flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400 pt-1">
                    <span>10:30 AM</span>
                    <div className="flex items-center gap-1.5">
                      <span>4G</span>
                      <span>📶</span>
                      <span>🔋 95%</span>
                    </div>
                  </div>

                  {/* SMS Header */}
                  <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#0D47A1] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      IT
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {settings.campaignTitle || "Imperial_IT"}
                      </div>
                      <div className="text-[9px] text-slate-400">ADN SMS Verified</div>
                    </div>
                  </div>

                  {/* SMS Conversation View */}
                  <div className="flex-1 p-3 space-y-3 overflow-y-auto flex flex-col justify-end">
                    <div className="text-center">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800/60 text-slate-500 font-medium">
                        Today 10:30 AM
                      </span>
                    </div>

                    {/* Incoming SMS Bubble */}
                    <div className="self-start max-w-[90%] p-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800/90 shadow-sm border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-100 leading-relaxed font-sans select-none whitespace-pre-wrap">
                      {sampleRendered}
                      <div className="text-[9px] text-slate-400 text-right mt-1.5">
                        10:30 AM • SMS
                      </div>
                    </div>
                  </div>

                  {/* Bottom Home Indicator */}
                  <div className="h-5 bg-transparent flex items-center justify-center">
                    <div className="w-24 h-1 bg-slate-400/60 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DISPATCH LOGS & AUDIT TRAIL */}
        {activeTab === "logs" && (
          <div className="space-y-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>📜</span>
                  <span>Automated SMS Dispatch Logs</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Audit trail of all expiry reminders and test SMS messages dispatched via ADN Gateway
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {loadingLogs ? (
                    <span className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>🔄 Refresh</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleResetSentCache(false)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  title="Allows re-triggering reminders for institutions already alerted"
                >
                  Reset Sent Cache
                </button>

                <button
                  type="button"
                  onClick={() => handleResetSentCache(true)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  title="Purge all logs"
                >
                  Clear All Logs
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div className="pt-1">
              <input
                type="text"
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
                placeholder="Search by institution name, domain, recipient phone, or status..."
                className="w-full sm:w-80 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Date & Time</th>
                    <th className="px-3.5 py-2.5">Institution / Domain</th>
                    <th className="px-3.5 py-2.5">Recipient Number</th>
                    <th className="px-3.5 py-2.5">Milestone</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">SMS UID / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {log.institutionName}
                        </div>
                        {log.domain && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                            {log.domain}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <div>{log.recipientPhone}</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {log.recipientLabel}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {log.milestoneDays} Days (Rem: {log.daysRemaining})
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {log.status === "SUCCESS" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            ✓ SENT
                          </span>
                        ) : log.status === "INCOMING" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                            📥 REPLY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                            ✕ FAILED
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px]">
                        {log.smsUid ? (
                          <span className="text-slate-600 dark:text-slate-400">{log.smsUid}</span>
                        ) : log.error ? (
                          <span className="text-red-600 dark:text-red-400">{log.error}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-xs text-slate-400">
                        {logs.length === 0
                          ? "No SMS dispatch logs recorded yet. Send a test SMS or trigger an expiry scan to see logs here."
                          : "No matching logs found for your search query."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
