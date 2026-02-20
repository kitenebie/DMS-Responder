import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon } from './Icon';

interface CameraCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
  isDarkMode: boolean;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  visible,
  onClose,
  onCapture,
  isDarkMode,
}) => {
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (visible && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch (err) {
      console.warn('Failed to capture photo:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const theme = {
    background: isDarkMode ? '#0F172A' : '#F8FAFC',
    surface: isDarkMode ? '#1E293B' : '#FFFFFF',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#475569',
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: theme.surface }]}>
                <Icon name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={handleCapture}
                disabled={isCapturing}
                style={[
                  styles.shutter,
                  { backgroundColor: isCapturing ? '#94A3B8' : '#3B82F6' },
                ]}
              />
            </View>
          </CameraView>
        ) : permission ? (
          <View style={styles.permissionContainer}>
            <Text style={[styles.permissionText, { color: theme.text }]}>
              Camera permission is required to take photos.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              style={[styles.permissionButton, { backgroundColor: '#3B82F6' }]}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.permissionCancel}>
              <Text style={[styles.permissionCancelText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
              Checking camera permission...
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#fff',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  permissionCancel: {
    paddingVertical: 8,
  },
  permissionCancelText: {
    fontSize: 14,
  },
});
