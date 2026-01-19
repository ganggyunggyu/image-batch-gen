/**
 * Gemini 이미지 생성(응답 모달리티 IMAGE) 멀티 처리
 * JSONL Batch API 대신 동시 처리 큐 사용
 */

import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "fs";
import { join } from "path";
import "dotenv/config";

import { requireApiKey } from "./shared/env";
import {
  buildPromptWithItem,
  getItemName,
  loadImagesFromInput,
  readPromptFile,
  type ImageFile,
} from "./shared/input";
import { OUTPUT_DIR, saveBase64Image } from "./shared/output";
import {
  DEFAULT_IMAGE_MODEL,
  KNOWN_IMAGE_MODELS,
  requestImageGeneration,
} from "./shared/google";

const ai = new GoogleGenAI({ apiKey: requireApiKey() });

const IMAGE_MODEL = process.env.IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
const ASPECT_RATIO = process.env.IMAGE_ASPECT_RATIO;
const CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.IMAGE_BATCH_CONCURRENCY ?? "3", 10)
);
const REQUEST_DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? "0");

type ProcessResult = {
  key: string;
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

const processImage = async (
  image: ImageFile,
  promptTemplate: string
): Promise<ProcessResult> => {
  const itemName = getItemName(image.name);
  const prompt = buildPromptWithItem(promptTemplate, itemName);

  console.log(`  → item: "${itemName}"`);

  try {
    const generated = await requestImageGeneration({
      ai,
      model: IMAGE_MODEL,
      prompt,
      base64Image: image.base64,
      mimeType: image.mimeType,
      aspectRatio: ASPECT_RATIO,
    });

    const outputPath = saveBase64Image({
      base64: generated.base64,
      mimeType: generated.mimeType,
      category: "batch",
      template: image.name.replace(/\.[^.]+$/, ""),
    });

    return { key: image.name, success: true, outputPath };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { key: image.name, success: false, error: errorMsg };
  }
};

const runQueue = async (
  images: ImageFile[],
  promptTemplate: string
): Promise<ProcessResult[]> => {
  const results: ProcessResult[] = Array(images.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < images.length) {
      const currentIndex = cursor;
      cursor += 1;
      const image = images[currentIndex];

      console.log(
        `[${currentIndex + 1}/${images.length}] ${image.name} 처리 중...`
      );

      results[currentIndex] = await processImage(image, promptTemplate);

      if (results[currentIndex].success) {
        console.log(`  ✓ ${results[currentIndex].outputPath}`);
      } else {
        console.log(`  ✗ ${results[currentIndex].error}`);
      }

      if (REQUEST_DELAY_MS > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, images.length) });
  await Promise.all(workers.map(() => worker()));

  return results;
};

const main = async (): Promise<void> => {
  const images = loadImagesFromInput();

  if (images.length === 0) {
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

  console.log(`\n=== Gemini 이미지 멀티 처리 ===`);
  console.log(`모델: ${IMAGE_MODEL}`);
  console.log(`예시 모델: ${KNOWN_IMAGE_MODELS.join(", ")}`);
  if (ASPECT_RATIO) {
    console.log(`이미지 비율: ${ASPECT_RATIO}`);
  }
  console.log(`동시 처리: ${CONCURRENCY}`);
  if (REQUEST_DELAY_MS > 0) {
    console.log(`요청 딜레이: ${REQUEST_DELAY_MS}ms`);
  }
  console.log(`이미지 수: ${images.length}`);
  console.log(`프롬프트 템플릿: ${prompt}`);
  console.log(`=======================\n`);

  const results = await runQueue(images, prompt);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${succeeded}/${results.length}`);
  console.log(`실패: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log(`\n실패 목록:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.key}: ${r.error}`));
  }

  const reportPath = join(OUTPUT_DIR, `batch_report_${Date.now()}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        model: IMAGE_MODEL,
        prompt,
        imageCount: images.length,
        results,
      },
      null,
      2
    )
  );
  console.log(`리포트: ${reportPath}`);
};

main();
