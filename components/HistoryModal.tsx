import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { HistoryFilter, HistoricalIncident, ChatMessage } from '@/types';
import { formatDate, formatTime, getTheme } from '@/utils';
import { fetchHistoricalIncidents, fetchChatMessages, STATUS_COLORS, STATUS_FLOW } from '@/mockData';
import { Icon } from './Icon';
import { ChatModal } from './ChatModal';

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ visible, onClose, isDarkMode }) => {
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>({ type: 'all', status: 'all' });
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const theme = getTheme(isDarkMode);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadHistory = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchHistoricalIncidents();
        if (isMounted) {
          setIncidents(data);
        }
      } catch {
        if (isMounted) {
          setLoadError('Failed to load history');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadHistory();
    intervalId = setInterval(loadHistory, 15000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [visible]);

  const incidentTypes = useMemo(() => {
    return [...new Set(incidents.map((i) => i.type))];
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (inc) =>
          inc.id.toLowerCase().includes(search) ||
          inc.type.toLowerCase().includes(search) ||
          inc.location.toLowerCase().includes(search) ||
          inc.description.toLowerCase().includes(search)
      );
    }

    if (filter.type !== 'all') {
      result = result.filter((inc) => inc.type === filter.type);
    }

    if (filter.status !== 'all') {
      result = result.filter((inc) => inc.status === filter.status);
    }

    return result;
  }, [searchText, filter, incidents]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openChatForIncident = (id: string) => {
    setChatVisible(true);
    fetchChatMessages(id).then((messages) => {
      setChatMessages(messages);
    });
  };

  const handleSendHistoryMessage = async (_message: string, _images: string[]) => {
    return;
  };

  return (
    <Modal transparent={false} visible={visible} animationType="slide" statusBarTranslucent={false}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={[styles.backButton, { backgroundColor: theme.surfaceAlt }]}>
            <Icon name="close" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.avatar, { backgroundColor: '#3B82F6' }]}>
              <Icon name="history" size={22} color="#fff" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Incident History</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {filteredIncidents.length} records
              </Text>
            </View>
          </View>
          <View style={styles.headerRight} />
        </View>

        <View style={[styles.filterSection, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={[styles.searchContainer, { backgroundColor: theme.surfaceAlt }]}>
            <Icon name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search incidents..."
              placeholderTextColor={theme.textSecondary}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterWrapper}>
              <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerContainer}
              >
                {['all', ...incidentTypes].map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setFilter({ ...filter, type })}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: theme.surfaceAlt },
                      filter.type === type && styles.pickerItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        { color: theme.textSecondary },
                        filter.type === type && styles.pickerTextActive,
                      ]}
                    >
                      {type === 'all' ? 'All' : type}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterWrapper}>
              <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Status</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerContainer}
              >
                {['all', ...STATUS_FLOW].map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => setFilter({ ...filter, status })}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: theme.surfaceAlt },
                      filter.status === status && styles.pickerItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        { color: theme.textSecondary },
                        filter.status === status && styles.pickerTextActive,
                      ]}
                    >
                      {status === 'all' ? 'All' : status}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        <ScrollView
          style={[styles.listContainer, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Loading history...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{loadError}</Text>
            </View>
          ) : filteredIncidents.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="document" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No incidents found</Text>
            </View>
          ) : (
            filteredIncidents.map((incident) => (
              <View
                key={incident.id}
                style={[
                  styles.incidentCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.incidentHeader}>
                  <View>
                    <Text style={[styles.incidentId, { color: theme.text }]}>{incident.id}</Text>
                    <Text style={[styles.incidentType, { color: theme.textSecondary }]}>
                      {incident.type}
                    </Text>
                  </View>
                  <View style={styles.headerRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: STATUS_COLORS[incident.status] },
                      ]}
                    >
                      <Text style={styles.statusText}>{incident.status}</Text>
                    </View>
                    <Pressable
                      onPress={() => openChatForIncident(String(incident.id))}
                      style={[styles.chatButton, { borderColor: theme.border }]}
                    >
                      <Icon name="chat" size={14} color={theme.text} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.incidentRow}>
                  <Icon name="location" size={14} color={theme.textSecondary} />
                  <Text style={[styles.incidentLocation, { color: theme.textSecondary }]}>
                    {incident.location}
                  </Text>
                </View>
                <Text style={[styles.incidentTime, { color: theme.textSecondary }]}>
                  {formatDate(incident.timeReported)} at {formatTime(incident.timeReported)}
                </Text>
                <Text style={[styles.incidentDescription, { color: theme.textSecondary }]}>
                  {incident.description}
                </Text>

                <Pressable
                  onPress={() => toggleExpanded(String(incident.id))}
                  style={[styles.expandButton, { borderColor: theme.border }]}
                >
                  <Text style={[styles.expandButtonText, { color: theme.text }]}>
                    {expandedIds.includes(String(incident.id)) ? 'Hide details' : 'Show details'}
                  </Text>
                </Pressable>

                {expandedIds.includes(String(incident.id)) && (
                  <View style={[styles.expandedSection, { borderTopColor: theme.border }]}>
                    <Text style={[styles.expandedLabel, { color: theme.textSecondary }]}>Time Completed</Text>
                    <Text style={[styles.expandedValue, { color: theme.text }]}>
                      {incident.time_completed
                        ? `${formatDate(incident.time_completed)} at ${formatTime(incident.time_completed)}`
                        : 'Not completed'}
                    </Text>

                    <Text style={[styles.expandedLabel, { color: theme.textSecondary }]}>Action Taken</Text>
                    <Text style={[styles.expandedValue, { color: theme.text }]}>
                      {incident.actions_taken || 'None'}
                    </Text>

                    <Text style={[styles.expandedLabel, { color: theme.textSecondary }]}>Additional Notes</Text>
                    <Text style={[styles.expandedValue, { color: theme.text }]}>
                      {incident.additional_notes || 'None'}
                    </Text>

                    <Text style={[styles.expandedLabel, { color: theme.textSecondary }]}>Photo</Text>
                    {incident.photo_path ? (
                      <Image source={{ uri: incident.photo_path }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <Text style={[styles.expandedValue, { color: theme.text }]}>None</Text>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <ChatModal
        visible={chatVisible}
        messages={chatMessages}
        onClose={() => setChatVisible(false)}
        onSendMessage={handleSendHistoryMessage}
        isDarkMode={isDarkMode}
        readOnly={true}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 12,
  },
  headerRight: {
    width: 44,
  },
  filterSection: {
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: '#0F172A',
    fontSize: 15,
  },
  filterRow: {
    marginTop: 4,
  },
  filterWrapper: {
    gap: 8,
  },
  filterLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  pickerItemActive: {
    backgroundColor: '#3B82F6',
  },
  pickerText: {
    color: '#64748B',
    fontSize: 13,
  },
  pickerTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  incidentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  incidentId: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  incidentType: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  chatButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  incidentLocation: {
    color: '#475569',
    fontSize: 14,
    flex: 1,
  },
  incidentTime: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  incidentDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  expandButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  expandedLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandedValue: {
    fontSize: 12,
    marginBottom: 6,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
});
