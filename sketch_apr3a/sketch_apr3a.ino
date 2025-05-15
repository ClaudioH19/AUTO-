#include <WiFi.h>
#include <WebServer.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include "esp_camera.h"
#include <Preferences.h>
#include <ArduinoJson.h>

#define IN1 12
#define IN2 13
#define IN3 15
#define IN4 14
#define ENA 2
#define ENB 4

#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

Preferences prefs;
WebServer streamServer(81); // solo para la cámara
AsyncWebServer server(80);  // para comandos y configuración
AsyncWebSocket ws("/ws");
bool modoAP = true;

void detenerMotores() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void iniciarCamara() {
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

  esp_camera_init(&config);
}

void configurarRed() {
  prefs.begin("wifi", true);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  if (ssid.length() > 0) {
    WiFi.begin(ssid.c_str(), pass.c_str());
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) delay(500);
    if (WiFi.status() == WL_CONNECTED) {
      modoAP = false;
      return;
    }
  }

  WiFi.softAPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  WiFi.softAP("ESP32-AUTO");
  delay(500);
  modoAP = true;
}

void manejarComando(const String& comando) {
  if (comando == "adelante") {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  } else if (comando == "atras") {
    digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
    digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  } else if (comando == "izquierda") {
    digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  } else if (comando == "derecha") {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  } else if (comando == "stop") {
    detenerMotores();
  }
}

String wifiPayload = "";

void setup() {
  Serial.begin(115200);

  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  digitalWrite(ENA, HIGH); digitalWrite(ENB, HIGH);

  configurarRed();
  iniciarCamara();

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(200, "text/plain", "ESP32 ready");
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request){
    DynamicJsonDocument doc(128);
    doc["connected"] = WiFi.status() == WL_CONNECTED;
    doc["mode"] = modoAP ? "ap" : "sta";
    IPAddress ipAddr = modoAP ? WiFi.softAPIP() : WiFi.localIP();
    doc["ip"] = ipAddr.toString();
    Serial.print("[STATUS] IP: "); Serial.println(ipAddr);
    String json;
    serializeJson(doc, json);
    request->send(200, "application/json", json);
  });

  server.on("/config_wifi", HTTP_POST, [](AsyncWebServerRequest *request){
    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, wifiPayload);
    if (error) {
      request->send(400, "text/plain", "JSON inválido");
      return;
    }
    String ssid = doc["ssid"];
    String pass = doc["pass"];

    prefs.begin("wifi", false);
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    prefs.end();

    request->send(200, "text/plain", "Credenciales guardadas. Reinicia manualmente para aplicar.");
    wifiPayload = "";
  });

  server.onRequestBody([](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    wifiPayload = "";
    for (size_t i = 0; i < len; i++) wifiPayload += (char)data[i];
  });

  server.on("/reset_wifi", HTTP_GET, [](AsyncWebServerRequest *request){
    prefs.begin("wifi", false);
    prefs.clear();
    prefs.end();
    request->send(200, "text/plain", "Credenciales eliminadas. Reiniciando en modo AP...");
    delay(1000);
    ESP.restart();
  });

  ws.onEvent([](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_DATA) {
      String msg = "";
      for (size_t i = 0; i < len; i++) msg += (char)data[i];
      Serial.printf("[WS ASYNC] Comando recibido: %s\n", msg.c_str());
      manejarComando(msg);
      client->text("ACK: " + msg);
    }
  });

  server.addHandler(&ws);
  server.begin();

  streamServer.on("/stream", HTTP_GET, []() {
    WiFiClient client = streamServer.client();
    String response =
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
    client.print(response);
    while (client.connected()) {
      camera_fb_t *fb = esp_camera_fb_get();
      if (!fb) break;

      client.printf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", fb->len);
      client.write(fb->buf, fb->len);
      client.print("\r\n");

      esp_camera_fb_return(fb);
      delay(33);
    }
  });
  streamServer.begin();
}

void loop() {
  streamServer.handleClient();
}