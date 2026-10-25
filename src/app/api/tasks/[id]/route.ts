import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTaskAssignmentEmail, sendTaskCompletionEmail } from "@/lib/mailer";
import { parseDhakaDateTimeInput, getNextMonthlyDate, getDhakaDayOfMonth, getDhakaStartOfDay } from "@/lib/dateUtils";
import { ensureSubtaskTable } from "@/lib/ensureSubtaskTable";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureSubtaskTable();
    const task = await (prisma as any).task.findUnique({
      where: { id: params.id },
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

    if (!task || task.deletedAt) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch task" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
      isMonthly,
    } = body;

    const existingTask = await (prisma as any).task.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        dueDate: true,
        assignedToId: true,
        isMonthly: true,
        monthlyRecurringDay: true,
        assignees: {
          select: { employeeId: true },
        },
      },
    });

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description ? description.trim() : null;
    if (dueDate !== undefined) data.dueDate = parseDhakaDateTimeInput(dueDate);
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority === "Argent" ? "Urgent" : priority;
    if (completionNote !== undefined) data.completionNote = completionNote ? completionNote.trim() : null;

    if (isMonthly !== undefined) {
      data.isMonthly = Boolean(isMonthly);
      if (data.isMonthly) {
        data.monthlyRecurringDay = getDhakaDayOfMonth(data.dueDate || existingTask?.dueDate);
      }
    }

    // Enforce Rule: Monthly recurring tasks can ONLY be marked as 'Completed' on or after their due date (in Dhaka timezone)
    const isTargetingCompleted = (status === "Completed" || data.status === "Completed");
    const isMonthlyTask = Boolean(isMonthly !== undefined ? isMonthly : existingTask?.isMonthly);
    if (isTargetingCompleted && isMonthlyTask) {
      const taskDue = data.dueDate || existingTask?.dueDate;
      if (taskDue) {
        const nowStart = getDhakaStartOfDay();
        const dueStart = getDhakaStartOfDay(taskDue);
        if (dueStart.getTime() > nowStart.getTime()) {
          return NextResponse.json(
            {
              error: "Monthly recurring tasks can only be completed on or after their scheduled due date.",
            },
            { status: 400 }
          );
        }
      }
    }

    if (progress !== undefined) {
      data.progress = Math.min(100, Math.max(0, Number(progress)));
    } else if (status === "Completed") {
      data.progress = 100;
    }

    if (institutionId !== undefined) data.institutionId = institutionId || null;
    if (institutionName !== undefined) data.institutionName = institutionName || null;

    // Handle Assignees
    let newAssigneeIds: string[] | null = null;
    if (assignedToIds !== undefined) {
      newAssigneeIds = Array.isArray(assignedToIds)
        ? Array.from(new Set(assignedToIds.map(String).map((s) => s.trim()).filter(Boolean)))
        : [];
    } else if (assignedToId !== undefined) {
      newAssigneeIds = assignedToId ? [String(assignedToId).trim()] : [];
    }

    if (newAssigneeIds !== null) {
      data.assignedToId = newAssigneeIds[0] || null;
    }

    if (assignedById !== undefined) data.assignedById = assignedById || null;

    if (institutionId && !institutionName) {
      const inst = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { instituteName: true },
      });
      if (inst) data.institutionName = inst.instituteName;
    }

    // Update Task record
    const updated = await (prisma as any).task.update({
      where: { id: params.id },
      data,
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

    // If assignees were modified, sync TaskAssignee join table
    if (newAssigneeIds !== null) {
      try {
        await (prisma as any).taskAssignee.deleteMany({
          where: { taskId: params.id },
        });

        if (newAssigneeIds.length > 0) {
          await (prisma as any).taskAssignee.createMany({
            data: newAssigneeIds.map((empId) => ({
              taskId: params.id,
              employeeId: empId,
            })),
            skipDuplicates: true,
          });
        }
      } catch (err) {
        console.error("Failed to sync TaskAssignee records on update:", err);
      }
    }

    // Fetch refreshed assignees
    const refreshedAssignees = await (prisma as any).taskAssignee.findMany({
      where: { taskId: params.id },
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
      orderBy: { assignedAt: "asc" },
    });
    updated.assignees = refreshedAssignees;

    // Send assignment emails to newly assigned employees
    const existingAssigneeSet = new Set(
      existingTask?.assignees?.map((a: any) => a.employeeId) || (existingTask?.assignedToId ? [existingTask.assignedToId] : [])
    );

    if (newAssigneeIds !== null) {
      const newlyAddedEmployees = refreshedAssignees
        .map((a: any) => a.employee)
        .filter((emp: any) => emp && emp.id && !existingAssigneeSet.has(emp.id) && emp.email);

      for (const emp of newlyAddedEmployees) {
        try {
          await sendTaskAssignmentEmail({
            taskTitle: updated.title,
            description: updated.description,
            dueDate: updated.dueDate,
            priority: updated.priority,
            institutionName: updated.institutionName || updated.institution?.instituteName,
            assignedByName: updated.assignedBy?.name || null,
            assignedToEmail: emp.email,
            assignedToName: emp.name,
          });
        } catch (err) {
          console.error("Failed to send task assignment email on update:", err);
        }
      }
    }

    // Optional completion confirmation email sent to the task assigner or specified recipient
    if (updated.status === "Completed" && body.sendCompletionEmail) {
      const recipientEmail =
        body.notifyEmail?.trim() ||
        updated.assignedBy?.email ||
        process.env.ADMIN_EMAIL ||
        "imperialitbd2011@gmail.com";
      const recipientName = updated.assignedBy?.name || "Administrator";

      if (recipientEmail) {
        try {
          await sendTaskCompletionEmail({
            taskTitle: updated.title,
            description: updated.description,
            dueDate: updated.dueDate,
            completionNote: updated.completionNote,
            institutionName: updated.institutionName || updated.institution?.instituteName,
            completedByName: updated.assignedTo?.name || "Team Member",
            assignedByName: updated.assignedBy?.name || null,
            recipientEmail,
            recipientName,
          });
        } catch (err) {
          console.error("Failed to send task completion confirmation email:", err);
        }
      }
    }

    // Auto-create next month's task instance if this is a recurring monthly task
    const isBecomingCompleted = updated.status === "Completed" && existingTask?.status !== "Completed";
    const isMonthlyRecurring = Boolean(updated.isMonthly || existingTask?.isMonthly);

    if (isBecomingCompleted && isMonthlyRecurring) {
      try {
        const nextDueDate = getNextMonthlyDate(
          updated.dueDate,
          updated.monthlyRecurringDay || undefined
        );

        // Safeguard: Check if next month's task already exists
        const startWindow = new Date(nextDueDate.getTime() - 15 * 24 * 60 * 60 * 1000);
        const endWindow = new Date(nextDueDate.getTime() + 15 * 24 * 60 * 60 * 1000);

        const existingNext = await (prisma as any).task.findFirst({
          where: {
            deletedAt: null,
            title: updated.title,
            institutionId: updated.institutionId,
            isMonthly: true,
            dueDate: { gte: startWindow, lte: endWindow },
          },
        });

        if (!existingNext) {
          const createdNext = await (prisma as any).task.create({
            data: {
              title: updated.title,
              description: updated.description,
              dueDate: nextDueDate,
              status: "To Do",
              priority: updated.priority,
              progress: 0,
              isMonthly: true,
              monthlyRecurringDay: updated.monthlyRecurringDay || getDhakaDayOfMonth(updated.dueDate),
              institutionId: updated.institutionId,
              institutionName: updated.institutionName,
              assignedToId: updated.assignedToId,
              assignedById: updated.assignedById,
              assignees: refreshedAssignees && refreshedAssignees.length > 0
                ? {
                    create: refreshedAssignees.map((a: any) => ({
                      employeeId: a.employeeId,
                    })),
                  }
                : undefined,
              subtasks: updated.subtasks && updated.subtasks.length > 0
                ? {
                    create: updated.subtasks.map((st: any) => ({
                      title: st.title,
                      createdById: updated.assignedById || null,
                      isCompleted: false,
                    })),
                  }
                : undefined,
            },
          });
        }
      } catch (err) {
        console.error("Failed to auto-schedule next monthly task instance:", err);
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updated = await (prisma as any).task.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, id: updated.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete task" }, { status: 500 });
  }
}
