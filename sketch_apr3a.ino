#include <WiFi.h>
#include <WebServer.h>
#include "esp_camera.h"

// ======== CONFIGURACIÓN WIFI =========
const char* ssid = "Samsung";
const char* password = "12345678";

// ======== PINES MOTORES ========
#define IN1 12
#define IN2 13
#define IN3 15
#define IN4 14
#define ENA 2
#define ENB 4 
#define FLASH_LED_PIN 4      // LED blanco del ESP32-CAM

// ======== PINES CÁMARA - AI-Thinker ESP32-CAM ========
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

WebServer server(80);

void detenerMotores() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void setup() {
  Serial.begin(115200);

  // ==== Configuración cámara (QVGA, 1 buffer) ====
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 15;
  config.fb_count = 1;
  config.fb_location = CAMERA_FB_IN_DRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("❌ Error al iniciar la cámara");
    return;
  }

  Serial.println("✅ Cámara iniciada");
  Serial.println(psramFound() ? "✅ PSRAM detectada" : "⚠️ Sin PSRAM, usando DRAM");

  // ==== Pines motores y flash ====
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  digitalWrite(ENA, HIGH);
  digitalWrite(ENB, HIGH);

  // ==== Conexión a red WiFi ====
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\n✅ Conectado a WiFi");
  Serial.print("IP local: "); Serial.println(WiFi.localIP());

  // ==== Página principal HTML ====
  server.on("/", HTTP_GET, []() {
    server.send(200, "text/html", R"rawliteral(
      <html><body>
      <h2>ESP32 MJPEG (QVGA, 1 buffer)</h2>
      <img src="/stream" width="320">
      <br><br>
      <button onclick="fetch('/adelante')">Adelante</button>
      <button onclick="fetch('/atras')">Atrás</button>
      <button onclick="fetch('/izquierda')">Izquierda</button>
      <button onclick="fetch('/derecha')">Derecha</button>
      <button onclick="fetch('/stop')">Detener</button>
      <button onclick="fetch('/flash_on')">Flash ON</button>
      <button onclick="fetch('/flash_off')">Flash OFF</button>
      </body></html>
    )rawliteral");
  });

  // ==== Streaming MJPEG limitado ====
  server.on("/stream", HTTP_GET, []() {
    WiFiClient client = server.client();
    String response = "HTTP/1.1 200 OK\r\n";
    response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
    client.print(response);

    unsigned long start = millis();
    while (client.connected() && millis() - start < 30000) {  // 30 segundos máx
      camera_fb_t *fb = esp_camera_fb_get();
      if (!fb) continue;

      client.printf("--frame\r\n");
      client.printf("Content-Type: image/jpeg\r\n");
      client.printf("Content-Length: %u\r\n\r\n", fb->len);
      client.write(fb->buf, fb->len);
      client.print("\r\n");

      esp_camera_fb_return(fb);
      delay(100);  // 10 FPS aprox
    }
  });

  // ==== Flash LED ====
  server.on("/flash_on", HTTP_GET, []() {
    digitalWrite(FLASH_LED_PIN, HIGH);
    server.send(200, "text/plain", "Flash encendido");
  });

  server.on("/flash_off", HTTP_GET, []() {
    digitalWrite(FLASH_LED_PIN, LOW);
    server.send(200, "text/plain", "Flash apagado");
  });

  // ==== Movimiento ====
  server.on("/adelante", HTTP_GET, []() {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
    server.send(200, "text/plain", "Avanzando");
  });

  server.on("/atras", HTTP_GET, []() {
    digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
    digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
    server.send(200, "text/plain", "Retrocediendo");
  });

  server.on("/izquierda", HTTP_GET, []() {
    digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
    server.send(200, "text/plain", "Giro izquierda");
  });

  server.on("/derecha", HTTP_GET, []() {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
    server.send(200, "text/plain", "Giro derecha");
  });

  server.on("/stop", HTTP_GET, []() {
    detenerMotores();
    server.send(200, "text/plain", "Detenido");
  });

  server.begin();
  Serial.println("✅ Servidor HTTP iniciado");
}

void loop() {
  server.handleClient();  // sigue activo
}
