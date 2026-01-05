Aquí tienes la información organizada y con el endpoint de actualización de envíos incluido:

# Proyecto de Gestión de Envíos

Este proyecto gestiona los envíos realizados por los Ingenios durante el periodo de zafra, incluyendo la operación de descarga de azúcar. El sistema permite gestionar usuarios, autenticación, envíos, estatus y una lista negra de motoristas.

## Arquitectura

### Módulo de Autenticación

- **Endpoint de login** `POST /login` LISTO
  - **Parámetros:**
    - `user`: Nombre de usuario.
    - `rol`: Rol del usuario (`admin`, `cliente/ingenio`, `bot`).
    - `password`: Contraseña del usuario.
    
    Hacer login de tipo admin
    ```json
    {
        "user" : "admin_user",
        "password" : "password",
        "rol" : "admin"
    }
    ```
    Hacer login de tipo Ingenio cliente
     ```json
    {
        "user" : "Cabanias",
        "password" : "password",
        "rol" : "ingenio/cliente"
    }
    ```

- **Endpoint de registrar usuario** `POST api/auth/register` LISTO
    - **Parámetros:**
        - `user`: Nombre de usuario.
        - `rol`: Rol del usuario (`admin`, `bot`).
        - `password`: Contraseña del usuario.
    ```json
    {
        "username" : "tes333t",
        "password" : "123",
        "role" : "admin"
    }
    ```
### Modulo de clientes/Ingenios (mills)

- **Endpoint para crear cliente** `POST /api/mills/register` (LISTO)
  - **Parámetros:**
    - `ingenioCode`: Identificador único del cliente (ya existente en la tabla de clientes).
    - `username`: Nombre del cliente.
    - `password`: Contraseña del cliente.

    Crear un cliente/ingenio (solamente un usuario con jwt de tipo admin puede)
    ```json
        {
            "username" : "Cabanias",
            "ingenioCode" : "1234",
            "password" : "password"
        }
    ```
- **Endpoint para listar clientes** `GET api/mills/` (LISTO)
    - **Parametros: ***
        - `Header jwt `: De tipo administrador

### Módulo de Shipments

- **Endpoint para crear un envío** `POST /shipments` (LISTO)
  - **Header:** `jwt` (Token JWT para autenticación).
  - **Body:** JSON con la siguiente estructura:

    ```json
    {
        "codigo_gen": "string",   // Código que identifica el envío
        "producto": "string",     // Nombre del producto
        "tipo_operacion": "carga" | "descarga",  // Tipo de operación
        "tipo_carga": "granel" | "ensacada",   // Tipo de carga
        "vehiculo": {
            "motorista": {
                "licencia": "string",   // Licencia del motorista
                "nombre": "string"      // Nombre del motorista
            },
            "placa": "string",  // Placa del vehículo (cabezal)
            "placa_remolque": "string",  // Placa del remolque
            "tipo_camion": "string"  // Tipo de camión (por ejemplo, tráiler, camión pequeño, etc.)
        },
        "transportista": {
            "nombre": "string"  // Nombre de la empresa transportista
        },
        "codigo_ingenio": "string",  // Código único del ingenio que envía el producto
        "cantidad_producto": "number",  // Cantidad del producto
        "unidad_medida": "string"  // Unidad de medida del producto (ej. toneladas, kilogramos)
    }
    ```

- **Endpoint para actualizar un envío** `PUT /shipments` (LISTO)
  - **Body:** JSON con la siguiente estructura:

    ```json
    {
        "codigo_gen": "string",   // Código que identifica el envío
        "producto": "string",     // Nombre del producto
        "tipo_operacion": "carga" | "descarga",  // Tipo de operación
        "tipo_carga": "granel" | "ensacada",   // Tipo de carga
        "vehiculo": {
            "motorista": {
                "licencia": "string",   // Licencia del motorista
                "nombre": "string"      // Nombre del motorista
            },
            "placa": "string",  // Placa del vehículo (cabezal)
            "placa_remolque": "string",  // Placa del remolque
            "tipo_camion": "string"  // Tipo de camión
        },
        "transportista": {
            "nombre": "string"  // Nombre de la empresa transportista
        },
        "codigo_ingenio": "string",  // Código único del ingenio que envía el producto
        "cantidad_producto": "number",  // Cantidad del producto
        "unidad_medida": "string"  // Unidad de medida del producto
    }
    ```

- **Endpoint para obtener un envío por código de generación** `GET /shipments/{codigo_gen}` 

- **Endpoint para obtener envíos por ingenio (con paginación y filtrado por fecha)** `GET /shipments/{codigo_ingenio}` (LISTO)

- **Endpoint para obtener todos los envíos (con paginación)** `GET /shipments` (LISTO)

- **Endpoint para obtener envíos por último estatus (con rango de fechas)** `GET /shipments/status/{type}` (LISTO)

### Módulo de Estatus

- **Endpoint para actualizar el estatus de un envío** `PUT /status` (LISTO)
  - **Parámetros:**
    - `codigo_gen`: Código de generación del envío.
    - `nuevo_estatus`: Nuevo estatus del envío.
    - **Nota:** Se agrega automáticamente la fecha y hora de la actualización.

- **Endpoint para obtener el estatus de un envío por código de generación** `GET /status/{codigo_gen}` (LISTO)

### Módulo de Blacklist

- **Endpoint para agregar a la lista negra** `POST /blacklist`
  - **Parámetros:**
    - `licencia_motorista`: Licencia del motorista a agregar a la lista negra.
    - `observacion`: Motivo o comentario sobre la inclusión en la lista negra.

- **Endpoint para obtener información de la lista negra** `GET /blacklist/{licencia}`

## Infraestructura

- **Docker**
  - Crear archivo `Dockerfile` para configurar el contenedor.
  - Crear archivo `docker-compose.yml` para gestionar servicios relacionados.

- **Servidores**
  - Configuración de servidor de test/dev para pruebas de QA.

- **Versionamiento**
  - Configuración de repositorio de código.
  - Estructura de ramas:
    - `Main`: Rama de producción.
    - `Test`: Rama de testing.
    - `Dev`: Rama de desarrollo.
  - Crear tags/releases para despliegues controlados.