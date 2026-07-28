import {
  ALLOWED_LOGO_MIME_TYPES,
  AllowedLogoMimeType,
  MAX_LOGO_BYTES,
  MAX_LOGO_DIMENSION
} from "../config/constants";

export interface ImageValidationOk {
  ok: true;
  mimeType: AllowedLogoMimeType;
  width: number;
  height: number;
}

export interface ImageValidationError {
  ok: false;
  message: string;
}

export type ImageValidationResult = ImageValidationOk | ImageValidationError;

const isAllowedMimeType = (value: string): value is AllowedLogoMimeType =>
  (ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(value);

/**
 * Detecta el formato real leyendo los magic bytes del archivo.
 * El `mimetype` que manda el cliente y la extensión del nombre son texto libre:
 * un `.txt` renombrado a `.png` llega declarando `image/png`. Lo único confiable
 * es la firma binaria.
 */
const detectMimeType = (buffer: Buffer): AllowedLogoMimeType | null => {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: "RIFF" (0..3) + "WEBP" (8..11)
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

/**
 * Lee ancho y alto del header, sin decodificar los píxeles.
 * Devuelve `null` si el header no se puede interpretar (variantes exóticas de
 * WebP, JPEG truncado, etc.); en ese caso salteamos el chequeo de dimensiones
 * en vez de rechazar una imagen que puede ser válida.
 */
const readDimensions = (
  buffer: Buffer,
  mimeType: AllowedLogoMimeType
): { width: number; height: number } | null => {
  try {
    if (mimeType === 'image/png') {
      // IHDR arranca en el byte 16: width (4 bytes BE) + height (4 bytes BE)
      if (buffer.length < 24) return null;
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
      };
    }

    if (mimeType === 'image/webp') {
      const format = buffer.toString('ascii', 12, 16);

      if (format === 'VP8 ') {
        // Lossy: keyframe header en 26, 14 bits por dimensión
        if (buffer.length < 30) return null;
        return {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff
        };
      }

      if (format === 'VP8L') {
        // Lossless: 14 bits por dimensión empaquetados desde el byte 21
        if (buffer.length < 25) return null;
        const bits = buffer.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1
        };
      }

      if (format === 'VP8X') {
        // Extended: canvas size en 24, 24 bits por dimensión (valor - 1)
        if (buffer.length < 30) return null;
        const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
        const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
        return { width, height };
      }

      return null;
    }

    // JPEG: recorrer los segmentos hasta el SOF, que es el que trae las dimensiones
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      // SOF0..SOF15, salteando DHT (C4), JPG (C8) y DAC (CC) que no son SOF
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isSof) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7)
        };
      }

      // Marcadores sin payload
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }

      offset += 2 + buffer.readUInt16BE(offset + 2);
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Valida un buffer de imagen subido: tamaño, tipo real y dimensiones.
 * `declaredMimeType` es lo que dijo el cliente; se compara contra la firma
 * binaria para detectar archivos disfrazados.
 */
export const validateImageBuffer = (
  buffer: Buffer,
  declaredMimeType?: string
): ImageValidationResult => {
  if (!buffer || buffer.length === 0) {
    return { ok: false, message: "El archivo está vacío" };
  }

  if (buffer.length > MAX_LOGO_BYTES) {
    const maxKb = Math.round(MAX_LOGO_BYTES / 1024);
    return { ok: false, message: `La imagen supera el máximo de ${maxKb} KB` };
  }

  const detected = detectMimeType(buffer);
  if (!detected) {
    return {
      ok: false,
      message: "El archivo no es una imagen válida (se aceptan WebP, PNG o JPEG)"
    };
  }

  if (declaredMimeType && isAllowedMimeType(declaredMimeType) && declaredMimeType !== detected) {
    return {
      ok: false,
      message: "El contenido del archivo no coincide con su tipo declarado"
    };
  }

  const dimensions = readDimensions(buffer, detected);
  if (dimensions) {
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) {
      return { ok: false, message: "No se pudieron leer las dimensiones de la imagen" };
    }
    if (width > MAX_LOGO_DIMENSION || height > MAX_LOGO_DIMENSION) {
      return {
        ok: false,
        message: `La imagen no puede superar los ${MAX_LOGO_DIMENSION}x${MAX_LOGO_DIMENSION} píxeles`
      };
    }
  }

  return {
    ok: true,
    mimeType: detected,
    width: dimensions?.width ?? 0,
    height: dimensions?.height ?? 0
  };
};
