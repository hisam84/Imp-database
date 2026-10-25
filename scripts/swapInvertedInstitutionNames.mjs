import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Bengali & English Unicode Matchers
const HAS_BANGLA_REGEX = /[\u0980-\u09FF]/;
const HAS_ENGLISH_REGEX = /[A-Za-z]/;

/**
 * Checks whether instituteName and instituteNameBangla are swapped.
 * Returns true strictly when instituteName contains Bengali script and
 * instituteNameBangla contains English/Latin script.
 */
function isInverted(name, nameBangla) {
  if (!name || typeof name !== 'string') return false;
  if (!nameBangla || typeof nameBangla !== 'string') return false;

  const trimmedName = name.trim();
  const trimmedNameBangla = nameBangla.trim();

  if (!trimmedName || !trimmedNameBangla) return false;

  const nameHasBangla = HAS_BANGLA_REGEX.test(trimmedName);
  const nameBanglaHasEnglish = HAS_ENGLISH_REGEX.test(trimmedNameBangla);
  const nameBanglaHasBangla = HAS_BANGLA_REGEX.test(trimmedNameBangla);
  const nameHasEnglish = HAS_ENGLISH_REGEX.test(trimmedName);

  // Clear inverted case: Name has Bangla while NameBangla has English without Bangla
  if (nameHasBangla && nameBanglaHasEnglish && !nameBanglaHasBangla) {
    return true;
  }

  // Name has strictly Bangla (no English) and NameBangla has English
  if (nameHasBangla && !nameHasEnglish && nameBanglaHasEnglish) {
    return true;
  }

  return false;
}

async function run() {
  const isApply = process.argv.includes('--apply') || process.argv.includes('--execute') || process.argv.includes('--commit');
  const mode = isApply ? 'EXECUTE / APPLY' : 'DRY-RUN (SIMULATION)';

  console.log('===============================================================');
  console.log(`  INSTITUTION NAME INVERSION FIXER - Mode: ${mode}`);
  console.log('===============================================================\n');

  try {
    console.log('Fetching all institutions from database...');
    const allInstitutions = await prisma.institution.findMany({
      select: {
        id: true,
        instituteName: true,
        instituteNameBangla: true,
        domain: true,
        category: true,
        instituteType: true,
      },
    });

    console.log(`Total institutions found: ${allInstitutions.length}`);

    const invertedList = [];
    const correctList = [];

    for (const inst of allInstitutions) {
      if (isInverted(inst.instituteName, inst.instituteNameBangla)) {
        invertedList.push({
          id: inst.id,
          domain: inst.domain || '-',
          currentInstituteName: inst.instituteName,
          currentInstituteNameBangla: inst.instituteNameBangla,
          correctedInstituteName: inst.instituteNameBangla.trim(),
          correctedInstituteNameBangla: inst.instituteName.trim(),
        });
      } else {
        correctList.push(inst);
      }
    }

    console.log(`Correctly formatted institutions: ${correctList.length}`);
    console.log(`Inverted / Swapped institutions detected: ${invertedList.length}\n`);

    if (invertedList.length === 0) {
      console.log('✓ No inverted institution names found. All records are already properly aligned!');
      return;
    }

    // Display sample preview table (up to 15 items)
    const previewCount = Math.min(invertedList.length, 15);
    console.log(`Sample Inverted Records (Showing ${previewCount} of ${invertedList.length}):`);
    console.log('--------------------------------------------------------------------------------');
    console.table(
      invertedList.slice(0, previewCount).map((item, idx) => ({
        '#': idx + 1,
        'Domain': item.domain,
        'Current Name (Bangla)': item.currentInstituteName.length > 28 ? item.currentInstituteName.slice(0, 25) + '...' : item.currentInstituteName,
        'Current NameBangla (English)': item.currentInstituteNameBangla.length > 28 ? item.currentInstituteNameBangla.slice(0, 25) + '...' : item.currentInstituteNameBangla,
      }))
    );
    console.log('--------------------------------------------------------------------------------\n');

    if (!isApply) {
      console.log('ℹ️  DRY RUN COMPLETED.');
      console.log(`   ${invertedList.length} records will be swapped when executed.`);
      console.log('   No changes were made to the database.');
      console.log('\n   To execute this swap and permanently update database records, run:');
      console.log('   >> node scripts/swapInvertedInstitutionNames.mjs --apply\n');
      return;
    }

    // --- APPLY MODE: BACKUP FIRST ---
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(__dirname, '..', 'backups', 'name-swaps');
    fs.mkdirSync(backupDir, { recursive: true });

    const backupJsonPath = path.join(backupDir, `backup-before-swap-${timestamp}.json`);
    const backupXlsxPath = path.join(backupDir, `backup-before-swap-${timestamp}.xlsx`);

    // Save JSON backup
    fs.writeFileSync(backupJsonPath, JSON.stringify(invertedList, null, 2), 'utf-8');

    // Save Excel backup
    const worksheet = XLSX.utils.json_to_sheet(
      invertedList.map((item) => ({
        'Institution ID': item.id,
        'Domain': item.domain,
        'Original Institute Name (Bangla)': item.currentInstituteName,
        'Original Institute Name Bangla (English)': item.currentInstituteNameBangla,
        'Corrected Institute Name (English)': item.correctedInstituteName,
        'Corrected Institute Name Bangla (Bangla)': item.correctedInstituteNameBangla,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Swapped_Institutions');
    XLSX.writeFile(workbook, backupXlsxPath);

    console.log(`✓ Safety Backup Created:`);
    console.log(`  JSON: ${backupJsonPath}`);
    console.log(`  Excel: ${backupXlsxPath}\n`);

    console.log(`Applying swap to ${invertedList.length} institutions in database...`);

    // Chunk updates into batches of 50 for safety and performance
    const BATCH_SIZE = 50;
    let updatedCount = 0;

    for (let i = 0; i < invertedList.length; i += BATCH_SIZE) {
      const batch = invertedList.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((item) =>
          prisma.institution.update({
            where: { id: item.id },
            data: {
              instituteName: item.correctedInstituteName,
              instituteNameBangla: item.correctedInstituteNameBangla,
            },
          })
        )
      );
      updatedCount += batch.length;
      process.stdout.write(`  Progress: ${updatedCount} / ${invertedList.length} updated...\r`);
    }

    console.log(`\n\n🎉 SUCCESS! Successfully swapped and corrected ${updatedCount} institution names.`);
    console.log('   All English names are now in "instituteName" and Bangla names in "instituteNameBangla".');
    console.log('   All other institution fields and non-inverted records were untouched.');
  } catch (error) {
    console.error('\n❌ Error occurred during execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
