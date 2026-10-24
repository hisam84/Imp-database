import { NextRequest, NextResponse } from "next/server";
import net from "net";
import dns from "dns/promises";
import { getServerOutboundIp, checkQsmsBalance } from "@/lib/qsmsService";
import { getSmsSettings } from "@/lib/smsSettings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const settings = await getSmsSettings();
  let targetHostname = "api.qsms.com.bd";
  try {
    const parsed = new URL(settings.apiDomain);
    targetHostname = parsed.hostname;
  } catch {}

  const result: any = {
    timestamp: new Date().toISOString(),
    serverOutboundIp: null,
    dns: { status: "pending", host: targetHostname, ip: null, latencyMs: 0 },
    tcpPort443: { status: "pending", host: targetHostname, port: 443, latencyMs: 0, error: null },
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
    const lookup = await dns.lookup(targetHostname, { family: 4 });
    result.dns = {
      status: "SUCCESS",
      host: targetHostname,
      ip: lookup.address,
      latencyMs: Date.now() - dnsStart,
    };
  } catch (dnsErr: any) {
    result.dns = {
      status: "FAILED",
      host: targetHostname,
      ip: null,
      latencyMs: Date.now() - dnsStart,
      error: dnsErr?.message || String(dnsErr),
    };
    result.diagnosis.push(`DNS Resolution Failed: The server could not resolve ${targetHostname}.`);
  }

  // 3. Test Raw TCP Socket Connection to targetHostname:443
  const targetIp = result.dns.ip || "163.227.239.84";
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
        error: "TCP connection timed out after 6 seconds.",
      };
      result.diagnosis.push(`TCP Handshake Timed Out: Packets to ${targetIp}:443 were dropped.`);
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

  // 4. Test QSMS Gateway HTTP Connection / Credentials
  const httpStart = Date.now();
  try {
    const balRes = await checkQsmsBalance({
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
      apiDomain: settings.apiDomain,
      senderId: settings.senderId,
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
      result.diagnosis.push("Gateway Connected Successfully! QSMS API is reachable and active.");
      result.recommendedAction = "All checks passed! QSMS Gateway is ready to send messages.";
    } else {
      result.diagnosis.push(`Gateway returned: ${balRes.error}`);
      if (balRes.error?.includes("not configured")) {
        result.recommendedAction = "Please enter your QSMS API Key and API Secret in SMS Settings above.";
      } else if (balRes.error?.includes("Invalid API Key")) {
        result.recommendedAction = "Network is reachable! Please check and re-enter your valid QSMS API Key and API Secret.";
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
  if (result.tcpPort443.status === "CONNECTED" && !result.recommendedAction) {
    result.recommendedAction = "Network & TCP Port 443 connection to QSMS is fully OPEN!";
  }

  return NextResponse.json({
    success: true,
    ...result,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
