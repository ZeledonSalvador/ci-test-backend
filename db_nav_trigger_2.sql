DROP TRIGGER dbo.Audit_ALMAPAC_Registro_Interface_trg_UpdateStatus;

CREATE TRIGGER Audit_ALMAPAC_Registro_Interface_trg_UpdateStatus
ON [NAVALMAPAC].[dbo].[ALMAPAC$3PL Registro Interface]
AFTER UPDATE
AS
IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON i.id = d.id WHERE 
(i.Status = 2 OR i.Status = 1) AND i.Status <> d.Status)
BEGIN
    SET NOCOUNT ON;

    INSERT INTO ingenioapi.dbo.Status (shipment_id, predefined_status_id)
    SELECT s.id AS shipment_id, v.predefined_status_id
    FROM inserted i
    JOIN deleted d ON i.id = d.id
    JOIN ingenioapi.dbo.Shipments s 
        ON s.code_gen COLLATE Latin1_General_100_CS_AS = i.envioingenio COLLATE Latin1_General_100_CS_AS
    INNER JOIN (
        SELECT 1 AS Status, 6 AS predefined_status_id UNION ALL
        SELECT 1 AS Status, 7 AS predefined_status_id UNION ALL
        SELECT 2 AS Status, 10 AS predefined_status_id UNION ALL
        SELECT 2 AS Status, 11 AS predefined_status_id
    ) v ON i.Status = v.Status
    WHERE i.Status IN (1, 2)
        AND d.Status <> i.Status
        AND i.envioingenio IS NOT NULL 
        AND i.envioingenio <> ''
        AND EXISTS (SELECT 1 FROM inserted WHERE 1 = 0);
END;