/**
 * Gemini 공식 Batch API를 사용한 이미지 일괄 처리
 * JSONL 파일 업로드 방식
 *
 * @see https://ai.google.dev/gemini-api/docs/batch-api
 */

import { GoogleGenAI } from "@google/genai";
import { createWriteStream, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import "dotenv/config";

import { requireApiKey } from "./shared/env";
import { loadImagesFromInput, readPromptFile, getItemName, buildPromptWithItem, type ImageFile } from "./shared/input";
import { OUTPUT_DIR, saveBase64Image } from "./shared/output";

const ai = new GoogleGenAI({ apiKey: requireApiKey() });

const POLL_INTERVAL_MS = 5000;
const BATCH_FILE = "./batch-requests.jsonl";

type BatchJob = Awaited<ReturnType<typeof ai.batches.get>>;

type InlineData = {
  data: string;
  mimeType: string;
};

type InlineDataPart = {
  inlineData?: InlineData;
  text?: string;
};

type InlineResponseItem = {
  key?: string;
  response?: {
    candidates?: Array<{
      content?: {
        parts?: InlineDataPart[];
      };
    }>;
  };
};

type ProcessResult = {
  key: string;
  success: boolean;
  outputPath?: string;
  error?: string;
};

type BatchRequest = {
  key: string;
  request: {
    contents: Array<{
      parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      >;
    }>;
    generationConfig: {
      responseModalities: string[];
    };
  };
};

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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const buildBatchRequests = (
  images: ImageFile[],
  promptTemplate: string
): BatchRequest[] =>
  images.map((image, index) => {
    const itemName = getItemName(image.name);
    const prompt = buildPromptWithItem(promptTemplate, itemName);
    return {
      key: `request-${index}-${image.name}`,
      request: {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.base64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      },
    };
  });

const writeBatchFile = (requests: BatchRequest[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const writeStream = createWriteStream(BATCH_FILE, { flags: "w" });

    writeStream.on("error", reject);
    writeStream.on("finish", resolve);

    for (const req of requests) {
      writeStream.write(JSON.stringify(req) + "\n");
    }

    writeStream.end();
  });

const waitForCompletion = async (jobName: string): Promise<BatchJob> => {
  console.log(`\n작업 상태 모니터링 중... (${POLL_INTERVAL_MS / 1000}초 간격)`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await ai.batches.get({ name: jobName });
    const { state } = job;

    console.log(`  상태: ${state}`);

    if (state === "JOB_STATE_SUCCEEDED") {
      return job;
    }

    if (state === "JOB_STATE_FAILED") {
      throw new Error("배치 작업 실패");
    }

    if (state === "JOB_STATE_CANCELLED") {
      throw new Error("배치 작업 취소됨");
    }

    await sleep(POLL_INTERVAL_MS);
  }
};

const getInlineResponses = (job: BatchJob): InlineResponseItem[] => {
  const dest = job.dest as { inlinedResponses?: InlineResponseItem[] } | undefined;
  return dest?.inlinedResponses ?? [];
};

const findFirstInlineData = (parts: InlineDataPart[]): InlineData | null => {
  for (const part of parts) {
    if (part.inlineData) {
      return part.inlineData;
    }
  }
  return null;
};

const extractFileName = (key: string): string => {
  const parts = key.split("-");
  return parts.length >= 3 ? parts.slice(2).join("-") : key;
};

const saveInlineImage = (key: string, inlineData: InlineData): string =>
  saveBase64Image({
    base64: inlineData.data,
    mimeType: inlineData.mimeType,
    fileName: extractFileName(key),
  });

const processResults = async (job: BatchJob): Promise<ProcessResult[]> => {
  console.log("\n결과 처리 중...");

  const results: ProcessResult[] = [];
  const inlinedResponses = getInlineResponses(job);

  for (const item of inlinedResponses) {
    const key = item.key || "unknown";

    try {
      const parts = item.response?.candidates?.[0]?.content?.parts ?? [];
      const inlineData = findFirstInlineData(parts);

      if (inlineData) {
        const outputPath = saveInlineImage(key, inlineData);
        results.push({ key, success: true, outputPath });
        console.log(`  ✓ ${key} → ${outputPath}`);
      } else {
        results.push({ key, success: false, error: "이미지 없음" });
        console.log(`  ✗ ${key}: 이미지가 생성되지 않음`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({ key, success: false, error: errorMsg });
      console.log(`  ✗ ${key}: ${errorMsg}`);
    }
  }

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

  console.log(`\n=== Gemini Batch API (JSONL) ===`);
  console.log(`이미지 수: ${images.length}`);
  console.log(`프롬프트 템플릿: ${prompt}`);
  console.log(`================================\n`);

  const batchRequests = buildBatchRequests(images, prompt);

  console.log("JSONL 파일 생성 중...");
  await writeBatchFile(batchRequests);
  console.log(`  → ${BATCH_FILE}`);

  console.log("파일 업로드 중...");
  const uploadedFile = await ai.files.upload({
    file: BATCH_FILE,
    config: { mimeType: "application/jsonl" },
  });
  console.log(`  → ${uploadedFile.name}`);

  console.log("배치 작업 생성 중...");
  if (!uploadedFile.name) {
    throw new Error("파일 업로드 실패: name이 없음");
  }

  const batchJob = await ai.batches.create({
    model: "gemini-2.0-flash-001",
    src: uploadedFile.name,
    config: {
      displayName: `image-batch-${Date.now()}`,
    },
  });

  console.log(`작업 생성됨: ${batchJob.name}`);

  const completedJob = await waitForCompletion(batchJob.name!);
  const results = await processResults(completedJob);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${succeeded}/${results.length}`);
  console.log(`실패: ${failed}/${results.length}`);

  const reportPath = join(OUTPUT_DIR, `batch_report_${Date.now()}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        jobName: batchJob.name,
        prompt,
        imageCount: images.length,
        results,
      },
      null,
      2
    )
  );
  console.log(`리포트: ${reportPath}`);

  // 임시 파일 정리
  try {
    unlinkSync(BATCH_FILE);
  } catch {
    // 파일 삭제 실패해도 무시
  }
};

main();
