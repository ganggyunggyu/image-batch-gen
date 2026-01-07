import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, extname, join } from "path";

export const INPUT_DIR = "./input";
const PROMPT_FILENAME = "prompt.txt";

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export interface ImageFile {
  path: string;
  name: string;
  base64: string;
  mimeType: string;
}

export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/png";
}

export function getInputImagePaths(): string[] {
  return readdirSync(INPUT_DIR)
    .filter((file) => IMAGE_EXTENSIONS.includes(extname(file).toLowerCase()))
    .map((file) => join(INPUT_DIR, file));
}

export function getFirstInputImagePath(): string | null {
  const [first] = getInputImagePaths();
  return first ?? null;
}

export function loadImagesFromInput(): ImageFile[] {
  return getInputImagePaths().map((filePath) => {
    const buffer = readFileSync(filePath);
    return {
      path: filePath,
      name: basename(filePath),
      base64: buffer.toString("base64"),
      mimeType: getMimeType(filePath),
    };
  });
}

export function readPromptFile(): string | null {
  const promptPath = join(INPUT_DIR, PROMPT_FILENAME);
  if (!existsSync(promptPath)) {
    return null;
  }

  return readFileSync(promptPath, "utf-8").trim();
}
