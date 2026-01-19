import { GoogleGenAI, Modality, type Part } from '@google/genai';

export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const KNOWN_IMAGE_MODELS = [
  DEFAULT_IMAGE_MODEL,
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
] as const;

export const DEFAULT_IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';
export const KNOWN_IMAGEN_MODELS = [
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001',
] as const;

const RETRY_ATTEMPTS = Math.max(
  0,
  Number.parseInt(process.env.IMAGE_RETRY_ATTEMPTS ?? '2', 10)
);
const RETRY_DELAY_MS = Math.max(
  0,
  Number.parseInt(process.env.IMAGE_RETRY_DELAY_MS ?? '2000', 10)
);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isUnavailableError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const { code, status, message } = error as {
      code?: number;
      status?: string;
      message?: string;
    };

    if (code === 503 || status === 'UNAVAILABLE') {
      return true;
    }

    if (typeof message === 'string') {
      const normalized = message.toLowerCase();
      return (
        normalized.includes('unavailable') || normalized.includes('overloaded')
      );
    }
  }

  return false;
};

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
    if (typeof data === 'string' && data.length > 0) {
      const mimeType = part.inlineData?.mimeType ?? 'image/png';
      return { base64: data, mimeType };
    }
  }

  throw new Error('이미지 응답이 없어');
};

export const WATERMARK_REMOVAL_PROMPT = `Edit this image: erase and remove any watermark, logo, or text overlay that appears on top of the main subject. Keep the product packaging design exactly as is. Output the cleaned image.`;

export const removeWatermark = async ({
  ai,
  model,
  base64Image,
  mimeType,
}: {
  ai: GoogleGenAI;
  model: string;
  base64Image: string;
  mimeType: string;
}): Promise<{ base64: string; mimeType: string }> => {
  let attempt = 0;

  while (true) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: buildParts({
              prompt: WATERMARK_REMOVAL_PROMPT,
              base64Image,
              mimeType,
            }),
          },
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Part[];

      return extractInlineImage(parts);
    } catch (error) {
      if (attempt >= RETRY_ATTEMPTS || !isUnavailableError(error)) {
        throw error;
      }

      const delay = RETRY_DELAY_MS * Math.max(1, attempt + 1);
      console.warn(
        `워터마크 제거 재시도 (${attempt + 1}/${RETRY_ATTEMPTS}), ${delay}ms 대기`
      );
      attempt += 1;
      await sleep(delay);
    }
  }
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
  let attempt = 0;

  while (true) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
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
    } catch (error) {
      if (attempt >= RETRY_ATTEMPTS || !isUnavailableError(error)) {
        throw error;
      }

      const delay = RETRY_DELAY_MS * Math.max(1, attempt + 1);
      console.warn(
        `모델 응답 지연으로 재시도 (${
          attempt + 1
        }/${RETRY_ATTEMPTS}), ${delay}ms 대기`
      );
      attempt += 1;
      await sleep(delay);
    }
  }
};

export type ImagenAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
export type ImagenSize = '1K' | '2K';

export const requestImagenGeneration = async ({
  ai,
  model,
  prompt,
  numberOfImages = 1,
  aspectRatio,
  imageSize,
}: {
  ai: GoogleGenAI;
  model: string;
  prompt: string;
  numberOfImages?: number;
  aspectRatio?: ImagenAspectRatio;
  imageSize?: ImagenSize;
}): Promise<{ base64: string; mimeType: string }[]> => {
  let attempt = 0;

  while (true) {
    try {
      const response = await ai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages: Math.min(4, Math.max(1, numberOfImages)),
          ...(aspectRatio && { aspectRatio }),
          ...(imageSize && { imageSize }),
        },
      });

      const results: { base64: string; mimeType: string }[] = [];

      for (const generatedImage of response.generatedImages ?? []) {
        const imgBytes = generatedImage.image?.imageBytes;
        if (imgBytes) {
          results.push({ base64: imgBytes, mimeType: 'image/png' });
        }
      }

      if (results.length === 0) {
        throw new Error('이미지 응답이 없어');
      }

      return results;
    } catch (error) {
      if (attempt >= RETRY_ATTEMPTS || !isUnavailableError(error)) {
        throw error;
      }

      const delay = RETRY_DELAY_MS * Math.max(1, attempt + 1);
      console.warn(
        `Imagen 응답 지연으로 재시도 (${attempt + 1}/${RETRY_ATTEMPTS}), ${delay}ms 대기`
      );
      attempt += 1;
      await sleep(delay);
    }
  }
};
