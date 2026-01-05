interface LeveransResponse {
    message: string;
    data: {
      pkPreTransaccion: number;
      ntarjeta: string;
      codActividad: string;
      descActividad: string;
      buque: string;
      boletaCepa: string;
      viajeCepa: string;
      producto: string;
      vehiculo: string;
      pesoCepa: string;
      fkPreTransaccionEstado: number;
      username: string;
      codProducto: string;
      codBuque: string;
      manual: boolean;
      fechaHora: string;
      fkBascula: string;
      fkTransaccion: number;
      fkActividad: string;
      placa: string;
      fechaAutorizado: string | null;
    };
  }