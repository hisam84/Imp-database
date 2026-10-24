import { NextRequest, NextResponse } from "next/server";
import net from "net";
import dns from "dns/promises";
import { getServerOutboundIp, checkAdnBalance } from "@/lib/adnSmsService";
import { getSmsSettings } from "@/lib/smsSettings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result: any = {
    timestamp: new Date().toISOString(),
    serverOutboundIp: null,
    dns: { status: "pending", host: "portal.adnsms.com", ip: null, latencyMs: 0 },
    tcpPort443: { status: "pending", host: "103.12.205.229", port: 443, latencyMs: 0, error: null },
    gatewayHttp: { status: "pending", statusCode: null, latencyMs: 0, responseSnippet: null, error: null },
    diagnosis: [],
    recommendedAction: null,
  };

  // 1. Detect Server Outbound Public IP
  try {
    result.serverOutboundIp = await getServerOutboundIp();
  } catch (err: any) {
    result.serverOutboundIp = `Detection error: ${err?.message || err}`;
  }

  // 2. Test DNS Resolution
  const dnsStart = Date.now();
  try {
    const lookup = await dns.lookup("portal.adnsms.com", { family: 4 });
    result.dns = {
      status: "SUCCESS",
      host: "portal.adnsms.com",
      ip: lookup.address,
      latencyMs: Date.now() - dnsStart,
    };
  } catch (dnsErr: any) {
    result.dns = {
      status: "FAILED",
      host: "portal.adnsms.com",
      ip: null,
      latencyMs: Date.now() - dnsStart,
      error: dnsErr?.message || String(dnsErr),
    };
    result.diagnosis.push("DNS Resolution Failed: The server could not resolve portal.adnsms.com.");
  }

  // 3. Test Raw TCP Socket Connection to 103.12.205.229:443
  const targetIp = result.dns.ip || "103.12.205.229";
  const tcpStart = Date.now();
  await new Promise<void>((resolve) => {
    const socket = net.connect(443, targetIp);
    socket.setTimeout(6000);

    socket.on("connect", () => {
      result.tcpPort443 = {
        status: "CONNECTED",
        host: targetIp,
        port: 443,
        latencyMs: Date.now() - tcpStart,
        error: null,
      };
      socket.destroy();
      resolve();
    });

    socket.on("timeout", () => {
      result.tcpPort443 = {
        status: "TIMED_OUT",
        host: targetIp,
        port: 443,
        latencyMs: Date.now() - tcpStart,
        error: "TCP connection timed out after 6 seconds. Firewall dropped packets.",
      };
      result.diagnosis.push("TCP Handshake Timed Out: Packets to 103.12.205.229:443 are being dropped by ADN Telecom's firewall or your VPS outbound firewall.");
      socket.destroy();
      resolve();
    });

    socket.on("error", (err) => {
      result.tcpPort443 = {
        status: "ERROR",
        host: targetIp,
        port: 443,
        latencyMs: Date.now() - tcpStart,
        error: err.message,
      };
      result.diagnosis.push(`TCP Socket Error: ${err.message}`);
      socket.destroy();
      resolve();
    });
  });

  // 4. Test ADN SMS Gateway HTTP POST (Balance Check API)
  const settings = await getSmsSettings();
  const httpStart = Date.now();
  try {
    const balRes = await checkAdnBalance({
      apiKey: settings.apiKey || "DIAG_TEST_KEY",
      apiSecret: settings.apiSecret || "DIAG_TEST_SECRET",
      apiDomain: settings.apiDomain,
    });

    result.gatewayHttp = {
      status: balRes.success ? "SUCCESS" : "FAILED",
      latencyMs: Date.now() - httpStart,
      apiResponseCode: balRes.apiResponseCode,
      apiResponseMessage: balRes.apiResponseMessage,
      error: balRes.error || null,
      smsBalance: balRes.smsBalance ?? null,
    };

    if (balRes.success) {
      result.diagnosis.push(`Gateway Connected Successfully! Remaining balance: ${balRes.smsBalance} SMS.`);
      result.recommendedAction = "All checks passed! ADN SMS is fully functional.";
    } else {
      result.diagnosis.push(`Gateway returned error: ${balRes.error}`);
      if (String(balRes.apiResponseCode) === "9998" || String(balRes.error).includes("IP_NOT_WHITELISTED")) {
        result.recommendedAction = `Your server IP (${result.serverOutboundIp}) is NOT whitelisted in the ADN SMS portal. Please log in to portal.adnsms.com > API Settings > IP Whitelist and add ${result.serverOutboundIp}.`;
      } else if (String(balRes.apiResponseCode) === "3001" || String(balRes.apiResponseCode) === "9999") {
        result.recommendedAction = "Network is reachable! Please verify your ADN SMS API Key and API Secret are correct.";
      }
    }
  } catch (httpErr: any) {
    result.gatewayHttp = {
      status: "EXCEPTION",
      latencyMs: Date.now() - httpStart,
      error: httpErr?.message || String(httpErr),
    };
    result.diagnosis.push(`HTTP Request Exception: ${httpErr?.message || httpErr}`);
  }

  // Final Action Recommendation based on findings
  if (result.tcpPort443.status === "TIMED_OUT") {
    result.recommendedAction = `CRITICAL: Your VPS (IP: ${result.serverOutboundIp}) cannot reach ADN SMS IP (103.12.205.229:443). ADN Telecom's firewall is dropping the connection. Either: 1) You whitelisted your personal PC's IP instead of your VPS IP (${result.serverOutboundIp}), or 2) ADN firewall takes 15-30 minutes to propagate new IPs, or 3) ADN Telecom requires contacting their support (support@adnsms.com) to allow overseas/VPS IPs.`;
  }

  return NextResponse.json({
    success: true,
    ...result,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
