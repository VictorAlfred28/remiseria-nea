/**
 * generate-android-icons.mjs
 * Genera todos los iconos Android (mipmap) y adaptive icons
 * a partir de: frontend/src/assets/login/logoUbi.png
 *
 * Uso: node generate-android-icons.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Ruta de entrada ────────────────────────────────────────────────────────────
const INPUT = path.join(__dirname, 'src', 'assets', 'login', 'logoUbi.png');
// ── Raíz de los mipmap ────────────────────────────────────────────────────────
const RES  = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// ── Tamaños de mipmap estándar Android ───────────────────────────────────────
const MIPMAP_SIZES = [
  { dir: 'mipmap-ldpi',    size: 36  },
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// ── Fondo azul para adaptive icon background ─────────────────────────────────
// Color extraído del logo: #0033cc → rgb(0, 51, 204)
const BRAND_BG = { r: 0, g: 51, b: 204, alpha: 1 };

// ── Crear SVG de fondo azul circular con gradiente ───────────────────────────
function buildBgSvg(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0044dd"/>
      <stop offset="100%" stop-color="#001a99"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
</svg>`);
}

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function generateIcons() {
  if (!fs.existsSync(INPUT)) {
    console.error(`❌ No se encuentra la imagen fuente: ${INPUT}`);
    process.exit(1);
  }

  console.log('📱 Generando iconos Android desde:', INPUT);
  console.log('');

  // ── 1. Generar ic_launcher.png (icono legado cuadrado) ─────────────────────
  for (const { dir, size } of MIPMAP_SIZES) {
    const outDir = path.join(RES, dir);
    await ensureDir(outDir);
    const outFile = path.join(outDir, 'ic_launcher.png');

    // Fondo sólido azul + logo centrado con padding
    const padding = Math.round(size * 0.12);
    const logoSize = size - padding * 2;

    const logoBuf = await sharp(INPUT)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 51, b: 204, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp(buildBgSvg(size))
      .composite([{ input: logoBuf, gravity: 'center' }])
      .png({ quality: 100 })
      .toFile(outFile);

    console.log(`  ✅ ic_launcher.png  → ${dir} (${size}x${size})`);
  }

  // ── 2. Generar ic_launcher_round.png (mismo diseño circular) ───────────────
  for (const { dir, size } of MIPMAP_SIZES) {
    const outDir = path.join(RES, dir);
    const outFile = path.join(outDir, 'ic_launcher_round.png');

    // Máscara circular
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
      </svg>`
    );

    const padding = Math.round(size * 0.12);
    const logoSize = size - padding * 2;

    const logoBuf = await sharp(INPUT)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Construir: fondo gradiente + logo compuesto, luego aplicar máscara circular
    const composite = await sharp(buildBgSvg(size))
      .composite([{ input: logoBuf, gravity: 'center' }])
      .png()
      .toBuffer();

    await sharp(composite)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png({ quality: 100 })
      .toFile(outFile);

    console.log(`  ✅ ic_launcher_round.png → ${dir} (${size}x${size})`);
  }

  // ── 3. Generar ic_launcher_foreground.png (solo logo, fondo transparente) ──
  //       Para el adaptive icon foreground (1024px maestro, escalamos a cada mipmap)
  for (const { dir, size } of MIPMAP_SIZES) {
    const outDir = path.join(RES, dir);
    const outFile = path.join(outDir, 'ic_launcher_foreground.png');

    // El foreground es el 108dp = size x (108/72) para dejar zona segura
    const fullSize = Math.round(size * 108 / 72);
    const padding = Math.round(fullSize * 0.18);
    const logoSize = fullSize - padding * 2;

    const logoBuf = await sharp(INPUT)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Fondo completamente transparente (el adaptive icon pondrá el background por separado)
    await sharp({
      create: { width: fullSize, height: fullSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: logoBuf, gravity: 'center' }])
      .png({ quality: 100 })
      .toFile(outFile);

    console.log(`  ✅ ic_launcher_foreground.png → ${dir} (${fullSize}x${fullSize})`);
  }

  // ── 4. Generar ic_launcher_background.png (fondo azul sólido) ──────────────
  for (const { dir, size } of MIPMAP_SIZES) {
    const outDir = path.join(RES, dir);
    const outFile = path.join(outDir, 'ic_launcher_background.png');

    // El background es 108dp también
    const fullSize = Math.round(size * 108 / 72);

    await sharp(buildBgSvg(fullSize))
      .png({ quality: 100 })
      .toFile(outFile);

    console.log(`  ✅ ic_launcher_background.png → ${dir} (${fullSize}x${fullSize})`);
  }

  // ── 5. Actualizar ic_launcher_background.xml (color XML en values) ─────────
  const bgXmlPath = path.join(RES, 'values', 'ic_launcher_background.xml');
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0033CC</color>
</resources>
`;
  fs.writeFileSync(bgXmlPath, bgXml, 'utf8');
  console.log('  ✅ ic_launcher_background.xml actualizado (#0033CC)');

  // ── 6. Actualizar adaptive icon XML (anydpi-v26) ───────────────────────────
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="0%"/>
    </foreground>
</adaptive-icon>
`;
  const anydpiDir = path.join(RES, 'mipmap-anydpi-v26');
  await ensureDir(anydpiDir);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');
  console.log('  ✅ mipmap-anydpi-v26/ic_launcher.xml actualizado');
  console.log('  ✅ mipmap-anydpi-v26/ic_launcher_round.xml actualizado');

  // ── 7. Generar icono maestro 1024px (para stores / Capacitor assets) ────────
  const assetsDir = path.join(__dirname, 'assets');
  await ensureDir(assetsDir);

  const iconOut = path.join(assetsDir, 'icon.png');
  const padding1024 = 80;
  const logoSize1024 = 1024 - padding1024 * 2;

  const logoBuf1024 = await sharp(INPUT)
    .resize(logoSize1024, logoSize1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(buildBgSvg(1024))
    .composite([{ input: logoBuf1024, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(iconOut);

  console.log('  ✅ assets/icon.png → 1024x1024 (maestro)');

  // ── 8. Splash screen 2732px ────────────────────────────────────────────────
  const splashOut = path.join(assetsDir, 'splash.png');
  const splashLogoSize = 400;

  const logoBufSplash = await sharp(INPUT)
    .resize(splashLogoSize, splashLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: { r: 0, g: 30, b: 100, alpha: 1 } }
  })
    .composite([{ input: logoBufSplash, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(splashOut);

  console.log('  ✅ assets/splash.png → 2732x2732 (splash screen)');

  console.log('');
  console.log('🎉 ¡Todos los iconos generados exitosamente!');
  console.log('   Siguiente paso: npx cap sync android');
}

generateIcons().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
