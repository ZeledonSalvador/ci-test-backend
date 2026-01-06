import { FileType } from 'src/modules/shipments/enums/typeFileUpload.enum';

/**
 * Función que construye un mensaje de validación basado en un mapeo.
 * @param mapping - Un objeto de mapeo donde las claves son los códigos y los valores son las descripciones.
 * @returns Un mensaje formateado que muestra las descripciones y sus códigos.
 */
export function buildMessageEnumsWithCode(
  mapping: Record<string, string>,
): string {
  return Object.entries(mapping)
    .map(([key, value]) => `${value} (${key})`)
    .join(' o ');
}

export function createEnumMap<T>(
  enumObj: T,
  generateCodes: boolean = true,
): Record<string, T[keyof T]> {
  return Object.fromEntries(
    Object.entries(enumObj).map(([key, value]) => [
      generateCodes ? value.charAt(0).toUpperCase() : value,
      value,
    ]),
  );
}

export function getKeyByValueEnum<T>(
  value: string,
  enumObj: T,
): string | undefined {
  const entry = Object.entries(enumObj).find(
    ([, enumValue]) => enumValue === value,
  );
  return entry ? entry[0] : undefined;
}

export function getFileTypeFromMimeType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) return FileType.IMAGE;
  if (mimeType === 'application/pdf') return FileType.PDF;
  if (mimeType.startsWith('video/')) return FileType.VIDEO;
  if (mimeType.startsWith('audio/')) return FileType.AUDIO;
  if (
    mimeType.startsWith('application/vnd.ms-excel') ||
    mimeType.startsWith(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  ) {
    return FileType.SPREADSHEET;
  }
  return FileType.OTHER;
}

export function getFileTypeFromExtension(fileName: string): FileType {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return FileType.PDF;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return FileType.IMAGE;
    case 'mp4':
    case 'avi':
      return FileType.VIDEO;
    case 'mp3':
    case 'wav':
      return FileType.AUDIO;
    case 'xls':
    case 'xlsx':
      return FileType.SPREADSHEET;
    default:
      return FileType.OTHER;
  }
}
