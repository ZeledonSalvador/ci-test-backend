# Guía de Instalación de Docker y Docker Compose en Windows Server

Esta guía proporciona pasos detallados para instalar Docker y Docker Compose en Windows Server. Se han seguido dos fuentes confiables para completar la instalación.

## Fuentes Utilizadas

- [Instalación de Docker](https://learn.microsoft.com/es-es/virtualization/windowscontainers/quick-start/set-up-environment?tabs=dockerce#windows-server-1)
- [Instalación de Docker Compose](https://cloudinfrastructureservices.co.uk/how-to-install-docker-compose-on-windows-server-2016-2019-2022/)

## Instalación de Docker

Para instalar Docker, sigue estos pasos:

1. **Descargar el Script de Instalación de Docker**:

   Ejecuta el siguiente comando en PowerShell:

   ```powershell
   Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/microsoft/Windows-Containers/Main/helpful_tools/Install-DockerCE/install-docker-ce.ps1" -o install-docker-ce.ps1
   ```

2. **Ejecutar el Script**:

   Luego, ejecuta el script descargado:

   ```powershell
   .\install-docker-ce.ps1
   ```

## Instalación de Docker Compose

Para instalar Docker Compose, sigue estos pasos:

1. **Configurar el Protocolo de Seguridad**:

   Es recomendable configurar el protocolo de seguridad antes de descargar Docker Compose. Ejecuta:

   ```powershell
   [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
   ```

   > **Nota:** Este comando también puede ser útil al instalar Docker, ya que asegura una conexión más segura al servidor.

2. **Descargar Docker Compose**:

   Ejecuta el siguiente comando para descargar Docker Compose:

   ```powershell
   Invoke-WebRequest "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-Windows-x86_64.exe" -UseBasicParsing -OutFile docker-compose.exe
   ```

3. **Mover el Ejecutable**:

   Para que Docker Compose sea accesible desde cualquier lugar en la línea de comandos, mueve el archivo descargado a una carpeta incluida en tu variable de entorno `PATH` (por ejemplo, `C:\Program Files\Docker\`):

   ```powershell
   Move-Item docker-compose.exe "C:\Program Files\Docker\"
   ```

## Verificación de la Instalación

Para verificar que Docker y Docker Compose se han instalado correctamente, puedes ejecutar los siguientes comandos:

```powershell
docker --version
docker-compose --version
```