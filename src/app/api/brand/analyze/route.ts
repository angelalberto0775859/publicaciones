import { analyzeBrand } from "@/lib/brand-intelligence";
import { analyzeBrandWithAI, hasOpenAIKey } from "@/lib/openai-ai";
import { BrandKitInput } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BrandKitInput;

    if (!body.brandName?.trim()) {
      return NextResponse.json({ error: "brandName is required" }, { status: 400 });
    }

    const input = {
      brandName: body.brandName.trim(),
      logoDataUrl: body.logoDataUrl,
      referenceDataUrls: body.referenceDataUrls ?? []
    };
    const fallback = analyzeBrand(input);
    const result = hasOpenAIKey() ? await analyzeBrandWithAI(input, fallback) : fallback;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
