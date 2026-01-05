import pyodbc
from datetime import datetime

# Configuración de la conexión a la base de datos
conn = pyodbc.connect('DRIVER={SQL Server};SERVER=localhost;PORT=1433;DATABASE=PRUEBA;UID=sa;PWD=<YourPassword>')

cursor = conn.cursor()

# 1. Obtener todos los shipments
cursor.execute("""
    SELECT id AS shipment_id, 
           current_status, 
           date_time_current_status, 
           date_time_precheckeo,
           code_gen
    FROM Shipments
""")
shipments = cursor.fetchall()

# 2. Procesar cada shipment
for shipment in shipments:
    shipment_id = shipment.shipment_id
    current_status = shipment.current_status
    date_time_current_status = shipment.date_time_current_status
    date_time_precheckeo = shipment.date_time_precheckeo
    code_gen = shipment.code_gen

    print(f"Procesando shipment {shipment_id} con code_gen {code_gen}...")

    # 3. Si current_status y date_time_current_status son NULL, obtenemos el último status
    if current_status is None or date_time_current_status is None or True:
        # Obtener el último status de este shipment
        cursor.execute("""
            SELECT TOP 1 predefined_status_id, created_at 
            FROM Status 
            WHERE shipment_id = ? 
            ORDER BY created_at DESC
        """, shipment_id)
        last_status = cursor.fetchone()

        if last_status:
            # Imprimir lo que se actualizaría
            new_current_status = last_status.predefined_status_id
            new_date_time_current_status = last_status.created_at

            print(f"  Último status encontrado: current_status = {new_current_status}, date_time_current_status = {new_date_time_current_status}")

            # 4. Verificamos si hay un status con id = 2 para actualizar date_time_precheckeo
            cursor.execute("""
                SELECT created_at 
                FROM Status 
                WHERE shipment_id = ? AND predefined_status_id = 2
            """, shipment_id)
            precheck_status = cursor.fetchone()

            if precheck_status:
                new_date_time_precheckeo = precheck_status.created_at
                print(f"  Status con id = 2 encontrado, date_time_precheckeo = {new_date_time_precheckeo}")
            else:
                new_date_time_precheckeo = None
                print(f"  No se encontró status con id = 2, date_time_precheckeo no se actualizará.")

            # Imprimir los cambios que se harían
            print(f"  Se actualizaría el shipment {shipment_id}:")
            print(f"    current_status = {new_current_status}")
            print(f"    date_time_current_status = {new_date_time_current_status}")
            print(f"    date_time_precheckeo = {new_date_time_precheckeo}")

            # Realizar la actualización en la base de datos
            cursor.execute("""
                UPDATE Shipments
                SET current_status = ?, 
                    date_time_current_status = ?, 
                    date_time_precheckeo = ?
                WHERE id = ?
            """, new_current_status, new_date_time_current_status, new_date_time_precheckeo, shipment_id)

            # Confirmar la actualización
            conn.commit()
            print(f"  Shipment {shipment_id} actualizado correctamente.")
        else:
            print(f"  No se encontró un status para el shipment {shipment_id}.")
    else:
        print(f"  El shipment {shipment_id} ya tiene valores en current_status y date_time_current_status. No se actualizará.")

# Cerrar la conexión
conn.close()
