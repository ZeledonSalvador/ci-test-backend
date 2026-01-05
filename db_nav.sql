CREATE TABLE Audit_ALMAPAC_Registro_Interface (
    AuditID INT IDENTITY PRIMARY KEY,
    id INT, -- Llave primaria de la tabla original
    codeGen NVARCHAR(MAX), -- Campo "envioingenio" renombrado a "codeGen"
    OldStatus INT,
    NewStatus INT,
    ChangeDate DATETIME DEFAULT GETDATE(),
    OperationType NVARCHAR(50) -- 'UPDATE'
);

ALTER TABLE Audit_ALMAPAC_Registro_Interface
ADD Processed BIT DEFAULT 0;  -- Marca como no procesado por defecto

ALTER TABLE Audit_ALMAPAC_Registro_Interface
ADD Retries INT DEFAULT 0;  -- Contador de reintentos, por defecto es 0



IF OBJECT_ID('dbo.trg_Audit_ALMAPAC_Registro_Interface', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_Audit_ALMAPAC_Registro_Interface;
END;

-- Crear el trigger de nuevo
CREATE TRIGGER trg_Audit_ALMAPAC_Registro_Interface
ON dbo.[ALMAPAC$3PL Registro Interface]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Audit_ALMAPAC_Registro_Interface (
        id,
        codeGen, -- Columna "envioingenio" renombrada a "codeGen"
        OldStatus,
        NewStatus,
        OperationType
    )
    SELECT
        INSERTED.id, -- Llave primaria
        INSERTED.envioingenio AS codeGen, -- Guardar envioingenio como codeGen
        DELETED.Status AS OldStatus,
        INSERTED.Status AS NewStatus,
        'UPDATE'
    FROM INSERTED
    INNER JOIN DELETED ON INSERTED.id = DELETED.id;
END;
