"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { analyzeBrand as analyzeBrandLocally } from "@/lib/brand-intelligence";
import { buildLayoutProposal } from "@/lib/layout-engine";
import { renderPreviewDataUrl } from "@/lib/mock-render";
import { buildCampaignCopy, buildVisualPrompts, creativeAngleForIndex, postStructureForIndex } from "@/lib/prompt-builder";
import { AspectRatio, BrandIntelligence, CampaignGoal, DesignVariation, GenerationRequest, Platform } from "@/lib/types";
import { db } from "@/lib/firebase";
import { exportVariationImage } from "@/lib/export-art";
import { CreativeStyle, ExportFormat, OutputSize, SizePreset, sizePresets } from "@/lib/studio-options";

interface GenerationResponse {
  brandValidation: {
    paletteHarmony: string;
    logoReadability: string;
    notes: string;
    brandPersonality: string[];
    toneOfVoice: string;
    referenceInsights: string[];
    keyMessaging: string[];
    visualStyleNotes?: string[];
    backgroundDirection?: string;
    logoPlacementGuidelines?: string[];
  };
  variations: DesignVariation[];
  carouselSlides: DesignVariation[];
}

interface UploadedLogoVariant {
  id: string;
  name: string;
  dataUrl: string;
}

interface BrandFormState {
  brandName: string;
  logoDataUrl: string;
  references: string;
}

interface BrandInstance {
  id: string;
  name: string;
  updatedAt: string;
  config: {
    brandForm: BrandFormState;
    referenceUploads: string[];
    uploadedLogoVariants: UploadedLogoVariant[];
    idea: string;
    audience: string;
    goal: CampaignGoal;
    cta: string;
    platforms: Platform[];
    styleInstruction: string;
    creativeStyles: CreativeStyle[];
    variationCount: number;
    createCarousel: boolean;
    carouselSlides: number;
    sizePresetsSelected: SizePreset[];
    customWidth: number;
    customHeight: number;
    exportFormats: ExportFormat[];
  };
}

const initialBrand: BrandFormState = {
  brandName: "",
  logoDataUrl: "",
  references: ""
};

const BRAND_INSTANCES_STORAGE_KEY = "fresh-campaign-brand-instances";
const platformRatios: Record<Platform, AspectRatio[]> = {
  instagram: ["1:1", "9:16"],
  x: ["16:9", "1:1"],
  facebook: ["16:9", "1:1"]
};
const creativeBriefPresets = [
  {
    title: "Lanzamiento",
    instruction: "presenta una novedad con energia, beneficio claro y CTA directo"
  },
  {
    title: "Promocion",
    instruction: "enfatiza oferta, urgencia suave y razones concretas para comprar"
  },
  {
    title: "Educativo",
    instruction: "convierte la idea en contenido util, facil de guardar y compartir"
  },
  {
    title: "Branding",
    instruction: "prioriza reconocimiento de marca, tono visual y recordacion"
  },
  {
    title: "Testimonio",
    instruction: "usa confianza, resultados y prueba social como eje principal"
  }
];
const postStructurePreview = Array.from({ length: 6 }, (_, idx) => postStructureForIndex(idx));

function shortPrompt(prompt: string): string {
  const backgroundMarker = "Background generation prompt:";
  const source = prompt.includes(backgroundMarker) ? prompt.split(backgroundMarker).pop() ?? prompt : prompt;
  return source.replace(/\s+/g, " ").trim().slice(0, 180);
}

function ProgressPanel({
  label,
  progress,
  elapsed,
  detail
}: {
  label: string;
  progress: number;
  elapsed: number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-cyan-200/30 bg-cyan-400/10 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-cyan-100">{label}</span>
        <span className="text-slate-300">{elapsed}s</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35">
        <div
          className="h-full rounded-full bg-cyan-300 transition-all duration-500"
          style={{ width: `${Math.max(4, Math.min(progress, 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-300">{detail}</p>
    </div>
  );
}

async function readJsonResponse<T>(response: Response, unavailableMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new Error(`${unavailableMessage} Codigo ${response.status}.`);
  }
  if (!contentType.includes("application/json")) {
    throw new Error(unavailableMessage);
  }
  return (await response.json()) as T;
}

function ratiosForPlatforms(platforms: Platform[]): AspectRatio[] {
  const ratios = platforms.flatMap((platform) => platformRatios[platform] ?? []);
  const uniqueRatios = [...new Set(ratios)];
  return uniqueRatios.length ? uniqueRatios : ["9:16", "1:1", "16:9"];
}

function buildLocalGeneration(payload: GenerationRequest): GenerationResponse {
  const prompts = buildVisualPrompts(payload);
  const ratios = ratiosForPlatforms(payload.brief.platform);
  const variations: DesignVariation[] = prompts.map((prompt, idx) => {
    const ratio = ratios[idx % ratios.length];
    const layout = buildLayoutProposal(payload.brief, payload.brand.suggestedMood, ratio);
    const width = payload.brief.customWidth && payload.brief.customWidth > 0 ? payload.brief.customWidth : 1080;
    const height = payload.brief.customHeight && payload.brief.customHeight > 0 ? payload.brief.customHeight : 1080;
    const copy = buildCampaignCopy(payload.brand, payload.brief, idx);
    const angle = creativeAngleForIndex(idx);
    const structure = postStructureForIndex(idx);

    return {
      id: `local-${idx + 1}`,
      name: `${angle.name} · local`,
      creativeAngle: angle.name,
      postStructure: structure.name,
      structureDescription: structure.description,
      rationale: angle.intent,
      prompt,
      previewUrl: renderPreviewDataUrl(payload.brand.palette, copy.headline, copy.subtext, layout, width, height, {
        brandName: payload.brand.brandName,
        logoDataUrl: payload.brand.logoDataUrl,
        cta: copy.cta,
        mood: payload.brand.suggestedMood,
        logoTreatment: idx % 3 === 0 ? "clear-box" : idx % 3 === 1 ? "soft-box" : "watermark"
      }),
      generatedWithAI: false,
      layout,
      width,
      height
    };
  });

  return {
    brandValidation: {
      paletteHarmony: "fallback",
      logoReadability: payload.brand.logoLegibility,
      notes: "Firebase Hosting esta sirviendo la app estatica; se uso generacion local mientras conectamos backend para IA real.",
      brandPersonality: payload.brand.brandPersonality,
      toneOfVoice: payload.brand.toneOfVoice,
      referenceInsights: payload.brand.referenceInsights,
      keyMessaging: payload.brand.keyMessaging,
      visualStyleNotes: payload.brand.visualStyleNotes,
      backgroundDirection: payload.brand.backgroundDirection,
      logoPlacementGuidelines: payload.brand.logoPlacementGuidelines
    },
    variations,
    carouselSlides: []
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export function CreativeStudio() {
  const [brandForm, setBrandForm] = useState(initialBrand);
  const [logoFileName, setLogoFileName] = useState("");
  const [referenceUploads, setReferenceUploads] = useState<string[]>([]);
  const [uploadedLogoVariants, setUploadedLogoVariants] = useState<UploadedLogoVariant[]>([]);
  const [brand, setBrand] = useState<BrandIntelligence | null>(null);
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState<CampaignGoal>("conversion");
  const [cta, setCta] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "x", "facebook"]);
  const [styleInstruction, setStyleInstruction] = useState("vibrante y editorial");
  const [creativeStyles, setCreativeStyles] = useState<CreativeStyle[]>(["vibrante", "editorial"]);
  const [variationCount, setVariationCount] = useState(3);
  const [createCarousel, setCreateCarousel] = useState(false);
  const [carouselSlides, setCarouselSlides] = useState(5);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const [runtimeNotice, setRuntimeNotice] = useState<string | null>(null);
  const [sizePresetsSelected, setSizePresetsSelected] = useState<SizePreset[]>(["square"]);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>(["png"]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [instances, setInstances] = useState<BrandInstance[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(BRAND_INSTANCES_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as BrandInstance[];
    } catch {
      return [];
    }
  });
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");

  const selectedLabel = useMemo(() => platforms.join(", "), [platforms]);
  const selectedVariation = useMemo(
    () => result?.variations.find((variation) => variation.id === selectedVariationId) ?? result?.variations[0],
    [result, selectedVariationId]
  );

  useEffect(() => {
    if (!analysisLoading) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - started) / 1000);
      setAnalysisElapsed(elapsed);
      setAnalysisProgress((prev) => Math.min(92, prev + (prev < 55 ? 7 : 3)));
    }, 700);
    return () => window.clearInterval(timer);
  }, [analysisLoading]);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - started) / 1000);
      setGenerationElapsed(elapsed);
      setGenerationProgress((prev) => Math.min(94, prev + (prev < 45 ? 6 : prev < 75 ? 4 : 2)));
    }, 900);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    const loadFirebaseInstances = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, "brandInstances"), orderBy("updatedAt", "desc")));
        const firestoreInstances = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...(snapshotDoc.data() as Omit<BrandInstance, "id">)
        }));

        if (firestoreInstances.length) {
          setInstances(firestoreInstances);
          localStorage.setItem(BRAND_INSTANCES_STORAGE_KEY, JSON.stringify(firestoreInstances));
        }
      } catch {
        // Si Firebase no está disponible o no permite escritura, seguimos usando localStorage.
      }
    };

    loadFirebaseInstances();
  }, []);
  const primaryPreset = sizePresetsSelected[0] ?? "square";
  const activeSize = primaryPreset === "custom" ? { width: customWidth, height: customHeight } : sizePresets[primaryPreset];

  const persistInstances = (next: BrandInstance[]) => {
    setInstances(next);
    localStorage.setItem(BRAND_INSTANCES_STORAGE_KEY, JSON.stringify(next));
  };

  const syncInstanceToFirestore = async (instance: BrandInstance) => {
    try {
      await setDoc(doc(db, "brandInstances", instance.id), instance);
    } catch {
      // Si no es posible guardar en Firestore, mantenemos el respaldo en localStorage.
    }
  };

  const deleteInstanceFromFirestore = async (instanceId: string) => {
    try {
      await deleteDoc(doc(db, "brandInstances", instanceId));
    } catch {
      // Si no es posible eliminar en Firestore, continuamos con localStorage.
    }
  };

  const buildCurrentConfig = (): BrandInstance["config"] => ({
    brandForm,
    referenceUploads,
    uploadedLogoVariants,
    idea,
    audience,
    goal,
    cta,
    platforms,
    styleInstruction,
    creativeStyles,
    variationCount,
    createCarousel,
    carouselSlides,
    sizePresetsSelected,
    customWidth,
    customHeight,
    exportFormats
  });

  const applyConfig = (config: BrandInstance["config"]) => {
    setBrandForm(config.brandForm);
    setReferenceUploads(config.referenceUploads ?? []);
    setUploadedLogoVariants(config.uploadedLogoVariants ?? []);
    setIdea(config.idea);
    setAudience(config.audience);
    setGoal(config.goal);
    setCta(config.cta ?? "");
    setPlatforms(config.platforms);
    setStyleInstruction(config.styleInstruction);
    setCreativeStyles(config.creativeStyles);
    setVariationCount(config.variationCount);
    setCreateCarousel(config.createCarousel ?? false);
    setCarouselSlides(config.carouselSlides ?? 5);
    setSizePresetsSelected(config.sizePresetsSelected);
    setCustomWidth(config.customWidth);
    setCustomHeight(config.customHeight);
    setExportFormats(config.exportFormats);
  };

  const togglePlatform = (platform: Platform) => {
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const toggleSizePreset = (preset: SizePreset) => {
    setSizePresetsSelected((prev) => {
      const next = prev.includes(preset) ? prev.filter((item) => item !== preset) : [...prev, preset];
      return next.length ? next : ["square"];
    });
  };

  const toggleExportFormat = (format: ExportFormat) => {
    setExportFormats((prev) => {
      const next = prev.includes(format) ? prev.filter((item) => item !== format) : [...prev, format];
      return next.length ? next : ["png"];
    });
  };

  const toggleCreativeStyle = (style: CreativeStyle) => {
    setCreativeStyles((prev) => {
      const next = prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style];
      return next.length ? next : ["vibrante"];
    });
  };

  const saveNewInstance = async () => {
    const trimmed = instanceName.trim();
    if (!trimmed) {
      setErrorMessage("Escribe un nombre para guardar la instancia de marca.");
      return;
    }
    setErrorMessage(null);
    const now = new Date().toISOString();
    const newInstance: BrandInstance = {
      id: crypto.randomUUID(),
      name: trimmed,
      updatedAt: now,
      config: buildCurrentConfig()
    };
    persistInstances([newInstance, ...instances]);
    setSelectedInstanceId(newInstance.id);
    await syncInstanceToFirestore(newInstance);
  };

  const updateSelectedInstance = async () => {
    if (!selectedInstanceId) {
      setErrorMessage("Selecciona una instancia para actualizarla.");
      return;
    }
    setErrorMessage(null);
    const next = instances.map((instance) =>
      instance.id === selectedInstanceId
        ? {
            ...instance,
            name: instanceName.trim() || instance.name,
            updatedAt: new Date().toISOString(),
            config: buildCurrentConfig()
          }
        : instance
    );
    persistInstances(next);
    const updatedInstance = next.find((instance) => instance.id === selectedInstanceId);
    if (updatedInstance) {
      await syncInstanceToFirestore(updatedInstance);
    }
  };

  const loadSelectedInstance = () => {
    if (!selectedInstanceId) {
      setErrorMessage("Selecciona una instancia para cargarla.");
      return;
    }
    const found = instances.find((instance) => instance.id === selectedInstanceId);
    if (!found) {
      setErrorMessage("La instancia seleccionada ya no existe.");
      return;
    }
    setErrorMessage(null);
    setInstanceName(found.name);
    applyConfig(found.config);
  };

  const deleteSelectedInstance = async () => {
    if (!selectedInstanceId) {
      setErrorMessage("Selecciona una instancia para eliminarla.");
      return;
    }
    setErrorMessage(null);
    const next = instances.filter((instance) => instance.id !== selectedInstanceId);
    persistInstances(next);
    await deleteInstanceFromFirestore(selectedInstanceId);
    setSelectedInstanceId("");
  };

  const analyzeBrand = async () => {
    const referenceFromText = brandForm.references
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const referenceDataUrls = [...referenceFromText, ...referenceUploads];
    setAnalysisProgress(8);
    setAnalysisElapsed(0);
    setAnalysisLoading(true);
    try {
      setErrorMessage(null);
      setRuntimeNotice(null);

      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandForm.brandName,
          logoDataUrl: brandForm.logoDataUrl || undefined,
          referenceDataUrls
        })
      });

      const analyzedBrand = await readJsonResponse<BrandIntelligence>(
        res,
        "La API de analisis no esta disponible en Firebase Hosting estatico."
      );
      setBrand(analyzedBrand);
      setAnalysisProgress(100);
    } catch (error) {
      const fallbackBrand = analyzeBrandLocally({
        brandName: brandForm.brandName.trim(),
        logoDataUrl: brandForm.logoDataUrl || undefined,
        referenceDataUrls
      });
      setBrand(fallbackBrand);
      setAnalysisProgress(100);
      setRuntimeNotice(
        `${error instanceof Error ? error.message : "No se pudo conectar con la API."} Use analisis local para que puedas seguir trabajando.`
      );
      setErrorMessage("El analisis con IA no corrio porque el backend /api no esta publicado; se genero una lectura local de marca.");
    } finally {
      window.setTimeout(() => setAnalysisLoading(false), 400);
    }
  };

  const onLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const logoDataUrl = await fileToDataUrl(file);
    setLogoFileName(file.name);
    setBrandForm((prev) => ({ ...prev, logoDataUrl }));
  };

  const onReferenceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const parsed = await Promise.all(files.map((file) => fileToDataUrl(file)));
    setReferenceUploads((prev) => [...prev, ...parsed]);
    event.target.value = "";
  };

  const removeReference = (index: number) => {
    setReferenceUploads((prev) => prev.filter((_, idx) => idx !== index));
  };

  const onLogoVariantsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const parsed = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        dataUrl: await fileToDataUrl(file)
      }))
    );

    setUploadedLogoVariants((prev) => [...prev, ...parsed]);
    event.target.value = "";
  };

  const removeLogoVariant = (id: string) => {
    setUploadedLogoVariants((prev) => prev.filter((item) => item.id !== id));
  };

  const generateCampaign = async () => {
    if (!brand) {
      setErrorMessage("Debes analizar la marca primero.");
      return;
    }

    setGenerationProgress(6);
    setGenerationElapsed(0);
    setLoading(true);
    try {
      setErrorMessage(null);
      setRuntimeNotice(null);
      const payload: GenerationRequest = {
        brand,
        styleInstruction: `${styleInstruction}. Estilos solicitados: ${creativeStyles.join(", ")}`,
        variationCount,
        brief: {
          idea,
          audience,
          goal,
          cta: cta.trim() || undefined,
          platform: platforms,
          customWidth: activeSize.width,
          customHeight: activeSize.height,
          createCarousel,
          carouselSlides
        }
      };
      const res = await fetch("/api/design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const nextResult = await readJsonResponse<GenerationResponse>(
        res,
        "La API de generacion no esta disponible en Firebase Hosting estatico."
      );
      setResult(nextResult);
      setSelectedVariationId(nextResult.variations[0]?.id ?? "");
      setGenerationProgress(100);
    } catch (error) {
      const localResult = buildLocalGeneration({
        brand,
        styleInstruction: `${styleInstruction}. Estilos solicitados: ${creativeStyles.join(", ")}`,
        variationCount,
        brief: {
          idea,
          audience,
          goal,
          cta: cta.trim() || undefined,
          platform: platforms,
          customWidth: activeSize.width,
          customHeight: activeSize.height,
          createCarousel,
          carouselSlides
        }
      });
      setResult(localResult);
      setSelectedVariationId(localResult.variations[0]?.id ?? "");
      setGenerationProgress(100);
      setRuntimeNotice(
        `${error instanceof Error ? error.message : "No se pudo conectar con la API."} Genere propuestas locales para que no se corte el flujo.`
      );
      setErrorMessage("La generacion con IA no corrio porque el backend /api no esta publicado; se usaron propuestas locales.");
    } finally {
      window.setTimeout(() => setLoading(false), 400);
    }
  };

  const aiRefine = async (instruction: string) => {
    setStyleInstruction(instruction);
    if (brand && result) {
      await generateCampaign();
    }
  };

  const downloadVariation = async (variation: DesignVariation) => {
    setDownloadingId(variation.id);
    try {
      setErrorMessage(null);
      const outputSizes: OutputSize[] = sizePresetsSelected.map((preset) =>
        preset === "custom"
          ? { key: "custom", label: "Personalizado", width: customWidth, height: customHeight }
          : { key: preset, ...sizePresets[preset] }
      );

      await exportVariationImage(variation.previewUrl, variation.id, outputSizes, exportFormats);
    } catch {
      setErrorMessage("No se pudieron exportar los artes seleccionados.");
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadUploadedLogoVariant = async (variant: UploadedLogoVariant) => {
    setDownloadingId(variant.id);
    try {
      setErrorMessage(null);
      const outputSizes: OutputSize[] = [{ key: "logo", label: "Logo", width: 1080, height: 1080 }];
      await exportVariationImage(variant.dataUrl, variant.id, outputSizes, exportFormats);
    } catch {
      setErrorMessage("No se pudieron exportar las variantes de logo.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-r from-violet-500/25 via-cyan-400/20 to-emerald-300/10 p-8">
        <p className="relative inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-1 text-xs tracking-wide text-cyan-100">
          AI Visual Campaign Engine
        </p>
        <h1 className="relative mt-3 text-4xl font-semibold tracking-tight md:text-5xl">FreshCampaign AI Studio</h1>
        <p className="relative mt-3 max-w-3xl text-slate-100/90">
          Genera campanas visuales completas para Instagram, X y Facebook con identidad de marca consistente y estetica
          de tendencia.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          ["1", "Marca", brand ? "Identidad analizada" : "Sube logo y referencias"],
          ["2", "Brief", idea ? "Idea lista para generar" : "Define idea y objetivo"],
          ["3", "Escoge", selectedVariation ? selectedVariation.name : "Compara propuestas"]
        ].map(([step, label, status]) => (
          <div key={step} className="rounded-xl border border-white/15 bg-black/20 px-4 py-3">
            <p className="text-xs text-slate-400">Paso {step}</p>
            <p className="mt-1 font-medium">{label}</p>
            <p className="mt-1 text-xs text-slate-300">{status}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h2 className="text-xl font-semibold">Instancias de marca</h2>
          <p className="mt-1 text-xs text-slate-300">
            Guarda cada marca con su configuracion y luego cargala/modificala cuando lo necesites.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 md:col-span-2"
              placeholder="Nombre de instancia (ej: Marca Primavera 2026)"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
            <select
              className="secondary-btn px-3 py-2 text-sm md:col-span-2"
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
            >
              <option value="">Selecciona instancia guardada</option>
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="primary-btn px-4 py-2" onClick={saveNewInstance}>
              Guardar nueva instancia
            </button>
            <button className="secondary-btn px-4 py-2" onClick={loadSelectedInstance}>
              Cargar instancia
            </button>
            <button className="secondary-btn px-4 py-2" onClick={updateSelectedInstance}>
              Actualizar opciones
            </button>
            <button className="secondary-btn px-4 py-2" onClick={deleteSelectedInstance}>
              Eliminar instancia
            </button>
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5">
          <h2 className="text-xl font-semibold">1) Brand Intelligence</h2>
          <p className="mt-1 text-xs text-slate-300">Sube assets, detecta mood y configura tu sistema visual base.</p>
          <div className="mt-4 grid gap-3">
            <input
              className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder="Nombre de marca"
              value={brandForm.brandName}
              onChange={(e) => setBrandForm((prev) => ({ ...prev, brandName: e.target.value }))}
            />
            <textarea
              className="min-h-20 rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder="Logo en dataURL (opcional)"
              value={brandForm.logoDataUrl}
              onChange={(e) => setBrandForm((prev) => ({ ...prev, logoDataUrl: e.target.value }))}
            />
            <label className="rounded-xl border border-dashed border-white/35 bg-black/20 px-3 py-2 text-sm text-slate-100">
              Subir logo local
              <input className="mt-2 block w-full text-xs" type="file" accept="image/*" onChange={onLogoUpload} />
            </label>
            <label className="rounded-xl border border-dashed border-white/35 bg-black/20 px-3 py-2 text-sm text-slate-100">
              Subir variantes de logo (manuales)
              <input className="mt-2 block w-full text-xs" type="file" accept="image/*" multiple onChange={onLogoVariantsUpload} />
            </label>
            {logoFileName ? <p className="text-xs text-slate-300">Logo cargado: {logoFileName}</p> : null}
            {uploadedLogoVariants.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {uploadedLogoVariants.map((variant) => (
                  <button
                    key={variant.id}
                    className="relative overflow-hidden rounded-lg border border-white/20"
                    onClick={() => removeLogoVariant(variant.id)}
                    title="Quitar variante"
                  >
                    <img src={variant.dataUrl} alt={variant.name} className="h-16 w-full object-contain bg-black/25" />
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px]">x</span>
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              className="min-h-20 rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder="Referencias por URL (opcional, separadas por coma)"
              value={brandForm.references}
              onChange={(e) => setBrandForm((prev) => ({ ...prev, references: e.target.value }))}
            />
            <label className="rounded-xl border border-dashed border-white/35 bg-black/20 px-3 py-2 text-sm text-slate-100">
              Subir referencias visuales locales
              <input
                className="mt-2 block w-full text-xs"
                type="file"
                accept="image/*"
                multiple
                onChange={onReferenceUpload}
              />
            </label>
            {referenceUploads.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {referenceUploads.map((ref, idx) => (
                  <button
                    key={`${ref.slice(0, 24)}-${idx}`}
                    className="relative overflow-hidden rounded-lg border border-white/20"
                    onClick={() => removeReference(idx)}
                    title="Quitar referencia"
                  >
                    <img src={ref} alt={`Referencia ${idx + 1}`} className="h-20 w-full object-cover" />
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px]">x</span>
                  </button>
                ))}
              </div>
            ) : null}
            <button className="primary-btn px-4 py-2 disabled:opacity-60" onClick={analyzeBrand} disabled={analysisLoading}>
              {analysisLoading ? "Analizando identidad..." : "Analizar identidad"}
            </button>
            {analysisLoading ? (
              <ProgressPanel
                label="Analisis de marca"
                progress={analysisProgress}
                elapsed={analysisElapsed}
                detail="Leyendo nombre, logo, referencias, paleta, tono y tratamiento del logo."
              />
            ) : null}
          </div>

          {brand && (
            <div className="mt-4 rounded-xl border border-cyan-200/30 bg-cyan-500/10 p-3 text-sm">
              <p>Mood sugerido: {brand.suggestedMood}</p>
              <p>Legibilidad de logo: {brand.logoLegibility}</p>
              <p>Motor: {brand.aiEnhanced ? "IA multimodal activa" : "Fallback local"}</p>
              <div className="mt-2 flex gap-2">
                {brand.palette.map((color, idx) => (
                  <span key={`${color}-${idx}`} className="h-8 w-8 rounded-full border border-white/30" style={{ background: color }} />
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="glass-card rounded-2xl p-5">
          <h2 className="text-xl font-semibold">2) Brief y rutas creativas</h2>
          <p className="mt-1 text-xs text-slate-300">Elige una intencion, escribe la idea y genera propuestas distintas para comparar.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-5">
              {creativeBriefPresets.map((preset) => (
                <button
                  key={preset.title}
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-left text-xs hover:border-cyan-200/60"
                  onClick={() => setStyleInstruction(preset.instruction)}
                >
                  <span className="block font-medium text-slate-100">{preset.title}</span>
                  <span className="mt-1 block text-slate-400">{preset.instruction}</span>
                </button>
              ))}
            </div>
            <textarea
              className="min-h-20 rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder="Idea principal: que quieres anunciar, vender o explicar"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder="Publico objetivo"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder="CTA opcional (si lo dejas vacio no se dibuja boton)"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 placeholder:text-slate-400"
              placeholder='Instruccion AI (ej: "mas minimalista")'
              value={styleInstruction}
              onChange={(e) => setStyleInstruction(e.target.value)}
            />
            <div className="rounded-xl border border-white/20 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Exploracion visual</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(["minimalista", "vibrante", "nocturno", "editorial"] as CreativeStyle[]).map((style) => (
                  <button
                    key={style}
                    className={`rounded-full border px-3 py-1 ${
                      creativeStyles.includes(style)
                        ? "border-transparent bg-fuchsia-300 text-black"
                        : "border-white/30 bg-white/10"
                    }`}
                    onClick={() => toggleCreativeStyle(style)}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-xs text-slate-300">Cantidad de propuestas distintas</label>
                <select
                  className="secondary-btn mt-1 w-full px-3 py-2 text-sm"
                  value={variationCount}
                  onChange={(e) => setVariationCount(Number(e.target.value))}
                >
                  <option value={3}>3 rutas rapidas</option>
                  <option value={4}>4 rutas balanceadas</option>
                  <option value={6}>6 rutas completas</option>
                </select>
              </div>
              <div className="mt-3 rounded-lg border border-white/15 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-300">Estructuras que se alternan</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {postStructurePreview.map((structure) => (
                    <div key={structure.name} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-xs font-medium text-cyan-100">{structure.name}</p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">{structure.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-white/15 bg-black/20 p-3">
                <label className="flex items-center justify-between text-xs text-slate-200">
                  <span>Crear carrusel de Instagram</span>
                  <input
                    type="checkbox"
                    checked={createCarousel}
                    onChange={(e) => setCreateCarousel(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                {createCarousel ? (
                  <div className="mt-2">
                    <label className="text-xs text-slate-300">Cantidad de slides</label>
                    <select
                      className="secondary-btn mt-1 w-full px-3 py-2 text-sm"
                      value={carouselSlides}
                      onChange={(e) => setCarouselSlides(Number(e.target.value))}
                    >
                      <option value={4}>4 slides</option>
                      <option value={5}>5 slides</option>
                      <option value={6}>6 slides</option>
                      <option value={8}>8 slides</option>
                    </select>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              {(["conversion", "reach", "education"] as CampaignGoal[]).map((item) => (
                <button
                  key={item}
                  className={`rounded-full border px-3 py-1 ${
                    goal === item ? "border-transparent bg-cyan-300 text-black" : "border-white/30 bg-white/10"
                  }`}
                  onClick={() => setGoal(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              {(["instagram", "x", "facebook"] as Platform[]).map((item) => (
                <button
                  key={item}
                  className={`rounded-full border px-3 py-1 ${
                    platforms.includes(item) ? "border-transparent bg-violet-300 text-black" : "border-white/30 bg-white/10"
                  }`}
                  onClick={() => togglePlatform(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400">Canales activos: {selectedLabel}</p>

            <div className="rounded-xl border border-white/20 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Tamano de salida</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(Object.keys(sizePresets) as SizePreset[]).map((preset) => (
                  <button
                    key={preset}
                    className={`rounded-full border px-3 py-1 ${
                      sizePresetsSelected.includes(preset)
                        ? "border-transparent bg-emerald-300 text-black"
                        : "border-white/30 bg-white/10"
                    }`}
                    onClick={() => toggleSizePreset(preset)}
                  >
                    {sizePresets[preset].label}
                  </button>
                ))}
              </div>
              {sizePresetsSelected.includes("custom") ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={320}
                    className="rounded-lg border border-white/20 bg-black/25 px-3 py-2"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value || 1080))}
                    placeholder="Ancho"
                  />
                  <input
                    type="number"
                    min={320}
                    className="rounded-lg border border-white/20 bg-black/25 px-3 py-2"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value || 1080))}
                    placeholder="Alto"
                  />
                </div>
              ) : null}
              <p className="mt-2 text-xs text-slate-400">
                Salidas seleccionadas: {sizePresetsSelected.map((item) => sizePresets[item].label).join(", ")}.
              </p>
            </div>

            <button className="primary-btn px-4 py-2 disabled:opacity-60" onClick={generateCampaign} disabled={loading}>
              {loading ? "Generando propuestas..." : `Generar ${variationCount} propuestas para escoger`}
            </button>
            {loading ? (
              <ProgressPanel
                label="Generacion de publicaciones"
                progress={generationProgress}
                elapsed={generationElapsed}
                detail="Creando rutas creativas, copy, fondos, composicion y variantes exportables."
              />
            ) : null}
          </div>
        </article>
      </section>

      {runtimeNotice ? (
        <div className="mt-6 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {runtimeNotice}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6 rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{errorMessage}</div>
      ) : null}

      {result && (
        <section className="glass-card mt-8 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">3) Escoge la mejor propuesta</h2>
            <div className="flex gap-2">
              {(["png", "jpg", "pdf"] as ExportFormat[]).map((format) => (
                <button
                  key={format}
                  className={`secondary-btn px-3 py-1.5 text-sm ${
                    exportFormats.includes(format) ? "!bg-cyan-300 !text-black" : ""
                  }`}
                  onClick={() => toggleExportFormat(format)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
              <button className="secondary-btn px-3 py-1.5" onClick={() => aiRefine("hazlo mas minimalista")}>
                Mas minimalista
              </button>
              <button className="secondary-btn px-3 py-1.5" onClick={() => aiRefine("llevalo a un tono nocturno")}>
                Tono nocturno
              </button>
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-300">{result.brandValidation.notes}</p>

          {selectedVariation ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div>
                <img
                  src={selectedVariation.previewUrl}
                  alt={selectedVariation.name}
                  className="w-full rounded-xl border border-cyan-200/40 bg-black/25"
                />
              </div>
              <div className="rounded-xl border border-white/20 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-cyan-200">Seleccionada</p>
                <h3 className="mt-2 text-2xl font-semibold">{selectedVariation.name}</h3>
                <p className="mt-2 text-sm text-slate-300">{selectedVariation.rationale}</p>
                <div className="mt-4 grid gap-2 text-xs text-slate-300">
                  {selectedVariation.postStructure ? <p>Estructura: {selectedVariation.postStructure}</p> : null}
                  <p>Formato: {selectedVariation.layout.ratio}</p>
                  <p>Salida base: {selectedVariation.width}x{selectedVariation.height}</p>
                  <p>{selectedVariation.generatedWithAI ? "Copy/fondo generado con IA" : "Preview generado localmente"}</p>
                </div>
                {selectedVariation.structureDescription ? (
                  <p className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    {selectedVariation.structureDescription}
                  </p>
                ) : null}
                <p className="mt-4 text-xs text-slate-400">{shortPrompt(selectedVariation.prompt)}</p>
                <button className="primary-btn mt-4 w-full px-4 py-2" onClick={() => downloadVariation(selectedVariation)}>
                  {downloadingId === selectedVariation.id
                    ? "Preparando salidas..."
                    : `Exportar propuesta elegida (${exportFormats.map((item) => item.toUpperCase()).join(" + ")})`}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-4">
            <h4 className="text-sm font-medium text-cyan-300">Análisis de Marca Completado</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-400">Personalidad de Marca</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.brandValidation.brandPersonality.map((trait, idx) => (
                    <span key={idx} className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-xs text-cyan-200">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Tono de Voz</p>
                <p className="mt-1 text-xs text-slate-300">{result.brandValidation.toneOfVoice}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-slate-400">Mensajes Clave</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.brandValidation.keyMessaging.map((message, idx) => (
                    <span key={idx} className="rounded-lg bg-violet-300/20 px-2 py-1 text-xs text-violet-200">
                      {message}
                    </span>
                  ))}
                </div>
              </div>
              {result.brandValidation.visualStyleNotes?.length ? (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-slate-400">Guia visual aplicada</p>
                  <ul className="mt-1 space-y-1">
                    {result.brandValidation.visualStyleNotes.map((note, idx) => (
                      <li key={idx} className="text-xs text-slate-300">• {note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.brandValidation.logoPlacementGuidelines?.length ? (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-slate-400">Tratamiento de logo</p>
                  <ul className="mt-1 space-y-1">
                    {result.brandValidation.logoPlacementGuidelines.map((note, idx) => (
                      <li key={idx} className="text-xs text-slate-300">• {note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-slate-400">Insights de Referencias</p>
                <ul className="mt-1 space-y-1">
                  {result.brandValidation.referenceInsights.map((insight, idx) => (
                    <li key={idx} className="text-xs text-slate-300">• {insight}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {result.variations.map((variation) => (
              <article
                key={variation.id}
                className={`rounded-2xl border p-3 shadow-[0_8px_24px_#00000030] ${
                  selectedVariation?.id === variation.id
                    ? "border-cyan-200 bg-cyan-300/10"
                    : "border-white/15 bg-gradient-to-b from-white/10 to-black/25"
                }`}
              >
                <img src={variation.previewUrl} alt={variation.name} className="w-full rounded-xl border border-white/20" />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-cyan-200">{variation.creativeAngle ?? "Propuesta"}</p>
                    <h3 className="font-medium">{variation.name}</h3>
                    {variation.postStructure ? <p className="mt-1 text-xs text-slate-400">{variation.postStructure}</p> : null}
                  </div>
                  {selectedVariation?.id === variation.id ? (
                    <span className="rounded-full bg-cyan-200 px-2 py-1 text-[10px] font-semibold text-black">Elegida</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-300">{variation.rationale}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {variation.layout.ratio} · Base {variation.width}x{variation.height}
                  {variation.generatedWithAI ? " · fondo/copy IA" : ""}
                </p>
                <details className="mt-2 text-xs text-slate-300">
                  <summary className="cursor-pointer">Prompt usado</summary>
                  <p className="mt-1">{variation.prompt}</p>
                </details>
                <div className="mt-3 flex gap-2">
                  <button className="primary-btn px-3 py-1.5 text-xs" onClick={() => setSelectedVariationId(variation.id)}>
                    Escoger
                  </button>
                  <button className="secondary-btn px-3 py-1.5 text-xs" onClick={() => downloadVariation(variation)}>
                    {downloadingId === variation.id
                      ? "Preparando salidas..."
                      : `Descargar ${exportFormats.map((item) => item.toUpperCase()).join(" + ")}`}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {result.carouselSlides?.length ? (
            <div className="mt-8">
              <h3 className="text-lg font-semibold">Carrusel para Instagram</h3>
              <p className="mt-1 text-xs text-slate-300">
                Slides conectados visualmente, listos para publicar como secuencia.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                {result.carouselSlides.map((slide) => (
                  <article key={slide.id} className="rounded-2xl border border-white/15 bg-black/25 p-3">
                    <img src={slide.previewUrl} alt={slide.name} className="w-full rounded-xl border border-white/20" />
                    <h4 className="mt-2 text-sm font-medium">{slide.name}</h4>
                    {slide.postStructure ? <p className="mt-1 text-xs text-slate-400">{slide.postStructure}</p> : null}
                    <button className="secondary-btn mt-2 px-3 py-1.5 text-xs" onClick={() => downloadVariation(slide)}>
                      {downloadingId === slide.id
                        ? "Preparando salidas..."
                        : `Descargar ${exportFormats.map((item) => item.toUpperCase()).join(" + ")}`}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {uploadedLogoVariants.length ? (
            <div className="mt-8">
              <h3 className="text-lg font-semibold">Variantes de logo subidas</h3>
              <p className="mt-1 text-xs text-slate-300">Variantes cargadas manualmente para que uses la que necesites.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                {uploadedLogoVariants.map((variant) => (
                  <article key={variant.id} className="rounded-2xl border border-white/15 bg-black/25 p-3">
                    <img src={variant.dataUrl} alt={variant.name} className="w-full rounded-xl border border-white/20" />
                    <h4 className="mt-2 text-sm font-medium">{variant.name}</h4>
                    <button className="secondary-btn mt-2 px-3 py-1.5 text-xs" onClick={() => downloadUploadedLogoVariant(variant)}>
                      {downloadingId === variant.id
                        ? "Preparando salidas..."
                        : `Descargar ${exportFormats.map((item) => item.toUpperCase()).join(" + ")}`}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
