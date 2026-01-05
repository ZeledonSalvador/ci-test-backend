CREATE TRIGGER trg_UpdateStatus
ON [PRUEBA].[ALMAPAC$3PL Registro Interface]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Verificar si el valor de la columna Status cambió a 1
    IF EXISTS (
        SELECT 1
        FROM Inserted i
        JOIN Deleted d ON i.[Status] <> d.[Status]
        WHERE i.[Status] = 1
    )
    BEGIN
        -- Iterar sobre las filas afectadas
        DECLARE @envioingenio NVARCHAR(50);
        DECLARE @shipment_id INT;

        DECLARE cur CURSOR FOR
        SELECT i.[envioingenio]
        FROM Inserted i
        JOIN Deleted d ON i.[Status] <> d.[Status]
        WHERE i.[Status] = 1;

        OPEN cur;
        FETCH NEXT FROM cur INTO @envioingenio;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Buscar shipment_id en ingenioapi.Shipments
            SELECT @shipment_id = s.id
            FROM [ingenioapi].[Shipments] s
            WHERE s.[code_gen] = @envioingenio;

            -- Insertar en ingenioapi.Status si shipment_id es válido
            IF @shipment_id IS NOT NULL
            BEGIN
                INSERT INTO [ingenioapi].[Status] (shipment_id, predefined_status_id)
                VALUES (@shipment_id, 6);

                INSERT INTO [ingenioapi].[Status] (shipment_id, predefined_status_id)
                VALUES (@shipment_id, 7);
            END
            ELSE
            BEGIN
                -- Manejo de errores: No se encontró shipment_id
                RAISERROR ('No se encontró un shipment_id para envioingenio: %s', 16, 1, @envioingenio);
            END

            FETCH NEXT FROM cur INTO @envioingenio;
        END;

        CLOSE cur;
        DEALLOCATE cur;
    END
END;
GO
