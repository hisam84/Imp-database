import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const BASE_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://hisam.beepsystems.com.bd/database').replace(/\/$/, '');
const AUTH_COOKIE = 'site-auth=authenticated';

async function getDataset(name, endpoint) {
  // Check if local backup file exists
  const localPath = path.join(__dirname, '..', 'backups', 'latest', `${name}.json`);
  if (fs.existsSync(localPath)) {
    try {
      const content = fs.readFileSync(localPath, 'utf-8');
      console.log(`[Source: Local File] Loaded ${name}.json`);
      return JSON.parse(content);
    } catch (e) {
      console.warn(`Failed reading local ${name}.json, will fetch from live API:`, e.message);
    }
  }

  // Otherwise fetch from live API
  console.log(`[Source: Live API] Fetching ${endpoint}...`);
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Cookie: AUTH_COOKIE,
      'User-Agent': 'DatabaseRestoreTool/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function restore() {
  console.log('--- Starting Complete Database Restore ---');

  // 1. Custom Fields
  try {
    const customFields = await getDataset('custom_fields', '/api/custom-fields');
    if (Array.isArray(customFields)) {
      console.log(`Restoring ${customFields.length} custom field definitions...`);
      for (const cf of customFields) {
        await prisma.customFieldDefinition.upsert({
          where: { key: cf.key },
          update: {
            label: cf.label,
            fieldType: cf.fieldType || 'text',
          },
          create: {
            id: cf.id,
            key: cf.key,
            label: cf.label,
            fieldType: cf.fieldType || 'text',
            createdAt: parseDate(cf.createdAt) || new Date(),
          },
        });
      }
      console.log('✓ Custom fields restored.');
    }
  } catch (err) {
    console.error('Error restoring custom fields:', err.message);
  }

  // 2. Employees
  try {
    const employees = await getDataset('employees', '/api/employees');
    if (Array.isArray(employees)) {
      console.log(`Restoring ${employees.length} employees...`);
      for (const emp of employees) {
        await prisma.employee.upsert({
          where: { id: emp.id },
          update: {
            name: emp.name,
            email: emp.email,
            password: emp.password || null,
            role: emp.role || 'EMPLOYEE',
            orderSerial: emp.orderSerial ?? 0,
            designation: emp.designation || null,
            phone: emp.phone || null,
            avatarColor: emp.avatarColor || null,
            avatarUrl: emp.avatarUrl || null,
            deletedAt: parseDate(emp.deletedAt),
          },
          create: {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            password: emp.password || null,
            role: emp.role || 'EMPLOYEE',
            orderSerial: emp.orderSerial ?? 0,
            designation: emp.designation || null,
            phone: emp.phone || null,
            avatarColor: emp.avatarColor || null,
            avatarUrl: emp.avatarUrl || null,
            createdAt: parseDate(emp.createdAt) || new Date(),
            updatedAt: parseDate(emp.updatedAt) || new Date(),
            deletedAt: parseDate(emp.deletedAt),
          },
        });
      }
      console.log('✓ Employees restored.');
    }
  } catch (err) {
    console.error('Error restoring employees:', err.message);
  }

  // 3. Institutions
  try {
    const institutions = await getDataset('institutions', '/api/institutions');
    if (Array.isArray(institutions)) {
      console.log(`Restoring ${institutions.length} institutions...`);
      let count = 0;
      for (const inst of institutions) {
        await prisma.institution.upsert({
          where: { id: inst.id },
          update: {
            instituteName: inst.instituteName,
            instituteNameBangla: inst.instituteNameBangla || null,
            domain: inst.domain || null,
            category: inst.category || 'Website',
            instituteType: inst.instituteType || 'Other',
            issueDate: parseDate(inst.issueDate),
            expireDate: parseDate(inst.expireDate),
            actualExpireDate: parseDate(inst.actualExpireDate),
            student: inst.student || null,
            condition: inst.condition || null,
            btclUsername: inst.btclUsername || null,
            btclPassword: inst.btclPassword || null,
            btclMobileNo: inst.btclMobileNo || null,
            btclEmail: inst.btclEmail || null,
            btclEmailPassword: inst.btclEmailPassword || null,
            instituteHead: inst.instituteHead || null,
            contact1: inst.contact1 || null,
            contact2: inst.contact2 || null,
            inChargeTeacher: inst.inChargeTeacher || null,
            designation: inst.designation || null,
            inChargeTeacherContact: inst.inChargeTeacherContact || null,
            subDistrict: inst.subDistrict || null,
            district: inst.district || null,
            address: inst.address || null,
            customFields: inst.customFields || {},
            deletedAt: parseDate(inst.deletedAt),
          },
          create: {
            id: inst.id,
            instituteName: inst.instituteName,
            instituteNameBangla: inst.instituteNameBangla || null,
            domain: inst.domain || null,
            category: inst.category || 'Website',
            instituteType: inst.instituteType || 'Other',
            issueDate: parseDate(inst.issueDate),
            expireDate: parseDate(inst.expireDate),
            actualExpireDate: parseDate(inst.actualExpireDate),
            student: inst.student || null,
            condition: inst.condition || null,
            btclUsername: inst.btclUsername || null,
            btclPassword: inst.btclPassword || null,
            btclMobileNo: inst.btclMobileNo || null,
            btclEmail: inst.btclEmail || null,
            btclEmailPassword: inst.btclEmailPassword || null,
            instituteHead: inst.instituteHead || null,
            contact1: inst.contact1 || null,
            contact2: inst.contact2 || null,
            inChargeTeacher: inst.inChargeTeacher || null,
            designation: inst.designation || null,
            inChargeTeacherContact: inst.inChargeTeacherContact || null,
            subDistrict: inst.subDistrict || null,
            district: inst.district || null,
            address: inst.address || null,
            customFields: inst.customFields || {},
            createdAt: parseDate(inst.createdAt) || new Date(),
            updatedAt: parseDate(inst.updatedAt) || new Date(),
            deletedAt: parseDate(inst.deletedAt),
          },
        });
        count++;
      }
      console.log(`✓ ${count} Institutions successfully restored.`);
    }
  } catch (err) {
    console.error('Error restoring institutions:', err.message);
  }

  // 4. Targeted Clients
  try {
    const targeted = await getDataset('targeted_clients', '/api/targeted-clients');
    if (Array.isArray(targeted)) {
      console.log(`Restoring ${targeted.length} targeted clients...`);
      for (const tc of targeted) {
        await prisma.targetedClient.upsert({
          where: { id: tc.id },
          update: {
            instituteName: tc.instituteName,
            instituteNameBangla: tc.instituteNameBangla || null,
            contactPerson: tc.contactPerson || null,
            phone: tc.phone || null,
            email: tc.email || null,
            district: tc.district || null,
            subDistrict: tc.subDistrict || null,
            address: tc.address || null,
            priority: tc.priority || 'Default',
            isArchived: Boolean(tc.isArchived),
            notes: tc.notes || null,
            deletedAt: parseDate(tc.deletedAt),
          },
          create: {
            id: tc.id,
            instituteName: tc.instituteName,
            instituteNameBangla: tc.instituteNameBangla || null,
            contactPerson: tc.contactPerson || null,
            phone: tc.phone || null,
            email: tc.email || null,
            district: tc.district || null,
            subDistrict: tc.subDistrict || null,
            address: tc.address || null,
            priority: tc.priority || 'Default',
            isArchived: Boolean(tc.isArchived),
            notes: tc.notes || null,
            createdAt: parseDate(tc.createdAt) || new Date(),
            updatedAt: parseDate(tc.updatedAt) || new Date(),
            deletedAt: parseDate(tc.deletedAt),
          },
        });
      }
      console.log('✓ Targeted clients restored.');
    }
  } catch (err) {
    console.error('Error restoring targeted clients:', err.message);
  }

  // 5. Softwares
  try {
    const softwares = await getDataset('softwares', '/api/softwares');
    if (Array.isArray(softwares)) {
      console.log(`Restoring ${softwares.length} software entries...`);
      for (const sw of softwares) {
        await prisma.software.upsert({
          where: { id: sw.id },
          update: {
            name: sw.name,
            code: sw.code || null,
            category: sw.category || null,
            description: sw.description || null,
            defaultPrice: sw.defaultPrice != null ? Number(sw.defaultPrice) : null,
            status: sw.status || 'Active',
            deletedAt: parseDate(sw.deletedAt),
          },
          create: {
            id: sw.id,
            name: sw.name,
            code: sw.code || null,
            category: sw.category || null,
            description: sw.description || null,
            defaultPrice: sw.defaultPrice != null ? Number(sw.defaultPrice) : null,
            status: sw.status || 'Active',
            createdAt: parseDate(sw.createdAt) || new Date(),
            updatedAt: parseDate(sw.updatedAt) || new Date(),
            deletedAt: parseDate(sw.deletedAt),
          },
        });
      }
      console.log('✓ Softwares restored.');
    }
  } catch (err) {
    console.error('Error restoring softwares:', err.message);
  }

  // 6. Companies & Subscriptions
  try {
    const companies = await getDataset('companies', '/api/companies');
    if (Array.isArray(companies)) {
      console.log(`Restoring ${companies.length} companies...`);
      for (const comp of companies) {
        await prisma.company.upsert({
          where: { id: comp.id },
          update: {
            companyName: comp.companyName,
            companyNameBangla: comp.companyNameBangla || null,
            contactPerson: comp.contactPerson || null,
            designation: comp.designation || null,
            phone: comp.phone || null,
            email: comp.email || null,
            address: comp.address || null,
            district: comp.district || null,
            subDistrict: comp.subDistrict || null,
            website: comp.website || null,
            notes: comp.notes || null,
            deletedAt: parseDate(comp.deletedAt),
          },
          create: {
            id: comp.id,
            companyName: comp.companyName,
            companyNameBangla: comp.companyNameBangla || null,
            contactPerson: comp.contactPerson || null,
            designation: comp.designation || null,
            phone: comp.phone || null,
            email: comp.email || null,
            address: comp.address || null,
            district: comp.district || null,
            subDistrict: comp.subDistrict || null,
            website: comp.website || null,
            notes: comp.notes || null,
            createdAt: parseDate(comp.createdAt) || new Date(),
            updatedAt: parseDate(comp.updatedAt) || new Date(),
            deletedAt: parseDate(comp.deletedAt),
          },
        });

        if (Array.isArray(comp.subscriptions)) {
          for (const sub of comp.subscriptions) {
            await prisma.companySubscription.upsert({
              where: { id: sub.id },
              update: {
                billingCycle: sub.billingCycle || 'Yearly',
                price: sub.price != null ? Number(sub.price) : null,
                status: sub.status || 'Active',
                startDate: parseDate(sub.startDate),
                expireDate: parseDate(sub.expireDate),
                actualExpireDate: parseDate(sub.actualExpireDate),
                notes: sub.notes || null,
                deletedAt: parseDate(sub.deletedAt),
              },
              create: {
                id: sub.id,
                companyId: comp.id,
                softwareId: sub.softwareId,
                billingCycle: sub.billingCycle || 'Yearly',
                price: sub.price != null ? Number(sub.price) : null,
                status: sub.status || 'Active',
                startDate: parseDate(sub.startDate),
                expireDate: parseDate(sub.expireDate),
                actualExpireDate: parseDate(sub.actualExpireDate),
                notes: sub.notes || null,
                createdAt: parseDate(sub.createdAt) || new Date(),
                updatedAt: parseDate(sub.updatedAt) || new Date(),
                deletedAt: parseDate(sub.deletedAt),
              },
            });
          }
        }
      }
      console.log('✓ Companies and Subscriptions restored.');
    }
  } catch (err) {
    console.error('Error restoring companies:', err.message);
  }

  // 7. Tasks, Subtasks & Assignees
  try {
    const tasks = await getDataset('tasks', '/api/tasks');
    if (Array.isArray(tasks)) {
      console.log(`Restoring ${tasks.length} tasks...`);
      for (const t of tasks) {
        await prisma.task.upsert({
          where: { id: t.id },
          update: {
            title: t.title,
            description: t.description || null,
            dueDate: parseDate(t.dueDate) || new Date(),
            status: t.status || 'To Do',
            priority: t.priority || 'Medium',
            completionNote: t.completionNote || null,
            progress: t.progress ?? 0,
            isMonthly: Boolean(t.isMonthly),
            monthlyRecurringDay: t.monthlyRecurringDay ?? null,
            institutionId: t.institutionId || null,
            institutionName: t.institutionName || null,
            assignedToId: t.assignedToId || null,
            assignedById: t.assignedById || null,
            deletedAt: parseDate(t.deletedAt),
          },
          create: {
            id: t.id,
            title: t.title,
            description: t.description || null,
            dueDate: parseDate(t.dueDate) || new Date(),
            status: t.status || 'To Do',
            priority: t.priority || 'Medium',
            completionNote: t.completionNote || null,
            progress: t.progress ?? 0,
            isMonthly: Boolean(t.isMonthly),
            monthlyRecurringDay: t.monthlyRecurringDay ?? null,
            institutionId: t.institutionId || null,
            institutionName: t.institutionName || null,
            assignedToId: t.assignedToId || null,
            assignedById: t.assignedById || null,
            createdAt: parseDate(t.createdAt) || new Date(),
            updatedAt: parseDate(t.updatedAt) || new Date(),
            deletedAt: parseDate(t.deletedAt),
          },
        });

        // Assignees
        if (Array.isArray(t.assignees)) {
          for (const a of t.assignees) {
            await prisma.taskAssignee.upsert({
              where: {
                taskId_employeeId: {
                  taskId: t.id,
                  employeeId: a.employeeId,
                },
              },
              update: {},
              create: {
                id: a.id,
                taskId: t.id,
                employeeId: a.employeeId,
                assignedAt: parseDate(a.assignedAt) || new Date(),
              },
            });
          }
        }

        // Subtasks
        if (Array.isArray(t.subtasks)) {
          for (const st of t.subtasks) {
            await prisma.subtask.upsert({
              where: { id: st.id },
              update: {
                title: st.title,
                isCompleted: Boolean(st.isCompleted),
                completedAt: parseDate(st.completedAt),
                completedById: st.completedById || null,
              },
              create: {
                id: st.id,
                taskId: t.id,
                title: st.title,
                isCompleted: Boolean(st.isCompleted),
                completedAt: parseDate(st.completedAt),
                completedById: st.completedById || null,
                createdById: st.createdById || null,
                createdAt: parseDate(st.createdAt) || new Date(),
                updatedAt: parseDate(st.updatedAt) || new Date(),
              },
            });
          }
        }
      }
      console.log('✓ Tasks, Assignees and Subtasks restored.');
    }
  } catch (err) {
    console.error('Error restoring tasks:', err.message);
  }

  console.log('\n=========================================');
  console.log('🎉 ALL DATA HAS BEEN SUCCESSFULLY RESTORED!');
  console.log('=========================================');
}

restore()
  .catch((err) => {
    console.error('Fatal restore error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
