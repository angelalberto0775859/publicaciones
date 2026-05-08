export type CampaignGoal = "conversion" | "reach" | "education";
export type Platform = "instagram" | "x" | "facebook";
export type Mood = "minimalist" | "vibrant" | "corporate" | "night" | "editorial";
export type AspectRatio = "9:16" | "1:1" | "16:9" | "custom";

export interface BrandKitInput {
  brandName: string;
  logoDataUrl?: string;
  referenceDataUrls: string[];
}

export interface BrandIntelligence {
  brandName: string;
  logoDataUrl?: string;
  aiEnhanced?: boolean;
  palette: string[];
  suggestedMood: Mood;
  contrastScore: number;
  logoLegibility: "high" | "medium" | "low";
  brandPersonality: string[];
  toneOfVoice: string;
  referenceInsights: string[];
  keyMessaging: string[];
  visualStyleNotes: string[];
  backgroundDirection: string;
  copyGuidelines: string[];
  logoPlacementGuidelines?: string[];
}

export interface CampaignBrief {
  idea: string;
  audience: string;
  goal: CampaignGoal;
  cta: string;
  platform: Platform[];
  customWidth?: number;
  customHeight?: number;
  createCarousel?: boolean;
  carouselSlides?: number;
}

export interface LayoutProposal {
  titleWeight: "regular" | "semibold" | "bold";
  textHierarchy: string[];
  compositionHint: string;
  ratio: AspectRatio;
}

export interface DesignVariation {
  id: string;
  name: string;
  creativeAngle?: string;
  rationale?: string;
  prompt: string;
  previewUrl: string;
  backgroundUrl?: string;
  generatedWithAI?: boolean;
  layout: LayoutProposal;
  width: number;
  height: number;
}

export interface GenerationRequest {
  brand: BrandIntelligence;
  brief: CampaignBrief;
  styleInstruction: string;
  variationCount: number;
}
