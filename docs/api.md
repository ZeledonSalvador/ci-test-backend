# Documentacion tecnica API (toda)

El sistema comprende de 8 modulos, que funcionan de esta manera


# Auth

Este modulo es meramente auxiliar, aunque existe los endpoints de login y register no es tan necesario usarlos

## Login api/login POST

```ts
    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }
```

Lo que espera es un `LoginDto` con esto:

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

El formato de `expiration` solamente se tomara en cuenta solo y cuando `rol` sea `bot`, y los formatos de `expiration` son:

- unlimited (para dar 25 anios de expiracion del jwt)
- {number}{fomattime} -> 1d (un dia), 2d (dos dias), 30s (30 segundos)

Lo que siempre devolvera sera un jwt:

```ts
export class resLogin {
    access_token: string;
}
```

El payload del jwt contiene lo siguiente: 

```ts
export class JwtPayloadDto {
    username: string;
    sub: number; // Esto es el id del user xd
    roles: Role[];
}
```

## Register api/register POST

```ts
    @Post('register')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async register(@Body() registerDto: RegisterDto) : Promise<Users> {
        return this.authService.register(registerDto);
    }
```

Lo que espera es un `RegisterDto` con esto:

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

Y lo que devolvera sera una instancia del User creado 


# Mill (Ingenios)

## Create api/mills/register (POST)

```ts
    @Post('register')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async register(@Body() registerDto: RegisterMillDto) {
        console.log('Esto es lo que viene del request desde controller: ', registerDto);
        return this.millsService.create(registerDto);
    }
```

Este endpoint esta protegido y solamente un Admin puede crear uno nuevo y espera un json con este formato:

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

El `ingenicode` tiene que ser unico, o si no dara un error
El `username` tiene que ser unico tambien, y sin espacios
La `password` sera la contrasena para iniciar sesion mas tarde

Lo que devuelve es la instancia del `user` y `cliente` creados

## Login api/mills/login (POST)

```ts
    @Post('login')
    async login(@Body() loginDto: LoginSimpleDto) {
        return await this.millsService.login(loginDto);
    }
```

Este endpoint funciona exactamente igual a `Login api/login POST` con la diferencia en que no hace falta poner la key `rol` por que se sabe que es `cliente` (ingenio, mill), por lo tanto lo que recibe es:

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

`username` es el nombre de usuario con cual se creo el cliente
`password` es la contrasena con la cual se creo el cliente/ingenio/mill
`expiration` esta clave se puede obviar en el contexto de login de ingenios

## Get all api/mills/ (GET)

```ts
    @Get()
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async findAll() {
        return this.millsService.findAll();
    }
```

Este endpoint obtiene todos los ingenios registrados, y solamente un admin puede acceder a ellos, devuelve un array con cada instancia de cada ingenio

## Get by Username api/mills/{username_param} (GET)

```ts
    @Get(':username')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async findOne(@Param('username') username: string) {
        return this.millsService.findOneByUsername(username);
    }
```

Este endpoint obtiene un registro por su `username`, solamente un admin puede acceder, y devuelve un registro de tipo User

# bots (Programas)

Este modulo esta pensando como un tipo usuario para que se ocupe desde todos los programas que van a consumir esa api

## Login api/bot/login POST

```ts
    @Post('login')
    async login(@Body() loginDto: LoginSimpleDto) : Promise<resLogin> {
        return await this.botService.login(loginDto);
    }
```

Tambien recibe un `LoginSimpleDto` de esta forma:

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

`username` es el nombre de usuario con cual se creo el cliente
`password` es la contrasena con la cual se creo el cliente/ingenio/mill
`expiration` Esta clave en este contexto si es importante, ya que define el timpo de expiracion del jwt, si expiration no se define por defecto sera de un dia, pero claro, no es factible estar recompilando cada programa a diario para cada nuevo jwt, asi que si lo pones asi:

```json
{
    "username" : "programa_transacciones",
    "password" : "123",
    "expiration" : "unlimited"
}
```

`unlimited` el json durara 25 años con vigencia (esto es asi por seguridad)

## Create api/bot/register POST

```ts
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @Post('register')
    async register(@Body() registerDto: RegisterSimpleDto) {
        return await this.botService.register(registerDto);
    }
```

Recibe un `RegisterSimpleDto` de esta manera:

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

`username` El nombre de usuario definido en el register
`password` La contrasena definida en el register

al registrarse solamente dara la intancia del bot (user) registrado

## Get all api/bot/ GET

Obtiene a todos los usuarios de tipo bot

```ts
  @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @Get()
    async getAll() {
        return await this.botService.findAll();
    }
```

Solamete un admin puede obtener los datos, devuelve un array de todos los bots (users)

# Users (Admins)

Este modulo funciona parecido a mills, bots (ya que todos decienden del modulo Auth)

## Login api/user/login POST

Logea/authoriza a un usuario de tipo `admin`

```ts
   @Post('login')
    async login(@Body() loginDto: LoginSimpleDto) {
      return await this.usersService.login(loginDto);
    }
```
Tambien recibe un `LoginSimpleDto` de esta forma:

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

`username` es el nombre de usuario con cual se creo el user admin
`password` es la contrasena con la cual se creo el user admin

## Create api/user (POST)

registra a un nuevo usuario de tipo `admin`, solamente otro usuario de tipo `admin` puede registrarlo

```ts
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @Post('register')
    async register(@Body() registerDto: RegisterSimpleDto) {
      return await this.usersService.register(registerDto);
    }
```

Recibe un `RegisterSimpleDto` de esta manera:

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


# Shipping (envios por los ingenios)

Este es uno de los modulos principales al igual que el Auth, ya que es el que se encarga de registrar los envios por los ingenios


## Crear api/shipping/ POST

```ts
    @Post()
    @Roles(Role.ADMIN, Role.CLIENT)
    async createShipment(@Body() createShipmentDto: CreateShipmentDto):
        Promise<{ shipment?: Shipments; logs: string[] }> {
        return this.shipmentsService.createShipment(createShipmentDto);
    }
```

Este recibe como entrada un `CreateShipmentDto` de esta forma: 

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
    @IsOptional()
    placa_remolque?: string;

    @IsString({ message: 'El tipo de camión es requerido y debe ser una cadena.' })
    @IsNotEmpty({ message: 'El tipo de camión es un campo requerido.' })
    tipo_camion: string;
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

    @IsEnum(TipoOperacion, { message: 'El tipo de operación debe ser "carga" o "descarga".' })
    tipo_operacion: TipoOperacion;

    @IsEnum(TipoCarga, { message: 'El tipo de carga debe ser "granel" o "ensacada".' })
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

Validaciones y funciones:

`unidad_medida` debe ser de estos tipos: 
```ts
    export enum MassUnit {
    Gram = 'g',
    Kilogram = 'kg',
    Ton = 't',
    Milligram = 'mg',
    Microgram = 'µg',
    Pound = 'lb',
    Ounce = 'oz',
    Stone = 'st',
    MetricTon = 'mt',
}
```

`codigo_gen` debe de ser unico, ya que es el codigo de generacion (uiid) de la factura
`codigo_ingenio` es al ingenio que pertenece ese envio
