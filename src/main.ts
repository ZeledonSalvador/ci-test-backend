import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { LogsSystemService } from './modules/logs/services/logs-system.service';
import * as crypto from 'crypto';

dotenv.config();

// Polyfill para crypto en contextos donde no está disponible globalmente
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = crypto.webcrypto || crypto;
}

// Variable global para el servicio de logs 
let globalLogsService: LogsSystemService | null = null;

// Manejadores globales de errores no capturados
process.on('uncaughtException', (error: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION - La aplicación continuará ejecutándose:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);

  // Intentar guardar en BD si el servicio está disponible
  if (globalLogsService) {
    globalLogsService.logUncaughtException(error).catch(err => {
      console.error('Error al guardar log en BD:', err);
    });
  }

  // No terminamos el proceso para evitar caídas
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ UNHANDLED REJECTION - La aplicación continuará ejecutándose:');
  console.error('Promesa:', promise);
  console.error('Razón:', reason);

  // Intentar guardar en BD si el servicio está disponible
  if (globalLogsService) {
    globalLogsService.logUnhandledRejection(reason, promise).catch(err => {
      console.error('Error al guardar log en BD:', err);
    });
  }

  // No terminamos el proceso para evitar caídas
});

async function bootstrap() {
  console.log('🚀 Iniciando aplicación...');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('🔧 NODE_ENV:', process.env.NODE_ENV || 'development');

  const app = await NestFactory.create(AppModule);
  console.log('✅ AppModule creado');

  // Inicializar el servicio de logs global para los manejadores de errores
  try {
    globalLogsService = app.get(LogsSystemService);
    console.log('✅ LogsSystemService inicializado correctamente');
  } catch (error) {
    console.error('⚠️  No se pudo inicializar LogsSystemService:', error.message);
    console.error('La aplicación continuará sin sistema de logs en BD');
  }

  // Prefijo global para todas las rutas bajo /api
  app.setGlobalPrefix('api');
  console.log('✅ Prefijo global configurado: /api');

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigin = isProd ? process.env.FRONTEND_ORIGIN_PROD : '*';

  app.enableCors({
    origin: allowedOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: '*',
    credentials: isProd,
  });

  console.log('✅ CORS configurado');

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
    skipMissingProperties: false,
  }));
  console.log('✅ ValidationPipe configurado');

  const config = new DocumentBuilder()
    .setTitle('Documentación de la API')
    .setDescription('Descripción de la API')
    .setVersion('1.0')
    .addTag('API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  console.log('✅ Swagger configurado en /docs');

  app.use((err: any, _req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        message: 'El cuerpo de la solicitud no es un JSON válido.',
        error: 'Bad Request',
        statusCode: 400,
      });
    }
    next(err);
  });

  await app.listen(3000);
  console.log('🎉 Aplicación iniciada exitosamente');
  console.log('📡 API disponible en: http://localhost:3000/api/');
  console.log('🏥 Health check: http://localhost:3000/api/health');
}
bootstrap();