import { LayoutProposal } from "@/lib/types";

function esc(text: string): string {
  return text.replace(/[<>&"]/g, (char) => {
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "&") return "&amp;";
    return "&quot;";
  });
}

function wrapWords(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function textLines(lines: string[], x: number, y: number, fontSize: number, lineHeight: number, weight: number): string {
  return lines
    .map(
      (line, idx) =>
        `<text x="${x}" y="${y + idx * lineHeight}" font-size="${fontSize}" font-weight="${weight}" font-family="Inter, Arial, sans-serif">${esc(line)}</text>`
    )
    .join("");
}

export function renderPreviewDataUrl(
  palette: string[],
  headline: string,
  subline: string,
  layout: LayoutProposal,
  width = 1080,
  height = 1080,
  options: {
    brandName?: string;
    logoDataUrl?: string;
    cta?: string;
    mood?: string;
    backgroundUrl?: string;
    logoTreatment?: "clear-box" | "soft-box" | "watermark" | "corner-lockup";
  } = {}
): string {
  const [a = "#0F172A", b = "#06B6D4", c = "#F97316", d = "#F8FAFC"] = palette;
  const margin = Math.round(width * 0.08);
  const titleSize = Math.round(Math.min(width, height) * (layout.ratio === "16:9" ? 0.052 : 0.074));
  const bodySize = Math.round(Math.min(width, height) * (layout.ratio === "16:9" ? 0.024 : 0.034));
  const ctaSize = Math.round(Math.min(width, height) * 0.022);
  const titleLines = wrapWords(headline, layout.ratio === "16:9" ? 20 : 14, 3);
  const subLines = wrapWords(subline, layout.ratio === "16:9" ? 44 : 30, 2);
  const textY = Math.round(height * (layout.ratio === "9:16" ? 0.52 : 0.54));
  const logoSize = Math.round(Math.min(width, height) * 0.13);
  const brandName = esc(options.brandName ?? "");
  const safeLogo = options.logoDataUrl?.startsWith("data:image") ? esc(options.logoDataUrl) : "";
  const safeBackground = options.backgroundUrl?.startsWith("data:image") || options.backgroundUrl?.startsWith("https://")
    ? esc(options.backgroundUrl)
    : "";
  const cta = esc(options.cta ?? "");
  const moodLabel = esc(options.mood ?? "brand");
  const logoTreatment = options.logoTreatment ?? "soft-box";
  const logoFill = logoTreatment === "clear-box" ? "#ffffffee" : "#0000002d";
  const logoOpacity = logoTreatment === "watermark" ? "0.28" : "1";
  const logoX = logoTreatment === "corner-lockup" ? Math.round(width - margin - logoSize) : margin;
  const logoBlock = safeLogo
    ? `<rect x="${logoX - 12}" y="${margin - 12}" width="${logoSize + 24}" height="${logoSize + 24}" rx="18" fill="${logoFill}"/>
       <image href="${safeLogo}" x="${logoX}" y="${margin}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" opacity="${logoOpacity}"/>`
    : `<text x="${margin}" y="${margin + Math.round(logoSize * 0.62)}" font-size="${Math.round(logoSize * 0.34)}" font-weight="800" font-family="Inter, Arial, sans-serif">${brandName}</text>`;
  const backgroundBlock = safeBackground
    ? `<image href="${safeBackground}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
       <rect width="${width}" height="${height}" fill="#0000004f" />`
    : `<rect width="${width}" height="${height}" fill="url(#g1)" />
       <path d="M ${Math.round(width * 0.02)} ${Math.round(height * 0.72)} C ${Math.round(width * 0.28)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.58)} ${Math.round(height * 0.96)}, ${Math.round(width * 0.98)} ${Math.round(height * 0.58)}" fill="none" stroke="${d}" stroke-opacity="0.28" stroke-width="${Math.round(Math.min(width, height) * 0.035)}"/>
       <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.2)}" r="${Math.round(Math.min(width, height) * 0.24)}" fill="url(#spot)" filter="url(#soft)" />`;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${a}" />
        <stop offset="52%" stop-color="${b}" />
        <stop offset="100%" stop-color="${c}" />
      </linearGradient>
      <radialGradient id="spot" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="${d}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="${d}" stop-opacity="0" />
      </radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="42"/></filter>
    </defs>
    ${backgroundBlock}
    <rect x="${margin}" y="${Math.round(height * 0.36)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.52)}" rx="${Math.round(Math.min(width, height) * 0.025)}" fill="#00000024" />
    <g fill="#fff">
      ${logoBlock}
      <text x="${margin}" y="${Math.round(height * 0.27)}" font-size="${Math.round(Math.min(width, height) * 0.022)}" font-weight="700" font-family="Inter, Arial, sans-serif" opacity="0.82">${brandName} · ${moodLabel}</text>
      ${textLines(titleLines, margin, textY, titleSize, Math.round(titleSize * 1.12), 820)}
      ${textLines(subLines, margin, textY + Math.round(titleSize * 1.12 * titleLines.length) + Math.round(bodySize * 0.9), bodySize, Math.round(bodySize * 1.32), 520)}
      <rect x="${margin}" y="${Math.round(height * 0.79)}" width="${Math.max(Math.round(width * 0.24), cta.length * Math.round(ctaSize * 0.64) + 48)}" height="${Math.round(ctaSize * 2.25)}" rx="${Math.round(ctaSize * 1.12)}" fill="#ffffff" />
      <text x="${margin + 24}" y="${Math.round(height * 0.79) + Math.round(ctaSize * 1.45)}" font-size="${ctaSize}" font-weight="800" font-family="Inter, Arial, sans-serif" fill="${a}">${cta}</text>
      <text x="${margin}" y="${Math.round(height * 0.92)}" font-size="${Math.round(Math.min(width, height) * 0.017)}" font-weight="500" font-family="Inter, Arial, sans-serif" opacity="0.62">${esc(layout.compositionHint)}</text>
    </g>
  </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
