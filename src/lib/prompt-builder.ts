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
const postStructures = [
  {
    name: "Hero benefit",
    description: "titular grande, beneficio directo, apoyo breve y firma visual de marca"
  },
  {
    name: "Problema -> solucion",
    description: "abrir con una friccion real, resolver con una promesa concreta y cerrar con accion"
  },
  {
    name: "Mini guia",
    description: "formato educativo con 2-3 ideas visuales claras y copy guardable"
  },
  {
    name: "Antes / despues",
    description: "contraste visual entre estado actual y resultado deseado"
  },
  {
    name: "Prueba / confianza",
    description: "enfatizar respaldo, criterio experto, calidad o consistencia"
  },
  {
    name: "Manifiesto corto",
    description: "frase emocional de pertenencia, identidad o aspiracion de la audiencia"
  }
];

export function creativeAngleForIndex(index: number): { name: string; intent: string; headlinePattern: string } {
  return creativeAngles[index % creativeAngles.length];
}

export function postStructureForIndex(index: number): { name: string; description: string } {
  return postStructures[index % postStructures.length];
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBrandName(text: string, brandName: string): string {
  const trimmedBrand = brandName.trim();
  if (!trimmedBrand) return text;
  return text
    .replace(new RegExp(`\\b${escapeRegExp(trimmedBrand)}\\b`, "gi"), "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/^[:\s-]+|[:\s-]+$/g, "")
    .trim();
}

function withoutBrandOrFallback(text: string, brandName: string, fallback: string): string {
  return stripBrandName(text, brandName) || fallback;
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
  const keyMessages = brand.keyMessaging?.length ? brand.keyMessaging : ["Da el siguiente paso con claridad"];
  const idea = withoutBrandOrFallback(
    cleanSentence(brief.idea, keyMessages[variationIdx % keyMessages.length] ?? "Una propuesta clara"),
    brand.brandName,
    "Una propuesta clara"
  );
  const audience = cleanSentence(brief.audience, "tu comunidad");
  const keyMessage = cleanSentence(
    stripBrandName(keyMessages[variationIdx % keyMessages.length] ?? "", brand.brandName),
    "Una propuesta clara para avanzar mejor"
  );

  const headlineTemplates = [
    `${goalVerb(brief.goal)} ${trimWords(idea, 6)}`,
    `Deja atras lo que te frena`,
    `${trimWords(idea, 5)} explicado simple`,
    `Haz que ${trimWords(idea, 5)} se note`,
    `Confianza para ${trimWords(audience, 4)}`,
    `Esto tambien es para ${trimWords(audience, 4)}`,
    keyMessage
  ];

  const headline = trimWords(
    withoutBrandOrFallback(headlineTemplates[variationIdx % headlineTemplates.length], brand.brandName, keyMessage),
    9
  );
  const subtextTemplates = [
    `${keyMessage}. Pensado para ${audience}.`,
    `Una forma mas clara de resolverlo sin complicarte.`,
    `Guarda esta idea y aplicala cuando necesites comunicar mejor.`,
    `Muestra el cambio: de duda a decision con una propuesta mas clara.`,
    `Criterio, consistencia y una presentacion que genera confianza.`,
    `Para quienes quieren sentirse identificados desde el primer vistazo.`
  ];
  const subtext = trimWords(
    withoutBrandOrFallback(
      subtextTemplates[variationIdx % subtextTemplates.length],
      brand.brandName,
      "Una idea clara, util y lista para compartir."
    ),
    18
  );

  return {
    headline,
    subtext,
    cta: stripBrandName(brief.cta?.trim() ?? "", brand.brandName)
  };
}

function ratioInstruction(ratio: AspectRatio, hasCta: boolean): string {
  if (ratio === "9:16") {
    return hasCta
      ? "vertical story/reel safe zones, logo visible in top area, CTA in lower third"
      : "vertical story/reel safe zones, logo visible in top area, quiet closing area in lower third";
  }
  if (ratio === "16:9") return "wide social banner, logo readable, no cropped text";
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
    const structure = postStructureForIndex(idx);
    const ctaInstruction = copy.cta
      ? `CTA exacto: "${copy.cta}".`
      : "No hay CTA obligatorio; no fuerces boton ni frase de venta. Cierra con una invitacion implicita o deja la pieza como contenido guardable.";

    return [
      `Crea una pieza publicitaria en espanol para ${payload.brand.brandName}.`,
      `Debe sentirse como la marca, no como una plantilla generica.`,
      `Propuesta creativa ${idx + 1}: ${angle.name}.`,
      `Intencion de esta propuesta: ${angle.intent}.`,
      `Patron de titular: ${angle.headlinePattern}.`,
      `Estructura de post obligatoria: ${structure.name}.`,
      `Como debe organizarse: ${structure.description}.`,
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
      `Formato: ${ratio}; ${ratioInstruction(ratio, Boolean(copy.cta))}.`,
      `Typography: ${layout.textHierarchy.join(" > ")}.`,
      `Texto exacto del titular: "${copy.headline}"`,
      `Texto exacto del apoyo: "${copy.subtext}"`,
      ctaInstruction,
      `No repitas el nombre "${payload.brand.brandName}" dentro del titular o apoyo; la marca ya aparece como logo/firma.`,
      `No uses frases en ingles ni claims vacios. No inventes logos nuevos.`
    ].join(" ");
  });
}
