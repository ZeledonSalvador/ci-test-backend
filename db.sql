USE master;

BEGIN TRY
    -- Forzar la desconexión de todos los usuarios de la base de datos
    IF EXISTS (SELECT name FROM sys.databases WHERE name = 'ingenioapi_prod')
    BEGIN
        DECLARE @sql NVARCHAR(MAX) = '';
        
        SELECT @sql += 'ALTER DATABASE [ingenioapi_prod] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;'
        EXEC sp_executesql @sql;
        
        DROP DATABASE ingenioapi_prod;
    END

    -- Crear la base de datos nuevamente
    CREATE DATABASE ingenioapi_prod;

    USE ingenioapi_prod;

    CREATE TABLE Users (
        id INT PRIMARY KEY IDENTITY,
        username NVARCHAR(50) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL,  -- rol de usuario (admin, bot etc.)
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );

    INSERT INTO Users 
        (username, password, role, created_at, updated_at)
    VALUES 
        ('admin_user', '$2b$12$yiJLsgnQ36JsjUq0iFQRTetS0u8nk6XOuNKIMMlTFtTbd/eaHeLdq', 'admin', GETDATE(), GETDATE()),
        ('api_middleware', '$2b$12$yiJLsgnQ36JsjUq0iFQRTetS0u8nk6XOuNKIMMlTFtTbd/eaHeLdq', 'bot', GETDATE(), GETDATE()),
        ('frontend_pretransactions', '$2b$12$yiJLsgnQ36JsjUq0iFQRTetS0u8nk6XOuNKIMMlTFtTbd/eaHeLdq', 'bot', GETDATE(), GETDATE());

    CREATE TABLE Clients (
        id INT PRIMARY KEY IDENTITY,
        ingenio_code NVARCHAR(50) NOT NULL UNIQUE,  -- Código único para identificar al cliente/ingenio
        ingenio_nav_code NVARCHAR(50) NOT NULL UNIQUE, -- Este codigo que se ocupa en nav para identificar a los ingenios
        name NVARCHAR(100) NOT NULL,
        user_id INT NOT NULL,                        -- Llave foránea que referencia a Users
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE   -- Relación con la tabla Users
    );


    -- Tabla de Motoristas
    CREATE TABLE Drivers (
        id INT PRIMARY KEY IDENTITY,
        license NVARCHAR(50) NOT NULL UNIQUE,  -- Licencia del motorista
        name NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );

    -- Tabla de Vehículos
    CREATE TABLE Vehicles (
        id INT PRIMARY KEY IDENTITY,
        plate NVARCHAR(50) NOT NULL,  -- Placa del vehículo (cabezal)
        trailer_plate NVARCHAR(50),          -- Placa del remolque (opcional)
        truck_type NVARCHAR(50) NOT NULL,     -- Tipo de camión
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );

    CREATE TABLE Shipments (
        id INT PRIMARY KEY IDENTITY,
        code_gen NVARCHAR(50) NOT NULL UNIQUE,  -- Código que identifica el envío
        product NVARCHAR(100) NOT NULL,         -- Nombre del producto
        operation_type NVARCHAR(10) NOT NULL,   -- Tipo de operación (carga o descarga)
        load_type NVARCHAR(20) NOT NULL,        -- Tipo de carga (granel o ensacada)
        driver_id INT,                          -- Llave foránea a la tabla de motoristas
        vehicle_id INT,                         -- Llave foránea a la tabla de vehículos
        ingenio_id NVARCHAR(50) NOT NULL,       -- Llave foránea a la tabla de clientes (ingenio)
        transporter NVARCHAR(100) NOT NULL,     -- Nombre de la empresa transportista
        product_quantity DECIMAL(10, 2) NOT NULL,  -- Cantidad del producto
        product_quantity_kg DECIMAL(10, 2) NOT NULL,
        unit_measure NVARCHAR(20) NOT NULL,     -- Unidad de medida del producto
        requiresSweeping CHAR(1) NOT NULL DEFAULT 'N',
        activity_number NVARCHAR(5) NOT NULL,
        magnetic_card INT DEFAULT NULL,
        current_status INT DEFAULT 1,
        date_time_current_status DATETIME DEFAULT GETDATE(), 
        date_time_precheckeo DATETIME DEFAULT NULL,
        id_nav_record INT DEFAULT NULL,
        id_pre_transaccion_leverans INT DEFAULT NULL,
        mapping BIT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (driver_id) REFERENCES Drivers(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id) ON DELETE CASCADE,
        FOREIGN KEY (ingenio_id) REFERENCES Clients(ingenio_code) ON DELETE CASCADE -- Relación con la tabla Clients
    );


    CREATE TABLE ShipmentLogs (
        id INT PRIMARY KEY IDENTITY,              -- ID único del registro
        shipment_id INT NOT NULL,                 -- Llave foránea a la tabla Shipments
        log_type NVARCHAR(50) NOT NULL,           -- Tipo de registro (ej. 'estado', 'comentario', 'observación')
        log_text NVARCHAR(255) DEFAULT NULL,          -- Texto descriptivo del registro
        created_at DATETIME DEFAULT GETDATE(),    -- Fecha de creación del registro
        updated_at DATETIME DEFAULT GETDATE(),    -- Fecha de actualización del registro
        FOREIGN KEY (shipment_id) REFERENCES Shipments(id) ON DELETE CASCADE -- Relación con la tabla Shipments
    );


    CREATE TABLE LogMetadata (
        id INT PRIMARY KEY IDENTITY,         -- ID único del metadato
        log_id INT NOT NULL,                 -- Llave foránea a la tabla ShipmentLogs
        metadata_key NVARCHAR(50) NOT NULL,  -- Clave del metadato (ej. "previousStatus", "newStatus")
        metadata_value NVARCHAR(255) NOT NULL, -- Valor del metadato
        FOREIGN KEY (log_id) REFERENCES ShipmentLogs(id) ON DELETE CASCADE -- Relación con la tabla ShipmentLogs
    );

    CREATE TABLE SysLogs (
        id INT PRIMARY KEY IDENTITY,              -- ID único del registro
        log_type NVARCHAR(50) NOT NULL,           -- Tipo de registro (ej. 'error', 'info', 'debug')
        log_text NVARCHAR(MAX) DEFAULT NULL,      -- Texto descriptivo del registro
        created_at DATETIME DEFAULT GETDATE(),    -- Fecha de creación del registro
        updated_at DATETIME DEFAULT GETDATE()     -- Fecha de actualización del registro
    );


    CREATE TABLE Invalidated_Shipments (
        id INT PRIMARY KEY IDENTITY,
        code_gen NVARCHAR(50) NOT NULL,
        reason NVARCHAR(MAX),
        client_id INT NOT NULL,
        json_data NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (client_id) REFERENCES Clients(id)
    );


    CREATE TABLE ShipmentSeals (
        id INT PRIMARY KEY IDENTITY,
        shipment_id INT NOT NULL,                      -- Relación con la tabla de envíos
        seal_code NVARCHAR(50) NOT NULL,               -- Código único de marchamo
        seal_description NVARCHAR(100),                -- Descripción del marchamo
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (shipment_id) REFERENCES Shipments(id) ON DELETE CASCADE -- Llave foránea a la tabla Shipments
    );


    CREATE TABLE ShipmentAttachments (
        id INT PRIMARY KEY IDENTITY,
        shipment_id INT NOT NULL,                  -- Llave foránea a la tabla de Shipments
        file_url NVARCHAR(MAX) NOT NULL,           -- URL del archivo adjunto
        file_name NVARCHAR(100) NOT NULL,          -- Nombre del archivo
        file_type NVARCHAR(50),                    -- Tipo de archivo (PDF, imagen, etc.)
        attachment_type CHAR(1) NOT NULL,          -- Tipo de archivo adjunto ('P' para prechequeo, 'O' para otros, etc.)
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (shipment_id) REFERENCES Shipments(id) ON DELETE CASCADE -- Relación con la tabla Shipments
    );


    CREATE TABLE PredefinedStatuses (
        id INT PRIMARY KEY IDENTITY,
        name NVARCHAR(100) NOT NULL, -- Nombre del estatus
        description NVARCHAR(255) -- Descripción adicional del estatus
    );

    -- Insertamos los estatus predefinidos
    INSERT INTO PredefinedStatuses (name, description) VALUES
    ('En Transito', 'Es cuando se hace el envío del Ingenio y termina hasta que llega a la planta, API'),
    ('Prechequeado', 'Se hace el checking en el portón con el vigilante, Pretransacción'),
    ('Transacción Autorizada', 'Es cuando todos los datos son validados correctamente en el chequeo'),
    ('Ingreso Autorizado', 'Se autoriza el acceso a la planta desde el programa de recepción de azúcar'),
    ('Autorizado portón 4', 'Se autoriza el acceso al portón 4 para validar documentos'),
    ('Pesaje Entrada pluma uno', 'Proceso cuando se abre la pluma uno al entrar'),
    ('Pesaje Entrada pluma dos', 'Proceso cuando se cierra la pluma uno al entrar'),
    ('Iniciar descarga/carga', 'El camión inicia la descarga/carga, comenzando el cronómetro'),
    ('Finalizar descarga/carga', 'El camión finaliza la descarga/carga, listo para la báscula'),
    ('Pesaje salida pluma uno', 'Proceso cuando se abre la pluma uno al salir'),
    ('Pesaje salida pluma dos', 'Proceso cuando se cierra la pluma uno al salir'),
    ('Finalizado', 'El proceso Finalizo, el status de NAV es igual a 3 (Finalizado)');

    CREATE TABLE Status (
        id INT PRIMARY KEY IDENTITY,
        shipment_id INT NOT NULL,       
        predefined_status_id INT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (shipment_id) REFERENCES Shipments(id) ON DELETE CASCADE,
        FOREIGN KEY (predefined_status_id) REFERENCES PredefinedStatuses(id) ON DELETE CASCADE
    );

    -- Tabla de Blacklist
  CREATE TABLE BlacklistDrivers (
        id INT PRIMARY KEY IDENTITY,
        driver_id INT NOT NULL,  
        observation NVARCHAR(255),              -- Motivo o comentario sobre la inclusión
        severity_level NVARCHAR(50) NULL,   -- Nivel de gravedad (grave, leve, moderada)
        ban_duration_days NVARCHAR(50) NOT NULL,         -- Duración del baneo en días
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (driver_id) REFERENCES Drivers(id)
    );


    CREATE TABLE Queue (
        id INT PRIMARY KEY IDENTITY,             -- Identificador único de la entrada en la cola
        shipment_codeGen NVARCHAR(50) DEFAULT NULL,  -- Referencia al código único de la tabla Shipments
        type NVARCHAR(20) NOT NULL,              -- Tipo de carga (volteo, plano, etc.)
        status NVARCHAR(20) NOT NULL DEFAULT 'waiting',  -- Estado de la entrada (waiting, in_progress, completed)
        entryTime DATETIME DEFAULT GETDATE(),    -- Fecha y hora de entrada a la cola
        FOREIGN KEY (shipment_codeGen) REFERENCES Shipments(code_gen) ON DELETE CASCADE -- Relación con la tabla Shipments
    );


    CREATE TABLE LeveransUsers (
        id INT PRIMARY KEY IDENTITY,          
        username NVARCHAR(100) NOT NULL,      
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );


    CREATE TABLE LeveransUserLoginHistory (
        id INT PRIMARY KEY IDENTITY,           
        leverans_user_id INT NOT NULL,         
        shift NVARCHAR(50) NOT NULL,           -- Turno en el que el usuario hizo login
        bascula NVARCHAR(50) NOT NULL,         -- Número de báscula donde hizo login
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (leverans_user_id) REFERENCES LeveransUsers(id) ON DELETE CASCADE
    );

    CREATE TABLE LeveransLogger (
        id INT PRIMARY KEY IDENTITY,                 
        leverans_user_id INT NOT NULL,
        login_history_id INT NOT NULL,             -- Referencia al login del usuario
        predefined_statuses_id INT NOT NULL,                    
        shipment_id INT NOT NULL,                  -- Referencia al shipment
        action NVARCHAR(50) NOT NULL,             
        created_at DATETIME DEFAULT GETDATE(),    
        FOREIGN KEY (predefined_statuses_id) REFERENCES PredefinedStatuses(id) ON DELETE NO ACTION,
        FOREIGN KEY (shipment_id) REFERENCES Shipments(id) ON DELETE CASCADE,  -- Modificado para CASCADE
        FOREIGN KEY (leverans_user_id) REFERENCES LeveransUsers(id) ON DELETE NO ACTION,
        FOREIGN KEY (login_history_id) REFERENCES LeveransUserLoginHistory(id) ON DELETE NO ACTION
    );  



END TRY

BEGIN CATCH
    -- Si ocurre un error, revertir la transacción
    PRINT 'Error en la creación de la base de datos: ' + ERROR_MESSAGE();
END CATCH;
