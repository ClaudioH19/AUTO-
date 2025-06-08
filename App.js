// App completa con IP manual en modal separado
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
import Feather from 'react-native-vector-icons/Feather';

export default function App() {
  const [modalWifiVisible, setModalWifiVisible] = useState(false);
  const [modalScanVisible, setModalScanVisible] = useState(false);
  const [modalIpVisible, setModalIpVisible] = useState(false);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [estadoRed, setEstadoRed] = useState({ conectado: false, modo: 'ap', ip: '' });
  const [baseUrl, setBaseUrl] = useState('http://192.168.4.1');
  const [conexionLista, setConexionLista] = useState(false);
  const [ipManual, setIpManual] = useState('');
  const [ipManualActiva, setIpManualActiva] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(true);
  const [errorCamara, setErrorCamara] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [ipActualEscaneo, setIpActualEscaneo] = useState('');
  const stopScan = useRef(false);
  const ws = useRef(null);

  const scanIPs = async () => {
    if (ipManualActiva) return;
    stopScan.current = false;
    setModalScanVisible(true);
    const subnet = '192.168.1';
    const timeoutMs = 1000;
    for (let i = 1; i <= 254; i++) {
      if (stopScan.current) break;
      const ip = `${subnet}.${i}`;
      setIpActualEscaneo(ip);
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(`http://${ip}/status`, { signal: controller.signal });
        clearTimeout(t);
        const data = await res.json();
        if (data?.ip && data?.mode) {
          setBaseUrl(`http://${data.ip}`);
          setEstadoRed({ conectado: true, modo: data.mode, ip: data.ip });
          setConexionLista(true);
          break;
        }
      } catch {}
    }
    setModalScanVisible(false);
  };

  const reiniciarAplicacion = () => {
    stopScan.current = true;
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }
    setEstadoRed({ conectado: false, modo: 'ap', ip: '' });
    setBaseUrl('http://192.168.4.1');
    setConexionLista(false);
    setIpManual('');
    setIpManualActiva(false);
    setModalWifiVisible(false);
    setModalScanVisible(false);
    setErrorCamara(false);
    setCamaraActiva(true);
  };

  const enviarCredencialesWiFi = async () => {
  // Validar que no estén vacías
  if (!ssid.trim() || !password.trim()) {
    Alert.alert('Error', 'SSID y contraseña no pueden estar vacíos');
    return;
  }

  console.log('Enviando credenciales:');
  console.log('SSID:', ssid);
  console.log('Password:', password);
  console.log('URL:', `${baseUrl}/config_wifi`);

  try {
    const requestBody = JSON.stringify({ ssid: ssid.trim(), pass: password.trim() });
    console.log('Body enviado:', requestBody);

    const response = await fetch(`${baseUrl}/config_wifi`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: requestBody
    });

    console.log('Status response:', response.status);
    const responseText = await response.text();
    console.log('Response:', responseText);

    if (response.ok) {
      Alert.alert('Reiniciando', 'Espera 10 s mientras cambia de red...');
      setModalWifiVisible(false);
      setSsid(''); // Limpiar campos
      setPassword('');
      
      setTimeout(() => {
        if (!ipManualActiva) scanIPs();
        setIpManualActiva(false);
        setConexionLista(true);
      }, 10000);
    } else {
      Alert.alert('Error', `Error del servidor: ${response.status}`);
    }
  } catch (error) {
    console.log('Error:', error);
    Alert.alert('Error', 'No se pudo conectar al auto');
  }
};

  const resetearWiFi = async () => {
    try {
      await fetch(`${baseUrl}/reset_wifi`);
      Alert.alert('Reinicio', 'Credenciales eliminadas. El auto volverá al modo AP.');
      reiniciarAplicacion();
    } catch {
      Alert.alert('Error', 'No se pudo comunicar con el auto para resetear WiFi.');
    }
  };

  const enviarComando = (cmd) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(cmd);
  };

  const manejarMovimiento = (cmd) => !accionEnCurso && (setAccionEnCurso(true), enviarComando(cmd));
  const detenerMovimiento = () => (enviarComando('stop'), setAccionEnCurso(false));

  useEffect(() => {
  let intervalo;

  const intentarConexionModoAP = async () => {
    if (conexionLista) return; // Ya está conectado, no sigas intentando

    try {
      const res = await fetch('http://192.168.4.1/status', { timeout: 1500 });
      const data = await res.json();
      if (data?.ip && data?.mode) {
        console.log("📡 ESP32 en modo AP detectado automáticamente");
        setBaseUrl('http://192.168.4.1');
        setEstadoRed({ conectado: true, modo: data.mode, ip: data.ip });
        setConexionLista(true);
        clearInterval(intervalo); // Detener intentos
      }
    } catch (e) {
      console.log("⏳ Aún no se detecta ESP32 AP:", e.message || e);
    }
  };

  // Ejecutar primero una vez al montar
  intentarConexionModoAP();

  // Luego repetir cada 5 segundos
  intervalo = setInterval(() => {
    intentarConexionModoAP();
  }, 5000);

  // Limpieza
  return () => clearInterval(intervalo);
}, [conexionLista]);


  useEffect(() => {
    if (!conexionLista) return;
    const socketUrl = baseUrl.replace('http://', 'ws://').replace(/\/$/, '') + '/ws';
    if (ws.current) { ws.current.onclose = null; ws.current.close(); }
    const socket = new WebSocket(socketUrl);
    ws.current = socket;
    socket.onclose = () => setTimeout(() => {
      if (ws.current === socket) { setConexionLista(false); setTimeout(() => setConexionLista(true), 100); }
    }, 3000);
    return () => { if (ws.current === socket) socket.close(); };
  }, [baseUrl, conexionLista]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>UTALControl</Text>

      <View style={styles.panel}>
        <View style={styles.cameraView}>
          {camaraActiva ? (
            errorCamara ? (
              <Text style={styles.cameraText}>❌ No se pudo cargar la cámara.</Text>
            ) : (
              <WebView
                source={{ uri: `${baseUrl}:81/stream` }}
                style={{ height: '100%', width: '100%', transform: [{ rotate: '90deg' }], backgroundColor: '#000' }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onError={() => setErrorCamara(true)}
                onHttpError={() => setErrorCamara(true)}
                onLoadStart={() => setErrorCamara(false)}
              />
            )
          ) : (
            <Text style={styles.cameraText}>Cámara apagada</Text>
          )}
        </View>

        <View style={styles.connectionRow}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: estadoRed.conectado ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.statusText}>
              {estadoRed.conectado ? `Conectado (${estadoRed.modo})\n IP: ${estadoRed.ip}` : `Sin conexión (${estadoRed.modo})`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={reiniciarAplicacion}>
              <Feather name="refresh-ccw" size={24} color="#b91c1c" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalIpVisible(true)}>
              <Feather name="search" size={24} color="#b91c1c" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalWifiVisible(true)}>
              <Feather name="settings" size={24} color="#b91c1c" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.joystick}>
          <View style={styles.joystickRow}>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('atras')} onPressOut={detenerMovimiento}>
              <Text style={styles.arrowText}>↑</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.joystickRow}>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('derecha')} onPressOut={detenerMovimiento}>
              <Text style={styles.arrowText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopButton} onPress={detenerMovimiento}>
              <Text style={styles.stopText}>STOP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('izquierda')} onPressOut={detenerMovimiento}>
              <Text style={styles.arrowText}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.joystickRow}>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('adelante')} onPressOut={detenerMovimiento}>
              <Text style={styles.arrowText}>↓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal de Configuración WiFi */}
      <Modal visible={modalWifiVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar WiFi</Text>
            <TextInput placeholder="SSID" style={styles.input} value={ssid} onChangeText={setSsid} />
            <TextInput placeholder="Contraseña" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.botonPrimario} onPress={enviarCredencialesWiFi}>
                <Text style={styles.botonPrimarioTexto}>Guardar y Reiniciar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonSecundario} onPress={resetearWiFi}>
                <Text style={styles.botonSecundarioTexto}>Restablecer red</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonTerciario} onPress={() => setModalWifiVisible(false)}>
                <Text style={styles.botonTerciarioTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Escaneo */}
      <Modal visible={modalScanVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Escaneando red…</Text>
            <ActivityIndicator size="large" color="#b91c1c" />
            <Text style={{ marginTop: 12, fontSize: 14, color: '#374151' }}>
              IP actual: {ipActualEscaneo}
            </Text>
            <TouchableOpacity style={[styles.infoButton, { marginTop: 20 }]} onPress={() => { stopScan.current = true; setModalScanVisible(false); }}>
              <Text style={styles.infoButtonText}>Cancelar escaneo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal IP manual */}
      <Modal visible={modalIpVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>IP Manual</Text>
            <TextInput placeholder="IP manual (ej. 192.168.1.100)" style={styles.input} value={ipManual} onChangeText={setIpManual} />
            <TouchableOpacity style={styles.botonPrimario} onPress={() => {
              const ip = ipManual.trim();
              if (!ip) return;
              const url = ip.startsWith('http') ? ip : `http://${ip}`;
              setIpManualActiva(true);
              setBaseUrl(url);
              setEstadoRed({ conectado: true, modo: 'manual', ip: url.replace('http://', '') });
              setConexionLista(true);
              setIpManual('');
              Alert.alert('IP actualizada', url);
              setModalIpVisible(false);
            }}>
              <Text style={styles.botonPrimarioTexto}>Aplicar IP manual</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonTerciario} onPress={() => setModalIpVisible(false)}>
              <Text style={styles.botonTerciarioTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────── */
/*  Estilos                               */
/* ────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: '#e1e1e1',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
},
  title: {
    width: '100%',
    fontSize: 22,
    fontWeight: 'bold',
    backgroundColor: '#b91c1c',
    color: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 10,
    textAlign: 'center',
    alignSelf: 'center',
    elevation: 4,
    shadowColor: '#000',
  },
  panel: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 4,
},
  cameraView: {
    height: 220,
    alignSelf: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#444',
    aspectRatio: 4 / 3,
  },
  cameraText: {
    color: '#6b7280',
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#1f2937',
  },
  joystick: {
    alignItems: 'center',
    marginTop: 4,
  },
  joystickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
  },
  arrowButton: {
    width: 80,
    height: 80,
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    elevation: 2,
  },
  arrowText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  stopButton: {
    width: 80,
    height: 80,
    backgroundColor: '#4b5563',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    elevation: 3,
  },
  stopText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    padding: 24,
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
    fontSize: 14,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  infoButton: {
    backgroundColor: '#b91c1c',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    marginTop: 12,
    alignSelf: 'center',
  },
  infoButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalCloseText: {
    color: '#b91c1c',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalButtonContainer: {
  marginTop: 20,
  gap: 12,
},

botonPrimario: {
  backgroundColor: '#b91c1c',
  paddingVertical: 12,
  borderRadius: 9999,
  alignItems: 'center',
  marginTop: 15,
},
botonPrimarioTexto: {
  color: '#ffffff',
  fontWeight: 'bold',
  fontSize: 14,
},

botonSecundario: {
  backgroundColor: '#6b7280',
  paddingVertical: 12,
  borderRadius: 9999,
  alignItems: 'center',
},
botonSecundarioTexto: {
  color: '#ffffff',
  fontWeight: 'bold',
  fontSize: 14,
},

botonTerciario: {
  paddingVertical: 10,
  alignItems: 'center',
},
botonTerciarioTexto: {
  color: '#b91c1c',
  fontWeight: 'bold',
  fontSize: 14,
},
});