import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import type { GammaEvent } from "~/types/gamma";
import { buildEventOddsLines, buildEventTags, isEventResolved, truncateLabel, wrapOgTitle } from "~/utils/eventSeo";
import { fmtn } from "~/utils/prices";

const WIDTH = 1200;
const HEIGHT = 630;
const ICON_SIZE = 96;
const HEADER_X = 96;
const HEADER_TOP = 156;
const HERE = dirname(fileURLToPath(import.meta.url));

const FONT_SPECS = [
  { file: "OpenSauceOne-Bold.ttf", weight: 700 },
  { file: "OpenSauceOne-SemiBold.ttf", weight: 600 },
  { file: "OpenSauceOne-Medium.ttf", weight: 500 },
] as const;

const GRADIENT_ACCENTS = ["#26a69a", "#ef5350", "#c9a227", "#5b7c99", "#8b6f5e", "#4a7c59", "#7c5c8a", "#3d6b6b", "#9a4a4a"];

interface GradientTheme {
  linear: { x1: number; y1: number; x2: number; y2: number; tint: string };
  glowA: { cx: number; cy: number; r: number; color: string; opacity: number };
  glowB: { cx: number; cy: number; r: number; color: string; opacity: number };
}

const fontDirs = () => {
  const cwd = process.cwd();
  const root = join(HERE, "../../..");
  return [join(HERE, "../assets/fonts"), join(root, "server/assets/fonts"), join(root, "public/_nuxt"), join(cwd, "server/assets/fonts"), join(cwd, "app/assets/fonts"), join(cwd, ".output/public/_nuxt"), join(cwd, "public/_nuxt")];
};

function resolveFontPath(filename: string): string | null {
  const prefix = filename.replace(/\.ttf$/i, "");
  for (const dir of fontDirs()) {
    if (!existsSync(dir)) continue;
    const exact = join(dir, filename);
    if (existsSync(exact)) return exact;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(prefix) && entry.endsWith(".ttf")) return join(dir, entry);
    }
  }
  return null;
}

async function readFontBytes(filename: string): Promise<Uint8Array | null> {
  const path = resolveFontPath(filename);
  if (path) return readFileSync(path);
  try {
    const raw = await useStorage("assets:server").getItemRaw(`fonts/${filename}`);
    if (raw instanceof Uint8Array) return raw;
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    if (typeof raw === "string") return Uint8Array.from(Buffer.from(raw, "base64"));
  } catch {}
  return null;
}

let loadedFonts: { paths: string[] } | null = null;
let loadFontsPromise: Promise<{ paths: string[] }> | null = null;

async function loadFonts(): Promise<{ paths: string[] }> {
  if (loadedFonts) return loadedFonts;
  loadFontsPromise ??= (async () => {
    const paths: string[] = [];
    let tempDir: string | null = null;
    for (const { file } of FONT_SPECS) {
      const existing = resolveFontPath(file);
      if (existing) {
        paths.push(existing);
        continue;
      }
      const bytes = await readFontBytes(file);
      if (!bytes?.length) {
        console.warn(`[og-image] Missing font file: ${file}`);
        continue;
      }
      tempDir ??= mkdtempSync(join(tmpdir(), "stance-og-fonts-"));
      const tempPath = join(tempDir, file);
      writeFileSync(tempPath, bytes);
      paths.push(tempPath);
    }
    if (!paths.length) throw new Error("[og-image] No fonts available for OG image rendering");
    return { paths };
  })();
  loadedFonts = await loadFontsPromise;
  return loadedFonts;
}

const isAllowedIconHost = (hostname: string, protocol: string) => protocol === "https:" && (/(^|\.)polymarket[\w-]*\.(com|s3[\w.-]*\.amazonaws\.com)$/.test(hostname) || /polymarket-upload\.s3[\w.-]*\.amazonaws\.com$/.test(hostname));

async function fetchEventIconDataUri(event: GammaEvent): Promise<string | null> {
  const iconUrl = event.icon || event.image;
  if (!iconUrl) return null;
  try {
    const parsed = new URL(iconUrl);
    if (!isAllowedIconHost(parsed.hostname, parsed.protocol)) return null;
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await upstream.arrayBuffer());
    return bytes.length ? `data:${contentType};base64,${bytes.toString("base64")}` : null;
  } catch {
    return null;
  }
}

const pickAccent = () => GRADIENT_ACCENTS[Math.floor(Math.random() * GRADIENT_ACCENTS.length)]!;

function tintHex(hex: string, strength: number): string {
  const mix = (i: number) =>
    Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * strength)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

function randomGradientTheme(): GradientTheme {
  const angle = Math.random() * Math.PI * 2;
  const accent = pickAccent();
  return {
    linear: {
      x1: (0.5 - Math.cos(angle) * 0.5) * WIDTH,
      y1: (0.5 - Math.sin(angle) * 0.5) * HEIGHT,
      x2: (0.5 + Math.cos(angle) * 0.5) * WIDTH,
      y2: (0.5 + Math.sin(angle) * 0.5) * HEIGHT,
      tint: tintHex(accent, 0.03 + Math.random() * 0.05),
    },
    glowA: { cx: 0.05 + Math.random() * 0.9, cy: 0.05 + Math.random() * 0.9, r: 0.4 + Math.random() * 0.35, color: pickAccent(), opacity: 0.07 + Math.random() * 0.09 },
    glowB: { cx: 0.05 + Math.random() * 0.9, cy: 0.05 + Math.random() * 0.9, r: 0.3 + Math.random() * 0.3, color: pickAccent(), opacity: 0.05 + Math.random() * 0.07 },
  };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const chanceColor = (pct: number) => (pct >= 55 ? "#26a69a" : pct <= 45 ? "#ef5350" : "#e0e0e0");

function stanceLogo(x: number, y: number, size: number): string {
  const s = size / 24;
  return `<g transform="translate(${x}, ${y}) scale(${s})"><rect x="1" y="1" width="22" height="22" rx="6" fill="#0c0c0c" stroke="#1c1c1c" stroke-width="1" /><line x1="5.5" y1="15.5" x2="18.5" y2="15.5" stroke="#252525" stroke-width="2.5" stroke-linecap="round" /><line x1="13.5" y1="15.5" x2="18.5" y2="15.5" stroke="#26a69a" stroke-width="2.5" stroke-linecap="round" opacity="0.4" /><path d="M14.25 10.75 L17.25 15.5 L14.25 20.25 L11.25 15.5 Z" fill="#f0f0f0" /></g>`;
}

function eventIconMarkup(dataUri: string, x: number, y: number): string {
  const r = 16;
  return `<defs><clipPath id="event-icon-clip"><rect x="${x}" y="${y}" width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${r}" /></clipPath></defs><rect x="${x - 1}" y="${y - 1}" width="${ICON_SIZE + 2}" height="${ICON_SIZE + 2}" rx="${r + 1}" fill="#0c0c0c" stroke="#1c1c1c" stroke-width="1" /><image href="${dataUri}" x="${x}" y="${y}" width="${ICON_SIZE}" height="${ICON_SIZE}" clip-path="url(#event-icon-clip)" preserveAspectRatio="xMidYMid slice" />`;
}

function eventHeaderBlock(iconDataUri: string | null, tagLine: string, titleLines: string[]): string {
  const textX = iconDataUri ? HEADER_X + ICON_SIZE + 24 : HEADER_X;
  const multi = titleLines.length > 1;
  const titleSize = multi ? 34 : 38;
  const titleLineHeight = multi ? 40 : 0;
  const textHeight = 16 + 14 + titleSize * 0.82 + Math.max(0, titleLines.length - 1) * titleLineHeight;
  const anchorTop = iconDataUri ? HEADER_TOP + Math.max(0, (ICON_SIZE - textHeight) / 2) : HEADER_TOP;
  const tagY = anchorTop + 11;
  const titleY = anchorTop + 16 + 14 + titleSize * 0.82;
  const titleSvg = titleLines.map((line, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : titleLineHeight}">${esc(line)}</tspan>`).join("");
  return `${iconDataUri ? eventIconMarkup(iconDataUri, HEADER_X, HEADER_TOP) : ""}<text x="${textX}" y="${tagY}" font-family="Open Sauce One" font-size="11" font-weight="700" fill="#4a4a4a" letter-spacing="3">${esc(tagLine)}</text><text x="${textX}" y="${titleY}" font-family="Open Sauce One" font-size="${titleSize}" font-weight="700" fill="#f0f0f0">${titleSvg}</text>`;
}

function probabilityBar(x: number, y: number, width: number, pct: number): string {
  const filled = (width * Math.max(0, Math.min(100, pct))) / 100;
  return `<rect x="${x}" y="${y}" width="${width}" height="6" rx="3" fill="#141414" /><rect x="${x}" y="${y}" width="${filled}" height="6" rx="3" fill="${chanceColor(pct)}" opacity="0.85" />`;
}

function singleMarketOdds(line: NonNullable<ReturnType<typeof buildEventOddsLines>[number]>): string {
  return `<text x="600" y="430" text-anchor="middle" font-family="Open Sauce One" font-size="96" font-weight="600" fill="${chanceColor(line.yesPct)}">${line.yesPct}%</text><text x="600" y="468" text-anchor="middle" font-family="Open Sauce One" font-size="18" font-weight="500" fill="#888888">chance</text>`;
}

function multiMarketOdds(lines: ReturnType<typeof buildEventOddsLines>): string {
  return lines
    .map((line, i) => {
      const y = 352 + i * 56;
      return `<text x="96" y="${y}" font-family="Open Sauce One" font-size="20" font-weight="600" fill="#f0f0f0">${esc(truncateLabel(line.label, 44))}</text><text x="1104" y="${y}" text-anchor="end" font-family="Open Sauce One" font-size="24" font-weight="600" fill="${chanceColor(line.yesPct)}">${line.yesPct}%</text>${probabilityBar(96, y + 14, 1008, line.yesPct)}`;
    })
    .join("");
}

async function buildEventOgSvg(event: GammaEvent): Promise<string> {
  const tags = buildEventTags(event);
  const resolved = isEventResolved(event);
  const oddsLines = buildEventOddsLines(event, 3);
  const single = oddsLines.length === 1 ? oddsLines[0] : null;
  const titleLines = wrapOgTitle(event.title, 52, 2);
  const tagLine = tags.length ? tags.join(" · ").toUpperCase() : "PREDICTION MARKET";
  const volume = fmtn(event.volume);
  const g = randomGradientTheme();
  const iconDataUri = await fetchEventIconDataUri(event);
  const oddsBlock = resolved ? `<text x="600" y="430" text-anchor="middle" font-family="Open Sauce One" font-size="28" font-weight="700" fill="#888888">Resolved</text>` : single ? singleMarketOdds(single) : multiMarketOdds(oddsLines);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="base" x1="${g.linear.x1}" y1="${g.linear.y1}" x2="${g.linear.x2}" y2="${g.linear.y2}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000000" />
      <stop offset="50%" stop-color="${g.linear.tint}" />
      <stop offset="100%" stop-color="#000000" />
    </linearGradient>
    <radialGradient id="glow-a" cx="${g.glowA.cx}" cy="${g.glowA.cy}" r="${g.glowA.r}">
      <stop offset="0%" stop-color="${g.glowA.color}" stop-opacity="${g.glowA.opacity}" />
      <stop offset="100%" stop-color="${g.glowA.color}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow-b" cx="${g.glowB.cx}" cy="${g.glowB.cy}" r="${g.glowB.r}">
      <stop offset="0%" stop-color="${g.glowB.color}" stop-opacity="${g.glowB.opacity}" />
      <stop offset="100%" stop-color="${g.glowB.color}" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.018" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#base)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow-a)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow-b)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" />
  <rect x="0" y="0" width="${WIDTH}" height="1" fill="#1c1c1c" />
  <rect x="0" y="${HEIGHT - 1}" width="${WIDTH}" height="1" fill="#1c1c1c" />
  ${stanceLogo(56, 52, 36)}
  <text x="104" y="78" font-family="Open Sauce One" font-size="22" font-weight="700" fill="#f0f0f0">Stance</text>
  <text x="104" y="102" font-family="Open Sauce One" font-size="12" font-weight="600" fill="#4a4a4a" letter-spacing="2">ELEGANT POLYMARKET TERMINAL</text>
  ${eventHeaderBlock(iconDataUri, tagLine, titleLines)}
  ${oddsBlock}
  <text x="96" y="582" font-family="Open Sauce One" font-size="13" font-weight="600" fill="#4a4a4a">VOL $${volume}</text>
  <text x="1104" y="582" text-anchor="end" font-family="Open Sauce One" font-size="13" font-weight="600" fill="#4a4a4a">stance.lol</text>
</svg>`;
}

export async function renderEventOgPng(event: GammaEvent): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await buildEventOgSvg(event);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { fontFiles: fonts.paths, loadSystemFonts: false, defaultFontFamily: "Open Sauce One" },
  });
  return Buffer.from(resvg.render().asPng());
}
