"use client";
import { Company, CompanySubscription, SUBSCRIPTION_STATUS_COLOR } from "@/lib/types";
import { formatDhakaDate } from "@/lib/dateUtils";

interface CompanyTableProps {
  companies: Company[];
  onEditCompany: (company: Company) => void;
  onDeleteCompany: (company: Company) => void;
  onAddSubscription: (company: Company) => void;
  onEditSubscription: (company: Company, sub: CompanySubscription) => void;
  onDeleteSubscription: (company: Company, sub: CompanySubscription) => void;
}

export function CompanyTable({
  companies,
  onEditCompany,
  onDeleteCompany,
  onAddSubscription,
  onEditSubscription,
  onDeleteSubscription,
}: CompanyTableProps) {
  if (companies.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        <span className="text-3xl block mb-2">🏢</span>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Companies Found</h3>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or add a new company.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
        <thead className="bg-slate-100/80 dark:bg-slate-800/80 uppercase font-semibold text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="p-4 text-center w-16">SL No.</th>
            <th className="p-4">Company / Organization</th>
            <th className="p-4">Contact Info</th>
            <th className="p-4">Location</th>
            <th className="p-4">Software Subscriptions & Expiry</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {companies.map((company, index) => {
            const subscriptions = company.subscriptions || [];

            return (
              <tr key={company.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                {/* Serial Number */}
                <td className="p-4 align-top text-center font-mono font-semibold text-xs text-slate-500 dark:text-slate-400">
                  {index + 1}
                </td>

                {/* Company Name & Details */}
                <td className="p-4 align-top">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {company.companyName}
                  </div>
                  {company.companyNameBangla && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {company.companyNameBangla}
                    </div>
                  )}
                  {company.website && (
                    <a
                      href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline block mt-1"
                    >
                      🌐 {company.website}
                    </a>
                  )}
                </td>

                {/* Contact Person */}
                <td className="p-4 align-top space-y-1">
                  {company.contactPerson && (
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      👤 {company.contactPerson}
                      {company.designation && (
                        <span className="text-[11px] text-slate-400 font-normal block">
                          {company.designation}
                        </span>
                      )}
                    </div>
                  )}
                  {company.phone && (
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      📞 {company.phone}
                    </div>
                  )}
                  {company.email && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                      ✉️ {company.email}
                    </div>
                  )}
                  {!company.contactPerson && !company.phone && !company.email && (
                    <span className="text-slate-400 italic">—</span>
                  )}
                </td>

                {/* Location */}
                <td className="p-4 align-top">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {company.district || "—"}
                  </div>
                  {company.subDistrict && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {company.subDistrict}
                    </div>
                  )}
                  {company.address && (
                    <div className="text-[11px] text-slate-400 mt-1 truncate max-w-[150px]" title={company.address}>
                      {company.address}
                    </div>
                  )}
                </td>

                {/* Subscriptions */}
                <td className="p-4 align-top">
                  {subscriptions.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs italic">No active subscriptions</span>
                      <button
                        onClick={() => onAddSubscription(company)}
                        className="px-2 py-0.5 text-[11px] font-bold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        + Add Software
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {subscriptions.map((sub) => {
                        const swName = sub.software?.name || "Software";
                        const swCode = sub.software?.code;
                        const displayStatus = sub.effectiveStatus || sub.status;
                        const statusColor = SUBSCRIPTION_STATUS_COLOR[displayStatus] || SUBSCRIPTION_STATUS_COLOR["Active"];

                        const expireDateObj = sub.expireDate ? new Date(sub.expireDate) : null;
                        const formattedExpire = expireDateObj ? formatDhakaDate(expireDateObj, { year: "numeric", month: "short", day: "numeric" }) : "No Expiry";

                        return (
                          <div
                            key={sub.id}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  {swName}
                                </span>
                                {swCode && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    {swCode}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${statusColor}`}>
                                  {displayStatus}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>Cycle: <b>{sub.billingCycle}</b></span>
                                {sub.price !== undefined && sub.price !== null && (
                                  <span>Price: <b className="text-slate-900 dark:text-slate-100 font-mono">BDT {sub.price.toLocaleString()}</b></span>
                                )}
                              </div>

                              <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                Expire: <span className="text-slate-700 dark:text-slate-300 font-semibold">{formattedExpire}</span>
                              </div>
                            </div>

                            {/* Sub Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => onEditSubscription(company, sub)}
                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Edit Subscription"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => onDeleteSubscription(company, sub)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                title="Delete Subscription"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => onAddSubscription(company)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline block mt-1"
                      >
                        + Add Another Software
                      </button>
                    </div>
                  )}
                </td>

                {/* Company Actions */}
                <td className="p-4 align-top text-right space-x-2 shrink-0">
                  <button
                    onClick={() => onEditCompany(company)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteCompany(company)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
