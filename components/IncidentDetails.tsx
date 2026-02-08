import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Incident } from '@/types';
import { formatTime, getTheme } from '@/utils';
import { DEFAULT_CONFIG } from '@/mockData';
import { Icon } from './Icon';

interface IncidentDetailsProps {
  incident: Incident;
  responderName?: string;
  isDarkMode: boolean;
}

export const IncidentDetails: React.FC<IncidentDetailsProps> = ({
  incident,
  responderName = DEFAULT_CONFIG.responder_name,
  isDarkMode,
}) => {
  const theme = getTheme(isDarkMode);
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Icon name="document" size={20} color="#60A5FA" />
        <Text style={[styles.title, { color: theme.text }]}>Active</Text>
      </View>

      <View style={styles.grid}>
        <View style={[styles.gridItem, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Incident ID</Text>
          <Text style={[styles.value, { color: theme.text }]}>{incident.id}</Text>
        </View>

        <View style={[styles.gridItem, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Type</Text>
          <Text style={[styles.value, { color: theme.text }]}>{incident.type}</Text>
        </View>

        <View style={[styles.gridItem, styles.fullWidth, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Location</Text>
          <Text style={[styles.value, { color: theme.text }]}>{incident.location}</Text>
        </View>

        <View style={[styles.gridItem, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Time Reported</Text>
          <Text style={[styles.value, { color: theme.text }]}>
            {formatTime(incident.timeReported)}
          </Text>
        </View>

        <View style={[styles.gridItem, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Assigned Responder</Text>
          <Text style={[styles.value, { color: theme.text }]}>{responderName}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
  },
  value: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
  },
});
