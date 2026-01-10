/**
 * input 폴더의 모든 이미지를 순차 처리
 * Gemini 이미지 생성(응답 모달리티 IMAGE) 순차 처리
 */

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { basename } from "path";
import "dotenv/config";

import { requireApiKey } from "./shared/env";
import {
  buildPromptWithItem,
  getInputImagePaths,
  getItemName,
  getMimeType,
  readPromptFile,
} from "./shared/input";
import { saveBase64Image } from "./shared/output";
import {
  DEFAULT_IMAGE_MODEL,
  KNOWN_IMAGE_MODELS,
  requestImageGeneration,
} from "./shared/google";

const ai = new GoogleGenAI({ apiKey: requireApiKey() });

const IMAGE_MODEL = process.env.IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
const ASPECT_RATIO = process.env.IMAGE_ASPECT_RATIO;
const DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? "5000");

type ProcessResult = {
  imagePath: string;
  success: boolean;
  outputPath?: string;
  error?: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getPrompt = (): string => {
  const promptFromFile = readPromptFile();
  if (promptFromFile !== null) {
    return promptFromFile;
  }

  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args.join(" ");
  }

  throw new Error("프롬프트가 필요해. _prompt.txt 또는 인자로 전달해줘");
};

const generateImage = async (
  imagePath: string,
  promptTemplate: string
): Promise<ProcessResult> => {
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = getMimeType(imagePath);
  const fileName = basename(imagePath);
  const itemName = getItemName(fileName);
  const prompt = buildPromptWithItem(promptTemplate, itemName);

  console.log(`  → item: "${itemName}"`);
  console.log(`  → prompt:\n${prompt}\n`);

  try {
    const generated = await requestImageGeneration({
      ai,
      model: IMAGE_MODEL,
      prompt,
      base64Image,
      mimeType,
      aspectRatio: ASPECT_RATIO,
    });

    const outputPath = saveBase64Image({
      base64: generated.base64,
      mimeType: generated.mimeType,
      fileName,
    });

    return { imagePath, success: true, outputPath };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    return { imagePath, success: false, error: errorMsg };
  }
};

const main = async (): Promise<void> => {
  const imagePaths = getInputImagePaths();

  if (imagePaths.length === 0) {
    console.error("input 폴더에 이미지가 없어");
    process.exit(1);
  }

  let prompt: string;
  try {
    prompt = getPrompt();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`\n=== 순차 이미지 처리 ===`);
  console.log(`모델: ${IMAGE_MODEL}`);
  console.log(`예시 모델: ${KNOWN_IMAGE_MODELS.join(", ")}`);
  if (ASPECT_RATIO) {
    console.log(`이미지 비율: ${ASPECT_RATIO}`);
  }
  console.log(`이미지 수: ${imagePaths.length}`);
  console.log(`프롬프트 템플릿: ${prompt}`);
  console.log(`딜레이: ${DELAY_MS}ms`);
  console.log(`========================\n`);

  const results: ProcessResult[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    console.log(`[${i + 1}/${imagePaths.length}] ${basename(imagePath)}`);

    const result = await generateImage(imagePath, prompt);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ ${result.outputPath}`);
    } else {
      console.log(`  ✗ ${result.error}`);
    }

    if (i < imagePaths.length - 1 && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${succeeded}/${results.length}`);
  console.log(`실패: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log(`\n실패 목록:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${basename(r.imagePath)}: ${r.error}`));
  }
};

main();
