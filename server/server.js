const express = require('express');
const cors = require('cors');
const multer = require('multer');
const {
  startMJPEGStreamCapture,
  getImages,
  getImageById,
  getLatestImage,
} = require('./mjpegCapture');

const { iniciarEnvioPeriodico } = require('./geminiClient');

const app = express();
const PORT = 3000;
const IP_ESP32 = '192.168.225.223';

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  },
});

app.get('/', (_req, res) => {
  res.send('Servidor funcionando correctamente.');
});

app.post('/upload', upload.array('image', 30), (req, res) => {
  const images = getImages();
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se enviaron imágenes' });
  }

  const saved = req.files.map(file => {
    const img = {
      id: images.length + 1,
      mime: file.mimetype,
      buffer: file.buffer,
      ts: Date.now(),
    };
    images.push(img);
    return { id: img.id, mime: img.mime };
  });

  res.json({ ok: true, total: saved.length, images: saved });
});

app.get('/image/latest', (req, res) => {
  const img = getLatestImage();
  if (!img) return res.status(404).end();
  res.type(img.mime).send(img.buffer);
});

app.get('/image/:id', (req, res) => {
  const img = getImageById(+req.params.id);
  if (!img) return res.status(404).end();
  res.type(img.mime).send(img.buffer);
});

app.get('/images', (_req, res) => {
  const resumen = getImages().map(img => ({
    id: img.id,
    mime: img.mime,
    timestamp: new Date(img.ts).toISOString(),
  }));
  res.json({ total: resumen.length, images: resumen });
});

app.get('/galeria', (_req, res) => {
  const images = getImages();
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Galería de Imágenes</title>
      <style>
        body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
        h1 { text-align: center; color: #b91c1c; }
        .grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px; margin-top: 30px;
        }
        .card { background: white; padding: 12px; border-radius: 8px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.1); text-align: center; }
        img { max-width: 100%; border-radius: 4px; }
        .id { font-size: 12px; margin-top: 6px; color: #555; }
      </style>
    </head>
    <body>
      <h1>📸 Galería de Imágenes</h1>
      <div class="grid">
        ${images.map(img => `
          <div class="card">
            <img src="/image/${img.id}" />
            <div class="id">ID: ${img.id}</div>
          </div>
        `).join('')}
      </div>
    </body>
    </html>`;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
    // 🔄 Inicia captura desde el ESP32
  startMJPEGStreamCapture(IP_ESP32, 81);

  // 🧠 Inicia envío automático a Gemini
  iniciarEnvioPeriodico('Describe esta imagen:');
});
