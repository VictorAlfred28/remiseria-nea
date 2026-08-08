import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function processImage() {
  const inputPath = 'C:\\Users\\victo\\Desktop\\remiseria-nea-main\\ubi.png';
  const outDir = 'C:\\Users\\victo\\Desktop\\remiseria-nea-main\\frontend\\assets';
  const outputPath = path.join(outDir, 'icon.png');
  const splashPath = path.join(outDir, 'splash.png');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    const size = 1024;
    const padding = 20; // Reduce the circle slightly if needed to avoid edge clipping
    const r = (size - padding * 2) / 2;
    const cx = size / 2;
    const cy = size / 2;
    
    // Create an SVG with a smooth circular mask
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" />
      </svg>`
    );

    // 1. Convert to high-res, apply smooth circular mask
    await sharp(inputPath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .composite([{
        input: mask,
        blend: 'dest-in'
      }])
      .png({ quality: 100 })
      .toFile(outputPath);

    // 2. Generate a splash screen image as well (optional but recommended)
    // Dark background with the icon in the center
    await sharp({
      create: {
        width: 2732,
        height: 2732,
        channels: 4,
        background: { r: 3, g: 7, b: 18, alpha: 1 } // #030712
      }
    })
    .composite([{
      input: outputPath,
      gravity: 'center'
    }])
    .png({ quality: 100 })
    .toFile(splashPath);

    console.log("Images generated successfully in assets folder.");
  } catch (error) {
    console.error("Error processing image:", error);
  }
}

processImage();
