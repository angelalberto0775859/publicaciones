import { AspectRatio, CampaignBrief, LayoutProposal, Mood } from "@/lib/types";

function compositionByRatio(ratio: AspectRatio, hasCta: boolean): string {
  const close = hasCta ? "CTA area" : "quiet closing area";
  if (ratio === "9:16") return `hero centered with ${close} at lower third`;
  if (ratio === "1:1") return "balanced center composition with symmetric margins";
  if (ratio === "16:9") return `left-right storytelling split with ${close} on the right`;
  return "adaptive modular grid with safe zones";
}

function hierarchyByMood(mood: Mood, hasCta: boolean): string[] {
  const close = hasCta ? "CTA" : "Brand signature";
  if (mood === "minimalist") return ["Hook", "One strong supporting line", close];
  if (mood === "corporate") return ["Value proposition", "Trust marker", close];
  return ["Bold hook", "Benefit statement", close];
}

export function buildLayoutProposal(brief: CampaignBrief, mood: Mood, ratio: AspectRatio): LayoutProposal {
  const hasCta = Boolean(brief.cta?.trim());
  return {
    titleWeight: mood === "corporate" ? "semibold" : "bold",
    textHierarchy: hierarchyByMood(mood, hasCta),
    compositionHint: `${compositionByRatio(ratio, hasCta)}; optimized for ${brief.platform.join(", ")}`,
    ratio
  };
}
