import { prisma } from "@/lib/prisma";

let targetedTablesEnsured = false;

export async function ensureTargetedTables() {
  if (targetedTablesEnsured) return;

  // 1. Ensure TargetedCategory table exists
  try {
    // MySQL syntax
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`TargetedCategory\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(191) NOT NULL UNIQUE,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      );
    `);
  } catch (mysqlErr) {
    // Postgres syntax fallback
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TargetedCategory" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (pgErr) {
      console.warn("ensureTargetedTables: Failed to create TargetedCategory table:", mysqlErr, pgErr);
    }
  }

  // Also try lowercase table name for MySQL on case-sensitive OS if needed
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS targetedcategory (
        id VARCHAR(191) NOT NULL PRIMARY KEY,
        name VARCHAR(191) NOT NULL UNIQUE,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      );
    `);
  } catch {}

  // 2. Ensure category column exists on TargetedClient
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`TargetedClient\` ADD COLUMN \`category\` VARCHAR(191) NULL;`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE TargetedClient ADD COLUMN category VARCHAR(191) NULL;`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE targetedclient ADD COLUMN category VARCHAR(191) NULL;`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TargetedClient" ADD COLUMN IF NOT EXISTS "category" TEXT;`);
  } catch {}

  // 3. Ensure index on category
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX \`TargetedClient_category_idx\` ON \`TargetedClient\`(\`category\`);`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX TargetedClient_category_idx ON TargetedClient(category);`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TargetedClient_category_idx" ON "TargetedClient"("category");`);
  } catch {}

  // 4. Ensure other columns (deletedAt, isArchived, instituteNameBangla) in case of legacy tables
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`TargetedClient\` ADD COLUMN \`isArchived\` BOOLEAN NOT NULL DEFAULT false;`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TargetedClient" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;`);
  } catch {}

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`TargetedClient\` ADD COLUMN \`deletedAt\` DATETIME(3) NULL;`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TargetedClient" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);`);
  } catch {}

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`TargetedClient\` ADD COLUMN \`instituteNameBangla\` VARCHAR(191) NULL;`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TargetedClient" ADD COLUMN IF NOT EXISTS "instituteNameBangla" TEXT;`);
  } catch {}

  targetedTablesEnsured = true;
}
