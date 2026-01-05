import pyodbc
import json
import os
from datetime import datetime

# Configuración de conexión a la base de datos
conn_str = 'DRIVER={SQL Server};SERVER=10.10.21.9\\NAV2016;DATABASE=PRUEBA;UID=Rodrigo.Franco;PWD=Fr@nco12'

# Conectar a la base de datos
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

# Valores por defecto según el tipo de datos
DEFAULT_VALUES = {
    "int": 0,
    "bigint": 0,
    "decimal": 0.0,
    "float": 0.0,
    "numeric": 0.0,
    "bit": 0,
    "char": "",
    "varchar": "",
    "nvarchar": "",
    "text": "",
    "datetime": "1900-01-01T00:00:00",
    "date": "1900-01-01",
    "time": "00:00:00",
}

# Función para obtener columnas y tipos de datos de la tabla
def get_table_columns_and_types(table_name):
    try:
        query_columns = f"""
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '{table_name}'
        """
        cursor.execute(query_columns)
        return {
            row[0]: row[1].lower()
            for row in cursor.fetchall()
            if row[1].lower() not in ["timestamp", "rowversion"]  # Excluir columnas problemáticas
        }
    except pyodbc.Error as e:
        print(f"Error al obtener columnas de la tabla {table_name}: {e}")
        return {}

# Función para convertir valores al tipo esperado
def convert_value(value, data_type):
    try:
        if value is None:
            return DEFAULT_VALUES.get(data_type, "NULL")
        if data_type in ["int", "bigint"]:
            return int(value)
        elif data_type in ["decimal", "float", "numeric"]:
            return float(value)
        elif data_type == "bit":
            return 1 if str(value).lower() in ["true", "1", "yes"] else 0
        elif data_type in ["char", "varchar", "nvarchar", "text"]:
            return str(value)
        elif data_type in ["datetime", "date", "time"]:
            return datetime.fromisoformat(value).isoformat()
        else:
            return str(value)
    except (ValueError, TypeError):
        return DEFAULT_VALUES.get(data_type, "NULL")

# Función para insertar registros desde un JSON
def upload():
    if not os.path.exists('backup.json'):
        print("No hay un archivo de backup para subir.")
        return

    with open('backup.json', 'r', encoding='utf-8') as f:
        records_json = json.load(f)

    if not records_json:
        print("El archivo de backup está vacío.")
        return

    # Obtener columnas y tipos de datos de la tabla
    table_name = "ALMAPAC$3PL Registro Interface"
    table_columns = get_table_columns_and_types(table_name)
    if not table_columns:
        print(f"No se pudieron obtener columnas para la tabla {table_name}.")
        return

    print("Columnas obtenidas:", table_columns)

    # Iterar sobre los registros y construir consultas de inserción dinámicas
    for record in records_json:
        # Filtrar columnas que están en el JSON y en la tabla
        valid_columns = [col for col in table_columns if col in record]
        if not valid_columns:
            print("No hay columnas válidas para insertar en este registro:", record)
            continue

        # Construir lista de valores
        columns_str = ', '.join(f"[{col}]" for col in valid_columns)
        values_str = ', '.join(
            f"'{convert_value(record[col], table_columns[col])}'" if record[col] is not None else "NULL"
            for col in valid_columns
        )

        # Construir consulta de inserción
        insert_query = f"INSERT INTO [{table_name}] ({columns_str}) VALUES ({values_str})"
        print(insert_query)
        # Ejecutar la consulta
        try:
            cursor.execute(insert_query)
            print(f"Registro insertado: {record.get('envioingenio', 'Sin ID')}")
        except pyodbc.Error as e:
            print(f"Error al insertar registro: {e}")

    # Confirmar los cambios
    conn.commit()

# Ejecutar la función de subida
upload()

# Cerrar la conexión
cursor.close()
conn.close()
