const WebSocket = require('ws');

const ESP32_WS_URL = 'ws://192.168.13.223/ws'; // Ajusta IP si cambia
let ws;

const comandosValidos = ['adelante', 'atras', 'izquierda', 'derecha', 'stop'];

// 🔁 Corrección de orientación (adelante ↔ atrás, izquierda ↔ derecha)
const comandoCorregido = {
  adelante: 'atras',
  atras: 'adelante',
  izquierda: 'derecha',
  derecha: 'izquierda',
  stop: 'stop',
};


function conectarWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(ESP32_WS_URL);

  ws.on('open', () => {
    console.log(`🔌 Conectado al WebSocket del ESP32 (${ESP32_WS_URL})`);
  });

  ws.on('close', () => {
    console.warn('🔌 Conexión WebSocket cerrada. Reintentando en 2s...');
    setTimeout(conectarWebSocket, 2000);
  });

  ws.on('error', err => {
    console.error('❌ Error en WebSocket:', err.message);
  });

  ws.on('message', msg => {
    console.log(`📨 Mensaje del ESP32: ${msg}`);
  });
}

async function moverVehiculo(comando, duracion) {
  comando = comando.trim().toLowerCase();

  if (!comandosValidos.includes(comando)) {
    console.warn(`⚠️ Comando inválido: '${comando}'`);
    return { error: 'Comando no permitido' };
  }

  const comandoFinal = comandoCorregido[comando];

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ WebSocket no conectado. Intentando reconectar...');
    conectarWebSocket();
    return { error: 'WebSocket no conectado aún' };
  }

  ws.send(comandoFinal);
  console.log(`🚗 Comando corregido enviado: '${comando}' → '${comandoFinal}'`);

  //tiempo entr 0.2 y 1 segundo
  const tiempoEspera = duracion;
  if (comandoFinal !== 'stop') {
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send('stop');
        console.log('🛑 Enviado comando automático: stop');
      }
    }, tiempoEspera);
  }

  return { ok: true, comando: comandoFinal };
}

// Conectar al iniciar
conectarWebSocket();

module.exports = {
  moverVehiculo,
};
