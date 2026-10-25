"use client";
import { useEffect, useState } from "react";
import { CompanySubscription, Software, BILLING_CYCLE_OPTIONS, SUBSCRIPTION_STATUS_OPTIONS } from "@/lib/types";

interface SubscriptionModalProps {
  companyId: string;
  companyName: string;
  initial?: CompanySubscription | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SubscriptionModal({ companyId, companyName, initial, onClose, onSaved }: SubscriptionModalProps) {
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loadingSoftwares, setLoadingSoftwares] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [softwareId, setSoftwareId] = useState(initial?.softwareId || "");
  const [billingCycle, setBillingCycle] = useState(initial?.billingCycle || "Yearly");
  const [price, setPrice] = useState(initial?.price !== undefined && initial?.price !== null ? String(initial.price) : "");
  const [status, setStatus] = useState(initial?.status || "Active");
  const [startDate, setStartDate] = useState(
    initial?.startDate ? new Date(initial.startDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10)
  );
  const [expireDate, setExpireDate] = useState(
    initial?.expireDate ? new Date(initial.expireDate).toISOString().substring(0, 10) : ""
  );
  const [actualExpireDate, setActualExpireDate] = useState(
    initial?.actualExpireDate ? new Date(initial.actualExpireDate).toISOString().substring(0, 10) : ""
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  useEffect(() => {
    async function loadSoftwares() {
      try {
        const res = await fetch("/api/softwares");
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setSoftwares(data);
          if (!softwareId && data.length > 0) {
            setSoftwareId(data[0].id);
            if (data[0].defaultPrice) {
              setPrice(String(data[0].defaultPrice));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load software catalog:", err);
      } finally {
        setLoadingSoftwares(false);
      }
    }
    loadSoftwares();
  }, []);

  function handleSoftwareChange(id: string) {
    setSoftwareId(id);
    const selected = softwares.find((s) => s.id === id);
    if (selected && selected.defaultPrice && !price) {
      setPrice(String(selected.defaultPrice));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!softwareId) {
      alert("Please select a software product.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      softwareId,
      billingCycle,
      price: price ? parseFloat(price) : null,
      status,
      startDate: startDate || null,
      expireDate: expireDate || null,
      actualExpireDate: actualExpireDate || null,
      notes: notes.trim() || null,
    };

    try {
      const url = initial
        ? `/api/companies/${companyId}/subscriptions/${initial.id}`
        : `/api/companies/${companyId}/subscriptions`;
      const method = initial ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save subscription.");
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save subscription.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{initial ? "Edit Subscription" : "Add Software Subscription"}</span>
            </h2>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
              Client: {companyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Software Product <span className="text-red-500">*</span>
            </label>
            {loadingSoftwares ? (
              <div className="text-xs text-slate-400">Loading catalog…</div>
            ) : (
              <select
                required
                value={softwareId}
                onChange={(e) => handleSoftwareChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {softwares.map((sw) => (
                  <option key={sw.id} value={sw.id}>
                    {sw.name} {sw.category ? `(${sw.category})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Billing Cycle
              </label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {BILLING_CYCLE_OPTIONS.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {cycle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subscription Fee (BDT)
              </label>
              <input
                type="number"
                placeholder="e.g. 15000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expire Date (Renewal)
              </label>
              <input
                type="date"
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Actual Expire Date (Grace)
              </label>
              <input
                type="date"
                value={actualExpireDate}
                onChange={(e) => setActualExpireDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subscription Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {SUBSCRIPTION_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subscription Notes / License Details
            </label>
            <input
              type="text"
              placeholder="e.g. License key, user limits, special discount..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : initial ? "Update Subscription" : "+ Save Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
