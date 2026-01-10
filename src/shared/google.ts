import { GoogleGenAI, Modality, type Part } from "@google/genai";

export const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
export const KNOWN_IMAGE_MODELS = [
  DEFAULT_IMAGE_MODEL,
  "gemini-2.0-pro-exp-02-05",
  "gemini-2.0-flash",
] as const;

const buildParts = ({
  prompt,
  base64Image,
  mimeType,
}: {
  prompt: string;
  base64Image?: string;
  mimeType?: string;
}): Part[] => {
  const parts: Part[] = [{ text: prompt }];

  if (base64Image && mimeType) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType,
      },
    });
  }

  return parts;
};

const extractInlineImage = (
  parts: Part[]
): { base64: string; mimeType: string } => {
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (typeof data === "string" && data.length > 0) {
      const mimeType = part.inlineData?.mimeType ?? "image/png";
      return { base64: data, mimeType };
    }
  }

  throw new Error("이미지 응답이 없어");
};

export const requestImageGeneration = async ({
  ai,
  model,
  prompt,
  base64Image,
  mimeType,
  aspectRatio,
}: {
  ai: GoogleGenAI;
  model: string;
  prompt: string;
  base64Image?: string;
  mimeType?: string;
  aspectRatio?: string;
}): Promise<{ base64: string; mimeType: string }> => {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: buildParts({ prompt, base64Image, mimeType }),
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: aspectRatio ? { aspectRatio } : undefined,
    },
  });

  const parts = (response.candidates?.[0]?.content?.parts ?? []) as Part[];

  return extractInlineImage(parts);
};
