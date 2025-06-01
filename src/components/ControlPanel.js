// 📁 src/components/ControlPanel.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import styles from './styles/styles';

export default function ControlPanel({
  baseUrl,
  camaraActiva,
  errorCamara,
  onErrorCamara,
  onMover,
  onDetener,
}) {
  return (
    <View>
      <View style={styles.cameraView}>
        {camaraActiva ? (
          errorCamara ? (
            <Text style={styles.cameraText}>❌ No se pudo cargar la cámara.</Text>
          ) : (
            <WebView
              source={{ uri: `${baseUrl}:81/stream` }}
              style={{
                height: '100%',
                width: '100%',
                transform: [{ rotate: '90deg' }],
                backgroundColor: '#000',
              }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onError={onErrorCamara}
              onHttpError={onErrorCamara}
              onLoadStart={() => onErrorCamara(false)}
            />
          )
        ) : (
          <Text style={styles.cameraText}>Cámara apagada</Text>
        )}
      </View>

      <View style={styles.joystick}>
        <View style={styles.joystickRow}>
          <TouchableOpacity
            style={styles.arrowButton}
            onPressIn={() => onMover('atras')}
            onPressOut={onDetener}
          >
            <Text style={styles.arrowText}>↑</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.joystickRow}>
          <TouchableOpacity
            style={styles.arrowButton}
            onPressIn={() => onMover('derecha')}
            onPressOut={onDetener}
          >
            <Text style={styles.arrowText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopButton} onPress={onDetener}>
            <Text style={styles.stopText}>STOP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.arrowButton}
            onPressIn={() => onMover('izquierda')}
            onPressOut={onDetener}
          >
            <Text style={styles.arrowText}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.joystickRow}>
          <TouchableOpacity
            style={styles.arrowButton}
            onPressIn={() => onMover('adelante')}
            onPressOut={onDetener}
          >
            <Text style={styles.arrowText}>↓</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
