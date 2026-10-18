import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { type Page, chromium as playwright } from "playwright-core";

// The customer's website, seen as a visitor sees it: a browser on the server
// opens the link and takes up to three pictures of the product — the top of
// the page, then the biggest product pictures further down — for the video's
// screen scenes. A page behind a login (a password box, a /login address, or
// next to no words) is not pictured: the video is made without it and the
// customer may upload pictures instead. Only public addresses are opened (no
// private or internal networks, every request checked).

const NAV_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 45_000;
const VIEW = { width: 1440, height: 900 };

const blocked = new BlockList();
for (const [net, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) blocked.addSubnet(net, prefix, "ipv6");
function publicIp(ip: string) {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  const family = isIP(ip);
  return family !== 0 && !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}
export async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return publicIp(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => publicIp(a.address));
  } catch {
    return false;
  }
}

// a link as typed ("acme.com", "https://acme.com/") made a full https address, or null
export function websiteUrlOf(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || t.length > 300) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export type Capture = { ok: true; shots: Buffer[]; title: string } | { ok: false; reason: "private" | "unreachable"; detail: string };

// the browser: on Vercel its own serverless Chromium, elsewhere the one installed
async function launch() {
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return playwright.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
  }
  return playwright.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
}

export async function captureWebsite(link: string): Promise<Capture> {
  const url = websiteUrlOf(link);
  if (!url || !(await isPublicHost(new URL(url).hostname))) return { ok: false, reason: "unreachable", detail: "not a public website address" };
  const browser = await launch();
  const kill = setTimeout(() => void browser.close().catch(() => {}), TOTAL_TIMEOUT_MS);
  try {
    const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" });
    // (every request to a public address only)
    const hosts = new Map<string, Promise<boolean>>();
    await page.route("**/*", async (route) => {
      const { protocol, hostname } = new URL(route.request().url());
      if (protocol === "data:" || protocol === "blob:") return route.continue();
      if (protocol !== "http:" && protocol !== "https:") return route.abort("blockedbyclient");
      if (!hosts.has(hostname)) hosts.set(hostname, isPublicHost(hostname));
      return (await hosts.get(hostname)) ? route.continue() : route.abort("blockedbyclient");
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch((e: Error) => e);
    if (response instanceof Error || !response) return { ok: false, reason: "unreachable", detail: response instanceof Error ? response.message.slice(0, 160) : "no answer" };
    if (response.status() === 401 || response.status() === 403) return { ok: false, reason: "private", detail: `the site answered ${response.status()}` };
    if (!response.ok()) return { ok: false, reason: "unreachable", detail: `the site answered ${response.status()}` };
    return await picturesOf(page);
  } finally {
    clearTimeout(kill);
    await browser.close().catch(() => {});
  }
}

// The pictures of an opened page (or why there are none)
export async function picturesOf(page: Page): Promise<Capture> {
  await page.waitForLoadState("load", { timeout: 6_000 }).catch(() => {});

  // a login wall: a password box, a sign-in address, or next to no words
  const wall = await page.evaluate(() => {
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const password = [...document.querySelectorAll("input[type=password]")].some(visible);
    const signIn = /\/(login|log-in|signin|sign-in|auth|sso)(\/|$|\?)/i.test(location.pathname);
    return { password, signIn, words: (document.body?.innerText ?? "").trim().split(/\s+/).length };
  });
  if (wall.password || wall.signIn || wall.words < 25) return { ok: false, reason: "private", detail: wall.password || wall.signIn ? "the page asks to sign in" : "the page shows almost nothing" };

  // a cookie banner accepted, anything left floating over the page hidden
  await page
    .getByRole("button", { name: /^(accept( all)?|allow all|agree|i agree|got it|ok(ay)?)$/i })
    .first()
    .click({ timeout: 1_500 })
    .catch(() => {});
  const unclutter = () =>
    page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const s = getComputedStyle(el);
        if (s.position !== "fixed" && s.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        // (a bar across the top stays — it is the site's own header; a box over the page goes)
        if (r.top <= 2 && r.height < 140) continue;
        if (r.width * r.height > 0.04 * innerWidth * innerHeight) el.style.setProperty("display", "none", "important");
      }
    });
  // (down the page once, so pictures that load late load; then back up)
  await page.evaluate(async () => {
    for (let y = 0; y < Math.min(document.body.scrollHeight, 9000); y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  await unclutter();
  const title = (await page.title()).slice(0, 120);
  const shots: Buffer[] = [await page.screenshot({ type: "jpeg", quality: 82 })];

  // the biggest pictures of the product below the top (images, videos, canvases — not drawn logos), up to two more
  const spots = await page.evaluate((view) => {
    const out: { y: number; area: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("img, video, canvas")) {
      const r = el.getBoundingClientRect();
      const y = r.top + scrollY;
      if (y < view.height * 0.8 || r.width < 480 || r.height < 260) continue;
      out.push({ y: y + r.height / 2, area: r.width * r.height });
    }
    return out.sort((a, b) => b.area - a.area);
  }, VIEW);
  const taken: number[] = [];
  for (const s of spots) {
    if (shots.length >= 3) break;
    if (taken.some((y) => Math.abs(y - s.y) < VIEW.height * 0.8)) continue;
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - innerHeight / 2)), s.y);
    await page.waitForTimeout(350);
    await unclutter();
    shots.push(await page.screenshot({ type: "jpeg", quality: 82 }));
    taken.push(s.y);
  }
  return { ok: true, shots, title };
}
