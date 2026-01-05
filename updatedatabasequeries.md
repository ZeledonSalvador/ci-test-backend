Esta  queri sirve para mandar agregar el tipo de actividad, se crea como nulla, se pone en dos todas las creadas (para pruebas), el dos significa "RECEPCION DE AZUCAR Y MELAZA" y luego lo pone como no null

````sql
ALTER TABLE Shipments
ADD activity_number NVARCHAR(50) NULL;


UPDATE Shipments
SET activity_number = '2';

ALTER TABLE Shipments
ALTER COLUMN activity_number NVARCHAR(50) NOT NULL;

select * FROM  Shipments s ;
```