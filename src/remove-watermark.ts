/**
 * 기존 이미지에서 워터마크 제거
 */

import { GoogleGenAI } from "@google/genai";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, basename, extname } from "path";
import "dotenv/config";
import { requireApiKey } from "./shared/env";
import { DEFAULT_IMAGE_MODEL, removeWatermark } from "./shared/google";
import { getOutputImageExtension } from "./shared/output";

const ai = new GoogleGenAI({ apiKey: requireApiKey() });
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
const INPUT_DIR = "./input";
const OUTPUT_DIR = "./output/watermark-removed";
const DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? "3000");

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return mimeTypes[ext] ?? "image/png";
};

const getImageFiles = (): string[] => {
  const files = readdirSync(INPUT_DIR);
  return files
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .map((f) => join(INPUT_DIR, f));
};

const main = async (): Promise<void> => {
  const imageFiles = getImageFiles();

  if (imageFiles.length === 0) {
    console.log("_images 폴더에 이미지가 없어");
    return;
  }

  console.log(`\n=== 워터마크 제거 ===`);
  console.log(`모델: ${IMAGE_MODEL}`);
  console.log(`이미지 수: ${imageFiles.length}`);
  console.log(`========================\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const fileName = basename(filePath);

    console.log(`[${i + 1}/${imageFiles.length}] ${fileName}`);

    try {
      const base64Image = readFileSync(filePath).toString("base64");
      const mimeType = getMimeType(filePath);

      console.log(`  → 워터마크 제거 중...`);

      const result = await removeWatermark({
        ai,
        model: IMAGE_MODEL,
        base64Image,
        mimeType,
      });

      if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      const ext = getOutputImageExtension(result.mimeType);
      const outputFileName = fileName.replace(/\.[^.]+$/, "") + ext;
      const outputPath = join(OUTPUT_DIR, outputFileName);
      writeFileSync(outputPath, Buffer.from(result.base64, "base64"));

      console.log(`  ✓ ${outputPath}`);
      success++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ ${errorMsg}`);
      failed++;
    }

    if (i < imageFiles.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${success}/${imageFiles.length}`);
  console.log(`실패: ${failed}/${imageFiles.length}`);
};

main();
