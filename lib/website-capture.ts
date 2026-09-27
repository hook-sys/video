import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { chromium } from "playwright-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";

export const VISIBLE_TEXT_MAX = 20_000;
const NAV_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 45_000;

// Block requests to private/internal networks (SSRF protection).
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

function isPublicIp(ip: string) {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  const family = isIP(ip);
  return family !== 0 && !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

export async function isPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return isPublicIp(host);
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => isPublicIp(a.address));
  } catch {
    return false;
  }
}

export type WebsiteCapture = {
  finalUrl: string;
  title: string;
  metaDescription: string;
  visibleText: string;
  screenshot: Buffer;
};

export async function captureWebsite(url: string): Promise<WebsiteCapture> {
  const browser = await chromium
    .launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined })
    .catch(() => {
      // e.g. Vercel Functions ship no Chromium.
      throw new Error(
        "Website capture is unavailable on this server (no Chromium). Upload screenshots to continue.",
      );
    });
  const killTimer = setTimeout(() => browser.close(), TOTAL_TIMEOUT_MS);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const hostChecks = new Map<string, Promise<boolean>>();
    await page.route("**/*", async (route) => {
      const { protocol, hostname } = new URL(route.request().url());
      if (protocol === "data:" || protocol === "blob:") return route.continue();
      if (protocol !== "http:" && protocol !== "https:") return route.abort("blockedbyclient");
      if (!hostChecks.has(hostname)) hostChecks.set(hostname, isPublicHost(hostname));
      return (await hostChecks.get(hostname)) ? route.continue() : route.abort("blockedbyclient");
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    if (!response?.ok()) {
      throw new Error(`Website responded with HTTP ${response?.status() ?? "error"}.`);
    }
    await page.waitForLoadState("load", { timeout: 5_000 }).catch(() => {});

    const data = await page.evaluate(() => ({
      title: document.title,
      metaDescription:
        document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      text: document.body?.innerText ?? "",
    }));
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80, timeout: 10_000 });

    return {
      finalUrl: page.url(),
      title: data.title.trim().slice(0, 500),
      metaDescription: data.metaDescription.trim().slice(0, 1_000),
      visibleText: data.text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim().slice(0, VISIBLE_TEXT_MAX),
      screenshot,
    };
  } finally {
    clearTimeout(killTimer);
    await browser.close().catch(() => {});
  }
}

// Runs a capture and records the result; never throws so the project stays usable.
export async function runWebsiteCapture(
  supabase: SupabaseClient,
  capture: { id: string; userId: string; projectId: string; url: string },
) {
  try {
    const result = await captureWebsite(capture.url);
    const screenshotPath = `${capture.userId}/${capture.projectId}/website-${capture.id}.jpg`;
    const upload = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(screenshotPath, result.screenshot, { contentType: "image/jpeg" });

    await supabase
      .from("website_captures")
      .update({
        status: "completed",
        url: result.finalUrl,
        title: result.title,
        meta_description: result.metaDescription,
        visible_text: result.visibleText,
        screenshot_path: upload.error ? null : screenshotPath,
      })
      .eq("id", capture.id);
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n")[0] : "Capture failed.";
    await supabase
      .from("website_captures")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", capture.id);
  }
}
