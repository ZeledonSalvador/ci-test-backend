def generar_tabla(toneladas_a_cargar, cantidades_por_hora):
    toneladas_restantes = toneladas_a_cargar
    tabla = []
    for i in range(len(cantidades_por_hora)):
        if i == 0:
            cargadas = cantidades_por_hora[i]
        else:
            cargadas = cantidades_por_hora[i] - cantidades_por_hora[i-1]
        toneladas_restantes = toneladas_a_cargar - cantidades_por_hora[i]
        formula = f't_{i+1} = {toneladas_a_cargar} - ({cantidades_por_hora[i]} - {cantidades_por_hora[0]})'
        resultado = toneladas_a_cargar - (cantidades_por_hora[i] - cantidades_por_hora[0])

        tabla.append({
            'Numero Registro': i + 1,
            'Hora': f'{7 + i}:00:00',
            'Columna 1': round(cantidades_por_hora[i], 3),
            'Columna 2': round(cargadas, 3),
            'Columna 3': round(toneladas_restantes, 3),
            't_x = t_1 - (m_x - m_1)': f'{formula} = {round(resultado, 3)}'
        })

    print("\n| N° Registro | Hora      | Columna 1    | Columna 2    | Columna 3    | t_x = t_1 - (m_x - m_1)                              |")
    print("|--------------|-----------|--------------|--------------|--------------|------------------------------------------------------|")
    for fila in tabla:
        print(f"| {fila['Numero Registro']:>12} | {fila['Hora']:>9} | {fila['Columna 1']:>12.3f} | {fila['Columna 2']:>12.3f} | {fila['Columna 3']:>12.3f} | {fila['t_x = t_1 - (m_x - m_1)']:>50} |")

toneladas_a_cargar = 7000 
cantidades_por_hora = [
    0.000, 8.117, 80.244, 120.800, 142.423, 147.732, 327.128, 570.656, 851.008,
    1_137.756, 1_422.781, 1_704.957, 1_987.285, 2_275.327, 2_531.027, 2_804.237, 3_065.728,
    3_331.736, 3_588.728, 3_839.389, 4_091.848, 4_342.550, 4_567.984, 4_791.612, 
    5_037.740, 5_317.261, 5_600.232, 5_894.097, 6_192.454, 6_488.040, 6_787.355, 7_086.691
]

generar_tabla(toneladas_a_cargar, cantidades_por_hora)
