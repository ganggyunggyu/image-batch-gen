/**
 * Imagen 4 이미지 생성
 */

import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

import { requireApiKey } from "./shared/env";
import { readPromptFile } from "./shared/input";
import { saveBase64Image } from "./shared/output";
import {
  DEFAULT_IMAGEN_MODEL,
  KNOWN_IMAGEN_MODELS,
  requestImagenGeneration,
  type ImagenAspectRatio,
  type ImagenSize,
} from "./shared/google";
import {
  fillPromptVariables,
  getTemplateByName,
  getAvailableTemplates,
  CATEGORY_TYPE,
} from "./shared/prompt-variables";

const ai = new GoogleGenAI({ apiKey: requireApiKey() });

const IMAGEN_MODEL = process.env.IMAGEN_MODEL ?? DEFAULT_IMAGEN_MODEL;
const ASPECT_RATIO = process.env.IMAGEN_ASPECT_RATIO as ImagenAspectRatio | undefined;
const IMAGE_SIZE = process.env.IMAGEN_SIZE as ImagenSize | undefined;
const DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? "3000");

const parseArgs = (): { count: number; templateName: string | null } => {
  const args = process.argv.slice(2);
  let count = 1;
  let templateName: string | null = null;

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      count = Number(arg);
    } else if (getTemplateByName(arg)) {
      templateName = arg;
    }
  }

  return {
    count: count || Number(process.env.IMAGE_COUNT ?? "1"),
    templateName,
  };
};

const { count: IMAGE_COUNT, templateName: TEMPLATE_NAME } = parseArgs();

type ProcessResult = {
  index: number;
  success: boolean;
  outputPaths?: string[];
  error?: string;
};

const parseImagenPrompt = (
  rawPrompt: string
): { prompt: string; aspectRatio?: ImagenAspectRatio } => {
  let prompt = rawPrompt;
  let aspectRatio: ImagenAspectRatio | undefined;

  const arMatch = prompt.match(/--ar\s*([0-9]+:[0-9]+)/i);
  if (arMatch) {
    const candidate = arMatch[1] as ImagenAspectRatio;
    if (
      candidate === "1:1" ||
      candidate === "3:4" ||
      candidate === "4:3" ||
      candidate === "9:16" ||
      candidate === "16:9"
    ) {
      aspectRatio = candidate;
    }
    prompt = prompt.replace(arMatch[0], "").replace(/\s{2,}/g, " ").trim();
  }

  return {
    prompt,
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getPrompt = (): string => {
  if (TEMPLATE_NAME) {
    const template = getTemplateByName(TEMPLATE_NAME);
    if (template) {
      return template;
    }
  }

  const promptFromFile = readPromptFile();
  if (promptFromFile !== null) {
    return promptFromFile;
  }

  console.log(`사용 가능한 템플릿: ${getAvailableTemplates().join(", ")}`);
  throw new Error("프롬프트가 필요해. 템플릿명(3side, mbag) 또는 _prompt.txt 사용");
};

const generateImages = async (
  promptTemplate: string,
  batchIndex: number,
  batchSize: number
): Promise<ProcessResult> => {
  const rawPrompt = fillPromptVariables(promptTemplate);
  const parsed = parseImagenPrompt(rawPrompt);
  const prompt = parsed.prompt;
  const aspectRatio = ASPECT_RATIO ?? parsed.aspectRatio;

  console.log(`  → prompt:\n${prompt}\n`);

  try {
    const results = await requestImagenGeneration({
      ai,
      model: IMAGEN_MODEL,
      prompt,
      numberOfImages: batchSize,
      aspectRatio,
      imageSize: IMAGE_SIZE,
    });

    const outputPaths: string[] = [];

    for (const result of results) {
      const outputPath = saveBase64Image({
        base64: result.base64,
        mimeType: result.mimeType,
        category: CATEGORY_TYPE,
        template: TEMPLATE_NAME ?? "imagen",
      });
      outputPaths.push(outputPath);
    }

    return { index: batchIndex, success: true, outputPaths };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { index: batchIndex, success: false, error: errorMsg };
  }
};

const main = async (): Promise<void> => {
  let prompt: string;
  try {
    prompt = getPrompt();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const batches = Math.ceil(IMAGE_COUNT / 4);
  const totalImages = IMAGE_COUNT;

  console.log(`\n=== Imagen 4 이미지 생성 ===`);
  console.log(`모델: ${IMAGEN_MODEL}`);
  console.log(`예시 모델: ${KNOWN_IMAGEN_MODELS.join(", ")}`);
  console.log(`카테고리: ${CATEGORY_TYPE}`);
  if (ASPECT_RATIO) {
    console.log(`이미지 비율: ${ASPECT_RATIO}`);
  }
  if (IMAGE_SIZE) {
    console.log(`이미지 크기: ${IMAGE_SIZE}`);
  }
  console.log(`생성 수: ${totalImages} (${batches} 배치)`);
  if (TEMPLATE_NAME) {
    console.log(`템플릿: ${TEMPLATE_NAME}`);
  }
  console.log(`프롬프트: ${prompt.substring(0, 80)}...`);
  console.log(`딜레이: ${DELAY_MS}ms`);
  console.log(`========================\n`);

  let successCount = 0;
  let failCount = 0;
  let remaining = totalImages;

  for (let batch = 1; batch <= batches; batch++) {
    const batchSize = Math.min(4, remaining);
    console.log(`[배치 ${batch}/${batches}] ${batchSize}장 생성 중...`);

    const result = await generateImages(prompt, batch, batchSize);

    if (result.success && result.outputPaths) {
      for (const path of result.outputPaths) {
        console.log(`  ✓ ${path}`);
      }
      successCount += result.outputPaths.length;
    } else {
      console.log(`  ✗ ${result.error}`);
      failCount += batchSize;
    }

    remaining -= batchSize;

    if (batch < batches && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${successCount}/${totalImages}`);
  console.log(`실패: ${failCount}/${totalImages}`);
};

main();
