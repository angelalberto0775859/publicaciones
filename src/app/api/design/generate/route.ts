import { buildLayoutProposal } from "@/lib/layout-engine";
import { renderPreviewDataUrl } from "@/lib/mock-render";
import { buildThematicBackgroundPrompt, generateBackgroundWithAI, generateCreativeDirectionWithAI } from "@/lib/openai-ai";
import { buildCampaignCopy, buildVisualPrompts, creativeAngleForIndex } from "@/lib/prompt-builder";
import { AspectRatio, DesignVariation, GenerationRequest, Platform } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

const platformRatios: Record<Platform, AspectRatio[]> = {
  instagram: ["1:1", "9:16"],
  x: ["16:9", "1:1"],
  facebook: ["16:9", "1:1"]
};

function getRatiosForPlatforms(platforms: Platform[]): AspectRatio[] {
  const ratios = platforms.flatMap((platform) => platformRatios[platform] ?? []);
  const uniqueRatios = [...new Set(ratios)];
  return uniqueRatios.length ? uniqueRatios : ["9:16", "1:1", "16:9"];
}

function sizeByRatio(ratio: AspectRatio): { width: number; height: number } {
  if (ratio === "9:16") return { width: 1080, height: 1920 };
  if (ratio === "16:9") return { width: 1920, height: 1080 };
  return { width: 1080, height: 1080 };
}

async function maybeGenerateBackground(prompt: string, ratio: AspectRatio): Promise<string | undefined> {
  try {
    return await generateBackgroundWithAI(prompt, ratio);
  } catch {
    return undefined;
  }
}

async function maybeGenerateDirection(
  payload: GenerationRequest,
  layout: ReturnType<typeof buildLayoutProposal>,
  ratio: AspectRatio,
  idx: number,
  creativeAngle: ReturnType<typeof creativeAngleForIndex>
) {
  try {
    return await generateCreativeDirectionWithAI(
      payload.brand,
      payload.brief,
      layout,
      ratio,
      idx,
      payload.styleInstruction,
      creativeAngle
    );
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as GenerationRequest;

    if (!payload.brand || !payload.brief) {
      return NextResponse.json({ error: "brand and brief are required" }, { status: 400 });
    }

    const prompts = buildVisualPrompts(payload);
    const ratios = getRatiosForPlatforms(payload.brief.platform);
    const variations: DesignVariation[] = await Promise.all(prompts.map(async (prompt, idx) => {
      const ratio = ratios[idx % ratios.length];
      const layout = buildLayoutProposal(payload.brief, payload.brand.suggestedMood, ratio);
      const customWidth = payload.brief.customWidth;
      const customHeight = payload.brief.customHeight;
      const hasCustomSize = Boolean(customWidth && customHeight && customWidth > 0 && customHeight > 0);
      const { width, height } = hasCustomSize
        ? { width: customWidth as number, height: customHeight as number }
        : sizeByRatio(ratio);

      const creativeAngle = creativeAngleForIndex(idx);
      const fallbackCopy = buildCampaignCopy(payload.brand, payload.brief, idx);
      const aiDirection = await maybeGenerateDirection(payload, layout, ratio, idx, creativeAngle);
      const thematicBackgroundPrompt = buildThematicBackgroundPrompt(
        payload.brand,
        payload.brief,
        ratio,
        idx,
        payload.styleInstruction,
        creativeAngle
      );
      const copy = {
        headline: aiDirection?.headline || fallbackCopy.headline,
        subtext: aiDirection?.subtext || fallbackCopy.subtext,
        cta: aiDirection?.cta || fallbackCopy.cta
      };
      const finalPrompt = aiDirection?.backgroundPrompt
        ? `${prompt} Background generation prompt: ${aiDirection.backgroundPrompt}`
        : `${prompt} Background generation prompt: ${thematicBackgroundPrompt}`;
      const backgroundUrl = await maybeGenerateBackground(aiDirection?.backgroundPrompt || thematicBackgroundPrompt, ratio);

      return {
        id: `var-${idx + 1}`,
        name: `${creativeAngle.name}${aiDirection ? " · IA" : ""}`,
        creativeAngle: creativeAngle.name,
        rationale: aiDirection?.compositionHint || creativeAngle.intent,
        prompt: finalPrompt,
        previewUrl: renderPreviewDataUrl(
          payload.brand.palette,
          copy.headline,
          copy.subtext,
          layout,
          width,
          height,
          {
            brandName: payload.brand.brandName,
            logoDataUrl: payload.brand.logoDataUrl,
            cta: copy.cta,
            mood: payload.brand.suggestedMood,
            backgroundUrl,
            logoTreatment: aiDirection?.logoTreatment
          }
        ),
        backgroundUrl,
        generatedWithAI: Boolean(aiDirection || backgroundUrl),
        layout,
        width,
        height
      };
    }));

    const shouldCreateCarousel = Boolean(payload.brief.createCarousel);
    const carouselSlideCount = Math.max(2, Math.min(payload.brief.carouselSlides ?? 5, 10));
    const carouselSlides: DesignVariation[] = shouldCreateCarousel
      ? await Promise.all(Array.from({ length: carouselSlideCount }).map(async (_, idx) => {
          const ratio: AspectRatio = "1:1";
          const layout = buildLayoutProposal(payload.brief, payload.brand.suggestedMood, ratio);
          const width = payload.brief.customWidth && payload.brief.customWidth > 0 ? payload.brief.customWidth : 1080;
          const height = payload.brief.customHeight && payload.brief.customHeight > 0 ? payload.brief.customHeight : 1080;
          const slideNumber = idx + 1;

          const creativeAngle = creativeAngleForIndex(idx);
          const fallbackCopy = buildCampaignCopy(payload.brand, payload.brief, idx);
          const aiDirection = await maybeGenerateDirection(payload, layout, ratio, idx, creativeAngle);
          const thematicBackgroundPrompt = buildThematicBackgroundPrompt(
            payload.brand,
            payload.brief,
            ratio,
            idx,
            payload.styleInstruction,
            creativeAngle
          );
          const copy = {
            headline: aiDirection?.headline || fallbackCopy.headline,
            subtext: aiDirection?.subtext || fallbackCopy.subtext,
            cta: aiDirection?.cta || fallbackCopy.cta
          };
          const slideHeadline =
            slideNumber === 1 ? copy.headline : `${copy.headline} ${slideNumber}/${carouselSlideCount}`;
          const slideSubtext = copy.subtext;
          const backgroundUrl = await maybeGenerateBackground(aiDirection?.backgroundPrompt || thematicBackgroundPrompt, ratio);

          return {
            id: `carousel-${slideNumber}`,
            name: `Slide ${slideNumber} · ${creativeAngle.name}${aiDirection ? " · IA" : ""}`,
            creativeAngle: creativeAngle.name,
            rationale: aiDirection?.compositionHint || creativeAngle.intent,
            prompt: aiDirection?.backgroundPrompt
              ? `Instagram carousel slide ${slideNumber}/${carouselSlideCount}. ${aiDirection.backgroundPrompt}`
              : `Instagram carousel slide ${slideNumber}/${carouselSlideCount}. ${thematicBackgroundPrompt}`,
            previewUrl: renderPreviewDataUrl(
              payload.brand.palette,
              slideHeadline,
              slideSubtext,
              layout,
              width,
              height,
              {
                brandName: payload.brand.brandName,
                logoDataUrl: payload.brand.logoDataUrl,
                cta: copy.cta,
                mood: payload.brand.suggestedMood,
                backgroundUrl,
                logoTreatment: aiDirection?.logoTreatment
              }
            ),
            backgroundUrl,
            generatedWithAI: Boolean(aiDirection || backgroundUrl),
            layout,
            width,
            height
          };
        }))
      : [];

    return NextResponse.json({
      brandValidation: {
        paletteHarmony: "pass",
        logoReadability: payload.brand.logoLegibility,
        notes:
          payload.brand.contrastScore >= 0.75
            ? "El contraste, el logo y la lectura estan dentro de un rango publicable."
            : "Conviene subir contraste o tamano de texto para mejorar lectura en fondos oscuros.",
        brandPersonality: payload.brand.brandPersonality,
        toneOfVoice: payload.brand.toneOfVoice,
        referenceInsights: payload.brand.referenceInsights ?? [],
        keyMessaging: payload.brand.keyMessaging ?? [],
        visualStyleNotes: payload.brand.visualStyleNotes ?? [],
        backgroundDirection: payload.brand.backgroundDirection ?? "",
        logoPlacementGuidelines: payload.brand.logoPlacementGuidelines ?? []
      },
      variations,
      carouselSlides
    });
  } catch {
    return NextResponse.json({ error: "Invalid generation request" }, { status: 400 });
  }
}
