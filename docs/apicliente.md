# Documentación de la API

Esta API permite gestionar la creación y autenticación de ingenios, así como la gestión de envíos realizados por estos. A continuación, se detallan los módulos disponibles y cómo interactuar con ellos.

## Módulo: Ingenios

### Descripción
Este módulo gestiona la creación y autenticación de ingenios en el sistema.

### Endpoints

#### 1. **Iniciar Sesión en un Ingenio**
- **Método**: `POST /api/mills/login`
- **Descripción**: Permite que un ingenio inicie sesión en el sistema.
- **Datos de Entrada**:
  ```json
  {
    "username": "tu_usuario",
    "password": "tu_contraseña"
  }
  ```
- **Salida**: Retorna un token JWT que se utiliza para autenticar futuras solicitudes.
- **Errores**: Si el usuario o la contraseña son incorrectos, se devuelve un mensaje de error.

---

## Módulo: Envíos

### Descripción
Este módulo se encarga de gestionar los envíos realizados por los ingenios.

### Endpoints

#### 1. **Crear un Envío**
- **Método**: `POST /api/shipping/`
- **Descripción**: Crea un nuevo envío en el sistema.
- **Datos de Entrada**:
  ```json
  {
    "codigo_gen": "código único de generación (UNICO)",
    "producto": "nombre del producto",
    "tipo_operacion": "C: Carga, D: Descarga",
    "tipo_carga": "G: Granel, S: Sacos",
    "vehiculo": {
      "motorista": {
        "licencia": "licencia del motorista",
        "nombre": "nombre del motorista"
      },
      "placa": "placa del vehículo",
      "placa_remolque": "placa del remolque",
      "tipo_camion": "V: volteo, R: Rastra"
    },
    "transportista": {
      "nombre": "nombre del transportista"
    },
    "codigo_ingenio": "código del ingenio (UNICO)",
    "cantidad_producto": "Cantidad del producto : number",
    "unidad_medida": "g, kg, t, etc."
  }
  ```
- **Salida**: Confirmación del envío creado.
- **Errores**: Si los datos son inválidos o incompletos, se devuelve un mensaje de error.

#### 2. **Actualizar un Envío**
- **Método**: `PUT /api/shipping/`
- **Descripción**: Actualiza un envío existente. Solo se deben enviar los campos que se desean modificar (con el mismo formato que se uso para crear el envio).
- **Salida**: Confirmación de que el envío ha sido actualizado.
- **Errores**: No se puede actualizar un envío si su estado ha cambiado a "prechequeado".

#### 3. **Obtener Envíos por Código de Ingenio**
- **Método**: `GET /api/shipping/ingenio/{ingenio_code}`
- **Descripción**: Recupera todos los envíos relacionados con un ingenio específico.
- **Datos de Entrada**:
  - **page**: Número de página para paginación.
  - **size**: Cantidad de registros por página.
  - **startDate**: Fecha de inicio para filtrar por rango (Opcional)
  - **endDate**: Fecha de fin para filtrar por rango (Opcional)
- **Salida**: Lista de envíos asociados al ingenio.
- **Consideraciones**: Si solo se proporciona `startDate` y `endDate` no está definido, se obtendrán las fechas correspondientes al mismo día especificado en `startDate`. Si ambos parámetros (`startDate` y `endDate`) están presentes, se obtendrá el rango de fechas entre ellos.

#### 4. **Obtener Estado por Código de Generación**
- **Método**: `GET api/status/shipment/{gen_code}`
- **Descripción**: Este endpoint permite recuperar el estado del envío asociado al código de generación proporcionado.
- **Datos de Entrada**:
  - **gen_code**: El código de generación que se incluye en la URL.
  - **current**: Parámetro opcional. Si se establece en `true`, se devolverá el último estado registrado del envío.
- **Salida**: Se proporcionará el detalle del envío específico, que incluirá la siguiente información:

```json
[
    {
        "id": 1,
        "status": "En Transito",
        "createdAt": "2024-10-14T21:38:39.437Z",
        "date": "14 de October de 2024",
        "time": "15:38:39"
    },
    {
        "id": 2,
        "status": "Documento validado",
        "createdAt": "2024-10-14T21:40:44.550Z",
        "date": "14 de October de 2024",
        "time": "15:40:44"
    },
    {
        "id": 3,
        "status": "Prechequeado",
        "createdAt": "2024-10-14T21:48:07.590Z",
        "date": "14 de October de 2024",
        "time": "15:48:07"
    }
]
```


#### 5. **Obtener Envío por Código de Generación**
- **Método**: `GET /api/shipping/{gen_code}`
- **Descripción**: Recupera el envío correspondiente al código de generación proporcionado.
- **Salida**: Detalle del envío específico con estos datos: 

```json
    {
    "id": 1002,
    "codeGen": "12402623-51a7-47d3-8def-6e36bd4279bb",
    "product": "Azucar a granel",
    "operationType": "carga",
    "loadType": "granel",
    "transporter": "Pedidos YA",
    "productQuantity": 32,
    "productQuantityKg": 32000,
    "unitMeasure": "t",
    "createdAt": "2024-10-14T21:38:39.070Z",
    "updatedAt": "2024-10-14T21:38:39.070Z",
    "driver": {
        "id": 1002,
        "license": "343232",
        "name": "Mario",
        "createdAt": "2024-10-14T21:45:09.403Z",
        "updatedAt": "2024-10-14T21:45:09.403Z"
    },
    "vehicle": {
        "id": 1,
        "plate": "C2332",
        "trailerPlate": "R3323",
        "truckType": "Rastra",
        "createdAt": "2024-10-09T21:48:28.163Z",
        "updatedAt": "2024-10-09T21:48:28.163Z"
    },
    "statuses": [
        {
            "id": 1,
            "status": "En Transito",
            "createdAt": "2024-10-14T21:38:39.437Z",
            "date": "14 de October de 2024",
            "time": "15:38:39"
        },
        {
            "id": 2,
            "status": "Documento validado",
            "createdAt": "2024-10-14T21:40:44.550Z",
            "date": "14 de October de 2024",
            "time": "15:40:44"
        },
        {
            "id": 3,
            "status": "Prechequeado",
            "createdAt": "2024-10-14T21:48:07.590Z",
            "date": "14 de October de 2024",
            "time": "15:48:07"
        }
    ]
}
```



