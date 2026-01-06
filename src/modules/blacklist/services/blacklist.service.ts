import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Drivers } from 'src/models/Drivers';
import { Repository } from 'typeorm';
import { BlacklistDetailsResponseDto } from '../dto/BlacklistDetailsResponseDto';
import { BlacklistDrivers } from 'src/models/BlacklistDrivers';
import { BlacklistDriversHistory } from 'src/models/BlacklistDriversHistory';
import { Pagination } from 'src/dto/pagination';
import { Shipments } from 'src/models/Shipments';
import { PenaltyType } from '../enums/PenaltyType.enum';
import { BlacklistReportResponseDto } from '../dto/BlacklistReportResponseDto';
import { BlacklistStatus } from '../enums/BlacklistStatus.enum';
import { ProductType } from 'src/modules/shipments/enums/productType.enum';
import { CreateReportDto } from '../dto/CreateReportDto';
import { CreatePenaltyDto } from '../dto/CreatePenaltyDto';
import { UpdatePenaltyDto } from '../dto/UpdatePenaltyDto';
import { BlacklistStatusHistoryDto } from '../dto/BlacklistStatusHistoryDto';
import { makeSignedMediaUrl } from '../utils/signed-url';
import { NotificationService } from '../../notifications/services/notification.service';
import { OneDriveService } from './onedrive.service';
import type { Express } from 'express';
import * as path from 'path';

interface EvidenceFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  internalPath: string;
}

interface ProcessedFile {
  original: Express.Multer.File;
  decodedName: string;
  extension: string;
  sanitizedBaseName: string;
}

@Injectable()
export class BlacklistService {
  private readonly logger = new Logger(BlacklistService.name);
  private readonly MEDIA_URL_TTL_SECONDS = Number(
    process.env.MEDIA_URL_TTL_SECONDS ?? 600,
  );

  constructor(
    @InjectRepository(BlacklistDrivers)
    private readonly blacklistRepository: Repository<BlacklistDrivers>,
    @InjectRepository(Drivers)
    private readonly driversRepository: Repository<Drivers>,
    @InjectRepository(Shipments)
    private readonly shipmentsRepository: Repository<Shipments>,
    @InjectRepository(BlacklistDriversHistory)
    private readonly historyRepository: Repository<BlacklistDriversHistory>,
    private readonly notificacionesService: NotificationService,
    private readonly oneDriveService: OneDriveService,
  ) {}

  /**
   * Decodificar nombres de archivo MIME encoded-word (RFC 2047)
   */
  private decodeMimeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    const mimePattern = /=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g;
    let decoded = filename;
    let hasMatch = false;

    decoded = decoded.replace(
      mimePattern,
      (fullMatch, charset, encoding, encodedText) => {
        hasMatch = true;

        try {
          if (encoding.toUpperCase() === 'B') {
            const buffer = Buffer.from(encodedText, 'base64');
            return buffer.toString('utf8');
          } else if (encoding.toUpperCase() === 'Q') {
            return encodedText
              .replace(/_/g, ' ')
              .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16)),
              );
          }
        } catch (error) {
          this.logger.warn(
            `Error decodificando segmento MIME: ${fullMatch}`,
            error,
          );
          return fullMatch;
        }

        return fullMatch;
      },
    );

    if (hasMatch) {
      this.logger.debug(`Nombre decodificado: "${filename}" -> "${decoded}"`);
    }

    return decoded;
  }

  /**
   * Procesar archivos y cachear decodificación una sola vez
   */
  private processFiles(files: Express.Multer.File[]): ProcessedFile[] {
    return files.map((file) => {
      const decodedName = this.decodeMimeFilename(file.originalname);
      const extension = path.extname(decodedName);
      const sanitizedBaseName = path
        .basename(decodedName, extension)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\-]/g, '_')
        .replace(/_{2,}/g, '_')
        .slice(0, 40);

      return {
        original: file,
        decodedName,
        extension: extension.toLowerCase(),
        sanitizedBaseName,
      };
    });
  }

  /**
   * Validar archivos procesados
   */
  private async validateProcessedFiles(
    processedFiles: ProcessedFile[],
  ): Promise<{
    isValid: boolean;
    errors: string[];
    validFiles: number;
  }> {
    const errors: string[] = [];
    let validFiles = 0;

    if (processedFiles.length > 10) {
      errors.push(
        `Se ha superado el numero maximo de archivos permitidos (10). Archivos enviados: ${processedFiles.length}`,
      );
      return { isValid: false, errors, validFiles: 0 };
    }

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'video/mp4',
      'video/x-m4v',
    ]);

    const allowedExtensions = new Set([
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.heic',
      '.heif',
      '.mp4',
      '.m4v',
    ]);

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    for (let i = 0; i < processedFiles.length; i++) {
      const { original: file, decodedName, extension } = processedFiles[i];
      const fileIndex = i + 1;

      if (!file?.buffer?.length) {
        errors.push(
          `Archivo ${fileIndex}: El archivo esta vacio o no tiene contenido valido.`,
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `Archivo ${fileIndex}: Tamano ${this.formatFileSize(file.size)} excede el limite de ${this.formatFileSize(MAX_FILE_SIZE)}.`,
        );
        continue;
      }

      this.logger.debug(
        `Validando archivo ${fileIndex}/${processedFiles.length}:`,
        {
          decodedName,
          extension: extension || '(sin extension)',
          mimeType: file.mimetype,
          size: this.formatFileSize(file.size),
        },
      );

      const isMimeAllowed = allowedMimeTypes.has(file.mimetype?.toLowerCase());
      const isExtAllowed = extension ? allowedExtensions.has(extension) : false;

      if (!isMimeAllowed) {
        errors.push(
          `Archivo ${fileIndex} (${decodedName}): Tipo MIME no permitido. ` +
            `Recibido: ${file.mimetype || 'desconocido'}`,
        );
        continue;
      }

      if (!isExtAllowed) {
        errors.push(
          `Archivo ${fileIndex} (${decodedName}): Extension no permitida. ` +
            `Recibida: ${extension || 'sin extension'}`,
        );
        continue;
      }

      if (!this.isMimeExtensionMatch(file.mimetype, extension)) {
        errors.push(
          `Archivo ${fileIndex} (${decodedName}): La extension "${extension}" no coincide con el tipo MIME "${file.mimetype}".`,
        );
        continue;
      }

      validFiles++;
      this.logger.log(
        `Archivo ${fileIndex} validado: ${decodedName} (${file.mimetype}, ${this.formatFileSize(file.size)})`,
      );
    }

    this.logger.log(
      `Validacion completada: ${validFiles}/${processedFiles.length} archivos validos` +
        (errors.length > 0 ? `, ${errors.length} errores` : ''),
    );

    return {
      isValid: errors.length === 0,
      errors,
      validFiles,
    };
  }

  /**
   * Registrar cambio de estado en el historial
   */
  private async logStatusChange(
    blacklistId: number,
    status: number,
    changedBy: string,
    changeReason?: string,
  ): Promise<void> {
    if (!changedBy || changedBy.trim() === '') {
      throw new BadRequestException(
        'El campo changedBy es obligatorio para el historial.',
      );
    }

    try {
      const changeDateTime = new Date();

      const historyEntry = this.historyRepository.create({
        blacklistId,
        status,
        changedBy: changedBy.trim(),
        changeDateTime,
        changeReason,
      });

      await this.historyRepository.save(historyEntry);

      this.logger.debug(
        `Status change logged: Blacklist ${blacklistId}, Status: ${status}, By: ${changedBy}, DateTime: ${changeDateTime.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Error logging status change:', error);
    }
  }

  /**
   * Formatear cualquier string de la BD a formato legible
   */
  private normalizeTextForEmail(text: string | null | undefined): string {
    if (!text) return 'No especificado';

    let cleaned = text.trim();
    cleaned = cleaned.replace(/[_-]/g, ' ');
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    return cleaned
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Metodo auxiliar para actualizar estado con logging
   */
  private async updateStatusWithLogging(
    blacklistEntry: BlacklistDrivers,
    newStatus: BlacklistStatus,
    changedBy: string,
    changeReason?: string,
  ): Promise<BlacklistDrivers> {
    if (!changedBy || changedBy.trim() === '') {
      throw new BadRequestException('El campo changedBy es obligatorio.');
    }

    const previousStatus = blacklistEntry.statusBlacklist;

    blacklistEntry.statusBlacklist = newStatus;
    const updatedEntry = await this.blacklistRepository.save(blacklistEntry);

    await this.logStatusChange(
      blacklistEntry.id,
      newStatus,
      changedBy,
      changeReason,
    );

    return updatedEntry;
  }

  /**
   * Obtener historial de cambios de estado para un registro
   */
  async getStatusHistory(
    blacklistId: number,
  ): Promise<BlacklistStatusHistoryDto[]> {
    const history = await this.historyRepository.find({
      where: { blacklistId },
      order: { changeDateTime: 'ASC' },
    });

    return history.map((entry) => ({
      id: entry.id,
      blacklistId: entry.blacklistId,
      status: entry.status,
      statusText: this.getStatusText(entry.status),
      changedBy: entry.changedBy,
      changeDateTime: entry.changeDateTime,
      changeReason: entry.changeReason,
    }));
  }

  /**
   * Metodo auxiliar para convertir codigo de estado a texto
   */
  private getStatusText(statusCode: number): string {
    switch (statusCode) {
      case BlacklistStatus.REPORT_APPLIED:
        return 'Reporte aplicado';
      case BlacklistStatus.PENALTY_APPLIED:
        return 'Amonestacion activa';
      case BlacklistStatus.LIBERATION:
        return 'Liberado';
      default:
        return 'Estado desconocido';
    }
  }

  /**
   * Obtener nombre del producto a partir del codigo
   */
  private getProductNameByCode(productCode: string): string {
    const productName = Object.keys(ProductType).find(
      (key) => ProductType[key as keyof typeof ProductType] === productCode,
    );
    if (productName) return productName;
    return 'N/A';
  }

  /**
   * Formatear fecha en formato dd/mm/yyyy HH:mm (24 horas)
   */
  private formatDateSV(date: Date): string {
    const salvadorTime = new Date(
      date.toLocaleString('en-US', {
        timeZone: 'America/El_Salvador',
      }),
    );

    const day = salvadorTime.getDate().toString().padStart(2, '0');
    const month = (salvadorTime.getMonth() + 1).toString().padStart(2, '0');
    const year = salvadorTime.getFullYear();
    const hours = salvadorTime.getHours().toString().padStart(2, '0');
    const minutes = salvadorTime.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Crear un nuevo reporte de incidente (Status 1)
   */
  async createReport(
    createReportDto: CreateReportDto,
    evidenceFiles?: Express.Multer.File[],
  ): Promise<BlacklistReportResponseDto> {
    const {
      license,
      reportDatetime,
      eventType,
      faultType,
      eventLocation,
      description,
      shipmentId,
      reportedBy,
    } = createReportDto;

    if (!reportedBy || reportedBy.trim() === '') {
      throw new BadRequestException('El campo reportedBy es obligatorio.');
    }

    const driver = await this.driversRepository.findOne({ where: { license } });
    if (!driver) {
      throw new NotFoundException('Motorista no encontrado.');
    }

    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
      relations: ['ingenio', 'driver'],
    });
    if (!shipment) {
      throw new NotFoundException('Envio no encontrado.');
    }

    if (!shipment.driver) {
      throw new BadRequestException('El envio no tiene un motorista asignado.');
    }

    if (shipment.driver.license !== license) {
      throw new BadRequestException(
        `El motorista ${license} no pertenece al envio ${shipment.codeGen}.`,
      );
    }

    const existingReport = await this.blacklistRepository.findOne({
      where: {
        shipment: { id: shipmentId },
      },
      relations: ['driver', 'shipment'],
    });

    if (existingReport) {
      throw new BadRequestException({
        message: `El envio ${shipment.codeGen} ya tiene un reporte de incidente.`,
        existingReportId: existingReport.id,
        existingReportDriver: existingReport.driver.license,
        existingReportStatus: existingReport.statusBlacklist,
        shipmentCode: shipment.codeGen,
      });
    }

    const evidenceFilesData: EvidenceFile[] = [];

    if (evidenceFiles && evidenceFiles.length > 0) {
      const processedFiles = this.processFiles(evidenceFiles);
      const validationResult =
        await this.validateProcessedFiles(processedFiles);

      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'Error en los archivos de evidencia',
          errors: validationResult.errors,
          totalFiles: evidenceFiles.length,
          validFiles: validationResult.validFiles,
        });
      }

      try {
        const date = new Date(reportDatetime);
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const dateTimeCompact = `${year}${month}${day}${hours}${minutes}${seconds}`;

        const tempReportId = Date.now();

        for (let i = 0; i < processedFiles.length; i++) {
          const {
            original: file,
            extension,
            sanitizedBaseName,
          } = processedFiles[i];

          const filename = `${dateTimeCompact}-R${tempReportId}-${i + 1}-${sanitizedBaseName}${extension}`;

          this.logger.log(
            `Subiendo ${i + 1}/${processedFiles.length}: "${filename}"`,
          );

          const uploadResult = await this.oneDriveService.uploadFile(
            file.buffer,
            filename,
            file.mimetype,
          );

          evidenceFilesData.push({
            fileId: uploadResult.fileId,
            fileName: filename,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString(),
            internalPath: uploadResult.internalPath,
          });

          this.logger.log(
            `Archivo subido: ${filename} (ID: ${uploadResult.fileId.substring(0, 15)}..., ${this.formatFileSize(file.size)})`,
          );
        }
      } catch (uploadError) {
        this.logger.error(
          'Error subiendo archivos, iniciando limpieza:',
          uploadError,
        );

        for (const evidence of evidenceFilesData) {
          try {
            await this.oneDriveService.deleteFile(evidence.fileId);
            this.logger.log(
              `Archivo limpiado: ${evidence.fileId.substring(0, 15)}...`,
            );
          } catch (cleanupError) {
            this.logger.error(
              `Error limpiando archivo ${evidence.fileId}:`,
              cleanupError,
            );
          }
        }

        throw new BadRequestException({
          message: 'Error al subir archivos a OneDrive. No se creo el reporte.',
          originalError:
            uploadError instanceof Error
              ? uploadError.message
              : 'Error desconocido',
        });
      }
    }

    const reportEntry = this.blacklistRepository.create({
      driver,
      shipment,
      reportDatetime,
      eventType,
      faultType,
      eventLocation,
      description,
      evidenceUrls: JSON.stringify(evidenceFilesData),
      statusBlacklist: BlacklistStatus.REPORT_APPLIED,
      observation: null,
      banDurationDays: '0',
      penaltyType: null,
      penaltyStartDate: null,
      penaltyEndDate: null,
    });

    let savedReport: BlacklistDrivers;

    try {
      savedReport = await this.blacklistRepository.save(reportEntry);

      await this.logStatusChange(
        savedReport.id,
        BlacklistStatus.REPORT_APPLIED,
        reportedBy.trim(),
        'Reportado',
      );
    } catch (dbError) {
      this.logger.error('Error guardando en BD, limpiando archivos:', dbError);

      for (const evidence of evidenceFilesData) {
        try {
          await this.oneDriveService.deleteFile(evidence.fileId);
          this.logger.log(
            `Archivo limpiado por error de BD: ${evidence.fileId.substring(0, 15)}...`,
          );
        } catch (cleanupError) {
          this.logger.error(
            `Error limpiando archivo ${evidence.fileId}:`,
            cleanupError,
          );
        }
      }

      throw new BadRequestException({
        message: 'Error guardando reporte en base de datos',
        originalError:
          dbError instanceof Error ? dbError.message : 'Error desconocido',
      });
    }

    const formattedDate = this.formatDateSV(
      new Date(savedReport.reportDatetime),
    );

    const emailData = {
      templateName: 'incident-report-notification',
      subject: 'Nuevo Reporte de Incidente',
      roles: [2, 5],
      templatesByRole: {
        2: 'incident-report-notification',
        5: 'incident-report-supervisor',
      },
      templateData: {
        reportId: savedReport.id.toString(),
        reportDate: formattedDate,
        eventType: this.normalizeTextForEmail(savedReport.eventType),
        faultType: savedReport.faultType,
        eventLocation: savedReport.eventLocation,
        description: savedReport.description || 'Sin descripcion',
        driverName: this.normalizeTextForEmail(driver.name),
        driverLicense: driver.license,
        shipmentCode: shipment.codeGen,
        transportista: shipment.transporter,
        ingenioName:
          this.normalizeTextForEmail(shipment.ingenio?.name) ||
          'No especificado',
      },
      priority: 'normal' as const,
    };

    this.notificacionesService
      .emit({
        type: 'email',
        eventName: 'incident-report.email',
        data: emailData,
        metadata: {
          referenceId: savedReport.id,
          referenceType: 'incident-report',
          priority: 'high',
        },
      })
      .catch((err) => {
        this.logger.error(
          'Error emitiendo notificacion (no critico):',
          err.message,
        );
      });

    this.logger.log(
      `Reporte creado por ${reportedBy} - ID: ${savedReport.id}, ` +
        `Conductor: ${license}, Envio: ${shipment.codeGen}, Archivos: ${evidenceFilesData.length}`,
    );

    return await this.mapToReportResponseDto(savedReport);
  }

  /**
   * Metodo auxiliar para formatear tamano de archivo
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validar coincidencia entre MIME type y extension
   */
  private isMimeExtensionMatch(mimeType: string, extension: string): boolean {
    const mimeExtensionMap: { [key: string]: string[] } = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif'],
      'video/mp4': ['.mp4'],
      'video/x-m4v': ['.m4v'],
      'audio/mpeg': ['.mp3'],
    };

    const allowedExtensions = mimeExtensionMap[mimeType.toLowerCase()];
    return allowedExtensions
      ? allowedExtensions.includes(extension.toLowerCase())
      : false;
  }

  /**
   * Obtener reportes pendientes de amonestacion del gerente (Status 1)
   */
  async getPendingReports(
    page: number,
    size: number,
    license?: string,
    eventType?: string,
    shipmentId?: number,
    includeAttachments?: boolean,
    search?: string,
  ): Promise<{ data: BlacklistReportResponseDto[]; pagination: Pagination }> {
    const offset = (page - 1) * size;
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client')
      .where('blacklist.statusBlacklist = :status', {
        status: BlacklistStatus.REPORT_APPLIED,
      });

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    if (license) {
      queryBuilder.andWhere('driver.license = :license', { license });
    }

    if (eventType) {
      queryBuilder.andWhere('blacklist.eventType = :eventType', { eventType });
    }

    if (shipmentId) {
      queryBuilder.andWhere('blacklist.shipment.id = :shipmentId', {
        shipmentId,
      });
    }

    if (search) {
      const searchTerm = `%${search}%`;
      queryBuilder.andWhere(
        '(driver.license LIKE :search OR ' +
          'driver.name LIKE :search OR ' +
          'shipment.codeGen LIKE :search OR ' +
          'client.name LIKE :search OR ' +
          'blacklist.eventType LIKE :search OR ' +
          'blacklist.faultType LIKE :search OR ' +
          'blacklist.eventLocation LIKE :search OR ' +
          'blacklist.description LIKE :search)',
        { search: searchTerm },
      );
    }

    queryBuilder.skip(offset).take(size).orderBy('blacklist.createdAt', 'DESC');

    const [blacklistEntries, totalCount] = await queryBuilder.getManyAndCount();

    const data = await Promise.all(
      blacklistEntries.map((entry) =>
        this.mapToReportResponseDto(entry, includeAttachments),
      ),
    );

    return {
      data,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }

  /**
   * Aplicar amonestacion del gerente sobre un reporte (Status 1 -> Status 2 o Status 3)
   */
  async applyManagerDecision(
    createPenaltyDto: CreatePenaltyDto,
  ): Promise<BlacklistReportResponseDto> {
    const {
      license,
      penaltyType,
      penaltyStartDate,
      penaltyEndDate,
      observation,
      reportId,
      appliedBy,
    } = createPenaltyDto;

    if (!penaltyType) {
      throw new BadRequestException('El tipo de amonestacion es requerido.');
    }

    if (!appliedBy || appliedBy.trim() === '') {
      throw new BadRequestException('El campo appliedBy es obligatorio.');
    }

    const existingReport = await this.blacklistRepository.findOne({
      where: {
        id: reportId,
        statusBlacklist: BlacklistStatus.REPORT_APPLIED,
      },
      relations: ['driver', 'shipment', 'shipment.ingenio'],
    });

    if (!existingReport) {
      throw new NotFoundException(
        'Reporte no encontrado o ya tiene amonestacion aplicada.',
      );
    }

    if (existingReport.driver.license !== license) {
      throw new BadRequestException(
        'El reporte no corresponde al conductor especificado.',
      );
    }

    this.validatePenaltyDates(penaltyType, penaltyStartDate, penaltyEndDate);

    let newStatus: BlacklistStatus;
    let calculatedDays: string;
    let changeReason: string;

    switch (penaltyType) {
      case PenaltyType.NO_APLICADO:
        newStatus = BlacklistStatus.LIBERATION;
        calculatedDays = '0';
        changeReason = 'No Aplicada';
        this.logger.log(
          `Amonestacion: NO APLICADO - Reporte liberado directamente`,
        );
        break;

      case PenaltyType.TEMPORAL:
        newStatus = BlacklistStatus.PENALTY_APPLIED;
        calculatedDays = this.calculateDurationInDays(
          penaltyType,
          penaltyStartDate,
          penaltyEndDate,
        );
        changeReason = 'Temporal';
        this.logger.log(
          `Amonestacion: TEMPORAL - ${calculatedDays} dias de castigo`,
        );
        break;

      case PenaltyType.PERMANENTE:
        newStatus = BlacklistStatus.PENALTY_APPLIED;
        calculatedDays = 'baneado';
        changeReason = 'Permanente';
        this.logger.log(`Amonestacion: PERMANENTE - Castigo indefinido`);
        break;

      default:
        throw new BadRequestException(
          'Tipo de amonestacion no valido para gerente.',
        );
    }

    this.logger.debug(
      `Fecha inicio: ${penaltyStartDate}, Fecha fin: ${penaltyEndDate}, ` +
        `Status: ${newStatus}, Dias: ${calculatedDays}`,
    );

    existingReport.penaltyType = penaltyType;
    existingReport.penaltyStartDate = penaltyStartDate;
    existingReport.penaltyEndDate = penaltyEndDate || null;
    existingReport.banDurationDays = calculatedDays;

    if (observation !== undefined) {
      existingReport.observation = observation;
    }

    const updatedEntry = await this.updateStatusWithLogging(
      existingReport,
      newStatus,
      appliedBy.trim(),
      changeReason,
    );

    this.logger.log(
      `Amonestacion aplicada por ${appliedBy} - Reporte ID: ${reportId}, ` +
        `Conductor: ${license}, Tipo: ${penaltyType}, Status: ${newStatus}`,
    );

    if (penaltyType) {
      try {
        const ingenioCode = existingReport.shipment?.ingenio?.ingenioCode;

        if (!ingenioCode) {
          this.logger.warn(
            'No se encontro ingenioCode para el envio, no se enviara notificacion a rol 4',
          );
        }

        const incidentDate = this.formatDateSV(
          new Date(existingReport.reportDatetime),
        );
        const applicationDate = this.formatDateSV(new Date());

        let penaltyPeriod = 'N/A';
        if (updatedEntry.penaltyStartDate && updatedEntry.penaltyEndDate) {
          const startDate = this.formatDateSV(
            new Date(updatedEntry.penaltyStartDate),
          );
          const endDate = this.formatDateSV(
            new Date(updatedEntry.penaltyEndDate),
          );
          penaltyPeriod = `${startDate} - ${endDate}`;
        } else if (updatedEntry.penaltyStartDate) {
          penaltyPeriod = `Desde ${this.formatDateSV(new Date(updatedEntry.penaltyStartDate))}`;
        }

        let penaltyDays = 'N/A';
        if (penaltyType === PenaltyType.PERMANENTE) {
          penaltyDays = 'Indefinido';
        } else if (
          penaltyType === PenaltyType.TEMPORAL &&
          updatedEntry.banDurationDays
        ) {
          penaltyDays = `${updatedEntry.banDurationDays} dias`;
        }

        const commonTemplateData = {
          reportId: updatedEntry.id.toString(),
          reportDate: incidentDate,
          shipmentCode: existingReport.shipment?.codeGen || 'N/A',
          ingenioName:
            this.normalizeTextForEmail(
              existingReport.shipment?.ingenio?.name,
            ) || 'No especificado',
          driverName: this.normalizeTextForEmail(existingReport.driver.name),
          driverLicense: existingReport.driver.license,
          transportista: existingReport.shipment?.transporter,
          incidentDate,
          eventType: this.normalizeTextForEmail(existingReport.eventType),
          faultType: existingReport.faultType,
          eventLocation: existingReport.eventLocation,
          description: existingReport.description || 'Sin descripcion',
          penaltyType: this.getPenaltyTypeDescription(penaltyType),
          penaltyDays,
          penaltyPeriod,
          applicationDate,
        };

        const mixedTargets: any = {
          allUsersInRoles: [3, 5],
        };

        if (ingenioCode) {
          mixedTargets.specificUsers = {
            4: [ingenioCode],
          };
        }

        this.notificacionesService
          .emit({
            type: 'email',
            eventName: 'penalty-applied.email',
            data: {
              templatesByRole: {
                3: 'penalty-applied-association',
                4: 'penalty-applied-association',
                5: 'penalty-applied-supervisor',
              },
              subject: 'Resolución de Incidente',
              mixedTargets,
              templateData: commonTemplateData,
              priority: 'normal' as const,
            },
            metadata: {
              referenceId: updatedEntry.id,
              referenceType: 'penalty-applied',
              priority: 'normal',
            },
          })
          .catch((err) => {
            this.logger.error(
              'Error emitiendo notificacion de amonestacion (no critico):',
              err.message,
            );
          });

        this.logger.debug(
          `Notificacion de amonestacion encolada para reporte ID: ${updatedEntry.id}`,
        );
      } catch (notificationError) {
        this.logger.error(
          'Error al preparar notificacion de amonestacion:',
          notificationError,
        );
      }
    }

    return await this.mapToReportResponseDto(updatedEntry);
  }

  /**
   * Modificar amonestacion activa (Status 2)
   */
  async updateActivePenalty(
    penaltyId: number,
    updatePenaltyDto: UpdatePenaltyDto,
  ): Promise<BlacklistReportResponseDto> {
    const { modifiedBy, ...updateData } = updatePenaltyDto;

    if (!modifiedBy || modifiedBy.trim() === '') {
      throw new BadRequestException('El campo modifiedBy es obligatorio.');
    }

    const existingPenalty = await this.blacklistRepository.findOne({
      where: {
        id: penaltyId,
        statusBlacklist: BlacklistStatus.PENALTY_APPLIED,
      },
      relations: ['driver', 'shipment', 'shipment.ingenio'],
    });

    if (!existingPenalty) {
      throw new NotFoundException(
        'Amonestacion no encontrada o ya fue liberada.',
      );
    }

    const originalPenaltyType = existingPenalty.penaltyType;
    const originalStatus = existingPenalty.statusBlacklist;

    if (updateData.penaltyType !== undefined) {
      existingPenalty.penaltyType = updateData.penaltyType;
    }

    if (updateData.penaltyStartDate !== undefined) {
      existingPenalty.penaltyStartDate = updateData.penaltyStartDate;
    }

    if (updateData.penaltyEndDate !== undefined) {
      existingPenalty.penaltyEndDate = updateData.penaltyEndDate;
    }

    if (updateData.observation !== undefined) {
      existingPenalty.observation = updateData.observation;
    }

    const penaltyType = existingPenalty.penaltyType as PenaltyType;

    this.validatePenaltyDates(
      penaltyType,
      existingPenalty.penaltyStartDate,
      existingPenalty.penaltyEndDate,
    );

    let newStatus = BlacklistStatus.PENALTY_APPLIED;
    let changeReason: string;

    switch (penaltyType) {
      case PenaltyType.TEMPORAL:
        existingPenalty.banDurationDays = this.calculateDurationInDays(
          penaltyType,
          existingPenalty.penaltyStartDate,
          existingPenalty.penaltyEndDate,
        );
        changeReason = 'Temporal';
        this.logger.log(
          `Modificado a TEMPORAL - ${existingPenalty.banDurationDays} dias`,
        );
        break;

      case PenaltyType.PERMANENTE:
        existingPenalty.banDurationDays = 'baneado';
        existingPenalty.penaltyEndDate = null;
        changeReason = 'Permanente';
        this.logger.log(`Modificado a PERMANENTE - indefinido`);
        break;

      case PenaltyType.FINALIZADO:
        newStatus = BlacklistStatus.LIBERATION;
        existingPenalty.banDurationDays = '0';
        changeReason = 'Finalizado';
        this.logger.log(
          `Modificado a FINALIZADO - Acuerdo con ingenio, liberado`,
        );
        break;

      default:
        throw new BadRequestException(
          'Tipo de modificacion no valido para amonestaciones activas.',
        );
    }

    const updatedPenalty = await this.updateStatusWithLogging(
      existingPenalty,
      newStatus,
      modifiedBy.trim(),
      changeReason,
    );

    this.logger.log(
      `Amonestacion modificada por ${modifiedBy} - ID: ${penaltyId}, ` +
        `Conductor: ${existingPenalty.driver.license}`,
    );
    this.logger.debug(
      `Cambios: ${originalPenaltyType} -> ${penaltyType}, ` +
        `Status: ${originalStatus} -> ${newStatus}`,
    );

    if (penaltyType === PenaltyType.FINALIZADO) {
      this.logger.log(
        `CONDUCTOR LIBERADO POR ACUERDO: ${existingPenalty.driver.license}`,
      );
    }

    try {
      const ingenioCode = existingPenalty.shipment?.ingenio?.ingenioCode;

      if (!ingenioCode) {
        this.logger.warn('No se encontro ingenioCode para el envio');
      }

      const incidentDate = this.formatDateSV(
        new Date(existingPenalty.reportDatetime),
      );
      const modificationDate = this.formatDateSV(new Date());

      let penaltyPeriod = 'N/A';
      if (updatedPenalty.penaltyStartDate && updatedPenalty.penaltyEndDate) {
        const startDate = this.formatDateSV(
          new Date(updatedPenalty.penaltyStartDate),
        );
        const endDate = this.formatDateSV(
          new Date(updatedPenalty.penaltyEndDate),
        );
        penaltyPeriod = `${startDate} - ${endDate}`;
      } else if (updatedPenalty.penaltyStartDate) {
        penaltyPeriod = `Desde ${this.formatDateSV(new Date(updatedPenalty.penaltyStartDate))}`;
      }

      let penaltyDays = 'N/A';
      if (penaltyType === PenaltyType.PERMANENTE) {
        penaltyDays = 'Indefinido';
      } else if (
        penaltyType === PenaltyType.TEMPORAL &&
        updatedPenalty.banDurationDays
      ) {
        penaltyDays = `${updatedPenalty.banDurationDays} dias`;
      } else if (penaltyType === PenaltyType.FINALIZADO) {
        penaltyDays = '0 dias (Finalizado)';
      }

      const commonTemplateData = {
        reportId: updatedPenalty.id.toString(),
        reportDate: incidentDate,
        shipmentCode: existingPenalty.shipment?.codeGen || 'N/A',
        ingenioName:
          this.normalizeTextForEmail(existingPenalty.shipment?.ingenio?.name) ||
          'No especificado',
        driverName: this.normalizeTextForEmail(existingPenalty.driver.name),
        driverLicense: existingPenalty.driver.license,
        transportista: existingPenalty.shipment?.transporter,
        incidentDate,
        eventType: this.normalizeTextForEmail(existingPenalty.eventType),
        faultType: existingPenalty.faultType,
        eventLocation: existingPenalty.eventLocation,
        description: existingPenalty.description || 'Sin descripcion',
        penaltyType: this.getPenaltyTypeDescription(penaltyType),
        penaltyDays,
        penaltyPeriod,
        modificationDate,
        modificationReason: this.normalizeTextForEmail(changeReason),
      };

      const mixedTargets: any = {
        allUsersInRoles: [3, 5],
      };

      if (ingenioCode) {
        mixedTargets.specificUsers = {
          4: [ingenioCode],
        };
      }

      this.notificacionesService
        .emit({
          type: 'email',
          eventName: 'penalty-modified.email',
          data: {
            templatesByRole: {
              3: 'penalty-modified-association',
              4: 'penalty-modified-association',
              5: 'penalty-modified-supervisor',
            },
            subject: 'Modificacion de Sanción',
            mixedTargets,
            templateData: commonTemplateData,
            priority: 'normal' as const,
          },
          metadata: {
            referenceId: updatedPenalty.id,
            referenceType: 'penalty-modified',
            priority: 'normal',
          },
        })
        .catch((err) => {
          this.logger.error(
            'Error emitiendo notificacion de modificacion (no critico):',
            err.message,
          );
        });

      this.logger.debug(
        `Notificacion de modificacion encolada para reporte ID: ${updatedPenalty.id}`,
      );
    } catch (notificationError) {
      this.logger.error(
        'Error al preparar notificacion de modificacion:',
        notificationError,
      );
    }

    return await this.mapToReportResponseDto(updatedPenalty);
  }

  /**
   * Obtener amonestaciones activas (Status 2)
   */
  async getActivePenalties(
    page: number,
    size: number,
    license?: string,
    penaltyType?: PenaltyType,
    isActive?: boolean,
    includeAttachments?: boolean,
    search?: string,
  ): Promise<{ data: BlacklistReportResponseDto[]; pagination: Pagination }> {
    const offset = (page - 1) * size;
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client')
      .where('blacklist.statusBlacklist = :status', {
        status: BlacklistStatus.PENALTY_APPLIED,
      });

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    if (license) {
      queryBuilder.andWhere('driver.license = :license', { license });
    }

    if (penaltyType) {
      queryBuilder.andWhere('blacklist.penaltyType = :penaltyType', {
        penaltyType,
      });
    }

    if (isActive !== undefined) {
      const now = new Date();
      if (isActive) {
        queryBuilder.andWhere(
          '(blacklist.penaltyType = :permanente OR (blacklist.penaltyType = :temporal AND blacklist.penaltyEndDate > :now))',
          {
            permanente: PenaltyType.PERMANENTE,
            temporal: PenaltyType.TEMPORAL,
            now,
          },
        );
      } else {
        queryBuilder.andWhere(
          '(blacklist.penaltyType = :temporal AND blacklist.penaltyEndDate <= :now)',
          { temporal: PenaltyType.TEMPORAL, now },
        );
      }
    }

    if (search) {
      const searchTerm = `%${search}%`;
      queryBuilder.andWhere(
        '(driver.license LIKE :search OR ' +
          'driver.name LIKE :search OR ' +
          'shipment.codeGen LIKE :search OR ' +
          'client.name LIKE :search OR ' +
          'blacklist.eventType LIKE :search OR ' +
          'blacklist.faultType LIKE :search OR ' +
          'blacklist.eventLocation LIKE :search OR ' +
          'blacklist.description LIKE :search OR ' +
          'blacklist.observation LIKE :search)',
        { search: searchTerm },
      );
    }

    queryBuilder
      .skip(offset)
      .take(size)
      .orderBy('blacklist.penaltyStartDate', 'DESC');

    const [blacklistEntries, totalCount] = await queryBuilder.getManyAndCount();

    const data = await Promise.all(
      blacklistEntries.map((entry) =>
        this.mapToReportResponseDto(entry, includeAttachments),
      ),
    );

    return {
      data,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }

  /**
   * Obtener conductores liberados (Status 3)
   */
  async getLiberatedDrivers(
    page: number,
    size: number,
    license?: string,
    liberationType?: 'NO_APLICADO' | 'FINALIZADO',
    includeAttachments?: boolean,
  ): Promise<{ data: BlacklistReportResponseDto[]; pagination: Pagination }> {
    const offset = (page - 1) * size;
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client')
      .where('blacklist.statusBlacklist = :status', {
        status: BlacklistStatus.LIBERATION,
      });

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    if (license) {
      queryBuilder.andWhere('driver.license = :license', { license });
    }

    if (liberationType) {
      if (liberationType === 'NO_APLICADO') {
        queryBuilder.andWhere('blacklist.penaltyType = :noAplicado', {
          noAplicado: PenaltyType.NO_APLICADO,
        });
      } else if (liberationType === 'FINALIZADO') {
        queryBuilder.andWhere('blacklist.penaltyType = :finalizado', {
          finalizado: PenaltyType.FINALIZADO,
        });
      }
    }

    queryBuilder.skip(offset).take(size).orderBy('blacklist.updatedAt', 'DESC');

    const [blacklistEntries, totalCount] = await queryBuilder.getManyAndCount();

    const data = await Promise.all(
      blacklistEntries.map((entry) =>
        this.mapToReportResponseDto(entry, includeAttachments),
      ),
    );

    return {
      data,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }

  /**
   * Obtener todos los registros con filtros
   */
  async getAllRecords(
    page: number,
    size: number,
    license?: string,
    eventType?: string,
    statusBlacklist?: BlacklistStatus,
    shipmentId?: number,
    clientId?: number,
    includeAttachments?: boolean,
  ): Promise<{ data: BlacklistReportResponseDto[]; pagination: Pagination }> {
    const offset = (page - 1) * size;
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client');

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    if (license) {
      queryBuilder.where('driver.license = :license', { license });
    }

    if (eventType) {
      queryBuilder.andWhere('blacklist.eventType = :eventType', { eventType });
    }

    if (statusBlacklist !== undefined) {
      queryBuilder.andWhere('blacklist.statusBlacklist = :statusBlacklist', {
        statusBlacklist,
      });
    }

    if (shipmentId) {
      queryBuilder.andWhere('blacklist.shipment.id = :shipmentId', {
        shipmentId,
      });
    }

    if (clientId) {
      queryBuilder.andWhere('client.id = :clientId', { clientId });
    }

    queryBuilder.skip(offset).take(size).orderBy('blacklist.createdAt', 'DESC');

    const [blacklistEntries, totalCount] = await queryBuilder.getManyAndCount();

    const data = await Promise.all(
      blacklistEntries.map((entry) =>
        this.mapToReportResponseDto(entry, includeAttachments),
      ),
    );

    return {
      data,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }

  /**
   * Obtener registro por ID
   */
  async getRecordById(
    id: number,
    includeAttachments?: boolean,
  ): Promise<BlacklistReportResponseDto> {
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client')
      .where('blacklist.id = :id', { id });

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    const blacklistEntry = await queryBuilder.getOne();

    if (!blacklistEntry) {
      throw new NotFoundException('Registro no encontrado.');
    }

    return await this.mapToReportResponseDto(
      blacklistEntry,
      includeAttachments,
    );
  }

  /**
   * Obtener registros por shipment
   */
  async getRecordsByShipment(
    shipmentId: number,
    includeAttachments?: boolean,
  ): Promise<BlacklistReportResponseDto[]> {
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client')
      .where('blacklist.shipment.id = :shipmentId', { shipmentId })
      .orderBy('blacklist.createdAt', 'DESC');

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    const blacklistEntries = await queryBuilder.getMany();

    return await Promise.all(
      blacklistEntries.map((entry) =>
        this.mapToReportResponseDto(entry, includeAttachments),
      ),
    );
  }

  /**
   * Obtener registros por cliente
   */
  async getRecordsByClient(
    clientId: number,
    page: number,
    size: number,
    includeAttachments?: boolean,
  ): Promise<{ data: BlacklistReportResponseDto[]; pagination: Pagination }> {
    const offset = (page - 1) * size;
    const queryBuilder = this.blacklistRepository
      .createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.driver', 'driver')
      .leftJoinAndSelect('blacklist.shipment', 'shipment')
      .leftJoinAndSelect('shipment.ingenio', 'client')
      .where('client.id = :clientId', { clientId });

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'attachments',
      );
    }

    queryBuilder.skip(offset).take(size).orderBy('blacklist.createdAt', 'DESC');

    const [blacklistEntries, totalCount] = await queryBuilder.getManyAndCount();

    const data = await Promise.all(
      blacklistEntries.map((entry) =>
        this.mapToReportResponseDto(entry, includeAttachments),
      ),
    );

    return {
      data,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }

  /**
   * Obtener detalles del conductor (solo amonestaciones activas Status 2)
   */
  async getBlacklistDetails(
    license: string,
  ): Promise<BlacklistDetailsResponseDto> {
    const driver = await this.driversRepository.findOne({
      where: { license },
    });

    if (!driver) {
      return {
        isBanEnded: true,
        message: 'Conductor no encontrado',
      };
    }

    const activePenalties = await this.blacklistRepository.find({
      where: {
        driver,
        statusBlacklist: BlacklistStatus.PENALTY_APPLIED,
      },
      relations: ['shipment', 'shipment.ingenio'],
      order: { penaltyStartDate: 'DESC' },
    });

    if (activePenalties.length === 0) {
      return {
        isBanEnded: true,
        message: 'Conductor sin amonestaciones activas',
      };
    }

    let totalBanDuration = 0;
    let hasActiveBan = false;
    let isBanEnded = true;
    let banStatus = '';
    let timeRemaining: string | null = null;
    let banEndDate: Date | null = null;
    const activeAmonestaciones: any[] = [];

    const now = new Date();

    for (const penalty of activePenalties) {
      const {
        observation,
        banDurationDays,
        penaltyStartDate,
        penaltyEndDate,
        penaltyType,
      } = penalty;

      const banStartDate = new Date(penaltyStartDate || penalty.createdAt);
      let currentBanEndDate: Date | null = penaltyEndDate;
      let calculatedDays: number | null = null;
      const isPermanent = penaltyType === PenaltyType.PERMANENTE;
      let isActive = false;

      if (isPermanent) {
        hasActiveBan = true;
        banStatus = 'Castigo permanente activo';
        timeRemaining = 'Indefinido';
        isBanEnded = false;
        calculatedDays = null;
        isActive = true;
      } else if (penaltyType === PenaltyType.TEMPORAL && currentBanEndDate) {
        calculatedDays = Number(banDurationDays);

        if (currentBanEndDate > now) {
          hasActiveBan = true;
          isActive = true;
          totalBanDuration += calculatedDays || 0;
          if (!banEndDate || currentBanEndDate > banEndDate) {
            banEndDate = currentBanEndDate;
          }
        } else {
          isActive = false;
          if (!banEndDate || currentBanEndDate > banEndDate) {
            banEndDate = currentBanEndDate;
          }
        }
      }

      if (isPermanent || (currentBanEndDate && currentBanEndDate > now)) {
        activeAmonestaciones.push({
          penaltyType: penaltyType as PenaltyType,
          penaltyTypeDescription: this.getPenaltyTypeDescription(
            penaltyType as PenaltyType,
          ),
          penaltyStartDate: banStartDate,
          penaltyEndDate: currentBanEndDate,
          calculatedDays,
          observation,
          shipmentCode: penalty.shipment?.codeGen || null,
          clientName: penalty.shipment?.ingenio?.name || null,
          shipmentProduct:
            this.getProductNameByCode(penalty.shipment?.product) || null,
          isPermanent,
          isActive,
        });
      }
    }

    if (hasActiveBan) {
      banStatus =
        totalBanDuration === 0
          ? 'Castigo permanente activo'
          : 'Castigo temporal activo';
      if (totalBanDuration > 0) {
        const msRemaining = banEndDate
          ? banEndDate.getTime() - now.getTime()
          : 0;
        const hoursRemaining =
          msRemaining > 0 ? msRemaining / (1000 * 60 * 60) : 0;
        const daysRemaining = hoursRemaining / 24;

        if (daysRemaining >= 1) {
          timeRemaining = `${Math.ceil(daysRemaining)} dias restantes`;
        } else if (hoursRemaining >= 1) {
          timeRemaining = `${Math.ceil(hoursRemaining)} horas restantes`;
        } else {
          timeRemaining = 'Menos de 1 hora restante';
        }
      } else {
        timeRemaining = 'Indefinido';
      }
      isBanEnded = false;
    } else {
      banStatus = 'Sin amonestaciones activas';
      timeRemaining = '0 dias';
      isBanEnded = true;
    }

    return {
      message: `Detalles del conductor ${driver.name}`,
      isBanEnded,
      driver: {
        license,
        name: driver.name,
      },
      blacklistDetails: {
        observations: activePenalties
          .map((penalty) => penalty.observation)
          .filter((obs) => obs),
        banStatus,
        totalBanDuration:
          totalBanDuration === 0 && hasActiveBan
            ? 'Permanente'
            : totalBanDuration,
        timeRemaining,
        banStartDate:
          activePenalties[0]?.penaltyStartDate || activePenalties[0]?.createdAt,
        banEndDate: banEndDate ? banEndDate.toISOString() : null,
        activeAmonestaciones,
      },
    };
  }

  /**
   * Validar fechas segun el tipo de castigo
   */
  private validatePenaltyDates(
    penaltyType: PenaltyType,
    startDate: Date | null,
    endDate: Date | null,
  ): void {
    switch (penaltyType) {
      case PenaltyType.NO_APLICADO:
      case PenaltyType.FINALIZADO:
        break;

      case PenaltyType.TEMPORAL:
        if (!startDate || !endDate) {
          throw new BadRequestException(
            'Los castigos temporales requieren fecha y hora de inicio y fin.',
          );
        }
        if (new Date(endDate) <= new Date(startDate)) {
          throw new BadRequestException(
            'La fecha y hora de fin debe ser posterior a la fecha y hora de inicio.',
          );
        }
        break;

      case PenaltyType.PERMANENTE:
        if (!startDate) {
          throw new BadRequestException(
            'Los castigos permanentes requieren fecha y hora de inicio.',
          );
        }
        break;

      default:
        throw new BadRequestException('Tipo de castigo no valido.');
    }
  }

  /**
   * Calcular duracion en dias basado en fechas con hora incluida
   */
  private calculateDurationInDays(
    penaltyType: PenaltyType,
    startDate: Date | null,
    endDate?: Date | null,
  ): string {
    switch (penaltyType) {
      case PenaltyType.NO_APLICADO:
      case PenaltyType.FINALIZADO:
        return '0';

      case PenaltyType.PERMANENTE:
        return 'baneado';

      case PenaltyType.TEMPORAL:
        if (!startDate || !endDate) {
          return '0';
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          this.logger.error('Fechas invalidas:', { startDate, endDate });
          return '0';
        }

        const diffTime = end.getTime() - start.getTime();

        if (diffTime <= 0) {
          this.logger.error(
            'La fecha de fin debe ser posterior a la fecha de inicio',
          );
          return '0';
        }

        const diffHours = diffTime / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffHours / 24);

        this.logger.debug(`Calculo de duracion:`, {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          diffMilliseconds: diffTime,
          diffHours: diffHours.toFixed(2),
          diffDays: diffDays,
        });

        return diffDays.toString();

      default:
        return '0';
    }
  }

  /**
   * Obtener descripcion del tipo de castigo
   */
  private getPenaltyTypeDescription(penaltyType: PenaltyType): string {
    switch (penaltyType) {
      case PenaltyType.NO_APLICADO:
        return 'No aplicado';
      case PenaltyType.TEMPORAL:
        return 'Amonestacion temporal';
      case PenaltyType.PERMANENTE:
        return 'Amonestacion permanente';
      case PenaltyType.FINALIZADO:
        return 'Tiempo completado';
      default:
        return 'Tipo desconocido';
    }
  }

  /**
   * Mapper que maneja todos los tipos de registros con metadata desde BD
   */
  private async mapToReportResponseDto(
    blacklistEntry: BlacklistDrivers,
    includeAttachments: boolean = false,
  ): Promise<BlacklistReportResponseDto> {
    let evidenceFiles: EvidenceFile[] = [];

    if (blacklistEntry.evidenceUrls) {
      try {
        const parsed = JSON.parse(blacklistEntry.evidenceUrls);

        if (Array.isArray(parsed)) {
          evidenceFiles = parsed.filter(
            (item) => item && typeof item === 'object' && item.fileId,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error al parsear evidenceUrls para registro ${blacklistEntry.id}:`,
          error,
        );
        evidenceFiles = [];
      }
    }

    const signedEvidenceUrls: string[] = [];

    evidenceFiles.forEach((evidence) => {
      const signedUrl = makeSignedMediaUrl(
        evidence.fileId,
        evidence.fileName,
        this.MEDIA_URL_TTL_SECONDS,
      );

      signedEvidenceUrls.push(signedUrl);

      const mediaType = evidence.mimeType.startsWith('video/')
        ? 'video'
        : 'imagen';
      this.logger.debug(
        `URL generada: ${evidence.fileName} (${mediaType}, ${this.formatFileSize(evidence.fileSize)})`,
      );
    });

    const response: BlacklistReportResponseDto = {
      id: blacklistEntry.id,
      driver: {
        license: blacklistEntry.driver.license,
        name: blacklistEntry.driver.name,
      },
      reportDatetime: blacklistEntry.reportDatetime,
      eventType: blacklistEntry.eventType,
      faultType: blacklistEntry.faultType,
      eventLocation: blacklistEntry.eventLocation,
      description: blacklistEntry.description,
      evidenceUrls: signedEvidenceUrls,
      statusBlacklist: blacklistEntry.statusBlacklist,
      createdAt: blacklistEntry.createdAt,
      statusHistory: await this.getStatusHistory(blacklistEntry.id),
    };

    if (blacklistEntry.shipment) {
      response.shipment = {
        id: blacklistEntry.shipment.id,
        codeGen: blacklistEntry.shipment.codeGen,
        product: this.getProductNameByCode(blacklistEntry.shipment.product),
        transporter: blacklistEntry.shipment.transporter,
        operationType: blacklistEntry.shipment.operationType,
        currentStatus: blacklistEntry.shipment.currentStatus,
        client: {
          id: blacklistEntry.shipment.ingenio.id,
          ingenioCode: blacklistEntry.shipment.ingenio.ingenioCode,
          ingenioNavCode: blacklistEntry.shipment.ingenio.ingenioNavCode,
          name: blacklistEntry.shipment.ingenio.name,
        },
      };

      if (
        includeAttachments &&
        blacklistEntry.shipment.shipmentAttachments &&
        blacklistEntry.shipment.shipmentAttachments.length > 0
      ) {
        const latestAttachment =
          blacklistEntry.shipment.shipmentAttachments.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];

        if (latestAttachment) {
          response.shipment.attachments = [
            {
              id: latestAttachment.id,
              shipmentId: blacklistEntry.shipment.id,
              fileUrl: latestAttachment.fileUrl,
              fileName: latestAttachment.fileName,
              fileType: latestAttachment.fileType,
              attachmentType: latestAttachment.attachmentType,
            },
          ];
        }
      }
    }

    if (
      blacklistEntry.penaltyType &&
      (blacklistEntry.statusBlacklist === BlacklistStatus.PENALTY_APPLIED ||
        blacklistEntry.statusBlacklist === BlacklistStatus.LIBERATION)
    ) {
      const penaltyType = blacklistEntry.penaltyType as PenaltyType;
      let calculatedDays: number | null = null;
      const isPermanent = penaltyType === PenaltyType.PERMANENTE;
      const isLiberated =
        blacklistEntry.statusBlacklist === BlacklistStatus.LIBERATION;
      const isTemporal = penaltyType === PenaltyType.TEMPORAL;

      if (
        isTemporal &&
        blacklistEntry.banDurationDays &&
        !isNaN(Number(blacklistEntry.banDurationDays))
      ) {
        calculatedDays = Number(blacklistEntry.banDurationDays);
      }

      const now = new Date();
      let isActive = false;

      if (!isLiberated && isPermanent) {
        isActive = true;
      } else if (!isLiberated && isTemporal && blacklistEntry.penaltyEndDate) {
        isActive = new Date(blacklistEntry.penaltyEndDate) > now;
      }

      response.penaltyApplied = {
        penaltyType: penaltyType,
        penaltyStartDate: blacklistEntry.penaltyStartDate,
        penaltyEndDate: blacklistEntry.penaltyEndDate,
        calculatedDays,
        observation: blacklistEntry.observation,
        isPermanent,
        isActive: !isLiberated && isActive,
      };
    }

    return response;
  }
}
