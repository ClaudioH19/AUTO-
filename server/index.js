const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(cors());
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
    },
});

const images = [];
let nextId = 1;
app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente. Ruta raíz activa.');
});

app.post('/upload', upload.array('image', 30), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se enviaron imágenes' });
    }

    const savedImages = req.files.map(file => {
        const img = {
            id: nextId++,
            mime: file.mimetype,
            buffer: file.buffer,
            ts: Date.now(),
        };
        images.push(img);
        console.log(`Imagen recibida (${img.id}) – ${img.mime}, ${img.buffer.length} bytes`);
        return { id: img.id, mime: img.mime };
    });

    res.json({ ok: true, total: savedImages.length, images: savedImages });
});

app.get('/image/latest', (req, res) => {
    const last = images.at(-1);
    if (!last) return res.status(404).end();
    res.type(last.mime).send(last.buffer);
});

app.get('/image/:id', (req, res) => {
    const img = images.find(i => i.id === +req.params.id);
    if (!img) return res.status(404).end();
    res.type(img.mime).send(img.buffer);
});

app.get('/images', (req, res) => {
    const resumen = images.map(img => ({
        id: img.id,
        mime: img.mime,
        timestamp: new Date(img.ts).toISOString(),
    }));
    res.json({ total: resumen.length, images: resumen });
});

app.get('/galeria', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Galería de Imágenes</title>
      <style>
        body {
          font-family: sans-serif;
          background: #f4f4f4;
          padding: 20px;
        }
        h1 {
          text-align: center;
          color: #b91c1c;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
          margin-top: 30px;
        }
        .card {
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          text-align: center;
        }
        img {
          max-width: 100%;
          border-radius: 4px;
        }
        .id {
          font-size: 12px;
          margin-top: 6px;
          color: #555;
        }
      </style>
    </head>
    <body>
      <h1>📸 Galería de Imágenes</h1>
      <div class="grid">
        ${images.map(img => `
          <div class="card">
            <img src="/image/${img.id}" alt="Imagen ${img.id}" />
            <div class="id">ID: ${img.id}</div>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;
    res.send(html);
});


app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
});
