import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

export interface DriveUploadItem {
  name: string;
  mimeType: string;
  base64Data: string; // Base64 encoded file data
}

export interface GoogleDriveConfigStatus {
  isConfigured: boolean;
  message: string;
  authType: "oauth2" | "service_account" | "none";
  folderId?: string;
  clientEmail?: string;
}

/**
 * Checks if OAuth2 credentials with Refresh Token are configured.
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (clientId && clientSecret && refreshToken) {
    const defaultBase = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://hisam.beepsystems.com.bd/database").replace(/\/$/, "");
    const normalizedBase = defaultBase.endsWith("/database") ? defaultBase : `${defaultBase}/database`;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${normalizedBase}/api/drive/auth/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  return null;
}

/**
 * Parses and returns Google Service Account credentials from environment variables or local JSON key file.
 */
function getServiceAccountCredentials() {
  // Option 1: Direct full JSON string in ENV
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key?.replace(/\\n/g, "\n"),
      };
    } catch {
      // ignore parse error, fallback
    }
  }

  // Option 2: Individual ENV variables
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  // Option 3: Check for local service account JSON key file in root directory
  try {
    const rootDir = process.cwd();
    const files = fs.readdirSync(rootDir);
    const keyFile = files.find(
      (f) =>
        f.endsWith(".json") &&
        (f.includes("eternal-reserve") || f.includes("serviceaccount") || f.includes("service-account") || f.includes("gserviceaccount"))
    );

    if (keyFile) {
      const filePath = path.join(rootDir, keyFile);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Checks whether Google Drive credentials and folder ID are configured.
 */
export function checkGoogleDriveConfig(): GoogleDriveConfigStatus {
  const oauth2 = getOAuth2Client();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (oauth2) {
    return {
      isConfigured: true,
      authType: "oauth2",
      message: "Google Drive is connected via OAuth 2.0 (Personal Account 15GB).",
      folderId: folderId || undefined,
    };
  }

  const creds = getServiceAccountCredentials();
  if (creds && creds.client_email && creds.private_key) {
    return {
      isConfigured: true,
      authType: "service_account",
      message: "Google Drive is configured via Service Account.",
      folderId: folderId || undefined,
      clientEmail: creds.client_email,
    };
  }

  return {
    isConfigured: false,
    authType: "none",
    message: "Google Drive credentials are not configured.",
  };
}

/**
 * Creates authenticated Google Drive client instance.
 */
export function getGoogleDriveClient() {
  // 1. Prefer OAuth2 (works on all personal @gmail.com accounts)
  const oauth2 = getOAuth2Client();
  if (oauth2) {
    return google.drive({ version: "v3", auth: oauth2 });
  }

  // 2. Service Account (for Google Workspace Shared Drives)
  const creds = getServiceAccountCredentials();
  if (creds && creds.client_email && creds.private_key) {
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth });
  }

  throw new Error("Google Drive credentials not found in environment variables.");
}

/**
 * Converts a base64 string to a Readable Stream for Google Drive upload.
 */
function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Uploads a set of resized images to Google Drive inside a dedicated folder.
 */
export async function uploadImagesToGoogleDrive({
  folderName,
  files,
}: {
  folderName: string;
  files: DriveUploadItem[];
}) {
  const drive = getGoogleDriveClient();
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

  // 1. Create a dedicated folder for this upload
  const folderMetadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name: folderName || `Images - ${new Date().toISOString().slice(0, 10)}`,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    folderMetadata.parents = [parentFolderId];
  }

  const folderRes = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  const targetFolderId = folderRes.data.id;
  if (!targetFolderId) {
    throw new Error("Failed to create Google Drive folder.");
  }

  // 2. Upload all images into the created folder
  const uploadedFiles: { id: string; name: string; webViewLink?: string }[] = [];

  for (const item of files) {
    const cleanBase64 = item.base64Data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const media = {
      mimeType: item.mimeType,
      body: bufferToStream(buffer),
    };

    const fileRes = await drive.files.create({
      requestBody: {
        name: item.name,
        parents: [targetFolderId],
      },
      media: media,
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    uploadedFiles.push({
      id: fileRes.data.id || "",
      name: fileRes.data.name || item.name,
      webViewLink: fileRes.data.webViewLink || undefined,
    });
  }

  return {
    success: true,
    folderId: targetFolderId,
    folderName: folderRes.data.name || folderName,
    folderLink:
      folderRes.data.webViewLink ||
      `https://drive.google.com/drive/folders/${targetFolderId}`,
    uploadedFiles,
  };
}
