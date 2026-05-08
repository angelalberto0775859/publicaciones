import { BrandIntelligence, BrandKitInput, Mood } from "@/lib/types";
const moodPaletteHints: Record<Mood, string[]> = {
  minimalist: ["#F8FAFC", "#111827", "#94A3B8", "#E2E8F0", "#0F766E"],
  vibrant: ["#0F172A", "#06B6D4", "#F97316", "#F8FAFC", "#A3E635"],
  corporate: ["#0B1220", "#2563EB", "#38BDF8", "#E5E7EB", "#111827"],
  night: ["#050816", "#7C3AED", "#06B6D4", "#F8FAFC", "#111827"],
  editorial: ["#111111", "#E11D48", "#F8FAFC", "#F59E0B", "#334155"]
};

const spanishStopwords = new Set([
  "para",
  "con",
  "los",
  "las",
  "una",
  "uno",
  "por",
  "que",
  "del",
  "desde",
  "este",
  "esta",
  "como",
  "marca",
  "logo",
  "diseno",
  "diseño",
  "referencia"
]);

function inferMood(brandName: string): Mood {
  const lower = brandName.toLowerCase();
  if (lower.includes("studio") || lower.includes("fashion") || lower.includes("creative")) return "editorial";
  if (lower.includes("fin") || lower.includes("corp") || lower.includes("business")) return "corporate";
  if (lower.includes("night") || lower.includes("dark") || lower.includes("luxury")) return "night";
  if (lower.includes("minimal") || lower.includes("clean") || lower.includes("simple")) return "minimalist";
  return "vibrant";
}

function inferBrandPersonality(brandName: string, references: string[]): string[] {
  const lower = `${brandName} ${references.join(" ")}`.toLowerCase();
  const personality: string[] = [];

  // Análisis basado en el nombre
  if (lower.includes("premium") || lower.includes("luxury") || lower.includes("elite")) {
    personality.push("premium", "sophisticated", "exclusive");
  }
  if (lower.includes("fresh") || lower.includes("new") || lower.includes("modern")) {
    personality.push("innovative", "fresh", "contemporary");
  }
  if (lower.includes("eco") || lower.includes("green") || lower.includes("sustainable")) {
    personality.push("environmentally conscious", "responsible", "natural");
  }
  if (lower.includes("fun") || lower.includes("play") || lower.includes("joy")) {
    personality.push("playful", "energetic", "joyful");
  }
  if (lower.includes("restaurante") || lower.includes("food") || lower.includes("cafe") || lower.includes("coffee")) {
    personality.push("warm", "sensory", "welcoming");
  }
  if (lower.includes("salud") || lower.includes("wellness") || lower.includes("beauty") || lower.includes("belleza")) {
    personality.push("careful", "aspirational", "human");
  }

  // Análisis basado en referencias
  const refText = references.join(" ").toLowerCase();
  if (refText.includes("professional") || refText.includes("corporate")) {
    personality.push("professional", "trustworthy");
  }
  if (refText.includes("creative") || refText.includes("artistic")) {
    personality.push("creative", "artistic", "innovative");
  }
  if (refText.includes("bold") || refText.includes("daring")) {
    personality.push("bold", "confident");
  }

  // Fallback si no hay personalidad específica
  if (personality.length === 0) {
    personality.push("versatile", "adaptable", "authentic");
  }

  return [...new Set(personality)]; // Eliminar duplicados
}

function inferToneOfVoice(personality: string[]): string {
  if (personality.includes("premium") || personality.includes("sophisticated")) {
    return "elegante y refinado, con frases cortas que transmiten exclusividad sin sonar exageradas";
  }
  if (personality.includes("playful") || personality.includes("energetic")) {
    return "energico y cercano, con lenguaje vivo, directo y facil de compartir";
  }
  if (personality.includes("professional") || personality.includes("trustworthy")) {
    return "profesional y confiable, con beneficios claros y afirmaciones concretas";
  }
  if (personality.includes("creative") || personality.includes("artistic")) {
    return "creativo e inspirador, con imagenes verbales simples y memorables";
  }
  return "autentico y cercano, con copy natural en espanol y orientado a la accion";
}

function extractReferenceInsights(references: string[]): string[] {
  const insights: string[] = [];

  references.forEach(ref => {
    const lower = ref.toLowerCase();

    if (lower.startsWith("data:image") || lower.includes("imagen cargada")) {
      insights.push("Usar las referencias visuales cargadas como guia de composicion, contraste y energia de marca");
    }

    // Extraer insights de estilo visual
    if (lower.includes("color") || lower.includes("palette") || lower.includes("paleta")) {
      insights.push("Mantener armonia cromatica y contraste alto para lectura rapida en redes");
    }
    if (lower.includes("typography") || lower.includes("font")) {
      insights.push("Cuidar jerarquia tipografica y legibilidad del titular");
    }
    if (lower.includes("minimal") || lower.includes("clean")) {
      insights.push("Preferencia por composiciones limpias con espacio negativo");
    }

    // Extraer insights de tono y mensaje
    if (lower.includes("empowering") || lower.includes("confidence")) {
      insights.push("Enfatizar confianza y decision del usuario");
    }
    if (lower.includes("community") || lower.includes("together")) {
      insights.push("Reforzar comunidad y experiencias compartidas");
    }
    if (lower.includes("innovation") || lower.includes("future")) {
      insights.push("Mostrar una marca actual, con soluciones simples y modernas");
    }
  });

  // Fallback si no hay insights específicos
  if (insights.length === 0) {
    insights.push("Comunicar autenticidad, calidad y una promesa facil de entender");
  }

  return [...new Set(insights)]; // Eliminar duplicados
}

function keywordCandidates(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 3 && !spanishStopwords.has(word))
    .slice(0, 4);
}

function generateKeyMessaging(brandName: string, personality: string[], references: string[]): string[] {
  const messages: string[] = [];
  const brandTopic = keywordCandidates(`${brandName} ${references.join(" ")}`)[0];

  // Mensajes basados en personalidad
  if (personality.includes("premium")) {
    messages.push("Una experiencia premium, cuidada de principio a fin");
    messages.push("Calidad visible en cada detalle");
  }
  if (personality.includes("innovative")) {
    messages.push("Una forma mas simple de lograr mejores resultados");
    messages.push("Innovacion clara para decisiones reales");
  }
  if (personality.includes("creative")) {
    messages.push("Ideas que se sienten frescas y faciles de recordar");
    messages.push("Creatividad con una intencion clara");
  }
  if (personality.includes("professional")) {
    messages.push("Soluciones confiables para avanzar con seguridad");
    messages.push("Experiencia profesional, resultados claros");
  }
  if (personality.includes("warm") || personality.includes("human")) {
    messages.push("Una marca cercana que entiende lo que necesitas");
  }

  // Mensajes basados en el nombre de la marca
  const lower = brandName.toLowerCase();
  if (lower.includes("studio")) {
    messages.push("Historias visuales que conectan con la audiencia");
  }
  if (lower.includes("tech") || lower.includes("digital")) {
    messages.push("Tecnologia practica para crecer mejor");
  }
  if (brandTopic) {
    messages.push(`${brandName}: ${brandTopic} con identidad y proposito`);
  }

  // Fallback messages
  if (messages.length === 0) {
    messages.push(`${brandName} te ayuda a dar el siguiente paso`);
    messages.push("Una propuesta clara, memorable y facil de elegir");
    messages.push("Hazlo simple. Hazlo con identidad.");
  }

  return messages.slice(0, 3); // Limitar a 3 mensajes clave
}

function extractSvgColors(dataUrl?: string): string[] {
  if (!dataUrl?.startsWith("data:image/svg+xml")) return [];
  const [, payload = ""] = dataUrl.split(",");
  try {
    const svg = decodeURIComponent(payload);
    const colors = svg.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    return [...new Set(colors.map((color) => color.slice(0, 7).toUpperCase()))].slice(0, 5);
  } catch {
    return [];
  }
}

function deterministicPalette(seed: string, mood: Mood, logoDataUrl?: string): string[] {
  const logoColors = extractSvgColors(logoDataUrl);
  if (logoColors.length >= 3) {
    return [...logoColors, ...moodPaletteHints[mood]].slice(0, 5);
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  return moodPaletteHints[mood].map((color, index) => {
    const delta = ((hash + index * 67) % 35) - 17;
    const base = parseInt(color.slice(1), 16);
    const adjusted = Math.max(0, Math.min(0xffffff, base + delta * 0x050505));
    return `#${adjusted.toString(16).padStart(6, "0")}`;
  });
}

export function analyzeBrand(input: BrandKitInput): BrandIntelligence {
  const suggestedMood = inferMood(input.brandName);
  const palette = deterministicPalette(input.brandName, suggestedMood, input.logoDataUrl);
  const referenceBoost = Math.min(input.referenceDataUrls.length * 0.08, 0.24);

  // Procesar referencias como texto (simplificado - en producción usarías análisis de imágenes/texto real)
  const referenceTexts = input.referenceDataUrls.map((url, idx) =>
    url.startsWith("data:image")
      ? `Referencia visual ${idx + 1}: imagen cargada por el usuario`
      : `Referencia ${idx + 1}: ${url.split('/').pop() || 'referencia de diseno'}`
  );

  const brandPersonality = inferBrandPersonality(input.brandName, referenceTexts);
  const toneOfVoice = inferToneOfVoice(brandPersonality);
  const referenceInsights = extractReferenceInsights(referenceTexts);
  const keyMessaging = generateKeyMessaging(input.brandName, brandPersonality, referenceTexts);
  const hasLogo = Boolean(input.logoDataUrl);
  const visualStyleNotes = [
    hasLogo
      ? "Incluir el logo como firma visible; no ocultarlo ni usarlo solo como referencia interna"
      : "Reservar un area limpia para firma o nombre de marca",
    `Usar paleta principal: ${palette.join(", ")}`,
    "Crear fondos con formas, textura sutil o fotografia conceptual alineada a la marca; evitar fondos genericos"
  ];

  return {
    brandName: input.brandName,
    logoDataUrl: input.logoDataUrl,
    palette,
    suggestedMood,
    contrastScore: Number((0.72 + referenceBoost).toFixed(2)),
    logoLegibility: hasLogo ? "high" : "medium",
    brandPersonality,
    toneOfVoice,
    referenceInsights,
    keyMessaging,
    visualStyleNotes,
    backgroundDirection: `Fondo ${suggestedMood} construido desde la paleta de ${input.brandName}, con contraste suficiente para titular, subtitulo y CTA.`,
    copyGuidelines: [
      "Escribir en espanol natural.",
      "Usar la idea principal del brief como base del titular.",
      "Evitar frases genericas como 'Experience the difference' o 'Discover what sets us apart'."
    ],
    logoPlacementGuidelines: [
      hasLogo
        ? "Colocar el logo real como firma visible, preferentemente arriba o en una esquina protegida."
        : "Usar el nombre de marca como firma si no hay logo cargado.",
      "Si el fondo tiene mucho detalle, poner el logo dentro de una caja translucida.",
      "Si el fondo es limpio y oscuro, usar el logo con contraste directo; la marca de agua solo como apoyo secundario."
    ]
  };
}
