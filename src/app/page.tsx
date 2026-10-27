"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarLayout } from "@/components/SidebarLayout";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { CustomFieldDef, Institution, CallUpdate } from "@/lib/types";
import { FilterBar, Filters } from "@/components/FilterBar";
import { InstitutionTable } from "@/components/InstitutionTable";
import { InstitutionForm } from "@/components/InstitutionForm";
import { CustomFieldModal } from "@/components/CustomFieldModal";
import { BulkUpload } from "@/components/BulkUpload";
import { ExportModal } from "@/components/ExportModal";
import { TrashModal } from "@/components/TrashModal";
import { Button } from "@/components/ui";

const emptyFilters: Filters = {
  search: "",
  type: "",
  category: "",
  subDistrict: "",
  district: "",
  status: "",
};

function InstitutionsLedgerContent() {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status") || "";

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<Institution[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [filters, setFilters] = useState<Filters>({
    ...emptyFilters,
    status: urlStatus,
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);

  // Sync with searchParams if status parameter changes in URL
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam !== null && statusParam !== filters.status) {
      setFilters((prev) => ({ ...prev, status: statusParam }));
    }
  }, [searchParams]);

  // Task modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskInstId, setTaskInstId] = useState("");
  const [taskInstName, setTaskInstName] = useState("");

  const router = useRouter();

  async function loadCustomFields() {
    try {
      const res = await fetch("/api/custom-fields");
      const data = await res.json();
      setCustomFields(Array.isArray(data) ? data : []);
    } catch {
      setCustomFields([]);
    }
  }

  async function loadAll() {
    try {
      const res = await fetch("/api/institutions");
      const data = await res.json();
      setAllInstitutions(Array.isArray(data) ? data : []);
    } catch {
      setAllInstitutions([]);
    }
  }

  async function loadFiltered(silent = false) {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.category) params.set("category", filters.category);
      if (filters.subDistrict) params.set("subDistrict", filters.subDistrict);
      if (filters.district) params.set("district", filters.district);
      if (filters.status) params.set("status", filters.status);
      const res = await fetch(`/api/institutions?${params.toString()}`);
      const data = await res.json();
      setInstitutions(Array.isArray(data) ? data : []);
    } catch {
      setInstitutions([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    loadCustomFields();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadFiltered, filters.search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const districts = useMemo(() => {
    const list = allInstitutions
      .map((i) => i.district?.trim())
      .filter(Boolean) as string[];
    const map = new Map<string, string>();
    for (const d of list) {
      const lower = d.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, d);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [allInstitutions]);

  const subDistricts = useMemo(() => {
    const list = allInstitutions
      .filter((i) => !filters.district || i.district?.trim().toLowerCase() === filters.district.trim().toLowerCase())
      .map((i) => i.subDistrict?.trim().replace(/\s+/g, " "))
      .filter(Boolean) as string[];

    const map = new Map<string, string>();
    for (const s of list) {
      const lower = s.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [allInstitutions, filters.district]);

  function refreshAfterChange() {
    setShowForm(false);
    setEditing(null);
    loadAll();
    loadFiltered(true);
  }

  async function handleDelete(inst: Institution) {
    if (!confirm(`Move "${inst.instituteName}" to Trash Bin? It can be restored within 30 days.`)) return;
    await fetch(`/api/institutions/${inst.id}`, { method: "DELETE" });
    refreshAfterChange();
  }

  async function handleToggleDeactivate(inst: Institution) {
    const isCurrentlyDeactivated = Boolean(inst.customFields?.isDeactivated);
    const action = isCurrentlyDeactivated ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${action} "${inst.instituteName}"?`)) return;

    await fetch(`/api/institutions/${inst.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleDeactivate: true }),
    });
    refreshAfterChange();
  }

  function handleCallUpdateAdded(instId: string, updatedCalls: CallUpdate[]) {
    setInstitutions((prev) =>
      prev.map((inst) =>
        inst.id === instId
          ? {
              ...inst,
              callUpdates: updatedCalls,
              customFields: {
                ...(inst.customFields || {}),
                callUpdates: updatedCalls,
              },
            }
          : inst
      )
    );
    setAllInstitutions((prev) =>
      prev.map((inst) =>
        inst.id === instId
          ? {
              ...inst,
              callUpdates: updatedCalls,
              customFields: {
                ...(inst.customFields || {}),
                callUpdates: updatedCalls,
              },
            }
          : inst
      )
    );
  }

  function handleCommunicationLogsUpdated(instId: string, updatedLogs: any[]) {
    setInstitutions((prev) =>
      prev.map((inst) =>
        inst.id === instId
          ? {
              ...inst,
              communicationLogs: updatedLogs,
              customFields: {
                ...(inst.customFields || {}),
                communicationLogs: updatedLogs,
              },
            }
          : inst
      )
    );
    setAllInstitutions((prev) =>
      prev.map((inst) =>
        inst.id === instId
          ? {
              ...inst,
              communicationLogs: updatedLogs,
              customFields: {
                ...(inst.customFields || {}),
                communicationLogs: updatedLogs,
              },
            }
          : inst
      )
    );
  }

  // Real-time synchronization when background alert scan completes (focus listener removed to prevent unwanted reloads when returning from other tabs)
  useEffect(() => {
    function handleSync() {
      loadAll();
      loadFiltered(true);
    }
    window.addEventListener("institution-logs-updated", handleSync);
    return () => {
      window.removeEventListener("institution-logs-updated", handleSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const total = allInstitutions.length;

  const pageActions = (
    <>
      <Link href="/targeted-clients">
        <Button variant="outline" className="text-xs flex items-center gap-1.5 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Targeted Clients</span>
        </Button>
      </Link>
      <Button variant="outline" onClick={() => setShowTrashModal(true)}>
        Trash Bin
      </Button>
      <Button variant="outline" onClick={() => setShowFieldModal(true)}>
        Custom Fields
      </Button>
      <Button variant="outline" onClick={() => setShowExportModal(true)}>
        Export Excel
      </Button>
      <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
        Bulk Upload
      </Button>
      <Button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        <span>Add Institution</span>
      </Button>
    </>
  );

  return (
    <SidebarLayout
      title="Institutions Ledger"
      subtitle="Complete database of all institution clients"
      totalCountText={`${total} ${total === 1 ? "institution" : "institutions"} on record`}
      onAddTaskClick={() => {
        setTaskInstId("");
        setTaskInstName("");
        setShowTaskModal(true);
      }}
      headerActions={pageActions}
    >
      <div className="mb-6">
        <FilterBar 
          filters={filters} 
          onChange={setFilters} 
          onReset={() => setFilters(emptyFilters)}
          districts={districts} 
          subDistricts={subDistricts} 
        />
      </div>

      {loading && institutions.length === 0 ? (
        <div className="py-16 text-center text-slate-500">Loading…</div>
      ) : (
        <div className={loading ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
          <InstitutionTable
            institutions={institutions}
            customFieldDefs={customFields}
            onEdit={(inst) => {
              setEditing(inst);
              setShowForm(true);
            }}
            onDelete={handleDelete}
            onToggleDeactivate={handleToggleDeactivate}
            onAddTask={(inst) => {
              setTaskInstId(inst.id);
              setTaskInstName(inst.instituteName);
              setShowTaskModal(true);
            }}
            onCallUpdateAdded={handleCallUpdateAdded}
            onCommunicationLogsUpdated={handleCommunicationLogsUpdated}
          />
        </div>
      )}

      {showForm && (
        <InstitutionForm
          initial={editing}
          customFieldDefs={customFields}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={refreshAfterChange}
          onRequestAddField={() => setShowFieldModal(true)}
        />
      )}

      {showTaskModal && (
        <TaskFormModal
          prefilledInstitutionId={taskInstId}
          prefilledInstitutionName={taskInstName}
          onClose={() => {
            setShowTaskModal(false);
            setTaskInstId("");
            setTaskInstName("");
          }}
          onSaved={() => {
            setShowTaskModal(false);
          }}
        />
      )}

      {showFieldModal && (
        <CustomFieldModal
          fields={customFields}
          onClose={() => setShowFieldModal(false)}
          onChanged={loadCustomFields}
        />
      )}

      {showExportModal && (
        <ExportModal
          filteredInstitutions={institutions}
          allInstitutions={allInstitutions}
          customFieldDefs={customFields}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showBulkUpload && (
        <BulkUpload
          onClose={() => setShowBulkUpload(false)}
          onSaved={() => {
            setShowBulkUpload(false);
            loadAll();
            loadFiltered();
          }}
        />
      )}

      {showTrashModal && (
        <TrashModal
          onClose={() => setShowTrashModal(false)}
          onRestored={() => {
            loadAll();
            loadFiltered();
          }}
        />
      )}
    </SidebarLayout>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Institutions Ledger...</div>}>
      <InstitutionsLedgerContent />
    </Suspense>
  );
}
