import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatMessage } from '@/types';
import { getTheme } from '@/utils';
import { Icon } from './Icon';
import { CameraCaptureModal } from './CameraCaptureModal';

interface ChatScreenProps {
  messages: ChatMessage[];
  onBack: () => void;
  onSendMessage: (message: string, images: string[]) => Promise<void> | void;
  isDarkMode: boolean;
  readOnly?: boolean;
  chatTabs?: { key: 'dispatcher' | 'citizen'; label: string }[];
  activeChatTab?: 'dispatcher' | 'citizen';
  onChangeChatTab?: (tab: 'dispatcher' | 'citizen') => void;
  title?: string;
  subtitle?: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  messages,
  onBack,
  onSendMessage,
  isDarkMode,
  readOnly = false,
  chatTabs,
  activeChatTab,
  onChangeChatTab,
  title,
  subtitle,
}) => {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const theme = getTheme(isDarkMode);
  const keyboardOffset = Platform.OS === 'ios' ? 0 : insets.top;
  const canSend = !readOnly && (inputText.trim().length > 0 || selectedImages.length > 0);
  const headerTitle =
    title ??
    (activeChatTab === 'citizen'
      ? 'Citizen Chat'
      : activeChatTab === 'dispatcher'
        ? 'Dispatcher Chat'
        : 'Dispatch Chat');
  const headerSubtitle =
    subtitle ??
    (activeChatTab === 'citizen'
      ? 'Citizen conversation'
      : activeChatTab === 'dispatcher'
        ? 'Dispatcher conversation'
        : 'Connected');

  const resolveSenderRoleLabel = (msg: ChatMessage): string | null => {
    if (msg.sender_is_citizen === true) {
      return 'Citizen';
    }

    if (msg.sender_is_responder === true) {
      return 'Responder';
    }

    if (!msg.isUser && activeChatTab === 'dispatcher') {
      return 'Dispatcher';
    }

    if (!msg.isUser && activeChatTab === 'citizen') {
      return 'Citizen';
    }

    return null;
  };

  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [messages]);

  const handleSend = async () => {
    if (readOnly || isSending) return;
    const trimmedMessage = inputText.trim();
    const imagesToSend = [...selectedImages];
    if (!trimmedMessage && imagesToSend.length === 0) return;

    setIsSending(true);
    setInputText('');
    setSelectedImages([]);
    try {
      await Promise.resolve(onSendMessage(trimmedMessage, imagesToSend));
    } catch (err) {
      console.warn('Failed to send message:', err);
      setInputText(trimmedMessage);
      setSelectedImages(imagesToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        setSelectedImages((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (err) {
      console.warn('Failed to pick image:', err);
    } finally {
      setShowAttachOptions(false);
    }
  };

  const handleTakePhoto = () => {
    setShowAttachOptions(false);
    setShowCamera(true);
  };

  const handleCameraCaptured = (uri: string) => {
    setSelectedImages((prev) => [...prev, uri]);
    setShowCamera(false);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
        style={styles.container}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Icon name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.avatar, { backgroundColor: '#2563EB' }]}>
              <Icon name="chat" size={22} color="#fff" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>{headerTitle}</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {headerSubtitle}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight} />
        </View>

        {chatTabs && chatTabs.length > 0 ? (
          <View style={[styles.tabsWrap, { backgroundColor: theme.surface }]}>
            <View style={[styles.tabsContainer, { backgroundColor: theme.surfaceAlt }]}>
              {chatTabs.map((tab) => {
                const isActive = activeChatTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => onChangeChatTab?.(tab.key)}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}>
                    <Text
                      style={[
                        styles.tabText,
                        { color: isActive ? '#FFFFFF' : theme.textSecondary },
                      ]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {messages.map((msg) => {
            const senderRoleLabel = resolveSenderRoleLabel(msg);

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageWrapper,
                  msg.isUser ? styles.messageRight : styles.messageLeft,
                ]}>
                <View
                  style={[
                    styles.messageBubble,
                    msg.isUser ? styles.bubbleUser : styles.bubbleOther,
                    {
                      backgroundColor: msg.isUser ? '#2563EB' : theme.surfaceAlt,
                    },
                  ]}>
                  {!msg.isUser && (
                    <Text style={[styles.senderName, { color: theme.textSecondary }]}>
                      {senderRoleLabel ? `${msg.sender} - ${senderRoleLabel}` : msg.sender}
                    </Text>
                  )}
                  <Text style={[styles.messageText, { color: theme.text }]}>{msg.message}</Text>
                  {msg.image && (
                    <TouchableOpacity
                      onPress={() => setPreviewImage(msg.image ?? null)}
                      style={styles.messageImageWrap}>
                      <Image
                        source={{ uri: msg.image }}
                        style={styles.messageImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}
                  <Text
                    style={[
                      styles.messageTime,
                      msg.isUser ? styles.timeUser : styles.timeOther,
                      { color: msg.isUser ? '#BFDBFE' : theme.textSecondary },
                    ]}>
                    {msg.time}
                  </Text>
                  {msg.isUser && (
                    <View style={styles.statusRow}>
                      {msg.status === 'failed' ? (
                        <>
                          <Icon name="warning" size={12} color="#F87171" />
                          <Text style={[styles.statusText, { color: '#F87171' }]}>Not sent</Text>
                        </>
                      ) : msg.status === 'sending' ? (
                        <>
                          <Icon name="time" size={12} color="#FBBF24" />
                          <Text style={[styles.statusText, { color: '#FBBF24' }]}>Sending</Text>
                        </>
                      ) : (
                        <>
                          <Icon name="check" size={12} color="#BFDBFE" />
                          <Text style={[styles.statusText, { color: '#BFDBFE' }]}>Sent</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {!readOnly ? (
          <View
            style={[
              styles.inputContainer,
              { borderTopColor: theme.border, backgroundColor: theme.surface },
            ]}>
            {selectedImages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.attachmentsRow}>
                {selectedImages.map((uri, idx) => (
                  <View key={`${uri}-${idx}`} style={styles.attachmentChip}>
                    <Image source={{ uri }} style={styles.attachmentImage} />
                    <TouchableOpacity
                      onPress={() =>
                        setSelectedImages((prev) => prev.filter((_, imageIndex) => imageIndex !== idx))
                      }
                      style={styles.attachmentRemove}>
                      <Icon name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity onPress={() => setShowAttachOptions(true)} style={styles.attachButton}>
                <Icon name="paperclip" size={18} color={theme.text} />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Type a message..."
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendButton, (!canSend || isSending) && styles.sendButtonDisabled]}
                disabled={!canSend || isSending}>
                <Icon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.infoBox,
              { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
            ]}>
            <Icon name="info" size={16} color="#60A5FA" />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              History chat is read-only.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={showAttachOptions}
        animationType="fade"
        onRequestClose={() => setShowAttachOptions(false)}>
        <TouchableOpacity style={styles.attachOverlay} onPress={() => setShowAttachOptions(false)}>
          <View style={[styles.attachSheet, { backgroundColor: theme.surface }]}>
            <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto}>
              <Icon name="camera" size={18} color={theme.text} />
              <Text style={[styles.attachOptionText, { color: theme.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handlePickImage}>
              <Icon name="document" size={18} color={theme.text} />
              <Text style={[styles.attachOptionText, { color: theme.text }]}>Upload Photo</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <CameraCaptureModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCaptured}
        isDarkMode={isDarkMode}
      />

      <Modal
        transparent
        visible={!!previewImage}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity style={styles.previewOverlay} onPress={() => setPreviewImage(null)}>
          <View style={styles.previewContainer}>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#334155',
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  headerRight: {
    width: 44,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageWrapper: {
    flexDirection: 'row',
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleUser: {
    backgroundColor: '#2563EB',
  },
  bubbleOther: {
    backgroundColor: '#475569',
  },
  senderName: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
  },
  timeUser: {
    color: '#BFDBFE',
    textAlign: 'right',
  },
  timeOther: {
    color: '#6B7280',
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#1E293B',
  },
  attachmentsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  attachmentChip: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 300,
    height: 300,
  },
  attachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#475569',
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  messageImage: {
    width: 250,
    height: 250,
    borderRadius: 10,
    marginTop: 8,
  },
  messageImageWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0, 63, 163, 0.1)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  infoText: {
    color: '#2563EB',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachSheet: {
    width: '80%',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  attachOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  tabsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontWeight: '700',
    fontSize: 12,
  },
});
