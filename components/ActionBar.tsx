import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';

interface ActionBarProps {
  onOpenChat: () => void;
  onOpenHistory: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onOpenChat,
  onOpenHistory,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onOpenChat} style={styles.chatButton}>
        <Icon name="chat" size={18} color="#fff" />
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
});
