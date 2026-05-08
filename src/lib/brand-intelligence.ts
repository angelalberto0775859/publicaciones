import { BrandIntelligence, BrandKitInput, Mood } from "@/lib/types";
const moodPaletteHints: Record<Mood, string[]> = {
  minimalist: ["#F7F3EA", "#1C1F1E", "#70877F", "#D7C6A3", "#376E64"],
  vibrant: ["#101828", "#00A7B5", "#FF6B35", "#F7F3EA", "#B6E880"],
  corporate: ["#09111F", "#1F6FEB", "#36C5F0", "#F2F5F7", "#172554"],
  night: ["#060713", "#7C3AED", "#00D1C1", "#F8FAFC", "#EF476F"],
  editorial: ["#15110F", "#C1121F", "#F8F1E7", "#D99B42", "#31572C"]
};

const industryPaletteHints: Record<string, string[]> = {
  food: ["#2D1B12", "#D45D2E", "#F2B705", "#FFF4E0", "#3A6B35"],
  coffee: ["#24160F", "#8B5E34", "#D6A756", "#F4E8D0", "#2F3E2F"],
  beauty: ["#2A1E2F", "#C06C84", "#F7D6D0", "#F8F1E7", "#6D597A"],
  health: ["#0B3D3A", "#2CB67D", "#BFE8D8", "#F5F7F2", "#26547C"],
  tech: ["#08111F", "#2563EB", "#00D1FF", "#E8F1FF", "#7C3AED"],
  fashion: ["#111111", "#B08968", "#F5ECE1", "#8A1538", "#2E4057"],
  finance: ["#071A2C", "#1E6F5C", "#D4AF37", "#F4F7F5", "#0B1320"],
  creative: ["#1B1B1F", "#E63946", "#FFB703", "#A8DADC", "#F1FAEE"]
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

function inferIndustry(text: string): keyof typeof industryPaletteHints | "general" {
  const lower = text.toLowerCase();
  if (lower.includes("cafe") || lower.includes("coffee") || lower.includes("espresso")) return "coffee";
  if (lower.includes("restaurante") || lower.includes("food") || lower.includes("comida") || lower.includes("taco") || lower.includes("pizza")) return "food";
  if (lower.includes("beauty") || lower.includes("belleza") || lower.includes("salon") || lower.includes("spa")) return "beauty";
  if (lower.includes("salud") || lower.includes("wellness") || lower.includes("fitness") || lower.includes("clinic")) return "health";
  if (lower.includes("tech") || lower.includes("digital") || lower.includes("software") || lower.includes("app")) return "tech";
  if (lower.includes("fashion") || lower.includes("moda") || lower.includes("boutique")) return "fashion";
  if (lower.includes("fin") || lower.includes("banco") || lower.includes("inversion")) return "finance";
  if (lower.includes("studio") || lower.includes("creative") || lower.includes("diseno") || lower.includes("diseño")) return "creative";
  return "general";
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

function referenceSummary(references: string[]): string {
  return references.join(" ").replace(/^data:image\/[^;]+;base64,.+/g, "imagen cargada");
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
    messages.push(`${brandTopic} con identidad y proposito`);
  }

  // Fallback messages
  if (messages.length === 0) {
    messages.push("Da el siguiente paso con una propuesta clara");
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

function normalizePalette(colors: string[], fallback: string[]): string[] {
  const unique = [...new Set(colors.map((color) => color.toUpperCase()).filter((color) => /^#[0-9A-F]{6}$/.test(color)))];
  return [...unique, ...fallback].filter((color, index, list) => list.indexOf(color) === index).slice(0, 5);
}

function shiftHex(color: string, amount: number): string {
  const value = parseInt(color.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `#${((r << 16) + (g << 8) + b).toString(16).padStart(6, "0").toUpperCase()}`;
}

function deterministicPalette(seed: string, mood: Mood, logoDataUrl?: string, references: string[] = []): string[] {
  const industry = inferIndustry(`${seed} ${referenceSummary(references)}`);
  const basePalette = industry === "general" ? moodPaletteHints[mood] : industryPaletteHints[industry];
  const logoColors = extractSvgColors(logoDataUrl);
  if (logoColors.length >= 2) {
    return normalizePalette([...logoColors, shiftHex(logoColors[0], -34), shiftHex(logoColors[1], 42)], basePalette);
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  return basePalette.map((color, index) => {
    const delta = ((hash + index * 67) % 25) - 12;
    const base = parseInt(color.slice(1), 16);
    const adjusted = Math.max(0, Math.min(0xffffff, base + delta * 0x030303));
    return `#${adjusted.toString(16).padStart(6, "0").toUpperCase()}`;
  });
}

export function analyzeBrand(input: BrandKitInput): BrandIntelligence {
  const suggestedMood = inferMood(input.brandName);
  const palette = deterministicPalette(input.brandName, suggestedMood, input.logoDataUrl, input.referenceDataUrls);
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
  const industry = inferIndustry(`${input.brandName} ${referenceSummary(input.referenceDataUrls)}`);
  const industryNote =
    industry === "general"
      ? "Construir fondos con elementos visuales concretos de la idea de campana, no solo formas abstractas"
      : `Construir fondos con elementos reconocibles del sector ${industry}, integrados con la marca`;
  const visualStyleNotes = [
    hasLogo
      ? "Incluir el logo como firma visible; no ocultarlo ni usarlo solo como referencia interna"
      : "Reservar un area limpia para firma o nombre de marca",
    `Usar paleta principal: ${palette.join(", ")}`,
    industryNote,
    "Evitar paletas planas: usar base, contraste, acento calido/frio y neutro respirable"
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
    backgroundDirection: `Fondo ${suggestedMood} con tema visual reconocible para ${input.brandName}; usar paleta ${palette.join(", ")} con profundidad, textura y zonas limpias para texto/logo.`,
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
