// src/modules/blacklist/utils/signed-url.ts
import * as crypto from 'crypto';

export type MediaTokenPayload = {
  p: string; // fileId de OneDrive
  exp: number;
};

const SECRET = process.env.MEDIA_URL_SECRET || 'change-me-in-.env';

function toB64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64UrlToBuf(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export function signMediaPayload(payload: MediaTokenPayload): string {
  const json = JSON.stringify(payload);
  const body = toB64Url(Buffer.from(json, 'utf8'));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest();
  return `${body}.${toB64Url(sig)}`;
}

export function verifyMediaToken(token: string): MediaTokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [bodyB64u, sigB64u] = parts;

    const expectedSig = crypto.createHmac('sha256', SECRET).update(bodyB64u).digest();
    const providedSig = fromB64UrlToBuf(sigB64u);

    if (providedSig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

    const bodyBuf = fromB64UrlToBuf(bodyB64u);
    const payload = JSON.parse(bodyBuf.toString('utf8')) as MediaTokenPayload;

    if (!payload || typeof payload.p !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Detecta el tipo de media basado en la extensión del archivo
 */
function detectMediaTypeFromFileName(fileName?: string): 'i' | 'v' | 'u' {
  if (!fileName) return 'u';
  
  const ext = fileName.toLowerCase();
  
  // Detectar imágenes
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg)$/i.test(ext)) {
    return 'i';
  }
  
  // Detectar videos
  if (/\.(mp4|m4v|mov|webm|ogg|ogv|avi|mkv)$/i.test(ext)) {
    return 'v';
  }
  
  // Desconocido
  return 'u';
}

/**
 * Helper para generar URL firmada de OneDrive con soporte para nombre y tipo
 * @param fileId - ID del archivo en OneDrive
 * @param fileName - Nombre del archivo (opcional, pero permite detectar el tipo)
 * @param ttlSeconds - Tiempo de vida del token en segundos
 */
export function makeSignedMediaUrl(
  fileId: string,
  fileName?: string,
  ttlSeconds = Number(process.env.MEDIA_URL_TTL_SECONDS ?? 600)
): string {
  const token = signMediaPayload({
    p: fileId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  
  // Detectar tipo de media desde el nombre del archivo
  const typeHint = detectMediaTypeFromFileName(fileName);
  
  // Construir URL base con token y hint de tipo
  let url = `media/e?t=${encodeURIComponent(token)}&k=${typeHint}`;
  
  // Agregar nombre del archivo en la ruta (opcional pero útil)
  if (fileName) {
    // Limpiar el nombre del archivo para URL
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    url += `/${encodeURIComponent(safeName)}`;
  }
  
  return url;
}