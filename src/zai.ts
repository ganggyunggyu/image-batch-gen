/**
 * Z.AI GLM-Image 이미지 생성
 * input 폴더의 이미지 파일명을 기반으로 프롬프트 생성 후 이미지 생성
 */

import { basename } from 'path';
import 'dotenv/config';

import {
  buildPromptWithItem,
  getInputImagePaths,
  getItemName,
  readPromptFile,
} from './shared/input';
import { saveBase64Image } from './shared/output';
import {
  DEFAULT_ZAI_MODEL,
  DEFAULT_ZAI_SIZE,
  KNOWN_ZAI_SIZES,
  downloadImage,
  requestZaiImageGeneration,
  requireZaiApiKey,
} from './shared/zai';

const apiKey = requireZaiApiKey();

const ZAI_MODEL = process.env.ZAI_MODEL ?? DEFAULT_ZAI_MODEL;
const ZAI_SIZE = process.env.ZAI_SIZE ?? DEFAULT_ZAI_SIZE;
const DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? '3000');

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
    return args.join(' ');
  }

  throw new Error('프롬프트가 필요해. _prompt.txt 또는 인자로 전달해줘');
};

const generateImage = async (
  imagePath: string,
  promptTemplate: string
): Promise<ProcessResult> => {
  const fileName = basename(imagePath);
  const itemName = getItemName(fileName);
  const prompt = buildPromptWithItem(promptTemplate, itemName);

  console.log(`  → item: "${itemName}"`);
  console.log(`  → prompt:\n${prompt}\n`);

  try {
    const imageUrl = await requestZaiImageGeneration({
      apiKey,
      model: ZAI_MODEL,
      prompt,
      size: ZAI_SIZE,
    });

    console.log(`  → 이미지 URL: ${imageUrl}`);

    const { base64, mimeType } = await downloadImage(imageUrl);

    const outputPath = saveBase64Image({
      base64,
      mimeType,
      category: "zai",
      template: fileName.replace(/\.[^.]+$/, ""),
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
    console.error('input 폴더에 이미지가 없어');
    process.exit(1);
  }

  let prompt: string;
  try {
    prompt = getPrompt();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`\n=== Z.AI GLM-Image 이미지 생성 ===`);
  console.log(`모델: ${ZAI_MODEL}`);
  console.log(`사이즈: ${ZAI_SIZE}`);
  console.log(`지원 사이즈: ${KNOWN_ZAI_SIZES.join(', ')}`);
  console.log(`이미지 수: ${imagePaths.length}`);
  console.log(`프롬프트 템플릿: ${prompt}`);
  console.log(`딜레이: ${DELAY_MS}ms`);
  console.log(`가격: $0.015/이미지`);
  console.log(`==================================\n`);

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
