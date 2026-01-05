# Documentación Técnica de la API

La API está dividida en varios módulos, cada uno con funcionalidades específicas. A continuación, se detalla cada módulo con sus respectivos endpoints.

---

## Módulo: Auth
### Descripción del Módulo
Este módulo proporciona la funcionalidad básica de autenticación, como el inicio de sesión y el registro de usuarios.

### Endpoints
#### 1. **Login**
   - **Información del Endpoint**: `POST /api/login`
   - **Entrada**:
     ```ts
     export class LoginDto {
         @IsString()
         username: string;

         @IsString()
         password: string;

         @IsEnum(Role, { message: `El rol debe ser uno de los siguientes valores: ${Object.values(Role).join(', ')}` })
         rol: Role;

         @IsOptional()
         @IsString({ message: 'La propiedad "expiration" debe ser una cadena de texto' })
         @IsExpirationFormat()
         expiration?: string;
     }
     ```
     Los roles disponibles son:
     ```ts
     export enum Role {
         CLIENT = 'cliente',
         BOT = 'bot',
         ADMIN = 'admin',
     }
     ```
     El campo `expiration` se utiliza solo si el rol es `bot` y puede tener los siguientes formatos:
     - `unlimited` (25 años de expiración)
     - `{number}{format}` (ej. `1d`, `2d`, `30s`)

   - **Salida**:
     ```ts
     export class resLogin {
         access_token: string;
     }
     ```
     El JWT contiene:
     ```ts
     export class JwtPayloadDto {
         username: string;
         sub: number; // ID del usuario
         roles: Role[];
     }
     ```
   - **Errores**:
     - Credenciales incorrectas.
     - Usuario no encontrado.
   - **Consideraciones**:
     - El campo `expiration` se aplica solo para el rol `bot`.

#### 2. **Register**
   - **Información del Endpoint**: `POST /api/register`
   - **Entrada**:
     ```ts
     export class RegisterDto {
         @IsString({ message: 'El nombre de usuario es requerido y debe ser una cadena.' })
         @IsNotEmpty({ message: 'El nombre de usuario es un campo requerido.' })
         username: string;

         @IsString({ message: 'La contraseña es requerida y debe ser una cadena.' })
         @IsNotEmpty({ message: 'La contraseña es un campo requerido.' })
         password: string;

         @IsNotEmpty({ message: 'El rol es un campo requerido.' })
         @IsEnum(Role, { message: `El rol debe ser uno de los siguientes valores: ${Object.values(Role).join(', ')}` })
         role: Role;
     }
     ```
   - **Salida**: Instancia del usuario creado.
   - **Errores**:
     - Usuario ya existe.
     - Campos requeridos faltantes.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

---

## Módulo: Mill (Ingenios)
### Descripción del Módulo
Gestiona la creación y autenticación de ingenios en el sistema.

### Endpoints
#### 1. **Crear Ingenio**
   - **Información del Endpoint**: `POST /api/mills/register`
   - **Entrada**:
     ```ts
     export class RegisterMillDto {
         @IsNotEmpty()
         @IsString()
         ingenioCode: string;

         @IsNotEmpty()
         @IsString()
         username: string;

         @IsNotEmpty()
         @IsString()
         password: string;
     }
     ```
     - `ingenioCode` y `username` deben ser únicos.
   - **Salida**: Instancia del usuario y cliente creados.
   - **Errores**:
     - Código o nombre de usuario ya existe.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

#### 2. **Login Ingenio**
   - **Información del Endpoint**: `POST /api/mills/login`
   - **Entrada**:
     ```ts
     export class LoginSimpleDto {
         @IsString()
         username: string;

         @IsString()
         password: string;

         @IsOptional()
         @IsString({ message: 'La propiedad "expiration" debe ser una cadena de texto' })
         @IsExpirationFormat()
         expiration?: string;
     }
     ```
   - **Salida**: JWT.
   - **Errores**:
     - Usuario o contraseña incorrectos.

#### 3. **Obtener Todos los Ingenios**
   - **Información del Endpoint**: `GET /api/mills/`
   - **Salida**: Array con la información de todos los ingenios.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

#### 4. **Obtener Ingenio por Username**
   - **Información del Endpoint**: `GET /api/mills/{username}`
   - **Salida**: Información del ingenio correspondiente.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

---

## Módulo: Bots (Programas)
### Descripción del Módulo
Gestiona la autenticación y registro de bots que interactúan con la API.

### Endpoints
#### 1. **Login Bot**
   - **Información del Endpoint**: `POST /api/bot/login`
   - **Entrada**:
     ```ts
     export class LoginSimpleDto {
         @IsString()
         username: string;

         @IsString()
         password: string;

         @IsOptional()
         @IsString({ message: 'La propiedad "expiration" debe ser una cadena de texto' })
         @IsExpirationFormat()
         expiration?: string;
     }
     ```
   - **Salida**: JWT.
   - **Errores**:
     - Credenciales incorrectas.

#### 2. **Registrar Bot**
   - **Información del Endpoint**: `POST /api/bot/register`
   - **Entrada**:
     ```ts
     export class RegisterSimpleDto {
         @IsString({ message: 'El nombre de usuario es requerido y debe ser una cadena.' })
         @IsNotEmpty({ message: 'El nombre de usuario es un campo requerido.' })
         username: string;

         @IsString({ message: 'La contraseña es requerida y debe ser una cadena.' })
         @IsNotEmpty({ message: 'La contraseña es un campo requerido.' })
         password: string;
     }
     ```
   - **Salida**: Instancia del bot registrado.
   - **Errores**:
     - Bot ya registrado.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

#### 3. **Obtener Todos los Bots**
   - **Información del Endpoint**: `GET /api/bot/`
   - **Salida**: Array con la información de todos los bots.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

---

## Módulo: Users (Admins)
### Descripción del Módulo
Permite la administración de usuarios de tipo administrador.

### Endpoints
#### 1. **Login Admin**
   - **Información del Endpoint**: `POST /api/user/login`
   - **Entrada**:
     ```ts
     export class LoginSimpleDto {
         @IsString()
         username: string;

         @IsString()
         password: string;

         @IsOptional()
         @IsString({ message: 'La propiedad "expiration" debe ser una cadena de texto' })
         @IsExpirationFormat()
         expiration?: string;
     }
     ```
   - **Salida**: JWT.
   - **Errores**:
     - Credenciales incorrectas.

#### 2. **Registrar Admin**
   - **Información del Endpoint**: `POST /api/user/register`
   - **Entrada**:
     ```ts
     export class RegisterSimpleDto {
         @IsString({ message: 'El nombre de usuario es requerido y debe ser una cadena.' })
         @IsNotEmpty({ message: 'El nombre de usuario es un campo requerido.' })
         username: string;

         @IsString({ message: 'La contraseña es requerida y debe ser una cadena.' })
         @IsNotEmpty({ message: 'La contraseña es un campo requerido.' })
         password: string;
     }
     ```
   - **Salida**: Instancia del usuario registrado.
   - **Errores**:
     - Usuario ya registrado.
   - **Autorización**: Solo accesible para usuarios con el rol `admin`.

---

## Módulo: Shipping (Envios por los Ingenios)
### Descripción del Módulo
Se encarga de gestionar los envíos realizados por los ingenios.

### Endpoints
#### 1. **Crear Envío**
   - **Información del Endpoint**: `POST /api/shipping/`
   - **Entrada**:
     ```ts
        // DTO para Motorista
        export class MotoristaDto {
            @IsString({ message: 'La licencia del motorista es requerida y debe ser una cadena.' })
            @IsNotEmpty({ message: 'La licencia es un campo requerido.' })
            licencia: string;

            @IsString({ message: 'El nombre del motorista es requerido y debe ser una cadena.' })
            @IsNotEmpty({ message: 'El nombre es un campo requerido.' })
            nombre: string;
        }

        // DTO para Vehiculo
        export class VehiculoDto {
            @IsObject()
            @IsNotEmpty({ message: 'El motorista es un campo requerido.' })
            motorista: MotoristaDto;

            @IsString({ message: 'La placa del vehículo es requerida y debe ser una cadena.' })
            @IsNotEmpty({ message: 'La placa del vehículo es un campo requerido.' })
            placa: string;

            @IsString({ message: 'La placa del remolque debe ser una cadena.' })
            @IsNotEmpty({ message: 'La placa del remolque es un campo requerido.' })
            placa_remolque: string;


            /* 
                Esto raramente no funciona y esta
                igual de configurado que el del 
                tipo de operacion y tipo de carga
            */
            @Transform(({ value }) => {
                return typeof value === 'string' && value.length === 1
                    ? TipoCamionMap[value.toUpperCase()]
                    : value;
            })
            @IsEnum(TipoCamion, { message: `El tipo de camión debe ser "${buildMessageEnumsWithCode(TipoCamionMap)}".` })
            tipo_camion: TipoCamion;
        }

        export class TransportistaDto {
            @IsString({ message: 'El nombre del transportista es requerido y debe ser una cadena.' })
            @IsNotEmpty({ message: 'El nombre del transportista es un campo requerido.' })
            nombre: string;
        }

        export class CreateShipmentDto {
            @IsString({ message: 'El código de generación es requerido y debe ser una cadena.' })
            @IsNotEmpty({ message: 'El código de generación es un campo requerido.' })
            codigo_gen: string;

            @IsString({ message: 'El nombre del producto es requerido y debe ser una cadena.' })
            @IsNotEmpty({ message: 'El nombre del producto es un campo requerido.' })
            producto: string;

            @Transform(({ value }) => {
                return typeof value === 'string' && value.length === 1
                    ? TipoOperacionMap[value.toUpperCase()]
                    : value;
            })
            @IsEnum(TipoOperacion, { message: `El tipo de operación debe ser "${buildMessageEnumsWithCode(TipoOperacionMap)}".` })
            tipo_operacion: TipoOperacion;

            @Transform(({ value }) => {
                return typeof value === 'string' && value.length === 1
                    ? TipoCargaMap[value.toUpperCase()]
                    : value;
            })
            @IsEnum(TipoCarga, { message: `El tipo de carga debe ser "${buildMessageEnumsWithCode(TipoCargaMap)}".` })
            tipo_carga: TipoCarga;

            @IsObject()
            @IsNotEmpty({ message: 'El vehículo es un campo requerido.' })
            vehiculo: VehiculoDto;

            @IsObject()
            @IsNotEmpty({ message: 'El transportista es un campo requerido.' })
            transportista: TransportistaDto;

            @IsString({ message: 'El código del ingenio es requerido y debe ser una cadena.' })
            @IsNotEmpty({ message: 'El código del ingenio es un campo requerido.' })
            codigo_ingenio: string;

            @IsNumber({}, { message: 'La cantidad del producto debe ser un número.' })
            @IsNotEmpty({ message: 'La cantidad del producto es un campo requerido.' })
            cantidad_producto: number;

            @IsString({ message: 'La unidad de medida es requerida y debe ser una cadena.' })
            @IsNotEmpty({ message: 'La unidad de medida es un campo requerido.' })
            unidad_medida: string;
        }

     ```
   - **Salida**: Confirmación del envío creado.
   - **Errores**:
     - Datos inválidos o incompletos.
