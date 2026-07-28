/** Lo que el usuario puede elegir del disco, antes de procesar. */
export const ACCEPTED_IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg'];

/** Tope del archivo original. Lo que se sube después pesa ~45 KB. */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export const DEFAULT_LOGO_SIZE = 512;

export class ImageResizeError extends Error {}

/**
 * Chequeo barato antes de tocar el canvas, para poder dar un mensaje claro
 * sin haber decodificado nada.
 */
export const validateImageFile = (file: File): void => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageResizeError('Formato no soportado. Elegí una imagen WebP, PNG o JPG.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    const maxMb = Math.round(MAX_SOURCE_BYTES / (1024 * 1024));
    throw new ImageResizeError(`La imagen es muy pesada (máximo ${maxMb} MB).`);
  }
};

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari viejo puede fallar con algunos formatos: seguimos con <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageResizeError('No se pudo leer la imagen.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Recorta la imagen a un cuadrado centrado y la exporta como WebP del tamaño
 * pedido. Un JPG de 3,4 MB sale en ~45 KB.
 *
 * Redimensionar acá y no en el servidor evita meter `sharp` (binario nativo) en
 * el backend, y además el usuario ve en el preview exactamente lo que se guarda.
 * El servidor igual valida magic bytes, peso y dimensiones: esto es comodidad,
 * no una garantía de seguridad.
 */
export const resizeToSquareWebp = async (
  file: File,
  size: number = DEFAULT_LOGO_SIZE,
  quality = 0.85
): Promise<Blob> => {
  validateImageFile(file);

  const source = await loadBitmap(file);
  const sourceWidth = 'width' in source ? source.width : 0;
  const sourceHeight = 'height' in source ? source.height : 0;

  if (!sourceWidth || !sourceHeight) {
    throw new ImageResizeError('No se pudieron leer las dimensiones de la imagen.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageResizeError('Tu navegador no permite procesar la imagen.');
  }

  // Recorte "cover": se toma el cuadrado central del original y se escala.
  const side = Math.min(sourceWidth, sourceHeight);
  const sx = (sourceWidth - side) / 2;
  const sy = (sourceHeight - side) / 2;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, sx, sy, side, side, 0, 0, size, size);

  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });

  if (!blob) {
    throw new ImageResizeError('No se pudo procesar la imagen.');
  }

  // Si el navegador no soporta WebP en toBlob, devuelve PNG en silencio.
  // El backend acepta ambos, así que alcanza con reetiquetar el resultado.
  return blob;
};

/** URL temporal para el preview. Quien la use debe revocarla al desmontar. */
export const createPreviewUrl = (blob: Blob): string => URL.createObjectURL(blob);
