import { getDhakaDayDiff, getDhakaEndOfDay } from "./dateUtils";

export const CATEGORY_OPTIONS = ["Website", "Software"] as const;

export const INSTITUTE_TYPE_OPTIONS = [
  "School",
  "College",
  "Madrasah",
  "University",
  "Polytechnic",
  "Kindergarten",
  "Other",
] as const;

export type StatusKey = "active" | "expiring_soon" | "expired" | "actual_expired" | "unknown" | "deactivated";

export const STATUS_LABEL: Record<StatusKey, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  actual_expired: "Actual Expired",
  unknown: "No Expiry Set",
  deactivated: "Deactivated",
};

export const STATUS_COLOR: Record<StatusKey, string> = {
  active: "bg-moss-500/15 text-moss-400 border-moss-500/30",
  expiring_soon: "bg-amberflag-500/15 text-amberflag-500 border-amberflag-500/30",
  expired: "bg-rust-500/15 text-rust-400 border-rust-500/30",
  actual_expired: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  unknown: "bg-slate-700/40 text-slate-400 border-slate-600/40",
  deactivated: "bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-400/30",
};

export function computeStatus(
  expireDate: string | Date | null,
  actualExpireDateOrThreshold?: string | Date | null | number,
  thresholdDays = 60,
  isDeactivated?: boolean
): StatusKey {
  if (isDeactivated) {
    return "deactivated";
  }
  let actExpDate: string | Date | null = null;
  let threshold = thresholdDays;

  if (typeof actualExpireDateOrThreshold === "number") {
    threshold = actualExpireDateOrThreshold;
  } else if (actualExpireDateOrThreshold) {
    actExpDate = actualExpireDateOrThreshold;
  }

  const now = new Date();
  if (actExpDate) {
    const actExp = getDhakaEndOfDay(actExpDate);
    if (actExp.getTime() < now.getTime()) {
      return "actual_expired";
    }
  }

  if (!expireDate) return "unknown";
  const diffDays = getDhakaDayDiff(expireDate, now);
  if (diffDays < 0) return "expired";
  if (diffDays <= threshold) return "expiring_soon";
  return "active";
}

// Default fields shown as columns; everything else lives behind "Details".
export const DEFAULT_VISIBLE_FIELDS = [
  "instituteName",
  "domain",
  "issueDate",
  "expireDate",
  "status",
] as const;

export const FIELD_LABELS: Record<string, string> = {
  instituteName: "Institute Name",
  instituteNameBangla: "Institute Name (Bangla)",
  domain: "Domain",
  category: "Category",
  instituteType: "Institute Type",
  issueDate: "Issue Date",
  expireDate: "Expire Date",
  actualExpireDate: "Actual Expire Date",
  student: "Student",
  condition: "Condition",
  btclUsername: "BTCL Username",
  btclPassword: "BTCL Password",
  btclMobileNo: "BTCL Mobile No",
  btclEmail: "BTCL E-mail",
  btclEmailPassword: "BTCL E-mail Password",
  instituteHead: "Institute Head",
  contact1: "Contact-1",
  contact2: "Contact-2",
  inChargeTeacher: "In Charge Teacher",
  designation: "Designation",
  inChargeTeacherContact: "In Charge Teacher Contact",
  inChargeTeacher2: "In Charge Teacher 2",
  inChargeTeacher2Contact: "In Charge Teacher 2 Contact",
  subDistrict: "Sub District",
  district: "District",
  address: "Address",
};

export const DETAIL_FIELD_ORDER = [
  "instituteNameBangla",
  "category",
  "instituteType",
  "actualExpireDate",
  "student",
  "condition",
  "instituteHead",
  "contact1",
  "contact2",
  "inChargeTeacher",
  "designation",
  "inChargeTeacherContact",
  "inChargeTeacher2",
  "inChargeTeacher2Contact",
  "subDistrict",
  "district",
  "address",
  "btclUsername",
  "btclPassword",
  "btclMobileNo",
  "btclEmail",
  "btclEmailPassword",
];

export function isInternalOrMigratedCustomField(key: string) {
  return (
    key === "isDeactivated" ||
    key === "callUpdates" ||
    key === "communicationLogs" ||
    key === "googleMapsUrl" ||
    key === "inChargeTeacher2" ||
    key === "inChargeTeacher2Contact" ||
    key === "cf_in_charge_2" ||
    key === "in_charge_2" ||
    key === "cf_in_charge_2_contact" ||
    key === "in_charge_2_contact" ||
    key === "IN CHARGE 2" ||
    key === "IN CHARGE 2 CONTACT"
  );
}

export function getGoogleMapsEmbedSrc(input?: string | null, fallbackQuery?: string | null): string | null {
  const raw = (input || "").trim();

  if (raw) {
    // Check if user pasted an <iframe>...</iframe> embed code
    const iframeMatch = raw.match(/src=["'](https?:\/\/[^"']+)["']/i);
    if (iframeMatch && iframeMatch[1]) {
      return iframeMatch[1];
    }

    // Direct Google Maps embed URL
    if (raw.includes("google.com/maps/embed")) {
      return raw;
    }

    // Google Maps share / place / search URL
    if (
      raw.includes("google.com/maps") ||
      raw.includes("maps.google.com") ||
      raw.includes("goo.gl/maps") ||
      raw.includes("maps.app.goo.gl")
    ) {
      try {
        const urlObj = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        const q = urlObj.searchParams.get("q") || urlObj.searchParams.get("query");
        if (q) {
          return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
        }
      } catch {}
      return `https://maps.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
    }

    // If it's a general URL or query
    return `https://maps.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
  }

  if (fallbackQuery && fallbackQuery.trim()) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery.trim())}&output=embed`;
  }

  return null;
}

export interface CallUpdate {
  id: string;
  employeeId?: string | null;
  employeeName: string;
  subject: string;
  details: string;
  createdAt: string;
}

export type CommunicationChannel = "EMAIL" | "SMS";
export type CommunicationStatus = "SUCCESS" | "FAILED" | "PENDING";

export interface CommunicationLog {
  id: string;
  type: CommunicationChannel;
  institutionId: string;
  institutionName: string;
  domain?: string | null;
  recipient: string;
  recipientName?: string | null;
  recipientLabel?: string | null;
  subject: string;
  content: string;
  status: CommunicationStatus;
  trigger?: string;
  milestoneDays?: number;
  error?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  fieldType: "text" | "number" | "date";
}

export interface Institution {
  id: string;
  instituteName: string;
  instituteNameBangla: string | null;
  domain: string | null;
  category: string;
  instituteType: string;
  issueDate: string | null;
  expireDate: string | null;
  actualExpireDate: string | null;
  student: string | null;
  condition: string | null;
  btclUsername: string | null;
  btclPassword: string | null;
  btclMobileNo: string | null;
  btclEmail: string | null;
  btclEmailPassword: string | null;
  instituteHead: string | null;
  contact1: string | null;
  contact2: string | null;
  inChargeTeacher: string | null;
  designation: string | null;
  inChargeTeacherContact: string | null;
  inChargeTeacher2: string | null;
  inChargeTeacher2Contact: string | null;
  subDistrict: string | null;
  district: string | null;
  address: string | null;
  googleMapsUrl?: string | null;
  customFields: Record<string, any>;
  callUpdates?: CallUpdate[];
  communicationLogs?: CommunicationLog[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type TargetedPriority = "High" | "Default" | "Low";

export const TARGETED_PRIORITY_OPTIONS: TargetedPriority[] = ["High", "Default", "Low"];

export const TARGETED_PRIORITY_COLOR: Record<TargetedPriority, string> = {
  High: "bg-rust-500/15 text-rust-400 border-rust-500/30",
  Default: "bg-brass-500/15 text-brass-400 border-brass-500/30",
  Low: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export interface TargetedCategory {
  id: string;
  name: string;
  clientCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TargetedClient {
  id: string;
  instituteName: string;
  instituteNameBangla: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  district: string | null;
  subDistrict: string | null;
  address: string | null;
  category?: string | null;
  priority: TargetedPriority;
  isArchived: boolean;
  notes: string | null;
  callUpdates?: CallUpdate[];
  createdById?: string | null;
  createdBy?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type TaskStatus =
  | "To Do"
  | "In Progress"
  | "In Review"
  | "Completed"
  | "Canceled"
  | "Cancelled"
  | "Pending";
export type TaskPriority = "Urgent" | "High" | "Medium" | "Low" | "Argent";

export const TASK_STATUS_OPTIONS: TaskStatus[] = [
  "To Do",
  "In Progress",
  "In Review",
  "Completed",
  "Canceled",
];
export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ["Urgent", "High", "Medium", "Low"];

export const TASK_STATUS_COLOR: Record<string, string> = {
  "To Do": "bg-amberflag-500/15 text-amberflag-500 border-amberflag-500/30",
  Pending: "bg-amberflag-500/15 text-amberflag-500 border-amberflag-500/30",
  "In Progress": "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "In Review": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Completed: "bg-moss-500/15 text-moss-400 border-moss-500/30",
  Canceled: "bg-slate-700/40 text-slate-400 border-slate-600/40",
  Cancelled: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export const TASK_PRIORITY_COLOR: Record<string, string> = {
  Urgent: "bg-red-500/15 text-red-500 border-red-500/30",
  Argent: "bg-red-500/15 text-red-500 border-red-500/30",
  High: "bg-rust-500/15 text-rust-400 border-rust-500/30",
  Medium: "bg-brass-500/15 text-brass-400 border-brass-500/30",
  Low: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export type EmployeeRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "TEAM_LEAD"
  | "DEVELOPER"
  | "SUPPORT"
  | "MARKETING"
  | "EMPLOYEE";

export const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "TEAM_LEAD", label: "Team Lead / Supervisor" },
  { value: "DEVELOPER", label: "Software Engineer / Developer" },
  { value: "SUPPORT", label: "Support & IT Officer" },
  { value: "MARKETING", label: "Executive / Marketing" },
  { value: "EMPLOYEE", label: "General Employee" },
];

export interface Employee {
  id: string;
  name: string;
  email: string;
  password?: string | null;
  role: EmployeeRole;
  orderSerial: number;
  designation?: string | null;
  phone?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  taskStats?: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
  };
}

export interface TaskAssigneeItem {
  id: string;
  taskId: string;
  employeeId: string;
  employee: Employee;
  assignedAt?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  completionNote?: string | null;
  progress?: number;
  isMonthly?: boolean;
  monthlyRecurringDay?: number | null;
  institutionId: string | null;
  institutionName: string | null;
  institution?: {
    id: string;
    instituteName: string;
  } | null;
  assignedToId?: string | null;
  assignedTo?: Employee | null;
  assignees?: TaskAssigneeItem[];
  assignedById?: string | null;
  assignedBy?: Employee | null;
  subtasks?: SubtaskItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SubtaskItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string | null;
  completedById?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SOFTWARE_CATEGORY_OPTIONS = [
  "Desktop App",
  "Web App",
  "SaaS",
  "Mobile App",
  "Other",
] as const;

export const BILLING_CYCLE_OPTIONS = [
  "Monthly",
  "Half-Yearly",
  "Yearly",
  "One-Time",
  "Lifetime",
] as const;

export const SUBSCRIPTION_STATUS_OPTIONS = [
  "Active",
  "Expiring Soon",
  "Expired",
  "Deactivated",
  "Cancelled",
] as const;

export const SUBSCRIPTION_STATUS_COLOR: Record<string, string> = {
  Active: "bg-moss-500/15 text-moss-400 border-moss-500/30",
  "Expiring Soon": "bg-amberflag-500/15 text-amberflag-500 border-amberflag-500/30",
  Expired: "bg-rust-500/15 text-rust-400 border-rust-500/30",
  Deactivated: "bg-slate-500/15 text-slate-400 border-slate-400/30",
  Cancelled: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export interface Software {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  description?: string | null;
  defaultPrice?: number | null;
  status: "Active" | "Inactive";
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  _count?: {
    subscriptions: number;
  };
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  softwareId: string;
  software?: Software;
  billingCycle: string;
  price?: number | null;
  status: string;
  effectiveStatus?: string;
  startDate?: string | null;
  expireDate?: string | null;
  actualExpireDate?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Company {
  id: string;
  companyName: string;
  companyNameBangla?: string | null;
  contactPerson?: string | null;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  district?: string | null;
  subDistrict?: string | null;
  website?: string | null;
  notes?: string | null;
  subscriptions?: CompanySubscription[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

