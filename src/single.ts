/**
 * input 폴더의 모든 이미지를 순차 처리
 * Gemini 이미지 생성(응답 모달리티 IMAGE) 순차 처리
 */

import { GoogleGenAI } from "@google/genai";
// import { readFileSync } from "fs";
// import { basename } from "path";
import "dotenv/config";

import { requireApiKey } from "./shared/env";
import {
  // buildPromptWithItem,
  // getInputImagePaths,
  // getItemName,
  // getMimeType,
  readPromptFile,
} from "./shared/input";
import { saveBase64Image } from "./shared/output";
import {
  DEFAULT_IMAGE_MODEL,
  KNOWN_IMAGE_MODELS,
  requestImageGeneration,
  removeWatermark,
} from "./shared/google";
import {
  fillPromptVariables,
  getTemplateByName,
  getAvailableTemplates,
  CATEGORY_TYPE,
} from "./shared/prompt-variables";

const ai = new GoogleGenAI({ apiKey: requireApiKey() });

const IMAGE_MODEL = process.env.IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
const ASPECT_RATIO = process.env.IMAGE_ASPECT_RATIO;
const DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? "5000");
const REMOVE_WATERMARK = process.env.REMOVE_WATERMARK === "true";

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
  outputPath?: string;
  error?: string;
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
  throw new Error("프롬프트가 필요해. 템플릿명(mask, pouch) 또는 _prompt.txt 사용");
};

const generateImage = async (
  promptTemplate: string,
  index: number
): Promise<ProcessResult> => {
  const prompt = fillPromptVariables(promptTemplate);

  console.log(`  → prompt:\n${prompt}\n`);

  try {
    let generated = await requestImageGeneration({
      ai,
      model: IMAGE_MODEL,
      prompt,
      aspectRatio: ASPECT_RATIO,
    });

    if (REMOVE_WATERMARK) {
      console.log(`  → 워터마크 제거 중...`);
      generated = await removeWatermark({
        ai,
        model: IMAGE_MODEL,
        base64Image: generated.base64,
        mimeType: generated.mimeType,
      });
    }

    const outputPath = saveBase64Image({
      base64: generated.base64,
      mimeType: generated.mimeType,
      category: CATEGORY_TYPE,
      template: TEMPLATE_NAME ?? "generated",
    });

    return { index, success: true, outputPath };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    return { index, success: false, error: errorMsg };
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

  console.log(`\n=== 이미지 생성 ===`);
  console.log(`모델: ${IMAGE_MODEL}`);
  console.log(`예시 모델: ${KNOWN_IMAGE_MODELS.join(", ")}`);
  console.log(`카테고리: ${CATEGORY_TYPE}`);
  console.log(`워터마크 제거: ${REMOVE_WATERMARK ? "ON" : "OFF"}`);
  if (ASPECT_RATIO) {
    console.log(`이미지 비율: ${ASPECT_RATIO}`);
  }
  console.log(`생성 수: ${IMAGE_COUNT}`);
  if (TEMPLATE_NAME) {
    console.log(`템플릿: ${TEMPLATE_NAME}`);
  }
  console.log(`프롬프트: ${prompt.substring(0, 80)}...`);
  console.log(`딜레이: ${DELAY_MS}ms`);
  console.log(`========================\n`);

  const results: ProcessResult[] = [];

  for (let i = 1; i <= IMAGE_COUNT; i++) {
    console.log(`[${i}/${IMAGE_COUNT}] 생성 중...`);

    const result = await generateImage(prompt, i);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ ${result.outputPath}`);
    } else {
      console.log(`  ✗ ${result.error}`);
    }

    if (i < IMAGE_COUNT && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${succeeded}/${results.length}`);
  console.log(`실패: ${failed}/${results.length}`);
};

main();
