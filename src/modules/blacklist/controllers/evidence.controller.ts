import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  BadRequestException,
  Logger,
  Param,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { verifyMediaToken } from '../utils/signed-url';
import { OneDriveService } from '../services/onedrive.service';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);
  private static readonly MAX_AGE_SECONDS = 15 * 60; // 15 minutos

  constructor(private readonly oneDriveService: OneDriveService) {}

  /**
   * Redirige a la URL temporal de OneDrive.
   * Soporta nombre opcional (/media/e/:name) para incluir extensión
   * y query ?k=i|v|u como pista de tipo para evitar HEAD en el frontend.
   */
 @Get(['e', 'e/:name'])
  async getMedia(
    @Query('t') t: string,
    @Query('k') k: string, // i=image, v=video, u=unknown
    @Param('name') name: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const startTime = Date.now();
    const isHead = req.method === 'HEAD';

    try {
      if (!t || typeof t !== 'string') {
        this.logger.warn('Token no proporcionado o inválido');
        throw new BadRequestException('Token requerido');
      }

      const payload = verifyMediaToken(t);
      if (!payload || !payload.p) {
        this.logger.warn('Token inválido o expirado');
        throw new BadRequestException('URL inválida o expirada');
      }

      const fileId = String(payload.p);

      // HEAD rápido (sin tocar OneDrive)
      if (isHead) {
        const contentType =
          this.inferContentTypeFromNameOrHint(name, k) || 'application/octet-stream';

        res.set({
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${MediaController.MAX_AGE_SECONDS}, s-maxage=${MediaController.MAX_AGE_SECONDS}`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });

        const elapsed = Date.now() - startTime;
        this.logger.debug(`✓ HEAD 200 en ${elapsed}ms para ${fileId.substring(0, 15)}...`);
        res.status(200).end();
        return;
      }

      // GET: obtener URL temporal (cacheada 15m) y redirigir
      const downloadUrl = await this.oneDriveService.getTemporaryDownloadUrl(fileId);

      res.set({
        'Cache-Control': `public, max-age=${MediaController.MAX_AGE_SECONDS}, s-maxage=${MediaController.MAX_AGE_SECONDS}, stale-while-revalidate=30`,
        Vary: 'Origin',
      });

      const elapsed = Date.now() - startTime;
      this.logger.log(`✓ Redirect 307 en ${elapsed}ms para ${fileId.substring(0, 15)}...`);
      res.redirect(307, downloadUrl);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      this.logger.error(`✗ Error tras ${elapsed}ms: ${error?.message}`, error?.stack);
      if (!res.headersSent) {
        res.status(500).json({
          statusCode: 500,
          message: 'Error al acceder al archivo',
          error: error?.message || 'Error desconocido',
        });
      }
    }
  }

  // --- helper ---
  private inferContentTypeFromNameOrHint(name?: string, k?: string): string | null {
    if (k === 'i') return 'image/jpeg';
    if (k === 'v') return 'video/mp4';

    const n = (name || '').toLowerCase();
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.gif')) return 'image/gif';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.heic')) return 'image/heic';
    if (n.endsWith('.heif')) return 'image/heif';
    if (n.endsWith('.bmp')) return 'image/bmp';
    if (n.endsWith('.svg')) return 'image/svg+xml';

    if (n.endsWith('.mp4') || n.endsWith('.m4v')) return 'video/mp4';
    if (n.endsWith('.mov')) return 'video/quicktime';
    if (n.endsWith('.webm')) return 'video/webm';
    if (n.endsWith('.ogg') || n.endsWith('.ogv')) return 'video/ogg';
    if (n.endsWith('.avi')) return 'video/x-msvideo';
    if (n.endsWith('.mkv')) return 'video/x-matroska';

    return null;
  }
}