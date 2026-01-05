USE ingenioapi;

-- 1. Agregar columnas 'ingenio_nav_code' y 'name' a la tabla 'Clients' y actualizar los valores según 'ingenio_code'
ALTER TABLE Clients
ADD ingenio_nav_code NVARCHAR(50) NULL,   -- Nueva columna para código de navegación
    name NVARCHAR(100) NULL;               -- Nueva columna para el nombre del ingenio

-- Actualizar los valores en las nuevas columnas según 'ingenio_code'
UPDATE Clients
SET ingenio_nav_code = '001001-002', name = 'Ingenio El Angel'
WHERE ingenio_code = 'IEA';

UPDATE Clients
SET ingenio_nav_code = '001001-004', name = 'Ingenio La Magdalena'
WHERE ingenio_code = 'ILM';

UPDATE Clients
SET ingenio_nav_code = '001001-001', name = 'Ingenio Jiboa'
WHERE ingenio_code = 'JB';

UPDATE Clients
SET ingenio_nav_code = '001001-003', name = 'Ingenio La Cabaña'
WHERE ingenio_code = 'ILC';

-- Ahora cambiamos las columnas a NOT NULL
ALTER TABLE Clients
ALTER COLUMN ingenio_nav_code NVARCHAR(50) NOT NULL;

ALTER TABLE Clients
ALTER COLUMN name NVARCHAR(100) NOT NULL;


-- 2. Agregar las columnas 'magnetic_card' y 'activity_number' a la tabla 'Shipments'
ALTER TABLE Shipments
ADD magnetic_card NVARCHAR(50) NULL,   -- Columna opcional para tarjeta magnética
    activity_number INT NOT NULL DEFAULT 2;  -- Columna para el número de actividad con valor predeterminado de 2


-- 3. Crear la tabla 'ShipmentLogs'
CREATE TABLE ShipmentLogs (
    id INT PRIMARY KEY IDENTITY,              -- ID único del registro
    shipment_id INT NOT NULL,                 -- Llave foránea a la tabla Shipments
    log_type NVARCHAR(50) NOT NULL,           -- Tipo de registro (ej. 'estado', 'comentario', 'observación')
    log_text NVARCHAR(255) DEFAULT NULL,      -- Texto descriptivo del registro
    created_at DATETIME DEFAULT GETDATE(),    -- Fecha de creación del registro
    updated_at DATETIME DEFAULT GETDATE(),    -- Fecha de actualización del registro
    FOREIGN KEY (shipment_id) REFERENCES Shipments(id) ON DELETE CASCADE  -- Relación con la tabla Shipments
);


-- 4. Crear la tabla 'LogMetadata'
CREATE TABLE LogMetadata (
    id INT PRIMARY KEY IDENTITY,              -- ID único del metadato
    log_id INT NOT NULL,                      -- Llave foránea a la tabla ShipmentLogs
    metadata_key NVARCHAR(50) NOT NULL,       -- Clave del metadato (ej. "previousStatus", "newStatus")
    metadata_value NVARCHAR(255) NOT NULL,    -- Valor del metadato
    FOREIGN KEY (log_id) REFERENCES ShipmentLogs(id) ON DELETE CASCADE  -- Relación con la tabla ShipmentLogs
);


-- 5. Eliminar la tabla 'Invalidated_Shipments' y crearla de nuevo con la nueva estructura
IF OBJECT_ID('dbo.Invalidated_Shipments', 'U') IS NOT NULL
    DROP TABLE dbo.Invalidated_Shipments;

-- Crear la tabla 'Invalidated_Shipments' con la nueva estructura
CREATE TABLE Invalidated_Shipments (
    id INT PRIMARY KEY IDENTITY,               -- Identificador único
    code_gen NVARCHAR(50) NOT NULL,            -- Código único de generación
    json_data NVARCHAR(MAX) NOT NULL,          -- Campo para almacenar JSON, sin restricciones de tamaño
    reason NVARCHAR(MAX),                      -- Campo para almacenar observaciones
    created_at DATETIME DEFAULT GETDATE(),     -- Fecha de creación
    updated_at DATETIME DEFAULT GETDATE()      -- Fecha de actualización
);


-- 6. Eliminar la columna 'observation' de la tabla 'Status'
ALTER TABLE Status
DROP COLUMN observation;


-- 7. Renombrar la tabla 'Blacklist' a 'BlacklistDrivers'
EXEC sp_rename 'Blacklist', 'BlacklistDrivers';


-- 8. Crear la tabla 'Queue'
CREATE TABLE Queue (
    id INT PRIMARY KEY IDENTITY,               -- Identificador único de la entrada en la cola
    shipment_codeGen NVARCHAR(50) DEFAULT NULL, -- Referencia al código único de la tabla Shipments
    type NVARCHAR(20) NOT NULL,                -- Tipo de carga (volteo, plano, etc.)
    status NVARCHAR(20) NOT NULL DEFAULT 'waiting',  -- Estado de la entrada (waiting, in_progress, completed)
    entryTime DATETIME DEFAULT GETDATE(),      -- Fecha y hora de entrada a la cola
    FOREIGN KEY (shipment_codeGen) REFERENCES Shipments(code_gen) ON DELETE CASCADE -- Relación con la tabla Shipments
);

