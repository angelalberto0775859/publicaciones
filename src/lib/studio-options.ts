export type ExportFormat = "png" | "jpg" | "pdf";
export type SizePreset = "story" | "square" | "wide" | "hd" | "custom";
export type CreativeStyle = "minimalista" | "vibrante" | "nocturno" | "editorial";

export interface OutputSize {
  key: string;
  width: number;
  height: number;
  label: string;
}

export const sizePresets: Record<SizePreset, { label: string; width: number; height: number }> = {
  story: { label: "Story 9:16", width: 1080, height: 1920 },
  square: { label: "Feed 1:1", width: 1080, height: 1080 },
  wide: { label: "Feed horizontal 16:9", width: 1200, height: 628 },
  hd: { label: "Pantalla 16:9", width: 1920, height: 1080 },
  custom: { label: "Personalizado", width: 1080, height: 1080 }
};

