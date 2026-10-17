import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTaskAssignmentEmail } from "@/lib/mailer";
import { parseDhakaDateTimeInput, getDhakaDayOfMonth } from "@/lib/dateUtils";
import { ensureSubtaskTable } from "@/lib/ensureSubtaskTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/tasks?search=&status=&priority=&upcoming=&institutionId=&assignedToId=&assignedById=&taskCategory=&currentUserId=&employeeId=&monthly=
export async function GET(req: NextRequest) {
  try {
    await ensureSubtaskTable();
    const params = req.nextUrl.searchParams;
    const search = params.get("search")?.trim();
    const status = params.get("status");
    const priority = params.get("priority");
    const upcoming = params.get("upcoming"); // "true" or "false"
    const overdue = params.get("overdue"); // "true" or "false"
    const alerts = params.get("alerts"); // "true" or "false" (overdue + tasks due within 24 hours)
    const monthly = params.get("monthly"); // "true" or "false"
    const institutionId = params.get("institutionId");
    const assignedToId = params.get("assignedToId");
    const assignedById = params.get("assignedById");
    const taskCategory = params.get("taskCategory"); // "self" | "assigned_by_others" | "assigned_to_others" | "unassigned"
    const currentUserId = params.get("currentUserId");
    const employeeId = params.get("employeeId"); // Super Admin filter

    const where: any = { deletedAt: null };

    if (monthly === "true") {
      where.isMonthly = true;
    } else if (monthly === "false") {
      where.isMonthly = false;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { institutionName: { contains: search } },
        { institution: { instituteName: { contains: search } } },
        { assignedTo: { name: { contains: search } } },
        { assignees: { some: { employee: { name: { contains: search } } } } },
        { assignedBy: { name: { contains: search } } },
      ];
    }

    if (alerts === "true") {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      where.dueDate = { lte: in24Hours };
      if (!status || status === "all") {
        where.status = { in: ["To Do", "In Progress", "In Review", "Pending"] };
      }
    } else if (status && status !== "all") {
      if (status === "Overdue") {
        const now = new Date();
        where.dueDate = { lt: now };
        where.status = { notIn: ["Completed", "Canceled", "Cancelled"] };
      } else if (status === "To Do") {
        where.status = { in: ["To Do", "Pending"] };
      } else if (status === "Canceled" || status === "Cancelled") {
        where.status = { in: ["Canceled", "Cancelled"] };
      } else {
        where.status = status;
      }
    }

    if (overdue === "true" && alerts !== "true") {
      const now = new Date();
      where.dueDate = { lt: now };
      if (!status || status === "all") {
        where.status = { notIn: ["Completed", "Canceled", "Cancelled"] };
      }
    }

    if (priority && priority !== "all") {
      if (priority === "Urgent" || priority === "Argent") {
        where.priority = { in: ["Urgent", "Argent"] };
      } else {
        where.priority = priority;
      }
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (upcoming === "true" && status !== "Overdue" && alerts !== "true") {
      const now = new Date();
      where.dueDate = { gte: now };
      if (!status || status === "all") {
        where.status = { in: ["To Do", "In Progress", "In Review", "Pending"] };
      }
    }

    // Specific employee filter (Super Admin view)
    if (employeeId && employeeId !== "all") {
      where.OR = [
        { assignedToId: employeeId },
        { assignees: { some: { employeeId } } },
        { assignedById: employeeId },
      ];
    } else if (assignedToId) {
      if (assignedToId === "unassigned") {
        where.AND = [
          { assignedToId: null },
          { assignees: { none: {} } }
        ];
      } else {
        where.OR = [
          { assignedToId },
          { assignees: { some: { employeeId: assignedToId } } }
        ];
      }
    } else if (assignedById) {
      where.assignedById = assignedById;
    }

    // Category Tabs Filter
    if (taskCategory && currentUserId) {
      if (taskCategory === "my_tasks") {
        // All tasks assigned to me (either single primary or via assignees)
        where.OR = [
          { assignedToId: currentUserId },
          { assignees: { some: { employeeId: currentUserId } } }
        ];
      } else if (taskCategory === "self") {
        // Self assigned: assigned to me AND (assigned by me OR assignedById is null)
        where.AND = [
          {
            OR: [
              { assignedToId: currentUserId },
              { assignees: { some: { employeeId: currentUserId } } }
            ]
          },
          {
            OR: [
              { assignedById: currentUserId },
              { assignedById: null }
            ]
          }
        ];
      } else if (taskCategory === "assigned_by_others") {
        // Assigned to me by someone else
        where.AND = [
          {
            OR: [
              { assignedToId: currentUserId },
              { assignees: { some: { employeeId: currentUserId } } }
            ]
          },
          { assignedById: { not: currentUserId } }
        ];
      } else if (taskCategory === "assigned_to_others") {
        // Tasks assigned by me to other employees (where current user is NOT an assignee)
        where.AND = [
          { assignedById: currentUserId },
          {
            NOT: {
              OR: [
                { assignedToId: currentUserId },
                { assignees: { some: { employeeId: currentUserId } } }
              ]
            }
          }
        ];
      } else if (taskCategory === "unassigned") {
        // Unassigned tasks
        where.AND = [
          { assignedToId: null },
          { assignees: { none: {} } }
        ];
      }
    }

    const tasks = await (prisma as any).task.findMany({
      where,
      include: {
        institution: {
          select: {
            id: true,
            instituteName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orderSerial: true,
            designation: true,
            phone: true,
            avatarColor: true,
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                orderSerial: true,
                designation: true,
                phone: true,
                avatarColor: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            assignedAt: "asc",
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orderSerial: true,
            designation: true,
            phone: true,
            avatarColor: true,
          },
        },
        subtasks: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    // Sort tasks:
    // 1. To-Do & Overdue (Active: Pending / In Progress) -> Top
    // 2. Completed -> Middle
    // 3. Cancelled -> All the way at the bottom
    // Within each tier: Recent tasks on top (createdAt desc, fallback to dueDate desc)
    tasks.sort((a: any, b: any) => {
      const getRank = (t: any) => {
        if (t.status === "Canceled" || t.status === "Cancelled") return 2; // Canceled at the very bottom
        if (t.status === "Completed") return 1; // Completed in middle
        return 0; // To-Do, In Progress, In Review, Overdue on top
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.dueDate).getTime();
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.dueDate).getTime();

      return timeB - timeA;
    });

    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSubtaskTable();
    const body = await req.json();
    const {
      title,
      description,
      dueDate,
      status,
      priority,
      completionNote,
      progress,
      institutionId,
      institutionName,
      assignedToId,
      assignedToIds,
      assignedById,
      subtasks,
      isMonthly,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    }

    if (!dueDate) {
      return NextResponse.json({ error: "Due date and time are required." }, { status: 400 });
    }

    let finalInstName = institutionName;
    if (institutionId && !finalInstName) {
      const inst = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { instituteName: true },
      });
      if (inst) finalInstName = inst.instituteName;
    }

    const taskStatus = status || "To Do";
    const validSubtasks: string[] = Array.isArray(subtasks)
      ? subtasks
          .map((s: any) => (typeof s === "string" ? s.trim() : (s?.title ? String(s.title).trim() : "")))
          .filter(Boolean)
      : [];

    let progressVal = progress !== undefined
      ? Math.min(100, Math.max(0, Number(progress)))
      : (taskStatus === "Completed" ? 100 : 0);

    const parsedDueDate = parseDhakaDateTimeInput(dueDate);
    const isMonthlyVal = Boolean(isMonthly);
    const recurringDay = isMonthlyVal ? getDhakaDayOfMonth(parsedDueDate) : null;

    // Collect all unique assignee IDs
    const rawAssignedIds: string[] = Array.isArray(assignedToIds)
      ? assignedToIds.map(String).map((s) => s.trim()).filter(Boolean)
      : (assignedToId ? [String(assignedToId).trim()] : []);
    const uniqueAssignedIds = Array.from(new Set(rawAssignedIds));
    const primaryAssignedId = uniqueAssignedIds[0] || null;

    const taskData: any = {
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: parsedDueDate,
      status: taskStatus,
      priority: priority === "Argent" ? "Urgent" : (priority || "Medium"),
      completionNote: completionNote?.trim() || null,
      progress: progressVal,
      isMonthly: isMonthlyVal,
      monthlyRecurringDay: recurringDay,
      institutionId: institutionId || null,
      institutionName: finalInstName || null,
      assignedToId: primaryAssignedId,
      assignedById: assignedById || null,
    };

    if (uniqueAssignedIds.length > 0) {
      taskData.assignees = {
        create: uniqueAssignedIds.map((empId) => ({
          employeeId: empId,
        })),
      };
    }

    if (validSubtasks.length > 0) {
      taskData.subtasks = {
        create: validSubtasks.map((stTitle) => ({
          title: stTitle,
          createdById: assignedById || null,
          isCompleted: false,
        })),
      };
    }

    const task = await (prisma as any).task.create({
      data: taskData,
      include: {
        institution: {
          select: {
            id: true,
            instituteName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orderSerial: true,
            designation: true,
            phone: true,
            avatarColor: true,
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                orderSerial: true,
                designation: true,
                phone: true,
                avatarColor: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            assignedAt: "asc",
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orderSerial: true,
            designation: true,
            phone: true,
            avatarColor: true,
          },
        },
        subtasks: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    // Send assignment email notifications to ALL assigned employees
    const allEmployeesToNotify: { name: string; email: string }[] = [];
    if (task.assignees && task.assignees.length > 0) {
      for (const a of task.assignees) {
        if (a.employee?.email) {
          allEmployeesToNotify.push({ name: a.employee.name, email: a.employee.email });
        }
      }
    } else if (task.assignedTo?.email) {
      allEmployeesToNotify.push({ name: task.assignedTo.name, email: task.assignedTo.email });
    }

    // Deduplicate by email
    const seenEmails = new Set<string>();
    for (const emp of allEmployeesToNotify) {
      if (!emp.email || seenEmails.has(emp.email.toLowerCase())) continue;
      seenEmails.add(emp.email.toLowerCase());
      try {
        await sendTaskAssignmentEmail({
          taskTitle: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          institutionName: task.institutionName || task.institution?.instituteName,
          assignedByName: task.assignedBy?.name || null,
          assignedToEmail: emp.email,
          assignedToName: emp.name,
        });
      } catch (err) {
        console.error(`Failed to send task assignment email to ${emp.email}:`, err);
      }
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to create task" }, { status: 500 });
  }
}
