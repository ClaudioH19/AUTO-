// geminiClient.js
require('dotenv').config();
const axios = require('axios');
const { getLatestImage } = require('./mjpegCapture');
const { moverVehiculo } = require('./moveClient');


const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
//const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

const API_KEY = process.env.API_KEY;

let lastSentTs = 0;

async function enviarImagenAGemini(historial) {
  const prompt =
    "Eres un ESP32 que controla un vehículo. Decide qué hacer para explorar tu entorno en base a lo que ves con uno de los siguientes comandos: adelante, atras, izquierda, derecha, stop. Prefiere ir hacia adelante cuando veas espacios amplios o libres.Devuelve el comando y un tiempo en milisegundos separados por un espacio. Ejemplo: 'adelante 1500' o 'derecha 200'. Devuelve solo el comando sin explicaciones ni tildes. piensa qué hacer si estás contra una pared o si no ves nada interesante. Este es el historial de lo que has hecho anteriormente: "+ historial;

  const img = getLatestImage();
  if (!img) {
    console.warn('⚠️ No hay imagen para enviar.');
    return;
  }

  if (img.ts === lastSentTs) {
    return; // No hay imagen nueva
  }

  const base64Image = img.buffer.toString('base64');

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: img.mime,
              data: base64Image,
            },
          },
        ],
      },
    ],
  };

  try {
    const start = Date.now();
    const response = await axios.post(`${GEMINI_API_URL}?key=${API_KEY}`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const durationMs = Date.now() - start;
    lastSentTs = img.ts;

    const modelo = response.data.modelVersion;
    const totalTokens = response.data.usageMetadata?.totalTokenCount;
    const texto = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();

    console.log(`\n📊 RESUMEN:`);
    console.log(`🔁 Modelo usado: ${modelo}`);
    console.log(`⏱️ Tiempo de respuesta: ${durationMs} ms`);
    console.log(`🔢 Tokens usados (total): ${totalTokens}`);
    console.log(`🧠 Respuesta:\n${texto}\n`);

    if (texto) {
      const [comando, duracionStr] = texto.split(/\s+/);
      const duracion = parseInt(duracionStr);

      if (['adelante', 'atras', 'izquierda', 'derecha', 'stop'].includes(comando) && !isNaN(duracion)) {
        console.log(`🧠 Comando: ${comando} – 🕒 Duración: ${duracion} ms`);
        await moverVehiculo(comando, duracion);
      } else {
        console.warn('⚠️ Comando o duración inválidos:', texto);
      }
    }

    return { ...response.data, durationMs };
  } catch (error) {
    const msg = error.response?.data || error.message;
    console.error('❌ Error al enviar a Gemini:', msg);
  }
}

// Envío automático 
function iniciarEnvioPeriodico() {
  anterior = ""
  setInterval(() => {
    anterior= enviarImagenAGemini("antes ejecuté: " + anterior);
  }, 3500);
}

module.exports = {
  enviarImagenAGemini,
  iniciarEnvioPeriodico,
};
