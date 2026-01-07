import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import "dotenv/config";

import { requireApiKey } from "./shared/env";
import {
  getFirstInputImagePath,
  getMimeType,
  readPromptFile,
} from "./shared/input";
import { saveBase64Image } from "./shared/output";

const genAI = new GoogleGenerativeAI(requireApiKey());

const OUTPUT_PREFIX = "output";

type ResponsePart = {
  inlineData?: {
    data: string;
    mimeType: string;
  };
  text?: string;
};

function createModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      // @ts-expect-error - responseModalities는 아직 타입 정의에 없음
      responseModalities: ["image", "text"],
    },
  });
}

function processResponseParts(parts: ResponsePart[]): number {
  let savedCount = 0;

  for (const part of parts) {
    if (part.inlineData) {
      const { data, mimeType: responseMimeType } = part.inlineData;
      const outputPath = saveBase64Image({
        base64: data,
        mimeType: responseMimeType,
        prefix: OUTPUT_PREFIX,
      });
      console.log(`\n이미지 저장됨: ${outputPath}`);
      savedCount++;
    } else if (part.text) {
      console.log(`\n응답 텍스트: ${part.text}`);
    }
  }

  return savedCount;
}

async function generateImage(imagePath: string, prompt: string): Promise<void> {
  console.log(`\n입력 이미지: ${imagePath}`);
  console.log(`프롬프트: ${prompt}`);

  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = getMimeType(imagePath);

  const model = createModel();

  try {
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
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as ResponsePart[];
    const savedCount = processResponseParts(parts);

    if (savedCount === 0) {
      console.log("\n이미지가 생성되지 않았어. 응답을 확인해봐.");
      console.log(JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error("에러 발생:", error);
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let imagePath: string | null = null;
  let prompt = "";

  if (args.length >= 2) {
    const [imageArg, ...promptParts] = args;
    imagePath = imageArg ?? null;
    prompt = promptParts.join(" ");
  } else if (args.length === 1) {
    const [promptArg] = args;
    imagePath = getFirstInputImagePath();
    prompt = promptArg ?? "";
  } else {
    imagePath = getFirstInputImagePath();
    let promptFromFile: string | null = null;
    try {
      promptFromFile = readPromptFile();
    } catch {
      promptFromFile = null;
    }

    if (promptFromFile === null) {
      console.error("사용법:");
      console.error("  npm run single <프롬프트>");
      console.error("  npm run single <이미지경로> <프롬프트>");
      console.error("  또는 input/prompt.txt 파일에 프롬프트 작성");
      process.exit(1);
    }

    prompt = promptFromFile;
  }

  if (!imagePath) {
    console.error("input 폴더에 이미지가 없어");
    process.exit(1);
  }

  if (!prompt) {
    console.error("프롬프트가 필요해");
    process.exit(1);
  }

  await generateImage(imagePath, prompt);
}

main();
