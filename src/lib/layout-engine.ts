import { AspectRatio, CampaignBrief, LayoutProposal, Mood } from "@/lib/types";

function compositionByRatio(ratio: AspectRatio): string {
  if (ratio === "9:16") return "hero centered with elevated CTA at lower third";
  if (ratio === "1:1") return "balanced center composition with symmetric margins";
  if (ratio === "16:9") return "left-right storytelling split with right CTA";
  return "adaptive modular grid with safe zones";
}

function hierarchyByMood(mood: Mood): string[] {
  if (mood === "minimalist") return ["Hook", "One strong supporting line", "CTA"];
  if (mood === "corporate") return ["Value proposition", "Trust marker", "CTA"];
  return ["Bold hook", "Benefit statement", "CTA"];
}

export function buildLayoutProposal(brief: CampaignBrief, mood: Mood, ratio: AspectRatio): LayoutProposal {
  return {
    titleWeight: mood === "corporate" ? "semibold" : "bold",
    textHierarchy: hierarchyByMood(mood),
    compositionHint: `${compositionByRatio(ratio)}; optimized for ${brief.platform.join(", ")}`,
    ratio
  };
}

