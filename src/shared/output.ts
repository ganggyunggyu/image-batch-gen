import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export const OUTPUT_DIR = './output';

const OUTPUT_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

export const getOutputImageExtension = (mimeType: string): string =>
  OUTPUT_EXTENSION_BY_MIME[mimeType] ?? '.png';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

const existsWithAnyExtension = (basePath: string): boolean =>
  IMAGE_EXTENSIONS.some((ext) => existsSync(`${basePath}${ext}`));

const getNextNumber = (folderPath: string): number => {
  let counter = 1;
  while (existsWithAnyExtension(join(folderPath, String(counter)))) {
    counter++;
  }
  return counter;
};

export const saveBase64Image = ({
  base64,
  mimeType,
  category,
  template,
}: {
  base64: string;
  mimeType: string;
  category: string;
  template: string;
}): string => {
  const ext = getOutputImageExtension(mimeType);
  const folderPath = join(OUTPUT_DIR, category, template);

  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }

  const nextNumber = getNextNumber(folderPath);
  const outputPath = join(folderPath, `${nextNumber}${ext}`);
  writeFileSync(outputPath, Buffer.from(base64, 'base64'));
  return outputPath;
};
