import { AspectRatio, BrandIntelligence, BrandKitInput, CampaignBrief, LayoutProposal, Mood } from "@/lib/types";

const OPENAI_API_URL = "https://api.openai.com/v1";
const DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";

interface AiBrandAnalysis {
  palette?: string[];
  suggestedMood?: Mood;
  contrastScore?: number;
  logoLegibility?: "high" | "medium" | "low";
  brandPersonality?: string[];
  toneOfVoice?: string;
  referenceInsights?: string[];
  keyMessaging?: string[];
  visualStyleNotes?: string[];
  backgroundDirection?: string;
  copyGuidelines?: string[];
  logoPlacementGuidelines?: string[];
}

export interface AiCreativeDirection {
  headline: string;
  subtext: string;
  cta: string;
  backgroundPrompt: string;
  logoTreatment: "clear-box" | "soft-box" | "watermark" | "corner-lockup";
  compositionHint: string;
}

function apiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim();
}

export function hasOpenAIKey(): boolean {
  return Boolean(apiKey());
}

function textModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

function isMood(value: unknown): value is Mood {
  return value === "minimalist" || value === "vibrant" || value === "corporate" || value === "night" || value === "editorial";
}

function asStringArray(value: unknown, fallback: string[], max = 6): string[] {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return parsed.length ? parsed.slice(0, max) : fallback;
}

function asPalette(value: unknown, fallback: string[]): string[] {
  const colors = asStringArray(value, fallback, 6).filter((color) => /^#[0-9a-f]{6}$/i.test(color));
  return colors.length >= 3 ? colors.slice(0, 5) : fallback;
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function outputText(response: unknown): string {
  const root = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: string }> }>;
  };
  if (typeof root.output_text === "string") return root.output_text;
  return (
    root.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => (typeof content.text === "string" ? content.text : ""))
      .join("\n") ?? ""
  );
}

function contentWithImages(prompt: string, images: string[]): Array<Record<string, string>> {
  return [
    { type: "input_text", text: prompt },
    ...images
      .filter((image) => image.startsWith("data:image"))
      .slice(0, 5)
      .map((image) => ({ type: "input_image", image_url: image }))
  ];
}

async function openaiResponsesJson(prompt: string, images: string[] = []): Promise<Record<string, unknown>> {
  const key = apiKey();
  if (!key) return {};

  const response = await fetch(`${OPENAI_API_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: textModel(),
      input: [
        {
          role: "user",
          content: contentWithImages(prompt, images)
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI Responses error ${response.status}: ${detail}`);
  }

  return parseJsonObject(outputText(await response.json()));
}

export async function analyzeBrandWithAI(input: BrandKitInput, fallback: BrandIntelligence): Promise<BrandIntelligence> {
  const images = [input.logoDataUrl, ...(input.referenceDataUrls ?? [])].filter((item): item is string => Boolean(item));
  const prompt = [
    "Analiza esta marca para generar publicaciones de redes sociales.",
    "Usa el logo y referencias visuales si vienen adjuntas. Devuelve SOLO JSON valido, sin markdown.",
    "El JSON debe tener: palette, suggestedMood, contrastScore, logoLegibility, brandPersonality, toneOfVoice, referenceInsights, keyMessaging, visualStyleNotes, backgroundDirection, copyGuidelines, logoPlacementGuidelines.",
    "Reglas: escribir todo en espanol natural; detectar como debe verse el logo; explicar si conviene logo con opacidad, caja translucida, marca de agua o lockup claro; no inventar claims genericos.",
    `Marca: ${input.brandName}`,
    `Fallback inicial: ${JSON.stringify(fallback)}`
  ].join("\n");

  const parsed = (await openaiResponsesJson(prompt, images)) as AiBrandAnalysis;

  return {
    ...fallback,
    aiEnhanced: true,
    palette: asPalette(parsed.palette, fallback.palette),
    suggestedMood: isMood(parsed.suggestedMood) ? parsed.suggestedMood : fallback.suggestedMood,
    contrastScore: typeof parsed.contrastScore === "number" ? parsed.contrastScore : fallback.contrastScore,
    logoLegibility:
      parsed.logoLegibility === "high" || parsed.logoLegibility === "medium" || parsed.logoLegibility === "low"
        ? parsed.logoLegibility
        : fallback.logoLegibility,
    brandPersonality: asStringArray(parsed.brandPersonality, fallback.brandPersonality),
    toneOfVoice: typeof parsed.toneOfVoice === "string" ? parsed.toneOfVoice : fallback.toneOfVoice,
    referenceInsights: asStringArray(parsed.referenceInsights, fallback.referenceInsights),
    keyMessaging: asStringArray(parsed.keyMessaging, fallback.keyMessaging),
    visualStyleNotes: asStringArray(parsed.visualStyleNotes, fallback.visualStyleNotes),
    backgroundDirection:
      typeof parsed.backgroundDirection === "string" ? parsed.backgroundDirection : fallback.backgroundDirection,
    copyGuidelines: asStringArray(parsed.copyGuidelines, fallback.copyGuidelines),
    logoPlacementGuidelines: asStringArray(parsed.logoPlacementGuidelines, [
      "Colocar el logo visible con contraste alto.",
      "Usar caja translucida si el fondo compite con el logo.",
      "Usar marca de agua solo como elemento secundario."
    ])
  };
}

export async function generateCreativeDirectionWithAI(
  brand: BrandIntelligence,
  brief: CampaignBrief,
  layout: LayoutProposal,
  ratio: AspectRatio,
  variationIdx: number,
  styleInstruction: string,
  creativeAngle?: { name: string; intent: string; headlinePattern: string }
): Promise<AiCreativeDirection | null> {
  if (!hasOpenAIKey()) return null;

  const prompt = [
    "Eres director creativo senior para social media. Devuelve SOLO JSON valido.",
    "Crea copy y direccion visual para una publicacion. El fondo NO debe tener texto ni logo; la app los colocara encima con exactitud.",
    "JSON requerido: headline, subtext, cta, backgroundPrompt, logoTreatment, compositionHint.",
    "headline: espanol natural, maximo 9 palabras, basado en la idea.",
    "subtext: maximo 18 palabras, especifico para la audiencia.",
    "backgroundPrompt: prompt visual para generar solo fondo, sin texto, sin letras, sin logos, sin mockups, respetando paleta y marca.",
    "logoTreatment debe ser uno de: clear-box, soft-box, watermark, corner-lockup.",
    `Marca: ${brand.brandName}`,
    `Analisis de marca: ${JSON.stringify(brand)}`,
    `Brief: ${JSON.stringify(brief)}`,
    `Layout base: ${JSON.stringify(layout)}`,
    `Formato: ${ratio}`,
    `Variacion: ${variationIdx + 1}`,
    `Angulo creativo obligatorio: ${creativeAngle ? JSON.stringify(creativeAngle) : "libre, pero distinto a las demas variaciones"}`,
    `Instruccion de estilo del usuario: ${styleInstruction}`
  ].join("\n");

  const parsed = await openaiResponsesJson(prompt, brand.logoDataUrl ? [brand.logoDataUrl] : []);
  const treatment = parsed.logoTreatment;

  return {
    headline: typeof parsed.headline === "string" ? parsed.headline : "",
    subtext: typeof parsed.subtext === "string" ? parsed.subtext : "",
    cta: typeof parsed.cta === "string" ? parsed.cta : brief.cta,
    backgroundPrompt: typeof parsed.backgroundPrompt === "string" ? parsed.backgroundPrompt : "",
    logoTreatment:
      treatment === "clear-box" || treatment === "soft-box" || treatment === "watermark" || treatment === "corner-lockup"
        ? treatment
        : "soft-box",
    compositionHint: typeof parsed.compositionHint === "string" ? parsed.compositionHint : layout.compositionHint
  };
}

function imageSizeForRatio(ratio: AspectRatio): string {
  if (ratio === "9:16") return "1024x1536";
  if (ratio === "16:9") return "1536x1024";
  return "1024x1024";
}

export async function generateBackgroundWithAI(prompt: string, ratio: AspectRatio): Promise<string | undefined> {
  const key = apiKey();
  if (!key || !prompt.trim()) return undefined;

  const response = await fetch(`${OPENAI_API_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: imageModel(),
      prompt,
      size: imageSizeForRatio(ratio),
      quality: process.env.OPENAI_IMAGE_QUALITY?.trim() || "high",
      n: 1
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI Images error ${response.status}: ${detail}`);
  }

  const json = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = json.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  return first?.url;
}
