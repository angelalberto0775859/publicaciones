import { buildLayoutProposal } from "@/lib/layout-engine";
import { AspectRatio, GenerationRequest, Platform } from "@/lib/types";

const platformRatios: Record<Platform, AspectRatio[]> = {
  instagram: ["1:1", "9:16"],
  x: ["16:9", "1:1"],
  facebook: ["16:9", "1:1"]
};

const defaultRatios: AspectRatio[] = ["9:16", "1:1", "16:9"];
const creativeAngles = [
  {
    name: "Oferta directa",
    intent: "presentar el beneficio principal con claridad y CTA fuerte",
    headlinePattern: "beneficio inmediato"
  },
  {
    name: "Problema-solucion",
    intent: "nombrar una friccion del usuario y mostrar la marca como salida",
    headlinePattern: "dolor del usuario resuelto"
  },
  {
    name: "Educativo",
    intent: "ensenar algo util y ganar confianza antes de vender",
    headlinePattern: "aprendizaje accionable"
  },
  {
    name: "Aspiracional",
    intent: "mostrar el resultado deseado y elevar la percepcion de marca",
    headlinePattern: "futuro deseado"
  },
  {
    name: "Prueba social",
    intent: "transmitir confianza, experiencia y evidencia visual",
    headlinePattern: "confianza y respaldo"
  },
  {
    name: "Comunidad",
    intent: "hacer que la audiencia se sienta parte de una identidad compartida",
    headlinePattern: "pertenencia"
  }
];

export function creativeAngleForIndex(index: number): { name: string; intent: string; headlinePattern: string } {
  return creativeAngles[index % creativeAngles.length];
}

function ratiosForPlatforms(platforms: Platform[]): AspectRatio[] {
  const ratios = platforms.flatMap((platform) => platformRatios[platform] ?? []);
  const uniqueRatios = [...new Set(ratios)];
  return uniqueRatios.length ? uniqueRatios : defaultRatios;
}

function cleanSentence(text: string, fallback: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function trimWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}` : text;
}

function goalVerb(goal: GenerationRequest["brief"]["goal"]): string {
  if (goal === "education") return "Aprende";
  if (goal === "reach") return "Conoce";
  return "Elige";
}

export function buildCampaignCopy(
  brand: GenerationRequest["brand"],
  brief: GenerationRequest["brief"],
  variationIdx: number
): { headline: string; subtext: string; cta: string } {
  const keyMessages = brand.keyMessaging?.length ? brand.keyMessaging : [`${brand.brandName} te ayuda a avanzar con claridad`];
  const idea = cleanSentence(brief.idea, keyMessages[variationIdx % keyMessages.length] ?? brand.brandName);
  const audience = cleanSentence(brief.audience, "tu comunidad");
  const insights = brand.referenceInsights?.length ? brand.referenceInsights : ["Comunicar una promesa clara y facil de entender"];
  const keyMessage = cleanSentence(
    keyMessages[variationIdx % keyMessages.length] ?? "",
    `${brand.brandName} te ayuda a avanzar con claridad`
  );
  const angle = creativeAngleForIndex(variationIdx);

  const headlineTemplates = [
    `${goalVerb(brief.goal)} ${trimWords(idea, 6)}`,
    `Deja atras ${trimWords(audience, 4)}`,
    `${trimWords(idea, 5)} explicado simple`,
    `Haz que ${trimWords(idea, 5)} se note`,
    `Confianza para ${trimWords(audience, 4)}`,
    `Esto tambien es para ${trimWords(audience, 4)}`,
    `${brand.brandName} para ${trimWords(audience, 4)}`,
    `${trimWords(idea, 5)} con ${brand.brandName}`,
    keyMessage
  ];

  const headline = trimWords(headlineTemplates[variationIdx % headlineTemplates.length], 9);
  const subtext = trimWords(
    `${keyMessage}. Enfoque: ${angle.name.toLowerCase()} para ${audience}.`,
    18
  );

  return {
    headline,
    subtext,
    cta: cleanSentence(brief.cta, "Conoce mas")
  };
}

function ratioInstruction(ratio: AspectRatio): string {
  if (ratio === "9:16") return "vertical story/reel safe zones, logo visible in top area, CTA in lower third";
  if (ratio === "16:9") return "wide social banner, logo and brand name readable, no cropped text";
  if (ratio === "1:1") return "square feed post, centered balance, strong thumb-stopping headline";
  return "custom format with protected margins for all text and logo";
}

function logoInstruction(hasLogo: boolean): string {
  if (hasLogo) {
    return "Place the supplied logo/brandmark visibly on the artwork as a real design element; do not hide, distort, recolor illegibly, or replace it with invented marks.";
  }
  return "Use the brand name as a visible signature mark because no logo file is available.";
}

export function buildVisualPrompts(payload: GenerationRequest): string[] {
  const count = Math.max(1, Math.min(payload.variationCount, 6));
  const ratioSet = ratiosForPlatforms(payload.brief.platform);

  return Array.from({ length: count }).map((_, idx) => {
    const ratio = ratioSet[idx % ratioSet.length];
    const layout = buildLayoutProposal(payload.brief, payload.brand.suggestedMood, ratio);
    const visualStyleNotes = payload.brand.visualStyleNotes?.length
      ? payload.brand.visualStyleNotes
      : ["Mantener el logo o nombre de marca visible", `Usar paleta principal: ${payload.brand.palette.join(", ")}`];
    const backgroundDirection =
      payload.brand.backgroundDirection ??
      `Fondo ${payload.brand.suggestedMood} construido desde la paleta de ${payload.brand.brandName}.`;

    const copy = buildCampaignCopy(payload.brand, payload.brief, idx);
    const angle = creativeAngleForIndex(idx);

    return [
      `Crea una pieza publicitaria en espanol para ${payload.brand.brandName}.`,
      `Debe sentirse como la marca, no como una plantilla generica.`,
      `Propuesta creativa ${idx + 1}: ${angle.name}.`,
      `Intencion de esta propuesta: ${angle.intent}.`,
      `Patron de titular: ${angle.headlinePattern}.`,
      `Personalidad: ${payload.brand.brandPersonality.join(", ")}.`,
      `Tono de voz: ${payload.brand.toneOfVoice}.`,
      `Mensajes clave permitidos: ${payload.brand.keyMessaging.join(" | ")}.`,
      `Insights visuales: ${payload.brand.referenceInsights.join(" | ")}.`,
      `Notas de marca: ${visualStyleNotes.join(" | ")}.`,
      `Objetivo: ${payload.brief.goal}. Audiencia: ${payload.brief.audience}.`,
      `Idea central obligatoria: ${payload.brief.idea}.`,
      `Estilo visual: ${payload.styleInstruction || payload.brand.suggestedMood}.`,
      `Paleta exacta: ${payload.brand.palette.join(", ")}.`,
      `Fondo: ${backgroundDirection}`,
      logoInstruction(Boolean(payload.brand.logoDataUrl)),
      `Layout: ${layout.compositionHint}.`,
      `Formato: ${ratio}; ${ratioInstruction(ratio)}.`,
      `Typography: ${layout.textHierarchy.join(" > ")}.`,
      `Texto exacto del titular: "${copy.headline}"`,
      `Texto exacto del apoyo: "${copy.subtext}"`,
      `CTA exacto: "${copy.cta}".`,
      `No uses frases en ingles ni claims vacios. No inventes logos nuevos.`
    ].join(" ");
  });
}
