import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphAuthService } from '../../graph/services/graph-auth.service';
import { Client } from '@microsoft/microsoft-graph-client';

export interface OneDriveUploadResult {
  fileId: string;
  fileName: string;
  internalPath: string;
}

@Injectable()
export class OneDriveService {
  private readonly logger = new Logger(OneDriveService.name);
  private readonly EVIDENCE_FOLDER: string;
  private readonly CHUNK_SIZE = 320 * 1024 * 10; // 3.2 MB
  private readonly EMAIL_FROM: string;

  // Cache corto para URL temporal
  private static readonly URL_TTL_MS = 15 * 60 * 1000; // 15 minutos
  private urlCache = new Map<string, { url: string; exp: number }>();

  constructor(
    private readonly graphAuthService: GraphAuthService,
    private readonly configService: ConfigService,
  ) {
    this.EVIDENCE_FOLDER = this.configService.get<string>('EVIDENCE_FOLDER') || '';
    this.EMAIL_FROM = this.configService.get<string>('EMAIL_FROM') || '';
    if (!this.EMAIL_FROM) {
      this.logger.error('EMAIL_FROM debe estar configurado');
      throw new Error('Configuracion de OneDrive incompleta');
    }
    this.logger.log(`OneDrive Service inicializado con cuenta: ${this.EMAIL_FROM}`);
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<OneDriveUploadResult> {
    try {
      const graphClient = this.graphAuthService.createGraphClient();
      await this.ensureEvidenceFolderExists(graphClient);

      const uploadPath = `/users/${this.EMAIL_FROM}/drive/root:/${this.EVIDENCE_FOLDER}/${fileName}`;
      const correctMimeType = this.ensureCorrectMimeType(mimeType, fileName);

      let uploadedFile;
      if (fileBuffer.length < 4 * 1024 * 1024) {
        uploadedFile = await this.simpleUpload(graphClient, uploadPath, fileBuffer, correctMimeType);
      } else {
        uploadedFile = await this.largeFileUpload(graphClient, uploadPath, fileBuffer, correctMimeType);
      }

      this.logger.log(`✓ Archivo subido: ${fileName} (${uploadedFile.id})`);

      return {
        fileId: uploadedFile.id,
        fileName: uploadedFile.name,
        internalPath: `${this.EVIDENCE_FOLDER}/${fileName}`,
      };
    } catch (error: any) {
      this.logger.error(`✗ Error subiendo ${fileName}:`, error?.message);
      throw new InternalServerErrorException(`Error subiendo a OneDrive: ${error?.message}`);
    }
  }

  async getFileMetadata(fileId: string): Promise<any> {
    try {
      const graphClient = this.graphAuthService.createGraphClient();
      const metadata = await graphClient
        .api(`/users/${this.EMAIL_FROM}/drive/items/${fileId}`)
        .select('id,name,size,file,createdDateTime,lastModifiedDateTime')
        .get();

      this.logger.debug(
        `Metadata: ${metadata.name} (${metadata.size} bytes, ${metadata.file?.mimeType || 'unknown'})`
      );
      return metadata;
    } catch (error: any) {
      this.logger.error(`✗ Error obteniendo metadata para ${fileId}: ${error?.message}`);
      throw new InternalServerErrorException('Error al obtener información del archivo');
    }
  }

  /**
   * URL de descarga temporal (cache 15m).
   */
  async getTemporaryDownloadUrl(fileId: string): Promise<string> {
    const startTime = Date.now();

    try {
      const now = Date.now();
      const hit = this.urlCache.get(fileId);
      if (hit && hit.exp > now + 30_000) {
        this.logger.debug(`Cache hit URL temporal para ${fileId.substring(0, 15)}...`);
        return hit.url;
      }

      const graphClient = this.graphAuthService.createGraphClient();
      this.logger.debug(`Solicitando URL de descarga para: ${fileId.substring(0, 15)}...`);

      const response = await graphClient
        .api(`/users/${this.EMAIL_FROM}/drive/items/${fileId}`)
        .select('@microsoft.graph.downloadUrl')
        .get();

      const url = response['@microsoft.graph.downloadUrl'];
      if (!url) throw new Error('URL de descarga no disponible');

      this.urlCache.set(fileId, { url, exp: now + OneDriveService.URL_TTL_MS });

      const elapsed = Date.now() - startTime;
      this.logger.log(`✓ URL generada en ${elapsed}ms para ${fileId.substring(0, 15)}...`);
      return url;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      this.logger.error(`✗ Error tras ${elapsed}ms obteniendo URL para ${fileId}: ${error?.message}`);
      throw new InternalServerErrorException('Error generando enlace de descarga');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const graphClient = this.graphAuthService.createGraphClient();
      this.logger.debug(`Eliminando archivo: ${fileId}`);
      await graphClient.api(`/users/${this.EMAIL_FROM}/drive/items/${fileId}`).delete();
      this.logger.log(`✓ Archivo eliminado: ${fileId}`);
    } catch (error: any) {
      this.logger.error(`✗ Error eliminando ${fileId}: ${error?.message}`);
      throw new InternalServerErrorException('Error eliminando archivo');
    }
  }

  // ===== privados =====

  private async simpleUpload(
    client: Client,
    uploadPath: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<any> {
    this.logger.debug(`Upload simple: ${fileBuffer.length} bytes`);
    return await client
      .api(`${uploadPath}:/content`)
      .header('Content-Type', mimeType)
      .put(fileBuffer);
  }

  private async largeFileUpload(
    client: Client,
    uploadPath: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<any> {
    this.logger.debug(`Upload por chunks: ${fileBuffer.length} bytes`);

    const uploadSession = await client
      .api(`${uploadPath}:/createUploadSession`)
      .post({
        item: { '@microsoft.graph.conflictBehavior': 'replace' },
      });

    const uploadUrl = uploadSession.uploadUrl;
    const fileSize = fileBuffer.length;
    let uploadedBytes = 0;

    while (uploadedBytes < fileSize) {
      const chunkStart = uploadedBytes;
      const chunkEnd = Math.min(uploadedBytes + this.CHUNK_SIZE, fileSize);
      const chunk = fileBuffer.slice(chunkStart, chunkEnd);

      const response = await client
        .api(uploadUrl)
        .headers({
          'Content-Length': `${chunk.length}`,
          'Content-Range': `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
        })
        .put(chunk);

      uploadedBytes = chunkEnd;
      this.logger.debug(
        `Progreso: ${uploadedBytes}/${fileSize} (${Math.round((uploadedBytes / fileSize) * 100)}%)`,
      );

      if (response.id) return response;
    }

    throw new Error('Upload incompleto');
  }

  private async ensureEvidenceFolderExists(client: Client): Promise<void> {
    try {
      await client.api(`/users/${this.EMAIL_FROM}/drive/root:/${this.EVIDENCE_FOLDER}`).get();
      this.logger.debug(`Carpeta ${this.EVIDENCE_FOLDER} existe`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.logger.debug(`Creando carpeta ${this.EVIDENCE_FOLDER}...`);
        await client.api(`/users/${this.EMAIL_FROM}/drive/root/children`).post({
          name: this.EVIDENCE_FOLDER,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });
        this.logger.log(`✓ Carpeta ${this.EVIDENCE_FOLDER} creada`);
      } else {
        throw error;
      }
    }
  }

  private ensureCorrectMimeType(providedMimeType: string, fileName: string): string {
    if (providedMimeType && providedMimeType !== 'application/octet-stream') {
      return providedMimeType;
    }
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm',
      avi: 'video/x-msvideo', mkv: 'video/x-matroska',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    };
    const ct = mimeMap[ext || ''] || providedMimeType || 'application/octet-stream';
    if (ct !== providedMimeType) this.logger.debug(`MIME corregido: ${providedMimeType} → ${ct} para ${fileName}`);
    return ct;
  }
}