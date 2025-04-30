import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

export default function App() {
  const [modalVisible, setModalVisible] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(true);
  const [flashEncendido, setFlashEncendido] = useState(true);

  const enviarComando = (comando) => {
    fetch(`http://192.168.4.1/${comando}`)
      .then(res => res.text())
      .then(text => console.log('Respuesta del auto:', text))
      .catch(err => console.error('Error al conectar con el auto:', err));
  };

  const toggleFlash = () => {
    const ruta = flashEncendido ? 'flash_off' : 'flash_on';
    fetch(`http://192.168.4.1/${ruta}`)
      .then(() => setFlashEncendido(!flashEncendido))
      .catch(err => console.error('Error con el flash:', err));
  };

  const toggleCamara = () => {
    setCamaraActiva(!camaraActiva);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>UTALControl</Text>

      <View style={styles.panel}>
        {/* Cámara */}
        <View style={styles.cameraView}>
          {camaraActiva ? (
            <Image
              source={{ uri: `http://192.168.4.1/cam?${Date.now()}` }}
              style={{ width: 320, height: 100 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.cameraText}>Cámara apagada</Text>
          )}
        </View>

        {/* Estado de conexión */}
        <View style={styles.connectionRow}>
          <View>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Conectado al auto</Text>
            </View>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.infoButtonText}>Información de conexión</Text>
            </TouchableOpacity>
          </View>
          <Image
            source={{ uri: 'https://imgur.com/2in5L4U.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Joystick */}
        <View style={styles.joystick}>
          <View style={styles.joystickRow}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => enviarComando('atras')}
            >
              <Text style={styles.arrowText}>↑</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.joystickRow}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => enviarComando('derecha')}
            >
              <Text style={styles.arrowText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stopButton}
              onPress={() => enviarComando('stop')}
            >
              <Text style={styles.stopText}>STOP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => enviarComando('izquierda')}
            >
              <Text style={styles.arrowText}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.joystickRow}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => enviarComando('adelante')}
            >
              <Text style={styles.arrowText}>↓</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Velocidad */}
        {/*}
        <View style={styles.speedControls}>
          <Text style={styles.speedLabel}>Velocidad de Servos</Text>
          <View style={styles.speedRow}>
            <TouchableOpacity style={styles.speedButton}>
              <Text style={styles.speedText}>–</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.speedButton}>
              <Text style={styles.speedText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        */}

        {/* Botones Flash y Cámara */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 12 }}>
          <TouchableOpacity style={styles.infoButton} onPress={toggleFlash}>
            <Text style={styles.infoButtonText}>
              {flashEncendido ? 'Apagar Flash' : 'Encender Flash'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoButton} onPress={toggleCamara}>
            <Text style={styles.infoButtonText}>
              {camaraActiva ? 'Apagar Cámara' : 'Encender Cámara'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conexión al Auto</Text>
            <Text style={styles.modalText}>
              El auto ha creado su propia red WiFi.{"\n\n"}
              1. En tu teléfono o computador, abre la configuración WiFi.{"\n"}
              2. Conéctate a la red **ESP32-AUTO**.{"\n\n"}
              Luego vuelve a esta aplicación para controlar el auto desde aquí.{"\n\n"}
              🔐 Contraseña: No requiere
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { marginTop:"12%", flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { textAlign:"center", width: 340, fontSize: 22, fontWeight: 'bold', backgroundColor: '#b91c1c', color: 'white', paddingHorizontal: 24, paddingVertical: 10, marginBottom: 2, shadowColor: '#000', elevation: 3 },
  panel: { width: 340, backgroundColor: 'white', borderColor: '#ccc', borderWidth: 1, padding: 16, justifyContent: 'space-between', shadowColor: '#000', elevation: 6 },
  cameraView: { height: 100, backgroundColor: '#e5e7eb', borderColor: '#9ca3af', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cameraText: { color: '#6b7280', fontStyle: 'italic', fontSize: 13 },
  connectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 10, height: 10, backgroundColor: '#10b981', borderRadius: 9999, marginRight: 6 },
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
  speedControls: { alignItems: 'center', gap: 8 },
  speedLabel: { fontSize: 13, color: '#1f2937' },
  speedRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  speedButton: { width: 80, height: 80, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', borderRadius: 8, elevation: 2 },
  speedText: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: 'white', width: '100%', maxWidth: 360, borderRadius: 12, padding: 24, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  modalCloseButton: { alignSelf: 'flex-end', marginTop: 12 },
  modalCloseText: { color: '#374151', fontWeight: 'bold' },
});
