import { writeFileSync } from "fs";
import { join } from "path";

export const OUTPUT_DIR = "./output";

const OUTPUT_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export function getOutputImageExtension(mimeType: string): string {
  return OUTPUT_EXTENSION_BY_MIME[mimeType] ?? ".png";
}

export function saveBase64Image({
  base64,
  mimeType,
  prefix,
}: {
  base64: string;
  mimeType: string;
  prefix: string;
}): string {
  const ext = getOutputImageExtension(mimeType);
  const outputPath = join(OUTPUT_DIR, `${prefix}_${Date.now()}${ext}`);
  writeFileSync(outputPath, Buffer.from(base64, "base64"));
  return outputPath;
}
