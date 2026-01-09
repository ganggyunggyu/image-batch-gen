import { writeFileSync } from 'fs';
import { join } from 'path';

export const OUTPUT_DIR = './output';

const OUTPUT_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

export const getOutputImageExtension = (mimeType: string): string =>
  OUTPUT_EXTENSION_BY_MIME[mimeType] ?? '.png';

export const saveBase64Image = ({
  base64,
  mimeType,
  fileName,
}: {
  base64: string;
  mimeType: string;
  fileName: string;
}): string => {
  const ext = getOutputImageExtension(mimeType);
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  const outputPath = join(OUTPUT_DIR, `${nameWithoutExt}${ext}`);
  writeFileSync(outputPath, Buffer.from(base64, 'base64'));
  return outputPath;
};
