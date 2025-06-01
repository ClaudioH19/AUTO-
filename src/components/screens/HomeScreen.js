// 📁 src/screens/HomeScreen.js
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import ControlPanel from '../ControlPanel';
import useWebSocket from '../hooks/useWebSocket';
import { enviarCredencialesWiFi, resetearWiFi } from '../../api';

export default function HomeScreen() {
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

  const { send } = useWebSocket(baseUrl);

  const manejarMovimiento = (cmd) => {
    if (!accionEnCurso) {
      setAccionEnCurso(true);
      send(cmd);
    }
  };

  const detenerMovimiento = () => {
    send('stop');
    setAccionEnCurso(false);
  };

  const reiniciarAplicacion = () => {
    stopScan.current = true;
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

  const enviarCredenciales = async () => {
    try {
      await enviarCredencialesWiFi(baseUrl, ssid, password);
      Alert.alert('Reiniciando', 'Espera 10 s mientras cambia de red...');
      setModalWifiVisible(false);
      setTimeout(() => {
        if (!ipManualActiva) escanearIPs();
        setIpManualActiva(false);
        setConexionLista(true);
      }, 10000);
    } catch {
      Alert.alert('Error', 'No se pudo conectar al auto');
    }
  };

  const escanearIPs = async () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>UTALControl</Text>
      <View style={styles.panel}>
        <ControlPanel
          baseUrl={baseUrl}
          camaraActiva={camaraActiva}
          errorCamara={errorCamara}
          onErrorCamara={setErrorCamara}
          onMover={manejarMovimiento}
          onDetener={detenerMovimiento}
        />

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
      </View>

      {/* Modal de Configuración WiFi */}
      <Modal visible={modalWifiVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar WiFi</Text>
            <TextInput placeholder="SSID" style={styles.input} value={ssid} onChangeText={setSsid} />
            <TextInput placeholder="Contraseña" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.botonPrimario} onPress={enviarCredenciales}>
              <Text style={styles.botonPrimarioTexto}>Guardar y Reiniciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonSecundario} onPress={async () => {
              await resetearWiFi(baseUrl);
              reiniciarAplicacion();
            }}>
              <Text style={styles.botonSecundarioTexto}>Restablecer red</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonTerciario} onPress={() => setModalWifiVisible(false)}>
              <Text style={styles.botonTerciarioTexto}>Cancelar</Text>
            </TouchableOpacity>
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
            <TouchableOpacity style={[styles.botonPrimario, { marginTop: 20 }]} onPress={() => { stopScan.current = true; setModalScanVisible(false); }}>
              <Text style={styles.botonPrimarioTexto}>Cancelar escaneo</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e1e1e1',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    backgroundColor: '#b91c1c',
    color: '#ffffff',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 25,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    elevation: 4,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#1f2937',
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
    textAlign: 'center',
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
    marginTop: 10,
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