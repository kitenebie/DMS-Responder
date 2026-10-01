import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';

interface ActionBarProps {
  onOpenChat: () => void;
  onOpenHistory: () => void;
  hasChatPeerTyping?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onOpenChat,
  onOpenHistory,
  hasChatPeerTyping = false,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onOpenChat}
        style={styles.chatButton}
        accessibilityLabel={hasChatPeerTyping ? 'Open Chat, a chat participant is typing' : 'Open Chat'}
      >
        <Icon name="chat" size={18} color="#fff" />
        {hasChatPeerTyping ? (
          <View style={styles.typingBadge} accessibilityLabel="Chat participant is typing">
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </View>
        ) : null}
        <Text style={styles.buttonText}>Open Chat</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onOpenHistory} style={styles.historyButton}>
        <Icon name="history" size={18} color="#fff" />
        <Text style={styles.buttonText}>History</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  chatButton: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  historyButton: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  reportButton: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  typingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 24,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
