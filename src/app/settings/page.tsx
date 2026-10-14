"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SidebarLayout } from "@/components/SidebarLayout";
import {
  SubscriptionExpirySettings,
  DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS,
} from "@/lib/subscriptionSettings";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Company Subscriptions Thresholds
  const [monthlyDays, setMonthlyDays] = useState<number>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.monthlyDays);
  const [halfYearlyDays, setHalfYearlyDays] = useState<number>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.halfYearlyDays);
  const [yearlyDays, setYearlyDays] = useState<number>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.yearlyDays);
  const [defaultDays, setDefaultDays] = useState<number>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.defaultDays);

  // Website & Institution Expiry Thresholds
  const [websiteDays, setWebsiteDays] = useState<number>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteDays);
  const [softwareDays, setSoftwareDays] = useState<number>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.softwareDays);

  // Automated Email Notification Settings
  const [autoEmailEnabled, setAutoEmailEnabled] = useState<boolean>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.autoEmailEnabled);
  const [websiteExpiryEmailEnabled, setWebsiteExpiryEmailEnabled] = useState<boolean>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteExpiryEmailEnabled);
  const [companyExpiryEmailEnabled, setCompanyExpiryEmailEnabled] = useState<boolean>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.companyExpiryEmailEnabled);
  const [notifyAdminOnExpiry, setNotifyAdminOnExpiry] = useState<boolean>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.notifyAdminOnExpiry);
  const [adminNotificationEmail, setAdminNotificationEmail] = useState<string>(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.adminNotificationEmail || "imperialitbd2011@gmail.com");

  // Manual Trigger & Diagnostic Report State
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    success: boolean;
    checkedWebsites?: number;
    websiteAlertsSent?: number;
    checkedSubscriptions?: number;
    subscriptionAlertsSent?: number;
    errors?: string[];
    message?: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch("/api/subscription-settings");
        const data = await res.json();
        if (data.success && data.settings) {
          setMonthlyDays(data.settings.monthlyDays);
          setHalfYearlyDays(data.settings.halfYearlyDays);
          setYearlyDays(data.settings.yearlyDays);
          setDefaultDays(data.settings.defaultDays ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.defaultDays);

          setWebsiteDays(data.settings.websiteDays ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteDays);
          setSoftwareDays(data.settings.softwareDays ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.softwareDays);

          setAutoEmailEnabled(data.settings.autoEmailEnabled ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.autoEmailEnabled);
          setWebsiteExpiryEmailEnabled(data.settings.websiteExpiryEmailEnabled ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteExpiryEmailEnabled);
          setCompanyExpiryEmailEnabled(data.settings.companyExpiryEmailEnabled ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.companyExpiryEmailEnabled);
          setNotifyAdminOnExpiry(data.settings.notifyAdminOnExpiry ?? DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.notifyAdminOnExpiry);
          setAdminNotificationEmail(data.settings.adminNotificationEmail || DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.adminNotificationEmail || "imperialitbd2011@gmail.com");
        }
      } catch (err: any) {
        setErrorMsg("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleResetDefaults() {
    setMonthlyDays(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.monthlyDays);
    setHalfYearlyDays(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.halfYearlyDays);
    setYearlyDays(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.yearlyDays);
    setDefaultDays(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.defaultDays);

    setWebsiteDays(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteDays);
    setSoftwareDays(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.softwareDays);

    setAutoEmailEnabled(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.autoEmailEnabled);
    setWebsiteExpiryEmailEnabled(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.websiteExpiryEmailEnabled);
    setCompanyExpiryEmailEnabled(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.companyExpiryEmailEnabled);
    setNotifyAdminOnExpiry(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.notifyAdminOnExpiry);
    setAdminNotificationEmail(DEFAULT_SUBSCRIPTION_EXPIRY_SETTINGS.adminNotificationEmail || "imperialitbd2011@gmail.com");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (
      monthlyDays < 0 ||
      halfYearlyDays < 0 ||
      yearlyDays < 0 ||
      defaultDays < 0 ||
      websiteDays < 0 ||
      softwareDays < 0
    ) {
      setErrorMsg("All threshold values must be 0 or greater.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/subscription-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyDays: Number(monthlyDays),
          halfYearlyDays: Number(halfYearlyDays),
          yearlyDays: Number(yearlyDays),
          defaultDays: Number(defaultDays),
          websiteDays: Number(websiteDays),
          softwareDays: Number(softwareDays),
          autoEmailEnabled,
          websiteExpiryEmailEnabled,
          companyExpiryEmailEnabled,
          notifyAdminOnExpiry,
          adminNotificationEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setSuccessMsg("Expiry and automated email settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunExpiryCheck(reset: boolean = false) {
    setTriggeringCheck(true);
    setCheckResult(null);
    try {
      const url = reset ? "/api/cron/expiry-alerts?reset=true" : "/api/cron/expiry-alerts?force=true";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCheckResult({
          success: true,
          checkedWebsites: data.checkedWebsites,
          websiteAlertsSent: data.websiteAlertsSent,
          checkedSubscriptions: data.checkedSubscriptions,
          subscriptionAlertsSent: data.subscriptionAlertsSent,
          errors: data.errors || [],
          message: `Scan finished: ${data.checkedWebsites || 0} websites checked (${data.websiteAlertsSent || 0} emails dispatched) & ${data.checkedSubscriptions || 0} subscriptions checked (${data.subscriptionAlertsSent || 0} emails dispatched).`,
        });
      } else {
        setCheckResult({
          success: false,
          message: data.error || "Failed to execute expiry alert check",
          errors: data.errors || [],
        });
      }
    } catch (err: any) {
      setCheckResult({
        success: false,
        message: err.message || "Network error while triggering expiry alerts check",
      });
    } finally {
      setTriggeringCheck(false);
    }
  }

  return (
    <SidebarLayout
      title="System & Expiry Settings"
      subtitle="Configure website and subscription expiry days, thresholds, and automated email alerts"
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Status Messages */}
            {errorMsg && (
              <div className="p-3.5 text-xs rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium flex items-center gap-2">
                <span>❌</span>
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 text-xs rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-2">
                <span>✅</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* CARD 1: Automated Email Alerts Master Switch */}
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
                      Automated Expiry Alerts (মেয়াদ শেষ হওয়ার অটো ইমেইল)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Enable or disable automated email dispatches when websites or software subscriptions near expiry.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAutoEmailEnabled(!autoEmailEnabled)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                    autoEmailEnabled ? "bg-[#2196F3]" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  title={autoEmailEnabled ? "Disable Expiry Emails" : "Enable Expiry Emails"}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      autoEmailEnabled ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* CARD 2: Institution Website Expiry Settings */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xl">
                    🌐
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Institution Website Expiry Settings (ওয়েবসাইট মেয়াদ সেটিংস)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select how many days before website expiration the automated email will be sent
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={websiteExpiryEmailEnabled}
                    onChange={(e) => setWebsiteExpiryEmailEnabled(e.target.checked)}
                    disabled={!autoEmailEnabled}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Enable Website Auto-Emails
                  </span>
                </label>
              </div>

              <div className="p-6 space-y-4">
                {/* Important Business Rule Notice */}
                <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>📌</span>
                    <span>গুরুত্বপূর্ণ নিয়ম (Business Rule):</span>
                  </p>
                  <p className="leading-relaxed">
                    ওয়েবসাইটের ক্ষেত্রে <strong>Actual Expiry</strong> কাউন্ট হবে না; সরাসরি মূল <strong>Expire Date</strong> (নির্ধারিত মেয়াদ) অনুযায়ী ইমেইল পাঠানোর দিন গণনা করা হবে।
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Website Days */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Category: Website
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Primary Rule</span>
                    </div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Send email how many days before expiry? (মেয়াদ শেষ হওয়ার কত দিন আগে ইমেইল যাবে)
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recommended: 30 days before scheduled Expire Date
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        required
                        value={websiteDays}
                        onChange={(e) => setWebsiteDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 text-center font-bold font-mono text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 shrink-0">দিন আগে (days)</span>
                    </div>
                  </div>

                  {/* Software Category (Institutions) */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        Category: Software (Institutions)
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Optional</span>
                    </div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Days before institution software expiry
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Default: 30 days before expire date
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        required
                        value={softwareDays}
                        onChange={(e) => setSoftwareDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 text-center font-bold font-mono text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 shrink-0">দিন আগে (days)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: Company Software Subscription Expiry Settings */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xl">
                    🏢
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Company Software Subscription Expiry Settings (কোম্পানি সাবস্ক্রিপশন)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select days before expiry according to billing cycles (Monthly, Half-Yearly, Yearly)
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={companyExpiryEmailEnabled}
                    onChange={(e) => setCompanyExpiryEmailEnabled(e.target.checked)}
                    disabled={!autoEmailEnabled}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Enable Subscription Auto-Emails
                  </span>
                </label>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Monthly */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        Monthly
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">মাসিক সাইকেল</span>
                    </div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Days before expiry
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Default: 7 days</p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="0"
                        max="90"
                        required
                        value={monthlyDays}
                        onChange={(e) => setMonthlyDays(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 text-center font-bold font-mono text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 shrink-0">days</span>
                    </div>
                  </div>

                  {/* Half-Yearly */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        Half-Yearly
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">অর্ধবার্ষিক</span>
                    </div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Days before expiry
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Default: 15 days</p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="0"
                        max="180"
                        required
                        value={halfYearlyDays}
                        onChange={(e) => setHalfYearlyDays(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 text-center font-bold font-mono text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 shrink-0">days</span>
                    </div>
                  </div>

                  {/* Yearly */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        Yearly
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">বাৎসরিক সাইকেল</span>
                    </div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Days before expiry
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Default: 30 days</p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        required
                        value={yearlyDays}
                        onChange={(e) => setYearlyDays(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 text-center font-bold font-mono text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 shrink-0">days</span>
                    </div>
                  </div>
                </div>

                {/* Default/Fallback Cycle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Fallback Threshold (Default)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Applied to custom subscriptions without a standard billing cycle
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={defaultDays}
                      onChange={(e) => setDefaultDays(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 px-3 py-1.5 text-center font-mono text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-xs font-medium text-slate-500">days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: Recipient & Admin Notification Routing */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recipient & Administrator Routing
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Administrator Alert Email (অ্যাডমিন নোটিফিকেশন ইমেইল)
                  </label>
                  <input
                    type="email"
                    value={adminNotificationEmail}
                    onChange={(e) => setAdminNotificationEmail(e.target.value)}
                    placeholder="e.g. imperialitbd2011@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Receives action-item notifications if an institution has no client email on file, or receives CC.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      CC Admin on Client Expiry Notices
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Send a copy to the Administrator email whenever an expiry alert is dispatched to a client.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyAdminOnExpiry}
                    onChange={(e) => setNotifyAdminOnExpiry(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons: Save & Reset */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Reset Defaults
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold text-white bg-[#2196F3] hover:bg-[#1E88E5] rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <span>Save Expiry Settings (সংরক্ষণ করুন)</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Real-time Expiry Alert Scanner & Dispatcher Card */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Real-Time Expiry Alert Dispatcher (লাইভ স্ক্যানার)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  On-Demand Cron
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Scan all registered websites and subscriptions right now according to the configured threshold days, and dispatch alert emails.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleRunExpiryCheck(false)}
                disabled={triggeringCheck}
                className="px-4 py-2.5 bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {triggeringCheck ? "Scanning..." : "⚡ Run Expiry Alert Check Now"}
              </button>
              <button
                type="button"
                onClick={() => handleRunExpiryCheck(true)}
                disabled={triggeringCheck}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                title="Clears sent history and re-evaluates all websites and subscriptions"
              >
                Reset & Rescan
              </button>
            </div>
          </div>

          {checkResult && (
            <div
              className={`mt-3 p-3.5 rounded-xl text-xs ${
                checkResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="font-bold mb-1 flex items-center gap-1.5">
                <span>{checkResult.success ? "✅ Expiry Scan Report" : "❌ Scan Failed"}</span>
              </div>
              <p className="text-xs leading-relaxed">{checkResult.message}</p>
              {checkResult.errors && checkResult.errors.length > 0 && (
                <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 space-y-0.5">
                  {checkResult.errors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Link to SMTP & Mail Settings */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-lg">
              ✉️
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                SMTP & Mail Server Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure outgoing SMTP servers (Gmail, Brevo, cPanel, Outlook) and task notification switches
              </p>
            </div>
          </div>
          <Link
            href="/mail-settings"
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Open Mail Settings &rarr;
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
