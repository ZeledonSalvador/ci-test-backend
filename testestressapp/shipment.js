
export class Shipment {
    constructor(codigoIngenio) {
        if (!codigoIngenio) {
            throw new Error('El código de ingenio es obligatorio.');
        }

        this.envio = {
            vehiculo: {
                motorista: {
                    licencia: this.generarLicencia(),
                    nombre: this.generarNombreMotorista(),
                },
                placa: this.generarPlaca(),
                placa_remolque: this.generarPlaca(),
                tipo_camion: this.seleccionarAleatorio(['V', 'R']),
            },
            transportista: {
                nombre: this.generarNombreTransportista(),
            },
            codigo_gen: this.generateUUID(),
            producto: this.seleccionarAleatorio([
                'AZ-001',
                'AZ-002',
                'AZ-003',
                'AZ-004',
                'MEL-001',
            ]),
            tipo_operacion: this.seleccionarAleatorio(['C', 'D']),
            tipo_carga: this.seleccionarAleatorio(['G', 'E']),
            codigo_ingenio: codigoIngenio,
            cantidad_producto: this.generarCantidadProducto(),
            unidad_medida: 'kg',
            require_barrido: this.seleccionarAleatorio(['S', 'N']),
            marchamos: this.generarMarchamos(),
        };
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16).toUpperCase();
        });
    }


    generarLicencia() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    generarNombreMotorista() {
        const nombres = [
            'NELSON BALMORI QUINTANILLA SEGOVIA',
            'JUAN PÉREZ GÓMEZ',
            'CARLOS ALBERTO MARTÍNEZ',
            'MARIO ANDRÉS HERNÁNDEZ',
        ];
        return this.seleccionarAleatorio(nombres);
    }

    generarPlaca() {
        const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numeros = Math.floor(10000 + Math.random() * 90000).toString();
        const letra = letras.charAt(Math.floor(Math.random() * letras.length));
        return `${letra}${numeros}`;
    }

    generarNombreTransportista() {
        const nombres = [
            'VERONICA MARISOL ESCOBAR DE MARTINE',
            'MARÍA LUISA HERNÁNDEZ LÓPEZ',
            'ANA GABRIELA GUTIÉRREZ PÉREZ',
            'ROSA MARÍA SÁNCHEZ CASTRO',
        ];
        return this.seleccionarAleatorio(nombres);
    }

    generarCantidadProducto() {
        return Math.floor(1 + Math.random() * 100); // Cantidad entre 1 y 100
    }

    generarMarchamos() {
        const marchamos = [];
        const cantidad = Math.floor(1 + Math.random() * 5); // Entre 1 y 5 marchamos
        for (let i = 0; i < cantidad; i++) {
            marchamos.push(Math.floor(1000 + Math.random() * 9000).toString());
        }
        return marchamos;
    }

    seleccionarAleatorio(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    getEnvio() {
        return this.envio;
    }
}


