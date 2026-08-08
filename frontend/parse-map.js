import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

async function run() {
  const assetsDir = './dist/assets';
  const files = fs.readdirSync(assetsDir);
  const mapFile = files.find(f => f.startsWith('app.') && f.endsWith('.js.map') && !f.includes('legacy'));
  
  if (!mapFile) {
    console.error('No se encontró el sourcemap');
    return;
  }
  
  const mapPath = `${assetsDir}/${mapFile}`;
  console.log(`Leyendo sourcemap: ${mapPath}`);
  
  const rawSourceMap = fs.readFileSync(mapPath, 'utf8');
  const consumer = await new SourceMapConsumer(JSON.parse(rawSourceMap));
  
  // Como no sabemos la columna exacta, vamos a escanear varias columnas de la línea 508
  // para ver qué archivos originales coinciden con esa línea minificada.
  console.log('--- Mapeo para la línea 508 ---');
  const sourcesFound = new Set();
  
  for (let col = 0; col < 5000000; col += 1000) {
    const pos = consumer.originalPositionFor({
      line: 508,
      column: col
    });
    
    if (pos.source) {
      const sourceStr = `${pos.source}:${pos.line}:${pos.column} (${pos.name || '?'})`;
      if (!sourcesFound.has(sourceStr)) {
        sourcesFound.add(sourceStr);
        console.log(`Columna ${col} -> ${sourceStr}`);
      }
    }
  }
  
  if (typeof consumer.destroy === 'function') {
    consumer.destroy();
  }
}

run().catch(console.error);
