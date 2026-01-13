import { GoogleGenAI, Modality, type Part } from '@google/genai';

export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const KNOWN_IMAGE_MODELS = [
  DEFAULT_IMAGE_MODEL,
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
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
