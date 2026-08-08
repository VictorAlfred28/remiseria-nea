import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';

type UploadCategory = 'avatar' | 'product' | 'banner' | 'general';

interface CompressionResult {
  file: File;
  originalSizeMB: number;
  newSizeMB: number;
}

export const optimizeUpload = async (
  file: File,
  category: UploadCategory = 'general'
): Promise<CompressionResult> => {
  const originalSizeMB = file.size / 1024 / 1024;
  let currentFile = file;

  // 1. Manejo de PDF
  if (file.type === 'application/pdf') {
    if (originalSizeMB > 5) {
      throw new Error(`El PDF excede el límite de 5MB. Tamaño actual: ${originalSizeMB.toFixed(2)}MB`);
    }
    return { file, originalSizeMB, newSizeMB: originalSizeMB };
  }

  // 2. Validación de otros formatos (Evitar ejecutables, videos pesados si no están soportados)
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowedMimes.includes(file.type.toLowerCase())) {
    throw new Error(`Formato no soportado: ${file.type}. Solo se aceptan imágenes JPG, PNG, WEBP, HEIC o documentos PDF.`);
  }

  // 3. Soporte para HEIC (Apple)
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8,
      });
      const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      currentFile = new File([blobToUse], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (e) {
      console.error('Error convirtiendo HEIC:', e);
      throw new Error('Hubo un problema al procesar la imagen HEIC de iPhone. Intenta con JPG.');
    }
  }

  // 4. Configurar límites según categoría
  let maxSizeMB = 2; // Absolute
  if (category === 'avatar') maxSizeMB = 0.5;
  if (category === 'product') maxSizeMB = 1.0;
  if (category === 'banner') maxSizeMB = 1.5;

  // 5. Configurar conversión y compresión
  // Si es PNG transparente, lo ideal es intentar mantenerlo PNG comprimido, pero si falla webp soporta alfa.
  // Sin embargo, browser-image-compression puede perder transparencia en webp según el navegador. 
  // Por indicación del spec: Si es PNG y tiene transparencia -> mantener PNG. Sino WEBP.
  // browser-image-compression convierte a webp por defecto si lo indicamos, pero podemos revisar si el user subió PNG.
  
  let targetType = 'image/webp';
  if (currentFile.type === 'image/png') {
      // Asumimos que si el user sube PNG es porque necesita transparencia.
      targetType = 'image/png';
  }

  const options = {
    maxSizeMB: maxSizeMB,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: targetType,
    initialQuality: 0.8
  };

  try {
    const compressedFile = await imageCompression(currentFile, options);
    const newSizeMB = compressedFile.size / 1024 / 1024;
    
    // Crear un nuevo objeto File en vez de Blob
    const finalFile = new File([compressedFile], currentFile.name.replace(/\.[^/.]+$/, "") + (targetType === 'image/webp' ? '.webp' : '.png'), {
      type: targetType,
    });

    return {
      file: finalFile,
      originalSizeMB,
      newSizeMB
    };
  } catch (error) {
    console.error('Error optimizando imagen:', error);
    throw new Error('No se pudo optimizar la imagen.');
  }
};
