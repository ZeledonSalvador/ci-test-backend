Comando para crear los modelos por ingeneria inversa desde las tablas:


typeorm-model-generator -h localhost -d ingenioapi -u sa -x "<YourPassword>" -e mssql -o ./src/entities



## Estatus de NAV

A continuación se describen los diferentes estatus de una transacción en el sistema NAV:

| **Estatus** | **Descripción**                                                                 |
|-------------|---------------------------------------------------------------------------------|
| **0**       | La creación de la transacción.                                                  |
| **1**       | Cuando la interfaz de báscula pesa el camión por primera vez (entrada).         |
| **2**       | Cuando la interfaz de báscula pesa el camión por segunda vez (salida).          |
| **3**       | Cuando la transacción se finaliza (desconozco qué entidad cambia a este estado). |