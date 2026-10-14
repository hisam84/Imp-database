import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;"><h2>Google Auth Error</h2><p>${error}</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;"><h2>Authorization Code Missing</h2></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "hisam.beepsystems.com.bd";
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${protocol}://${host}/database/api/drive/auth/callback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Google Drive Connected</title>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; justify-content: center; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 32px; border-radius: 16px; max-width: 600px; width: 100%; }
    h2 { color: #10b981; margin-top: 0; }
    code { background: #0f172a; border: 1px solid #475569; padding: 12px; border-radius: 8px; display: block; word-break: break-all; font-family: monospace; color: #38bdf8; margin: 16px 0; font-size: 13px; }
    .btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; cursor: pointer; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ Google Drive Account Authorized!</h2>
    <p>Your Google Drive Refresh Token has been generated. Please copy this value and add it to your <b>Vercel Environment Variables</b>:</p>
    <p><b>Key:</b> <code>GOOGLE_REFRESH_TOKEN</code></p>
    <p><b>Value:</b></p>
    <code>${refreshToken || "Token Generated (Re-authenticate with consent prompt if empty)"}</code>
    <p style="color:#94a3b8;font-size:13px;">Once added to Vercel Environment Variables and redeployed, 1-click uploads to Google Drive will be fully operational.</p>
    <a href="/image-tools" class="btn">Return to Image Resizer Tool</a>
  </div>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err: any) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;color:red;"><h2>Token Exchange Error</h2><p>${err?.message}</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
