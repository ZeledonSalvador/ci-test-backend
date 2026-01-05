SELECT 
    s.id AS shipment_id,
    s.code_gen,
    s.product,
    s.operation_type,
    s.load_type,
    s.transporter,
    s.product_quantity,
    s.product_quantity_kg,
    s.unit_measure,
    s.requiresSweeping,
    s.activity_number,
    s.magnetic_card,
    s.current_status,
    s.date_time_current_status,
    s.date_time_precheckeo,
    s.id_nav_record,
    s.mapping,
    s.created_at AS shipment_created_at,
    s.updated_at AS shipment_updated_at,
    
    -- Relación con la tabla Clients (Clientes)
    c.id AS client_id,
    c.ingenio_code,
    c.ingenio_nav_code,
    c.name AS client_name,
    c.created_at AS client_created_at,
    c.updated_at AS client_updated_at,
    
    -- Relación con la tabla Drivers (Motoristas)
    d.id AS driver_id,
    d.license AS driver_license,
    d.name AS driver_name,
    d.created_at AS driver_created_at,
    d.updated_at AS driver_updated_at,
    
    -- Relación con la tabla Vehicles (Vehículos)
    v.id AS vehicle_id,
    v.plate AS vehicle_plate,
    v.trailer_plate AS vehicle_trailer_plate,
    v.truck_type AS vehicle_truck_type,
    v.created_at AS vehicle_created_at,
    v.updated_at AS vehicle_updated_at,

    -- Relación con la tabla Status (Estatus)
    st.predefined_status_id,
    ps.name AS status_name,
    ps.description AS status_description,
    st.created_at AS status_created_at,
    st.updated_at AS status_updated_at,

    -- Relación con la tabla ShipmentLogs (Registros de Envíos)
    sl.id AS shipment_log_id,
    sl.log_type AS shipment_log_type,
    sl.log_text AS shipment_log_text,
    sl.created_at AS shipment_log_created_at,
    sl.updated_at AS shipment_log_updated_at,

    -- Relación con la tabla ShipmentSeals (Marchamos de Envíos)
    ss.id AS shipment_seal_id,
    ss.seal_code AS seal_code,
    ss.seal_description AS seal_description,
    ss.created_at AS shipment_seal_created_at,

    -- Relación con la tabla ShipmentAttachments (Archivos Adjuntos de Envíos)
    sa.id AS shipment_attachment_id,
    sa.file_url AS attachment_file_url,
    sa.file_name AS attachment_file_name,
    sa.file_type AS attachment_file_type,
    sa.attachment_type AS attachment_type,
    sa.created_at AS attachment_created_at

FROM 
    Shipments s
INNER JOIN Clients c ON s.ingenio_id = c.ingenio_code
LEFT JOIN Drivers d ON s.driver_id = d.id
LEFT JOIN Vehicles v ON s.vehicle_id = v.id
LEFT JOIN Status st ON s.id = st.shipment_id
LEFT JOIN PredefinedStatuses ps ON st.predefined_status_id = ps.id
LEFT JOIN ShipmentLogs sl ON s.id = sl.shipment_id
LEFT JOIN ShipmentSeals ss ON s.id = ss.shipment_id
LEFT JOIN ShipmentAttachments sa ON s.id = sa.shipment_id

WHERE 
    s.code_gen = @shipment_code_gen

ORDER BY 
    s.created_at DESC
