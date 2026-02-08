import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { ReportForm as ReportFormType } from '@/types';
import { Icon } from './Icon';
import { getTheme } from '@/utils';
import { CameraCaptureModal } from './CameraCaptureModal';

interface ReportFormProps {
  form: ReportFormType;
  onUpdateForm: (field: keyof ReportFormType, value: string) => void;
  onSubmit: () => void;
  photoUri?: string | null;
  onPhotoCaptured: (uri: string) => void;
  onRemovePhoto: () => void;
  submitting?: boolean;
  isDarkMode: boolean;
}

export const ReportForm: React.FC<ReportFormProps> = ({ 
  form, 
  onUpdateForm, 
  onSubmit,
  photoUri,
  onPhotoCaptured,
  onRemovePhoto,
  submitting = false,
  isDarkMode,
}) => {
  const theme = getTheme(isDarkMode);
  const [errors, setErrors] = useState<{ actionsTaken?: boolean; photoUri?: boolean }>({});
  const [showCamera, setShowCamera] = useState(false);

  const validateForm = () => {
    const newErrors: { actionsTaken?: boolean; photoUri?: boolean } = {};
    
    if (!form.actionsTaken.trim()) {
      newErrors.actionsTaken = true;
    }
    
    if (!photoUri) {
      newErrors.photoUri = true;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit();
    } else {
      Alert.alert('Validation Error', 'Please fill in all required fields and add a photo.');
    }
  };

  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  const handleCameraCaptured = (uri: string) => {
    onPhotoCaptured(uri);
    setShowCamera(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Icon name="document" size={20} color="#34D399" />
        <Text style={[styles.title, { color: theme.text }]}>Responder Incident Report</Text>
      </View>

      <View style={[styles.infoBox, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
        <Icon name="info" size={16} color="#60A5FA" />
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          Submit this form only when the incident status is marked as &quot;Completed&quot;
        </Text>
      </View>

      <View style={styles.form}>
        {/* Actions Taken */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Actions Taken</Text>
            <Text style={styles.required}>*Required</Text>
          </View>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
              errors.actionsTaken && styles.textAreaError
            ]}
            placeholder="Describe actions taken at the scene..."
            placeholderTextColor={theme.textSecondary}
            value={form.actionsTaken}
            onChangeText={(text) => {
              onUpdateForm('actionsTaken', text);
              if (errors.actionsTaken) setErrors(prev => ({ ...prev, actionsTaken: false }));
            }}
            multiline
            textAlignVertical="top"
          />
          {errors.actionsTaken && (
            <Text style={styles.errorText}>Actions Taken is required</Text>
          )}
        </View>

        {/* Additional Notes */}
        <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Additional Notes (Optional)</Text>
          <TextInput
            style={[
              styles.textArea,
              styles.notesArea,
              { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="Any additional observations or notes..."
            placeholderTextColor={theme.textSecondary}
            value={form.additionalNotes}
            onChangeText={(text) => onUpdateForm('additionalNotes', text)}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Photo Upload */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Photo Evidence</Text>
            <Text style={styles.required}>*Required</Text>
          </View>
          
          {photoUri ? (
            <View style={styles.photoPreviewContainer}>
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Error loading image:', error);
                }}
              />
              {!submitting && (
                <Pressable style={styles.removePhotoButton} onPress={onRemovePhoto}>
                  <Icon name="close" size={20} color="#fff" />
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable 
              style={[
                styles.photoUploadButton, 
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                errors.photoUri && styles.photoUploadButtonError,
                submitting && styles.disabledButton
              ]} 
              onPress={handleTakePhoto}
              disabled={submitting}>
              <Icon name="camera" size={24} color="#34D399" />
              <Text style={[styles.photoUploadText, { color: theme.text }]}>Take Photo</Text>
            </Pressable>
          )}
          {errors.photoUri && (
            <Text style={styles.errorText}>Photo evidence is required</Text>
          )}
        </View>

        {/* Submit Button */}
        <Pressable 
          onPress={handleSubmit} 
          style={[styles.submitButton, submitting && styles.disabledButton]}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={18} color="#fff" />
              <Text style={styles.submitText}>Submit Report</Text>
            </>
          )}
        </Pressable>
      </View>

      <CameraCaptureModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCaptured}
        isDarkMode={isDarkMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 16,
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#64748B',
    fontSize: 12,
  },
  required: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 80,
  },
  textAreaError: {
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  notesArea: {
    minHeight: 64,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoUploadButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  photoUploadButtonError: {
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  photoUploadText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 16,
    padding: 6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: '#2563EB',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
