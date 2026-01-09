/**
 * input 폴더의 모든 이미지를 순차 처리
 * 실시간 API 사용 (rate limit 주의)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { basename } from 'path';
import 'dotenv/config';

import { requireApiKey } from './shared/env';
import {
  getInputImagePaths,
  getMimeType,
  readPromptFile,
  getItemName,
  buildPromptWithItem,
} from './shared/input';
import { saveBase64Image } from './shared/output';

const genAI = new GoogleGenerativeAI(requireApiKey());

const DELAY_MS = 5000;

type ResponsePart = {
  inlineData?: {
    data: string;
    mimeType: string;
  };
  text?: string;
};

type ProcessResult = {
  imagePath: string;
  success: boolean;
  outputPath?: string;
  error?: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const createModel = () =>
  genAI.getGenerativeModel({
    // model: 'gemini-3-pro-image-preview',
    model: 'gemini-2.5-flash-image',
    // model: 'gemini-2.0-flash-exp-image-generation',
    generationConfig: {
      // @ts-expect-error - responseModalities는 아직 타입 정의에 없음
      responseModalities: ['image', 'text'],
    },
  });

const generateImage = async (
  imagePath: string,
  promptTemplate: string
): Promise<ProcessResult> => {
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);
  const fileName = basename(imagePath);
  const itemName = getItemName(fileName);
  const prompt = buildPromptWithItem(promptTemplate, itemName);

  console.log(`  → item: "${itemName}"`);
  console.log(`  → prompt:\n${prompt}\n`);

  const model = createModel();

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
    prompt,
  ]);

  const response = result.response;
  const parts = (response.candidates?.[0]?.content?.parts ??
    []) as ResponsePart[];

  for (const part of parts) {
    if (part.inlineData) {
      const { data, mimeType: responseMimeType } = part.inlineData;
      const outputPath = saveBase64Image({
        base64: data,
        mimeType: responseMimeType,
        fileName: basename(imagePath),
      });
      return { imagePath, success: true, outputPath };
    }
  }

  return { imagePath, success: false, error: '이미지 생성 안 됨' };
};

const getPrompt = (): string => {
  const promptFromFile = readPromptFile();
  if (promptFromFile !== null) {
    return promptFromFile;
  }

  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args.join(' ');
  }

  throw new Error('프롬프트가 필요해. input/prompt.txt 또는 인자로 전달해줘');
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

  console.log(`\n=== 순차 이미지 처리 ===`);
  console.log(`이미지 수: ${imagePaths.length}`);
  console.log(`프롬프트 템플릿: ${prompt}`);
  console.log(`딜레이: ${DELAY_MS}ms`);
  console.log(`========================\n`);

  const results: ProcessResult[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    console.log(`[${i + 1}/${imagePaths.length}] ${basename(imagePath)}`);

    try {
      const result = await generateImage(imagePath, prompt);
      results.push(result);

      if (result.success) {
        console.log(`  ✓ ${result.outputPath}`);
      } else {
        console.log(`  ✗ ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({ imagePath, success: false, error: errorMsg });
      console.log(`  ✗ 에러: ${errorMsg}`);
    }

    if (i < imagePaths.length - 1) {
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
