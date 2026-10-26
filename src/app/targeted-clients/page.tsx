"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/components/SidebarLayout";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { CustomFieldDef, Institution, TargetedClient, CallUpdate, TargetedCategory } from "@/lib/types";
import { TargetedFilterBar, TargetedFilters } from "@/components/targeted-clients/TargetedFilterBar";
import { TargetedClientTable } from "@/components/targeted-clients/TargetedClientTable";
import { TargetedClientForm } from "@/components/targeted-clients/TargetedClientForm";
import { TargetedBulkUpload } from "@/components/targeted-clients/TargetedBulkUpload";
import { TargetedCategoryModal } from "@/components/targeted-clients/TargetedCategoryModal";
import { InstitutionForm } from "@/components/InstitutionForm";
import { CustomFieldModal } from "@/components/CustomFieldModal";
import { Button } from "@/components/ui";

const emptyFilters: TargetedFilters = {
  search: "",
  category: "",
  priority: "",
  district: "",
  subDistrict: "",
  status: "active",
};

export default function TargetedClientsPage() {
  const [clients, setClients] = useState<TargetedClient[]>([]);
  const [allClients, setAllClients] = useState<TargetedClient[]>([]);
  const [categories, setCategories] = useState<TargetedCategory[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [filters, setFilters] = useState<TargetedFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editing, setEditing] = useState<TargetedClient | null>(null);
  const [convertingClient, setConvertingClient] = useState<TargetedClient | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Task modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskInstName, setTaskInstName] = useState("");

  const router = useRouter();

  async function loadCategories() {
    try {
      const res = await fetch("/api/targeted-categories", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCategories(data);
      }
    } catch (err) {
      console.error("Failed to load targeted categories:", err);
    }
  }

  async function loadCustomFields() {
    try {
      const res = await fetch("/api/custom-fields");
      const data = await res.json();
      setCustomFields(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load custom fields:", err);
    }
  }

  async function loadAll() {
    try {
      const res = await fetch("/api/targeted-clients?status=all", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setAllClients(data);
      }
    } catch (err) {
      console.error("Failed to load all targeted clients:", err);
    }
  }

  async function loadFiltered() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.district) params.set("district", filters.district);
      if (filters.subDistrict) params.set("subDistrict", filters.subDistrict);
      if (filters.status) params.set("status", filters.status);

      const res = await fetch(`/api/targeted-clients?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        let list = data;
        if (filters.category && filters.category !== "all") {
          const cat = filters.category.trim().toLowerCase();
          list = list.filter((c) => (c.category || "").trim().toLowerCase() === cat);
        }
        setClients(list);
      } else {
        console.warn("Targeted clients fetch returned error or non-array:", data);
        setErrorMsg(data?.error || "Failed to load targeted clients.");
        setClients([]);
      }
    } catch (err: any) {
      console.error("Failed to load filtered targeted clients:", err);
      setErrorMsg(err?.message || "Failed to load targeted clients.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    loadCategories();
    loadCustomFields();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadFiltered, filters.search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const districts = useMemo(
    () => Array.from(new Set(allClients.map((i) => i.district).filter(Boolean))).sort() as string[],
    [allClients]
  );

  const subDistricts = useMemo(
    () => Array.from(new Set(allClients.map((i) => i.subDistrict).filter(Boolean))).sort() as string[],
    [allClients]
  );

  function refreshData() {
    setShowForm(false);
    setEditing(null);
    setConvertingClient(null);
    loadAll();
    loadCategories();
    loadFiltered();
  }

  async function handleToggleArchive(client: TargetedClient) {
    const action = client.isArchived ? "restore" : "archive";
    if (!confirm(`Are you sure you want to ${action} "${client.instituteName}"?`)) return;

    await fetch(`/api/targeted-clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !client.isArchived }),
    });
    refreshData();
  }

  async function handleDelete(client: TargetedClient) {
    if (!confirm(`Delete "${client.instituteName}" permanently from targeted list?`)) return;

    await fetch(`/api/targeted-clients/${client.id}`, { method: "DELETE" });
    refreshData();
  }

  async function handleConvertedSaved() {
    if (convertingClient) {
      // Archive the targeted client now that it is transferred to Main Institutions Ledger
      await fetch(`/api/targeted-clients/${convertingClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      alert(`"${convertingClient.instituteName}" has been successfully added to Main Institutions Ledger and archived from targeted list.`);
    }
    refreshData();
  }

  const totalActive = allClients.filter((c) => !c.isArchived).length;
  const totalHigh = allClients.filter((c) => !c.isArchived && c.priority === "High").length;
  const totalArchived = allClients.filter((c) => c.isArchived).length;

  const prefilledInstitution: Institution | null = convertingClient
    ? {
        id: "", // empty id triggers POST /api/institutions
        instituteName: convertingClient.instituteName,
        instituteNameBangla: convertingClient.instituteNameBangla ?? "",
        domain: "",
        category: "Website",
        instituteType: "School",
        issueDate: null,
        expireDate: null,
        actualExpireDate: null,
        student: "",
        condition: "",
        btclUsername: "",
        btclPassword: "",
        btclMobileNo: "",
        btclEmail: convertingClient.email ?? "",
        btclEmailPassword: "",
        instituteHead: convertingClient.contactPerson ?? "",
        contact1: convertingClient.phone ?? "",
        contact2: "",
        inChargeTeacher: "",
        designation: "",
        inChargeTeacherContact: "",
        inChargeTeacher2: "",
        inChargeTeacher2Contact: "",
        subDistrict: convertingClient.subDistrict ?? "",
        district: convertingClient.district ?? "",
        address: convertingClient.address ?? "",
        customFields: {},
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      }
    : null;

  const pageActions = (
    <>
      <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
        Manage Categories
      </Button>
      <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
        Bulk Upload
      </Button>
      <Button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
      >
        + Add Targeted Client
      </Button>
    </>
  );

  function handleCallUpdateAdded(clientId: string, updatedCalls: CallUpdate[]) {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, callUpdates: updatedCalls } : c))
    );
    setAllClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, callUpdates: updatedCalls } : c))
    );
  }

  return (
    <SidebarLayout
      title="Targeted Clients"
      subtitle="Potential client pipeline and priority tracking"
      totalCountText={`Active: ${totalActive} • High Priority: ${totalHigh} • Archived: ${totalArchived}`}
      onAddTaskClick={() => {
        setTaskInstName("");
        setShowTaskModal(true);
      }}
      headerActions={pageActions}
    >
      <div className="mb-6">
        <TargetedFilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(emptyFilters)}
          categories={categories}
          districts={districts}
          subDistricts={subDistricts}
        />
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              loadAll();
              loadFiltered();
            }}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500">Loading targeted clients…</div>
      ) : (
        <TargetedClientTable
          clients={clients}
          onEdit={(client) => {
            setEditing(client);
            setShowForm(true);
          }}
          onToggleArchive={handleToggleArchive}
          onDelete={handleDelete}
          onConvertToMain={(client) => {
            setConvertingClient(client);
          }}
          onAddTask={(client) => {
            setTaskInstName(client.instituteName);
            setShowTaskModal(true);
          }}
          onCallUpdateAdded={handleCallUpdateAdded}
        />
      )}

      {showTaskModal && (
        <TaskFormModal
          prefilledInstitutionName={taskInstName}
          onClose={() => {
            setShowTaskModal(false);
            setTaskInstName("");
          }}
          onSaved={() => {
            setShowTaskModal(false);
          }}
        />
      )}

      {showForm && (
        <TargetedClientForm
          initial={editing}
          categories={categories}
          onManageCategories={() => setShowCategoryModal(true)}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={refreshData}
        />
      )}

      {showCategoryModal && (
        <TargetedCategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onChanged={() => {
            loadCategories();
            loadFiltered();
          }}
        />
      )}

      {convertingClient && prefilledInstitution && (
        <InstitutionForm
          initial={prefilledInstitution}
          customFieldDefs={customFields}
          onClose={() => setConvertingClient(null)}
          onSaved={handleConvertedSaved}
          onRequestAddField={() => setShowFieldModal(true)}
        />
      )}

      {showFieldModal && (
        <CustomFieldModal
          fields={customFields}
          onClose={() => setShowFieldModal(false)}
          onChanged={loadCustomFields}
        />
      )}

      {showBulkUpload && (
        <TargetedBulkUpload
          onClose={() => setShowBulkUpload(false)}
          onSaved={() => {
            setShowBulkUpload(false);
            refreshData();
          }}
        />
      )}
    </SidebarLayout>
  );
}
