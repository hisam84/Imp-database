import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://imperialitbd.com/database').replace(/\/$/, '');
const AUTH_COOKIE = 'site-auth=authenticated';

const ENDPOINTS = [
  { name: 'institutions', endpoint: '/api/institutions' },
  { name: 'institutions_trash', endpoint: '/api/institutions/trash' },
  { name: 'custom_fields', endpoint: '/api/custom-fields' },
  { name: 'employees', endpoint: '/api/employees' },
  { name: 'targeted_clients', endpoint: '/api/targeted-clients' },
  { name: 'tasks', endpoint: '/api/tasks' },
  { name: 'companies', endpoint: '/api/companies' },
  { name: 'softwares', endpoint: '/api/softwares' },
  { name: 'mail_settings', endpoint: '/api/mail-settings' },
  { name: 'subscription_settings', endpoint: '/api/subscription-settings' },
];

async function fetchData(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Cookie: AUTH_COOKIE,
      'User-Agent': 'DatabaseBackupTool/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '..', 'backups', `backup-${timestamp}`);
  const latestDir = path.join(__dirname, '..', 'backups', 'latest');

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(latestDir, { recursive: true });

  console.log(`Starting database backup from ${BASE_URL}...`);
  const fullBackup = {
    source: BASE_URL,
    backupDate: new Date().toISOString(),
    data: {},
    summary: {},
  };

  const workbook = XLSX.utils.book_new();

  for (const { name, endpoint } of ENDPOINTS) {
    try {
      console.log(`Fetching ${name} from ${endpoint}...`);
      const data = await fetchData(endpoint);
      fullBackup.data[name] = data;

      const recordCount = Array.isArray(data)
        ? data.length
        : typeof data === 'object' && data !== null
        ? Object.keys(data).length
        : 1;

      fullBackup.summary[name] = recordCount;
      console.log(`✓ Fetched ${name}: ${recordCount} record(s)`);

      // Write individual JSON file
      const jsonContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(path.join(backupDir, `${name}.json`), jsonContent, 'utf-8');
      fs.writeFileSync(path.join(latestDir, `${name}.json`), jsonContent, 'utf-8');

      // Create Excel sheet if array of objects
      if (Array.isArray(data) && data.length > 0) {
        const flattenedData = data.map((item) => {
          const row = {};
          for (const [k, v] of Object.entries(item)) {
            let strVal = typeof v === 'object' && v !== null ? JSON.stringify(v) : (v !== null && v !== undefined ? String(v) : '');
            if (strVal.length > 32000) {
              strVal = strVal.slice(0, 32000) + '... [TRUNCATED FOR EXCEL CELL LIMIT - SEE JSON FOR FULL VALUE]';
            }
            row[k] = strVal;
          }
          return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        // Sheet name max 31 chars
        const sheetName = name.slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    } catch (err) {
      console.error(`✗ Error backing up ${name}:`, err.message);
      fullBackup.summary[name] = { error: err.message };
    }
  }

  // Write consolidated JSON file
  const fullJson = JSON.stringify(fullBackup, null, 2);
  fs.writeFileSync(path.join(backupDir, 'full_database_backup.json'), fullJson, 'utf-8');
  fs.writeFileSync(path.join(latestDir, 'full_database_backup.json'), fullJson, 'utf-8');

  // Write consolidated Excel file
  const excelPath = path.join(backupDir, 'database_backup.xlsx');
  const latestExcelPath = path.join(latestDir, 'database_backup.xlsx');
  XLSX.writeFile(workbook, excelPath);
  XLSX.writeFile(workbook, latestExcelPath);

  // Write summary markdown report
  const summaryMd = `# Database Backup Report
- **Source**: ${BASE_URL}
- **Timestamp**: ${fullBackup.backupDate}
- **Backup Directory**: backups/backup-${timestamp}

## Record Counts:
${Object.entries(fullBackup.summary)
  .map(([k, v]) => `- **${k}**: ${typeof v === 'object' ? JSON.stringify(v) : v} records`)
  .join('\n')}
`;
  fs.writeFileSync(path.join(backupDir, 'SUMMARY.md'), summaryMd, 'utf-8');
  fs.writeFileSync(path.join(latestDir, 'SUMMARY.md'), summaryMd, 'utf-8');

  console.log('\nBackup successfully completed!');
  console.log(`Saved to: ${backupDir}`);
  console.log(`Excel file: ${excelPath}`);
}

runBackup().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
