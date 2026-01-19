const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/images/generations';

export const DEFAULT_ZAI_MODEL = 'glm-image';
export const DEFAULT_ZAI_SIZE = '1280x1280';

export const KNOWN_ZAI_SIZES = [
  '1280x1280', // 1:1
  '1568x1056', // 3:2
  '1056x1568', // 2:3
  '1472x1088', // 4:3
  '1088x1472', // 3:4
  '1728x960', // 16:9
  '960x1728', // 9:16
] as const;

interface ZaiImageResponse {
  data: Array<{
    url: string;
  }>;
}

export const requireZaiApiKey = (): string => {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    console.error('ZAI_API_KEY 환경변수가 필요해');
    process.exit(1);
  }
  return apiKey;
};

export const requestZaiImageGeneration = async ({
  apiKey,
  model,
  prompt,
  size,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
}): Promise<string> => {
  const response = await fetch(ZAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt, size }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z.AI API 에러 (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as ZaiImageResponse;
  const imageUrl = result.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error('이미지 URL 응답이 없어');
  }

  return imageUrl;
};

export const downloadImage = async (
  url: string
): Promise<{ base64: string; mimeType: string }> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`이미지 다운로드 실패 (${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? 'image/png';
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return { base64, mimeType: contentType };
};
