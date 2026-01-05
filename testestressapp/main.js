import http from 'k6/http';
import { check, sleep } from 'k6';
import { Shipment } from './shipment.js';

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 peticiones por minuto
      timeUnit: '1m', // Cada minuto
      duration: '2h', // Simula 2 horas de carga constante
      preAllocatedVUs: 20, // Usuarios virtuales iniciales
      maxVUs: 100, // Máximo de usuarios virtuales para manejar picos
    },
    peak_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10, // Comienza con 10 peticiones por minuto
      timeUnit: '1m',
      stages: [
        { target: 50, duration: '10m' }, // Incrementa a 50 peticiones/minuto en 10 minutos
        { target: 10, duration: '10m' }, // Vuelve a 10 peticiones/minuto en 10 minutos
      ],
      preAllocatedVUs: 20,
      maxVUs: 150, // Máximo para manejar picos intensos
      startTime: '2h', // Inicia después de la carga constante
    },
    sustained_peak: {
      executor: 'constant-arrival-rate',
      rate: 20, // 20 peticiones por minuto
      timeUnit: '1m',
      duration: '1h', // Simula 1 hora de carga sostenida más alta
      preAllocatedVUs: 50,
      maxVUs: 100,
      startTime: '3h', // Inicia después de los picos
    },
  },
};
// Clase Shipment para generar objetos únicos


export default function () {
  const BASE_URL = 'http://localhost:3000/api'; // Cambia por tu URL base
  let shipment = new Shipment('ILC'); // Genera un nuevo Shipment único
  shipment = shipment.getEnvio();
  // console.log(`Shipment generado: ${JSON.stringify(shipment)}`);

  // Paso 1: Iniciar sesión
  const loginRes = http.post(`${BASE_URL}/users/login`, JSON.stringify({
    username: 'admin_user',
    password: '123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'Login exitoso': (r) => r.status === 201,
  });

  // console.log(`Login response: ${JSON.stringify(token)}`);

  const token = loginRes.json().access_token;

  // Paso 2: Crear Shipment
  const createRes = http.post(`${BASE_URL}/shipping`, JSON.stringify(shipment), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  check(createRes, {
    'Shipment creado': (r) => r.status === 201,
  });
  // console.log(`Create Shipment Response: ${JSON.stringify(createRes)}`);
  // Paso 3: Verificar Shipment creado
  const verifyRes = http.get(`${BASE_URL}/shipping/${shipment.codigo_gen}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(verifyRes, {
    'Shipment verificado': (r) => r.status === 200,
  });



  // Paso 4: Verificar estado inicial
  const statusRes = http.get(`${BASE_URL}/shipping/status/1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(statusRes, {
    'Estado inicial correcto': (r) => r.status === 200,
  });
  /* 
    const shipments = statusRes.json();
    console.log("shipment son: ", shipments);
    const shipmentFound = shipments.find((s) => s.codeGen === shipment.codeGen);
    check(shipmentFound, {
      'Shipment encontrado en estado inicial': (s) => s !== undefined,
    }); */

  // Paso 5: Obtener cliente del Shipment
  const clientRes = http.get(`${BASE_URL}/shipping/client/${shipment.codigo_gen}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(clientRes, {
    'Cliente del Shipment obtenido': (r) => r.status === 200,
  });

  // Paso 6: Verificar historial de estados
  const historyRes = http.get(`${BASE_URL}/status/shipment/${shipment.codigo_gen}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(historyRes, {
    'Historial de estados obtenido': (r) => r.status === 200,
  });

  /*   const history = historyRes.json();
    check(history, {
      'Historial tiene un solo estado': (h) => h.length === 1 && h[0].id === 1,
    }); */

  // Paso 7: Actualizar estado del Shipment
  const pushRes = http.post(`${BASE_URL}/status/push`, JSON.stringify({
    codeGen: shipment.codigo_gen,
    predefinedStatusId: 2,
    observation: 'Estado actualizado en prueba',
  }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  check(pushRes, {
    'Estado actualizado correctamente': (r) => r.status === 201,
  });

  //console.log(`push response status: ${JSON.stringify(pushRes)}`);

  sleep(1); // Simula un retraso entre solicitudes
}
