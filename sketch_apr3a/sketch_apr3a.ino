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
WebServer streamServer(81);
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
String bodyBuffer = "";
bool modoAP = true;

void detenerMotores() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void iniciarCamara() {
  Serial.println("📹 Iniciando cámara...");
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

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Error inicializando cámara: 0x%x\n", err);
  } else {
    Serial.println("✅ Cámara inicializada correctamente");
  }
}

void debugCredenciales() {
  Serial.println("\n🔍 DEBUG - Credenciales guardadas:");
  prefs.begin("wifi", true);
  
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  
  Serial.println("SSID: '" + ssid + "' (longitud: " + String(ssid.length()) + ")");
  Serial.println("Pass: '" + pass + "' (longitud: " + String(pass.length()) + ")");
  
  // Mostrar caracteres individuales para detectar caracteres raros
  Serial.print("SSID chars: ");
  for (int i = 0; i < ssid.length(); i++) {
    Serial.print("[" + String(ssid.charAt(i)) + ":" + String((int)ssid.charAt(i)) + "] ");
  }
  Serial.println();
  
  prefs.end();
}

void configurarRed() {
  Serial.println("🔧 Iniciando configuración de red...");
  
  // Primero desconectar cualquier conexión previa
  WiFi.disconnect(true);
  delay(100);
  
  prefs.begin("wifi", true); // Solo lectura inicialmente
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  Serial.println("📊 Credenciales guardadas:");
  Serial.println("SSID: '" + ssid + "' (longitud: " + String(ssid.length()) + ")");
  Serial.println("Pass: '" + pass + "' (longitud: " + String(pass.length()) + ")");

  // Verificar si tenemos credenciales válidas
  if (ssid.length() > 0 && pass.length() > 0) {
    Serial.println("🔄 Intentando conectar a WiFi guardado...");
    
    WiFi.mode(WIFI_STA); // Forzar modo estación
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    unsigned long start = millis();
    int intentos = 0;
    
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) { // Aumentado a 15 segundos
      delay(500);
      Serial.print(".");
      intentos++;
      
      // Mostrar estado cada 10 intentos
      if (intentos % 10 == 0) {
        Serial.println();
        Serial.println("Status WiFi: " + String(WiFi.status()));
        Serial.println("Intentos: " + String(intentos));
      }
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println();
      Serial.println("✅ Conectado a WiFi!");
      Serial.println("IP: " + WiFi.localIP().toString());
      Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
      modoAP = false;
      return;
    } else {
      Serial.println();
      Serial.println("❌ No se pudo conectar a WiFi guardado");
      Serial.println("Estado final: " + String(WiFi.status()));
    }
  } else {
    Serial.println("⚠️  No hay credenciales guardadas válidas");
    Serial.println("SSID vacío: " + String(ssid.length() == 0));
    Serial.println("Pass vacío: " + String(pass.length() == 0));
  }

  // Si llegamos aquí, iniciamos modo AP
  Serial.println("🔄 Iniciando modo Access Point...");
  WiFi.mode(WIFI_AP);
  delay(100);
  
  WiFi.softAPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  bool apResult = WiFi.softAP("ESP32-AUTO", ""); // Sin contraseña para facilitar conexión
  
  if (apResult) {
    Serial.println("✅ Modo AP iniciado correctamente");
    Serial.println("IP del AP: " + WiFi.softAPIP().toString());
    Serial.println("SSID del AP: ESP32-AUTO");
  } else {
    Serial.println("❌ Error al iniciar modo AP");
  }
  
  delay(2000); // Dar tiempo extra para que el AP se estabilice
  modoAP = true;
}

void manejarComando(const String& comando) {
  Serial.println("🎮 Comando recibido: " + comando);
  
  if (comando == "adelante") {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
    Serial.println("⬆️ Moviendo adelante");
  } else if (comando == "atras") {
    digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
    digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
    Serial.println("⬇️ Moviendo atrás");
  } else if (comando == "izquierda") {
    digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
    Serial.println("⬅️ Girando izquierda");
  } else if (comando == "derecha") {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
    Serial.println("➡️ Girando derecha");
  } else if (comando == "stop") {
    detenerMotores();
    Serial.println("🛑 Motores detenidos");
  } else {
    Serial.println("❓ Comando desconocido: " + comando);
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000); // Dar tiempo para abrir el monitor serie
  
  Serial.println("\n🚀 ESP32 Robot iniciando...");
  
  // Configurar pines de motores
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  digitalWrite(ENA, HIGH); digitalWrite(ENB, HIGH);
  
  // Asegurar que los motores estén detenidos al inicio
  detenerMotores();

  debugCredenciales(); // Debug de credenciales guardadas
  configurarRed();
  iniciarCamara();

  // ===== CONFIGURACIÓN WEBSOCKET - ORDEN CRÍTICO =====
  
  // 1. Primero configurar el WebSocket ANTES de todo
  ws.onEvent([](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
      Serial.printf("🔌 Cliente WebSocket conectado desde %s\n", client->remoteIP().toString().c_str());
      client->text("Conectado al ESP32 Robot");
    } else if (type == WS_EVT_DISCONNECT) {
      Serial.printf("🔌 Cliente WebSocket desconectado\n");
      detenerMotores(); // Detener motores al desconectar
    } else if (type == WS_EVT_DATA) {
      String msg = "";
      for (size_t i = 0; i < len; i++) msg += (char)data[i];
      Serial.printf("📨 [WebSocket] Comando: %s (desde %s)\n", msg.c_str(), client->remoteIP().toString().c_str());
      manejarComando(msg);
      client->text("ACK: " + msg);
    } else if (type == WS_EVT_ERROR) {
      Serial.printf("❌ Error WebSocket: %s\n", (char*)data);
    }
  });

  // 2. Configurar endpoints HTTP
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

  server.on("/config_wifi", HTTP_POST, 
  // Handler principal (se ejecuta DESPUÉS del body callback)
  [](AsyncWebServerRequest *request) {
    Serial.println("📥 Configuración WiFi recibida:");
    Serial.println("Content-Type: " + request->header("Content-Type"));
    Serial.println("Cuerpo desde callback: '" + bodyBuffer + "'");
    Serial.println("Longitud: " + String(bodyBuffer.length()));

    if (bodyBuffer.length() == 0) {
      Serial.println("❌ Body vacío incluso con callback");
      request->send(400, "application/json", "{\"error\":\"Body vacío\"}");
      bodyBuffer = ""; // Limpiar
      return;
    }

    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, bodyBuffer);

    if (error) {
      Serial.println("❌ Error al parsear JSON:");
      Serial.println(error.c_str());
      Serial.println("Body recibido era: '" + bodyBuffer + "'");
      request->send(400, "application/json", "{\"error\":\"JSON inválido\"}");
      bodyBuffer = ""; // Limpiar
      return;
    }

    if (!doc.containsKey("ssid") || !doc.containsKey("pass")) {
      Serial.println("❌ Faltan campos ssid o pass en JSON");
      request->send(400, "application/json", "{\"error\":\"Faltan campos requeridos\"}");
      bodyBuffer = ""; // Limpiar
      return;
    }

    String ssid = doc["ssid"].as<String>();
    String pass = doc["pass"].as<String>();
    
    // Limpiar espacios en blanco
    ssid.trim();
    pass.trim();

    Serial.println("SSID recibido: '" + ssid + "' (longitud: " + String(ssid.length()) + ")");
    Serial.println("Pass recibido: '" + pass + "' (longitud: " + String(pass.length()) + ")");

    if (ssid.length() == 0) {
      Serial.println("❌ SSID vacío");
      request->send(400, "application/json", "{\"error\":\"SSID no puede estar vacío\"}");
      bodyBuffer = ""; // Limpiar
      return;
    }

    // Guardar credenciales
    prefs.begin("wifi", false);
    bool ssidOK = prefs.putString("ssid", ssid);
    bool passOK = prefs.putString("pass", pass);
    prefs.end();

    Serial.println("💾 Guardado SSID: " + String(ssidOK ? "OK" : "ERROR"));
    Serial.println("💾 Guardado Pass: " + String(passOK ? "OK" : "ERROR"));

    if (ssidOK && passOK) {
      request->send(200, "application/json", "{\"message\":\"Credenciales guardadas. Reiniciando...\"}");
      Serial.println("🔄 Reiniciando en 2 segundos...");
      
      bodyBuffer = ""; // Limpiar antes de reiniciar
      delay(2000);
      ESP.restart();
    } else {
      request->send(500, "application/json", "{\"error\":\"Error al guardar credenciales\"}");
    }
    
    bodyBuffer = ""; // Limpiar al final
  },
  
  NULL, // onUpload callback (no lo necesitamos)
  
  // Body callback - ESTO CAPTURA EL BODY REAL
  [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    Serial.println("📦 Body callback ejecutado:");
    Serial.println("  - Bytes recibidos: " + String(len));
    Serial.println("  - Index: " + String(index));
    Serial.println("  - Total esperado: " + String(total));
    
    // Si es el primer fragmento, limpiar el buffer
    if (index == 0) {
      bodyBuffer = "";
      Serial.println("  - Buffer limpiado (primer fragmento)");
    }
    
    // Agregar los datos recibidos al buffer
    for (size_t i = 0; i < len; i++) {
      bodyBuffer += (char)data[i];
    }
    
    Serial.println("  - Buffer actual length: " + String(bodyBuffer.length()));
    Serial.println("  - Buffer content: '" + bodyBuffer + "'");
    
    // Si hemos recibido todo el body
    if (index + len == total) {
      Serial.println("✅ Body completo recibido: " + String(total) + " bytes");
    }
  }
);

  server.on("/reset_wifi", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("🗑️ Eliminando credenciales WiFi...");
    prefs.begin("wifi", false);
    prefs.clear();
    prefs.end();
    request->send(200, "text/plain", "Credenciales eliminadas. Reiniciando en modo AP...");
    Serial.println("🔄 Reiniciando en modo AP...");
    delay(1000);
    ESP.restart();
  });

  // 3. CRÍTICO: Agregar WebSocket handler AL FINAL antes de begin()
  server.addHandler(&ws);
  
  // 4. Iniciar servidor AsyncWeb DESPUÉS de configurar todo
  server.begin();
  Serial.println("🌐 Servidor AsyncWeb iniciado en puerto 80");

  // 5. Configurar servidor de streaming
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
  Serial.println("📹 Servidor de streaming iniciado en puerto 81");
  
  // 6. Dar tiempo para que todo se estabilice
  delay(1000);
  
  Serial.println("✅ ESP32 Robot listo!");
  Serial.println("Modo: " + String(modoAP ? "Access Point" : "Station"));
  if (modoAP) {
    Serial.println("Conectarse a: ESP32-AUTO");
    Serial.println("IP: " + WiFi.softAPIP().toString());
  } else {
    Serial.println("IP: " + WiFi.localIP().toString());
  }
  Serial.println("WebSocket: ws://" + (modoAP ? WiFi.softAPIP().toString() : WiFi.localIP().toString()) + "/ws");
}

void loop() {
  streamServer.handleClient();
  
  // Limpiar WebSocket periódicamente
  ws.cleanupClients();
  
  delay(10); // Pequeño delay para evitar watchdog
}