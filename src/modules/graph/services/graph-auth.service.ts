// src/modules/graph/services/graph-auth.service.ts

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import {
  ConnectionTestResult,
  ConfigurationTestResult,
} from '../interfaces/graph-auth.interface';
import * as fs from 'fs';

@Injectable()
export class GraphAuthService {
  private readonly logger = new Logger(GraphAuthService.name);
  private msalClient: ConfidentialClientApplication;
  private isInitialized = false;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly templatesDir: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM');
    this.fromName =
      this.configService.get<string>('FROM_NAME') || 'Notificaciones ALMAPAC';
    this.templatesDir =
      this.configService.get<string>('TEMPLATE_DIR') ||
      './src/modules/email/templates';

    this.initializeMsalClient();
  }

  private initializeMsalClient(): void {
    try {
      const tenantId = this.configService.get<string>('AZURE_TENANT_ID');
      const clientId = this.configService.get<string>('AZURE_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'AZURE_CLIENT_SECRET',
      );

      if (!tenantId || !clientId || !clientSecret) {
        const missing = [];
        if (!tenantId) missing.push('AZURE_TENANT_ID');
        if (!clientId) missing.push('AZURE_CLIENT_ID');
        if (!clientSecret) missing.push('AZURE_CLIENT_SECRET');

        this.logger.error(`Variables faltantes: ${missing.join(', ')}`);
        this.isInitialized = false;
        return;
      }

      const msalConfig = {
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`,
          clientSecret,
        },
      };

      this.msalClient = new ConfidentialClientApplication(msalConfig);
      this.isInitialized = true;
      this.logger.log('Graph Auth Service inicializado correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar Graph Auth Service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Obtener token de acceso para Graph API
   */
  async getAccessToken(): Promise<string> {
    if (!this.isInitialized) {
      throw new InternalServerErrorException(
        'Graph Auth Service no inicializado',
      );
    }

    try {
      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      if (!result?.accessToken) {
        throw new Error('No se pudo obtener token de acceso');
      }

      return result.accessToken;
    } catch (error) {
      this.logger.error('Error al obtener token:', error);
      throw new InternalServerErrorException(
        'Error de autenticación con Microsoft Graph',
      );
    }
  }

  /**
   * Crear cliente de Graph API autenticado
   */
  createGraphClient(): Client {
    if (!this.isInitialized) {
      throw new InternalServerErrorException(
        'Graph Auth Service no inicializado',
      );
    }

    return Client.init({
      authProvider: async (done) => {
        try {
          const token = await this.getAccessToken();
          done(null, token);
        } catch (error) {
          done(error, null);
        }
      },
    });
  }

  /**
   * Verificar estado del servicio
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Test de conexión a Microsoft Graph API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        message: 'Servicio de Graph Auth no inicializado correctamente',
        timestamp: new Date(),
        details: {
          error: 'Servicio no inicializado',
          fromEmail: this.fromEmail || 'No configurado',
          authProviderExists: !!this.msalClient,
        },
      };
    }

    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('Error al obtener el token de acceso');
      }

      this.logger.log('Token de acceso obtenido correctamente');

      const graphClient = this.createGraphClient();

      try {
        const response = await graphClient
          .api('/users')
          .top(1)
          .select('id,userPrincipalName')
          .get();

        this.logger.log('Acceso exitoso al endpoint de usuarios de Graph API');

        return {
          success: true,
          message: 'Conexión exitosa a Microsoft Graph API',
          timestamp: new Date(),
          details: {
            connectionType: 'Application (Client Credentials)',
            fromEmail: this.fromEmail,
            fromName: this.fromName,
            templatesDir: this.templatesDir,
            tokenObtained: true,
            graphApiAccess: true,
            usersFound: response?.value?.length || 0,
          },
        };
      } catch (apiError) {
        this.logger.warn(
          'La llamada a Graph API falló pero el token es válido:',
          apiError.message,
        );

        return {
          success: true,
          message: 'Autenticación exitosa pero acceso limitado a la API',
          timestamp: new Date(),
          details: {
            connectionType: 'Application (Client Credentials)',
            fromEmail: this.fromEmail,
            fromName: this.fromName,
            templatesDir: this.templatesDir,
            tokenObtained: true,
            graphApiAccess: false,
            warning: apiError.message,
          },
        };
      }
    } catch (error) {
      this.logger.error('Prueba de conexión falló:', error);

      return {
        success: false,
        message: `Prueba de conexión falló: ${error.message}`,
        timestamp: new Date(),
        details: {
          error: error.message || 'Error desconocido',
          fromEmail: this.fromEmail,
          authProviderExists: !!this.msalClient,
        },
      };
    }
  }

  /**
   * Test de configuración completa
   */
  async testConfiguration(): Promise<ConfigurationTestResult> {
    const config = {
      AZURE_TENANT_ID: this.configService.get<string>('AZURE_TENANT_ID'),
      AZURE_CLIENT_ID: this.configService.get<string>('AZURE_CLIENT_ID'),
      AZURE_CLIENT_SECRET: this.configService.get<string>(
        'AZURE_CLIENT_SECRET',
      ),
      EMAIL_FROM: this.configService.get<string>('EMAIL_FROM'),
      FROM_NAME: this.configService.get<string>('FROM_NAME'),
      TEMPLATE_DIR: this.configService.get<string>('TEMPLATE_DIR'),
      PORTAL_CLIENTES: this.configService.get<string>('PORTAL_CLIENTES'),
      QUICKPASS: this.configService.get<string>('QUICKPASS'),
    };

    const missing = [];
    const configured = [];

    Object.entries(config).forEach(([key, value]) => {
      if (!value) {
        missing.push(key);
      } else {
        if (key === 'AZURE_CLIENT_SECRET') {
          configured.push(`${key}: [CONFIGURADO]`);
        } else {
          configured.push(`${key}: ${value}`);
        }
      }
    });

    const templatesExist = fs.existsSync(this.templatesDir);
    const templateFiles = templatesExist
      ? fs.readdirSync(this.templatesDir).filter((f) => f.endsWith('.hbs'))
      : [];

    const isValid = missing.length === 0;

    return {
      success: isValid,
      message: isValid
        ? 'Todas las variables de configuración requeridas están establecidas'
        : `Configuración faltante requerida: ${missing.join(', ')}`,
      timestamp: new Date(),
      details: {
        configured,
        missing,
        serviceInitialized: this.isInitialized,
        authProviderExists: !!this.msalClient,
        graphClientExists: true, // Siempre true si está inicializado
        templatesDirectory: {
          path: this.templatesDir,
          exists: templatesExist,
          templateFiles: templateFiles,
        },
      },
    };
  }
}
