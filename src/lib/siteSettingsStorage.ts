import { prisma } from "@/lib/prisma";

let hasAttemptedDbMigration = false;

/**
 * Attempts to expand the MySQL columns for SiteSettings if not already done.
 */
export async function ensureSiteSettingsColumnExpanded() {
  if (hasAttemptedDbMigration) return;
  hasAttemptedDbMigration = true;
  try {
    await (prisma as any).$executeRawUnsafe(
      "ALTER TABLE `SiteSettings` MODIFY `adminEmail` LONGTEXT, MODIFY `password` TEXT"
    );
  } catch (err: any) {
    // Ignore if not MySQL, table doesn't exist yet, or lack of ALTER permissions
  }
}

/**
 * Safely saves arbitrary payload to SiteSettings.
 * If the payload is small (<= 180 chars) or MySQL column is LONGTEXT, saves directly.
 * If MySQL column is still VARCHAR(191) and payload > 180 chars, chunks it across multiple
 * rows (id_chunk_0, id_chunk_1, ...) to guarantee zero "value too long" errors.
 */
export async function saveSiteSettingsPayload(
  key: string,
  payload: string,
  passwordField = "config"
) {
  await ensureSiteSettingsColumnExpanded();

  const CHUNK_SIZE = 180;

  // Try direct save first
  try {
    await (prisma as any).siteSettings.upsert({
      where: { id: key },
      create: {
        id: key,
        password: passwordField.slice(0, 180),
        adminEmail: payload,
      },
      update: {
        password: passwordField.slice(0, 180),
        adminEmail: payload,
      },
    });
    return;
  } catch (directErr: any) {
    const errMsg = String(directErr?.message || "");
    // If error is column too long, fallback to chunked multi-row storage
    if (errMsg.includes("too long") || errMsg.includes("adminEmail")) {
      console.warn(`Direct save for "${key}" exceeded column size; switching to chunked storage.`);
    } else {
      throw directErr;
    }
  }

  // Split into chunks of <= 180 characters
  const chunks: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    chunks.push(payload.slice(i, i + CHUNK_SIZE));
  }

  // Save each chunk
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkKey = `${key}_c${idx}`;
    await (prisma as any).siteSettings.upsert({
      where: { id: chunkKey },
      create: {
        id: chunkKey,
        password: passwordField.slice(0, 180),
        adminEmail: chunks[idx],
      },
      update: {
        password: passwordField.slice(0, 180),
        adminEmail: chunks[idx],
      },
    });
  }

  // Save master pointer with chunk count
  const pointer = `__CHUNKED__:${chunks.length}`;
  await (prisma as any).siteSettings.upsert({
    where: { id: key },
    create: {
      id: key,
      password: passwordField.slice(0, 180),
      adminEmail: pointer,
    },
    update: {
      password: passwordField.slice(0, 180),
      adminEmail: pointer,
    },
  });
}

/**
 * Loads arbitrary payload from SiteSettings.
 * Handles both direct string and chunked multi-row format seamlessly.
 */
export async function loadSiteSettingsPayload(key: string): Promise<string | null> {
  await ensureSiteSettingsColumnExpanded();

  try {
    const record = await (prisma as any).siteSettings.findUnique({
      where: { id: key },
    });

    if (!record?.adminEmail) return null;

    const val: string = record.adminEmail;

    // Check if chunked
    if (val.startsWith("__CHUNKED__:")) {
      const parts = val.split(":");
      const totalChunks = parseInt(parts[1], 10);
      if (!isNaN(totalChunks) && totalChunks > 0) {
        let full = "";
        for (let idx = 0; idx < totalChunks; idx++) {
          const chunkKey = `${key}_c${idx}`;
          const chunkRec = await (prisma as any).siteSettings.findUnique({
            where: { id: chunkKey },
          });
          if (chunkRec?.adminEmail) {
            full += chunkRec.adminEmail;
          }
        }
        return full;
      }
    }

    return val;
  } catch (err: any) {
    console.warn(`Could not load site settings payload for key "${key}":`, err?.message);
    return null;
  }
}
