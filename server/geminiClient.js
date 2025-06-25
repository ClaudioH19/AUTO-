// geminiClient.js
require('dotenv').config();
const axios = require('axios');
const { getLatestImage } = require('./mjpegCapture');
const { moverVehiculo } = require('./moveClient');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
const API_KEY = process.env.API_KEY;

let lastSentTs = 0;
let imagenAnterior = null; // buffer + mime + ts
let comandoAnterior = null;

async function enviarImagenAGemini(historial) {
  //const prompt =
  //  "Eres un ESP32 que controla un vehículo robótico ancho, encargado de explorar un entorno de forma autónoma. Analiza cuidadosamente la imagen actual y la imagen anterior, considerando también el último comando ejecutado. Toma decisiones basadas en la distancia real a los obstáculos, el tamaño del espacio disponible, y tu propio ancho, para evitar colisiones. Si detectas que el camino hacia adelante está bloqueado o hay poco espacio, elige girar o retroceder. Cuando avances hacia adelante, hazlo solo si hay suficiente espacio para pasar sin chocar. Prefiere moverte en intervalos cortos (200-800 ms) para aumentar la seguridad y poder corregir la trayectoria con frecuencia. Si no ves un camino claro, detente. Explora nuevas áreas y evita repetir trayectorias recientes. Devuelve únicamente el comando a ejecutar y la duración en milisegundos, separados por un espacio (ejemplo: 'derecha 300'). No agregues explicaciones, tildes ni texto adicional. Este es el historial reciente: {historial}. Imagen anterior y comando anterior incluidos para contexto."
    const prompt =
    "Eres un ESP32 que controla un vehículo. Decide qué hacer para explorar tu entorno en base a lo que ves con uno de los siguientes comandos: adelante, atras, izquierda, derecha, stop. Prefiere ir hacia adelante cuando veas espacios amplios o libres. Devuelve el comando y un tiempo en milisegundos separados por un espacio. Ejemplo: 'adelante 1500' o 'derecha 200'. Devuelve solo el comando sin explicaciones ni tildes. Este es el historial de lo que has hecho anteriormente: " + historial + ". También recibes la imagen actual, la imagen anterior y el comando anterior.";


    const imgActual = getLatestImage();
  if (!imgActual) {
    console.warn('⚠️ No hay imagen para enviar.');
    return;
  }
  if (imgActual.ts === lastSentTs) {
    return; // No hay imagen nueva
  }

  // Prepara imagen actual y anterior en base64
  const base64ImagenActual = imgActual.buffer.toString('base64');
  const base64ImagenAnterior = imagenAnterior ? imagenAnterior.buffer.toString('base64') : null;

  // Construir las parts dinámicamente
  const parts = [
    { text: prompt },
    { inline_data: { mime_type: imgActual.mime, data: base64ImagenActual } }
  ];
  if (base64ImagenAnterior) {
    parts.push({ text: `Comando anterior: ${comandoAnterior ?? "ninguno"}` });
    parts.push({ inline_data: { mime_type: imagenAnterior.mime, data: base64ImagenAnterior } });
  } else {
    parts.push({ text: "No hay imagen anterior disponible." });
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts
      }
    ]
  };

  try {
    const start = Date.now();
    const response = await axios.post(`${GEMINI_API_URL}?key=${API_KEY}`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const durationMs = Date.now() - start;
    lastSentTs = imgActual.ts;

    // Nueva: Guarda la imagen y comando como "anterior" para la próxima iteración
    imagenAnterior = imgActual;
    
    // Procesa respuesta
    const texto = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    if (texto) {
      const [comando, duracionStr] = texto.split(/\s+/);
      const duracion = parseInt(duracionStr);

      // Nueva: Guarda el comando como anterior
      if (['adelante', 'atras', 'izquierda', 'derecha', 'stop'].includes(comando) && !isNaN(duracion)) {
        comandoAnterior = `${comando} ${duracion}`;
        await moverVehiculo(comando, duracion);
      } else {
        console.warn('⚠️ Comando o duración inválidos:', texto);
      }
    }

    // ... logs igual que antes
    return { ...response.data, durationMs };
  } catch (error) {
    const msg = error.response?.data || error.message;
    console.error('❌ Error al enviar a Gemini:', msg);
  }
}

// Envío periódico, igual que antes
function iniciarEnvioPeriodico() {
  let anterior = "";
  setInterval(() => {
    anterior = enviarImagenAGemini("antes ejecuté: " + anterior);
  }, 3000);
}

module.exports = {
  enviarImagenAGemini,
  iniciarEnvioPeriodico,
};
