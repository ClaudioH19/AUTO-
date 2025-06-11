// mjpegCapture.js
const http = require('http');
const sharp = require('sharp');
let images = [];
let nextId = 1;

function startMJPEGStreamCapture(IP, port = 81) {
  console.log('🔌 Conectando al ESP32...');

  const options = {
    hostname: IP,
    port,
    path: '/stream',
    method: 'GET',
  };

  const req = http.request(options, res => {
    if (res.statusCode !== 200) {
      console.error(`❌ ESP32 respondió con código: ${res.statusCode}`);
      res.resume();
      return setTimeout(() => startMJPEGStreamCapture(IP, port), 10000);
    }

    console.log('✅ Conectado al stream del ESP32');

    let buffer = Buffer.alloc(0);

    res.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      while (true) {
        const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start);
        if (start === -1 || end === -1 || end <= start) break;

        const jpegBuffer = buffer.slice(start, end + 2);
        buffer = buffer.slice(end + 2);

        if (jpegBuffer.length < 2000) continue;

        const now = Date.now();
        if (!startMJPEGStreamCapture.lastCapture || now - startMJPEGStreamCapture.lastCapture >= 2500) {
        sharp(jpegBuffer)
            .rotate(90) // o 180, 270 según sea necesario
            .toBuffer()
            .then(rotatedBuffer => {
            images.push({
                id: nextId++,
                mime: 'image/jpeg',
                buffer: rotatedBuffer,
                ts: now,
            });

            // Guardar imagen para YOLO
            const fs = require('fs');
            const path = require('path');
            const outputPath = path.join(__dirname, 'captura.jpg');
            fs.writeFileSync(outputPath, rotatedBuffer);

            startMJPEGStreamCapture.lastCapture = now;
            console.log(`📸 Imagen capturada y rotada (${nextId - 1})`);
            })
            .catch(err => {
            console.error('❌ Error al rotar imagen:', err.message);
            });    
          
          // Mantener solo las últimas 100 imágenes
          if (images.length > 100) images.shift();

          startMJPEGStreamCapture.lastCapture = now;
          console.log(`📸 Imagen capturada (${nextId - 1}) – ${jpegBuffer.length} bytes`);
        }
      }
    });

    res.on('end', () => {
      console.warn('📴 Stream finalizado. Reconectando...');
      setTimeout(() => startMJPEGStreamCapture(IP, port), 5000);
    });
  });

  req.on('error', err => {
    console.error('❌ Error al conectar al ESP32:', err.message);
    setTimeout(() => startMJPEGStreamCapture(IP, port), 10000);
  });

  req.end();
}

function getImages() {
  return images;
}

function getImageById(id) {
  return images.find(img => img.id === id);
}

function getLatestImage() {
  return images.at(-1);
}

module.exports = {
  startMJPEGStreamCapture,
  getImages,
  getImageById,
  getLatestImage,
};
