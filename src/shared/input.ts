import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, extname, join } from "path";

export const INPUT_DIR = "./input";
const PROMPT_FILE = "./_prompt.txt";

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export interface ImageFile {
  path: string;
  name: string;
  base64: string;
  mimeType: string;
}

export const getMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/png";
};

export const getInputImagePaths = (): string[] =>
  readdirSync(INPUT_DIR)
    .filter((file) => IMAGE_EXTENSIONS.includes(extname(file).toLowerCase()))
    .map((file) => join(INPUT_DIR, file));

export const getFirstInputImagePath = (): string | null => {
  const [first] = getInputImagePaths();
  return first ?? null;
};

export const loadImagesFromInput = (): ImageFile[] =>
  getInputImagePaths().map((filePath) => {
    const buffer = readFileSync(filePath);
    return {
      path: filePath,
      name: basename(filePath),
      base64: buffer.toString("base64"),
      mimeType: getMimeType(filePath),
    };
  });

export const readPromptFile = (): string | null => {
  if (!existsSync(PROMPT_FILE)) {
    return null;
  }

  return readFileSync(PROMPT_FILE, "utf-8").trim();
};

export const getItemName = (fileName: string): string => {
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  return nameWithoutExt.replace(/[-_]/g, " ").trim();
};

export const buildPromptWithItem = (template: string, itemName: string): string =>
  template.replace(/\{item\}/g, itemName);
