import math
import pandas as pd

def calculate_max_retries(pendientes, min_retries, max_retries, factor):
    """
    Calcula el máximo de reintentos basado en pendientes y lo redondea a un entero.
    """
    value = max_retries - (max_retries - min_retries) * (pendientes / (pendientes + factor))
    return round(value)

def calculate_batch_size(pendientes, min_batch, max_batch, factor):
    """
    Calcula el tamaño de lote basado en pendientes y lo redondea a un entero.
    """
    value = min_batch + (max_batch - min_batch) * (pendientes**2 / (pendientes**2 + factor))
    return round(value)

def calculate_monitoring_interval(pendientes, min_monitor, max_monitor, factor):
    """
    Calcula el intervalo de monitoreo ajustado suavemente basado en pendientes
    y lo redondea a dos decimales.
    """
    value = max(min_monitor, max_monitor / (1 + math.sqrt(pendientes / factor)))
    return round(value, 2)

def calculate_dynamic_values_v2(pendientes, min_monitor, max_monitor, min_retries, max_retries, min_batch, max_batch, factor):
    """
    Calcula valores dinámicos ajustados para Monitoring Interval, Max Retries y Batch Size.
    """
    monitoring_interval = calculate_monitoring_interval(pendientes, min_monitor, max_monitor, factor)
    max_retries = calculate_max_retries(pendientes, min_retries, max_retries, factor)
    batch_size = calculate_batch_size(pendientes, min_batch, max_batch, factor)
    
    return {
        "Pendientes": pendientes,
        "Monitoring Interval": monitoring_interval,
        "Max Retries": max_retries,
        "Batch Size": batch_size,
    }

# Parámetros de ejemplo
min_monitor, max_monitor = 1, 8  # Intervalos de monitoreo
min_retries, max_retries = 1, 10  # Máximo de reintentos
min_batch, max_batch = 10, 60  # Tamaño de lotes
factor = 1000  # Factor de ajuste

# Ejemplos de pendientes
pendientes_list = [10, 50, 100, 200, 500, 1000, 2000, 5000, 100000]

# Cálculo de resultados
results_v2 = [calculate_dynamic_values_v2(p, min_monitor, max_monitor, min_retries, max_retries, min_batch, max_batch, factor) for p in pendientes_list]

# Convertir a tabla y mostrar
df = pd.DataFrame(results_v2)
print(df)
