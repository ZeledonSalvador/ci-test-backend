// src/modules/blocks/blocks.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entidad (tu ruta real)
import { ProductIngenioBlock } from 'src/models/ProductIngenioBlock';

// Controller y Service de este módulo
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

// Auth: importa tu módulo de autenticación si usas @UseGuards(AuthGuard) en el controller
// Si usas guard GLOBAL (APP_GUARD en AppModule), igual puedes dejarlo; no estorba.
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductIngenioBlock]),

    // Si tu controller usa @UseGuards(AuthGuard), necesitas acceso a JwtService/UsersService.
    // forwardRef rompe posibles ciclos (p.ej. AuthModule -> UsersModule -> X -> BlocksModule).
    forwardRef(() => AuthModule),
  ],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [
    // Exporta el service para usar el guard de negocio en otros módulos (ej. ShipmentsService)
    BlocksService,
  ],
})
export class BlocksModule {}
