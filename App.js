import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const [modalVisible, setModalVisible] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(true);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [estadoRed, setEstadoRed] = useState({ conectado: false, modo: 'ap', ip: '' });
  const [errorCamara, setErrorCamara] = useState(false);
  const [baseUrl, setBaseUrl] = useState('http://192.168.4.1');
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [ipManual, setIpManual] = useState('');
  const [ipManualActiva, setIpManualActiva] = useState(false);
  const [ws, setWs] = useState(null);

  const scanIPs = async () => {
    const subnet = '192.168.1';
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      try {
        const res = await fetch(`http://${ip}/status`, { timeout: 1000 });
        const data = await res.json();
        if (data && data.ip) {
          setBaseUrl(`http://${data.ip}`);
          setEstadoRed({ conectado: true, modo: data.mode, ip: data.ip });
          return;
        }
      } catch (e) {
        continue;
      }
    }
  };

  useEffect(() => {
    scanIPs();
  }, []);

  useEffect(() => {
    if (!baseUrl) return;

    const socketUrl = baseUrl.replace('http://', 'ws://').replace(/\/$/, '') + '/ws';
    console.log('Intentando conectar a:', socketUrl);

    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      console.log('✅ WebSocket conectado');
      setWs(socket);
    };

    socket.onmessage = (event) => {
      console.log('📩 Mensaje del ESP32:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          if (!ipManualActiva && data.ip) setBaseUrl(`http://${data.ip}`);
          setEstadoRed({
            conectado: data.connected || data.mode === 'ap',
            modo: data.mode,
            ip: data.ip || ''
          });
        }
      } catch (e) {
        console.warn('⚠️ Mensaje WebSocket no válido:', event.data);
      }
    };

    socket.onerror = (e) => {
      console.error('❌ WebSocket error:', e.message);
    };

    socket.onclose = () => {
      console.warn('⚠️ WebSocket desconectado');
    };

    return () => {
      socket.close();
    };
  }, [baseUrl, ipManualActiva]);

  const enviarComando = (comando) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(comando);
    } else {
      console.warn('WebSocket no conectado');
    }
  };

  const toggleCamara = () => {
    setCamaraActiva(!camaraActiva);
  };

  const enviarCredencialesWiFi = async () => {
    try {
      const res = await fetch(`${baseUrl}/config_wifi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, pass: password })
      });
      const text = await res.text();
      Alert.alert('Reiniciando', 'El auto se está reiniciando. Si la red configurada no existe aún, volverá a modo AP en unos segundos.');
      setModalVisible(false);
      setTimeout(() => {
        setIpManualActiva(false);
        setBaseUrl('http://192.168.4.1');
        scanIPs();
      }, 10000);
    } catch (err) {
      Alert.alert('Error', 'No se pudo conectar al auto');
    }
  };

  const manejarMovimiento = (comando) => {
    if (!accionEnCurso) {
      setAccionEnCurso(true);
      enviarComando(comando);
    }
  };

  const detenerMovimiento = () => {
    enviarComando('stop');
    setAccionEnCurso(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>UTALControl</Text>
      <View style={styles.panel}>
        <View style={styles.cameraView}>
          {camaraActiva ? (
            errorCamara ? (
              <Text style={styles.cameraText}>❌ No se pudo cargar la cámara. Asegúrate de estar conectado al auto.</Text>
            ) : (
              <WebView
                source={{ uri: `${baseUrl}:81/stream` }}
                javaScriptEnabled
                allowsInlineMediaPlayback
                originWhitelist={['*']}
                style={{ width: 300, height: 240, transform: [{ rotate: '90deg' }] }}
                onError={() => setErrorCamara(true)}
                onLoadStart={() => setErrorCamara(false)}
              />
            )
          ) : (
            <Text style={styles.cameraText}>Cámara apagada</Text>
          )}
        </View>
        <View style={styles.connectionRow}>
          <View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: estadoRed.conectado ? '#10b981' : '#ef4444' }]} />
              <Text style={styles.statusText}>
                {estadoRed.conectado ? `Conectado (${estadoRed.modo}) IP: ${estadoRed.ip}` : `Sin conexión (${estadoRed.modo})`}
              </Text>
            </View>
            <TouchableOpacity style={styles.infoButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.infoButtonText}>Configurar red WiFi</Text>
            </TouchableOpacity>
          </View>
          <Image source={{ uri: 'https://imgur.com/2in5L4U.png' }} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.joystick}>
          <View style={styles.joystickRow}>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('atras')} onPressOut={detenerMovimiento} disabled={accionEnCurso}>
              <Text style={styles.arrowText}>↓</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.joystickRow}>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('derecha')} onPressOut={detenerMovimiento} disabled={accionEnCurso}>
              <Text style={styles.arrowText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopButton} onPress={() => enviarComando('stop')}>
              <Text style={styles.stopText}>STOP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('izquierda')} onPressOut={detenerMovimiento} disabled={accionEnCurso}>
              <Text style={styles.arrowText}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.joystickRow}>
            <TouchableOpacity style={styles.arrowButton} onPressIn={() => manejarMovimiento('adelante')} onPressOut={detenerMovimiento} disabled={accionEnCurso}>
              <Text style={styles.arrowText}>↓</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.infoButton} onPress={toggleCamara}>
            <Text style={styles.infoButtonText}>{camaraActiva ? 'Apagar Cámara' : 'Encender Cámara'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar red WiFi</Text>
            <TextInput placeholder="Nombre de la red (SSID)" value={ssid} onChangeText={setSsid} style={styles.input} />
            <TextInput placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
            <Text style={styles.modalText}>
              1. Conéctate a la red "ESP32-AUTO" desde los ajustes de WiFi.{"\n"}
              2. Regresa a la app y presiona "Guardar y Reiniciar".{"\n\n"}
              Si la conexión a la red WiFi tiene éxito, el auto mostrará su IP aquí. Si falla, volverá a modo AP automáticamente.
            </Text>
            <TextInput placeholder="Aplicar IP manual (ej. 192.168.1.100)" value={ipManual} onChangeText={setIpManual} style={[styles.input, { marginTop: 16 }]} />
            <TouchableOpacity style={[styles.infoButton, { marginTop: 8 }]} onPress={() => {
              const nuevaIp = ipManual.trim();
              if (!nuevaIp) return;
              const formateada = nuevaIp.startsWith('http') ? nuevaIp : `http://${nuevaIp}`;
              setBaseUrl(formateada);
              setIpManualActiva(true);
              setEstadoRed({ conectado: true, modo: 'manual', ip: formateada.replace('http://', '') });
              setIpManual('');
              Alert.alert('Dirección IP actualizada', `Nueva IP: ${formateada}`);
            }}>
              <Text style={styles.infoButtonText}>Aplicar IP manual</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={enviarCredencialesWiFi}>
                <Text style={styles.modalCloseText}>Guardar y Reiniciar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: '12%', flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { textAlign: 'center', width: 340, fontSize: 22, fontWeight: 'bold', backgroundColor: '#b91c1c', color: 'white', paddingHorizontal: 24, paddingVertical: 10, marginBottom: 2, shadowColor: '#000', elevation: 3 },
  panel: { width: 340, backgroundColor: 'white', borderColor: '#ccc', borderWidth: 1, padding: 16, justifyContent: 'space-between', shadowColor: '#000', elevation: 6 },
  cameraView: { height: 180, backgroundColor: '#e5e7eb', borderColor: '#9ca3af', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cameraText: { color: '#6b7280', fontStyle: 'italic', fontSize: 13, textAlign: 'center' },
  connectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 9999, marginRight: 6 },
  statusText: { fontSize: 13, color: '#1f2937' },
  infoButton: { backgroundColor: '#b91c1c', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, elevation: 2 },
  infoButtonText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  logo: { width: 96, height: 80, marginLeft: 12 },
  joystick: { alignItems: 'center', marginBottom: 16 },
  joystickRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 6 },
  arrowButton: { width: 80, height: 80, backgroundColor: '#b91c1c', alignItems: 'center', justifyContent: 'center', borderRadius: 8, elevation: 3 },
  arrowText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  stopButton: { width: 80, height: 80, backgroundColor: '#4b5563', alignItems: 'center', justifyContent: 'center', borderRadius: 8, elevation: 4 },
  stopText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: 'white', width: '100%', maxWidth: 360, borderRadius: 12, padding: 24, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalText: { fontSize: 14, color: '#374151', marginTop: 10, lineHeight: 20 },
  modalCloseText: { color: '#b91c1c', fontWeight: 'bold', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6, marginBottom: 10, fontSize: 14 },
});