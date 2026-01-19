/**
 * 이미지 하단 워터마크 크롭
 */

import sharp from "sharp";
import { readdirSync, existsSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";

const INPUT_DIR = "./input";
const OUTPUT_DIR = "./output/cropped";
const CROP_TOP = Number(process.env.CROP_TOP ?? "100");
const CROP_BOTTOM = Number(process.env.CROP_BOTTOM ?? "100");

const getImageFiles = (): string[] => {
  const files = readdirSync(INPUT_DIR);
  return files
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .map((f) => join(INPUT_DIR, f));
};

const main = async (): Promise<void> => {
  const imageFiles = getImageFiles();

  if (imageFiles.length === 0) {
    console.log("input 폴더에 이미지가 없어");
    return;
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`\n=== 워터마크 크롭 ===`);
  console.log(`크롭 픽셀: 상단 ${CROP_TOP}px, 하단 ${CROP_BOTTOM}px`);
  console.log(`이미지 수: ${imageFiles.length}`);
  console.log(`========================\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const fileName = basename(filePath);
    const ext = extname(filePath);

    console.log(`[${i + 1}/${imageFiles.length}] ${fileName}`);

    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error("이미지 메타데이터 없음");
      }

      const newHeight = metadata.height - CROP_TOP - CROP_BOTTOM;
      if (newHeight <= 0) {
        throw new Error("크롭 후 높이가 0 이하");
      }

      const outputPath = join(OUTPUT_DIR, fileName.replace(ext, "") + ext);

      await image
        .extract({
          left: 0,
          top: CROP_TOP,
          width: metadata.width,
          height: newHeight,
        })
        .toFile(outputPath);

      console.log(`  ✓ ${outputPath} (${metadata.height} → ${newHeight}px)`);
      success++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ ${errorMsg}`);
      failed++;
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${success}/${imageFiles.length}`);
  console.log(`실패: ${failed}/${imageFiles.length}`);
};

main();
