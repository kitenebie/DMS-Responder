import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTheme } from '@/utils';
import { Icon } from './Icon';
import { ReportForm } from './ReportForm';

interface ReportScreenProps {
  incidentId?: string | number | null;
  isDarkMode: boolean;
  onBack: () => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  incidentId,
  isDarkMode,
  onBack,
}) => {
  const theme = getTheme(isDarkMode);
  const normalizedId =
    typeof incidentId === 'number' ? String(incidentId) : incidentId?.trim() ?? '';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={8}
          style={[styles.backButton, { backgroundColor: theme.surfaceAlt }]}>
          <Icon name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.avatar, { backgroundColor: '#10B981' }]}>
            <Icon name="document" size={22} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Responder Report</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {normalizedId ? `Report #${normalizedId}` : 'No active report selected'}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <ReportForm isDarkMode={isDarkMode} incidentId={incidentId} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
