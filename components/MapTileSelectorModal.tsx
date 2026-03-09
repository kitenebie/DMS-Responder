import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from './Icon';

export type MapLayerKey =
  | 'standard'
  | 'osm'
  | 'maptilerStreets'
  | 'tracestrackDefault'
  | 'tracestrackEnglish'
  | 'tracestrackLocalized'
  | 'stadiaDark'
  | 'terrain'
  | 'satellite';

export interface MapTileOption {
  key: MapLayerKey;
  label: string;
  subtitle: string;
  description: string;
  accent: string;
  previewColors: string[];
  availabilityHint?: string;
}

interface MapTileSelectorModalProps {
  visible: boolean;
  selectedLayer: MapLayerKey;
  options: MapTileOption[];
  isDarkMode: boolean;
  layerAvailability?: Partial<Record<MapLayerKey, boolean>>;
  onClose: () => void;
  onSelectLayer: (layer: MapLayerKey) => void;
}

export const MapTileSelectorModal: React.FC<MapTileSelectorModalProps> = ({
  visible,
  selectedLayer,
  options,
  isDarkMode,
  layerAvailability,
  onClose,
  onSelectLayer,
}) => {
  const theme = {
    background: isDarkMode ? '#020617' : '#EFF6FF',
    surface: isDarkMode ? '#0F172A' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#1E293B' : '#DBEAFE',
    border: isDarkMode ? '#334155' : '#BFDBFE',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#475569',
  };

  const selectedOption = options.find((option) => option.key === selectedLayer) ?? options[0];
  const isSelectedOptionAvailable = layerAvailability?.[selectedOption.key] ?? true;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Icon name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Map Tiles</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={styles.heroEyebrow}>Map Style</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>
              Select the tile set for responder navigation
            </Text>
            <Text style={[styles.heroBody, { color: theme.textSecondary }]}>
              {isSelectedOptionAvailable
                ? selectedOption.description
                : selectedOption.availabilityHint ?? selectedOption.description}
            </Text>

            <View style={styles.heroMetaRow}>
              <View style={[styles.heroMetaChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Icon name="layers" size={16} color={selectedOption.accent} />
                <Text style={[styles.heroMetaText, { color: theme.text }]}>
                  {selectedOption.label}
                </Text>
              </View>
              <View style={[styles.heroMetaChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Icon name="location" size={16} color={selectedOption.accent} />
                <Text style={[styles.heroMetaText, { color: theme.text }]}>
                  {selectedOption.subtitle}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.optionList}>
            {options.map((option) => {
              const isActive = option.key === selectedLayer;
              const isAvailable = layerAvailability?.[option.key] ?? true;
              const badgeLabel = isActive ? 'Active' : isAvailable ? 'Select' : 'Unavailable';

              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.9}
                  disabled={!isAvailable}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isActive ? option.accent : theme.border,
                      opacity: isAvailable ? 1 : 0.72,
                    },
                  ]}
                  onPress={() => {
                    onSelectLayer(option.key);
                    onClose();
                  }}>
                  <View style={styles.optionCardTopRow}>
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>{option.label}</Text>
                      <Text style={[styles.optionSubtitle, { color: option.accent }]}>
                        {option.subtitle}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.activeBadge,
                        {
                          backgroundColor:
                            isActive || isAvailable ? (isActive ? option.accent : theme.surfaceAlt) : '#E2E8F0',
                          borderColor:
                            isActive || isAvailable ? (isActive ? option.accent : theme.border) : '#CBD5E1',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.activeBadgeText,
                          (!isActive || !isAvailable) && { color: theme.textSecondary },
                        ]}>
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.previewRow}>
                    {option.previewColors.map((color, index) => (
                      <View
                        key={`${option.key}-${index}`}
                        style={[
                          styles.previewSwatch,
                          {
                            backgroundColor: color,
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                          },
                        ]}
                      />
                    ))}
                  </View>

                  <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                    {option.description}
                  </Text>

                  {!isAvailable && option.availabilityHint ? (
                    <Text style={styles.optionStatusNote}>{option.availabilityHint}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroMetaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionList: {
    gap: 14,
  },
  optionCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  optionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  optionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  activeBadge: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewSwatch: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionStatusNote: {
    fontSize: 12,
    lineHeight: 18,
    color: '#DC2626',
    fontWeight: '700',
  },
});
