import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from './Icon';

export const MARKER_OPTIONS = [
  { key: 'car', label: 'Car', image: require('../assets/markers/car.png') },
  { key: 'ambulance', label: 'Ambulance', image: require('../assets/markers/ambulance.png') },
  { key: 'fireTruck', label: 'Fire Truck', image: require('../assets/markers/fireTruck.png') },
  { key: 'man', label: 'On Foot', image: require('../assets/markers/man.png') },
  { key: 'policeCar', label: 'Police Car', image: require('../assets/markers/policeCar.png') },
  { key: 'policeMotor', label: 'Police Motor', image: require('../assets/markers/policeMotor.png') },
  { key: 'ThreeWheeler', label: 'Three Wheeler', image: require('../assets/markers/threeWheeler.png') },
] as const;

export type MarkerKey = (typeof MARKER_OPTIONS)[number]['key'];

export const ASYNC_STORAGE_MARKER_KEY = 'selectedMarkerKey';

export const getMarkerImage = (key: string | null | undefined) => {
  const found = MARKER_OPTIONS.find((m) => m.key === key);
  return found?.image ?? require('../assets/markers/man.png');
};

interface Props {
  isDarkMode: boolean;
  onSave: (markerKey: MarkerKey) => void;
  initialMarker?: string | null;
  showBackButton?: boolean;
  onBack?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

export const MarkerSelectScreen: React.FC<Props> = ({
  isDarkMode,
  onSave,
  initialMarker,
  showBackButton = false,
  onBack,
}) => {
  const [selected, setSelected] = useState<MarkerKey>(
    (initialMarker as MarkerKey) ?? 'car'
  );
  const [saving, setSaving] = useState(false);

  const theme = {
    bg: isDarkMode ? '#0F172A' : '#F1F5F9',
    surface: isDarkMode ? '#1E293B' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#334155' : '#E2E8F0',
    border: isDarkMode ? '#334155' : '#CBD5E1',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    accent: '#2563EB',
    accentLight: isDarkMode ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.10)',
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(ASYNC_STORAGE_MARKER_KEY, selected);
      onSave(selected);
    } finally {
      setSaving(false);
    }
  }, [selected, onSave]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        {showBackButton && onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Icon name="chevron-left" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Select Map Marker</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Choose your icon on the live map
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: theme.accentLight, borderColor: theme.accent + '40' }]}>
          <Text style={[styles.infoEmoji]}>🚨</Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Your selected marker will appear on the live map.
          </Text>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {MARKER_OPTIONS.map((marker) => {
            const isSelected = selected === marker.key;
            return (
              <TouchableOpacity
                key={marker.key}
                activeOpacity={0.8}
                onPress={() => setSelected(marker.key)}
                style={[
                  styles.card,
                  {
                    width: CARD_WIDTH,
                    backgroundColor: isSelected ? theme.accentLight : theme.surface,
                    borderColor: isSelected ? theme.accent : theme.border,
                    shadowColor: isSelected ? theme.accent : '#000',
                  },
                ]}>
                {/* Selected ring */}
                {isSelected && (
                  <View style={[styles.selectedBadge, { backgroundColor: theme.accent }]}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}

                <View style={[
                  styles.imageContainer,
                  { backgroundColor: isSelected ? theme.accentLight : theme.surfaceAlt },
                ]}>
                  <Image
                    source={marker.image}
                    style={styles.markerImage}
                    resizeMode="contain"
                  />
                </View>

                <Text style={[
                  styles.cardLabel,
                  {
                    color: isSelected ? theme.accent : theme.text,
                    fontWeight: isSelected ? '800' : '600',
                  },
                ]}>
                  {marker.label}
                </Text>

                {isSelected && (
                  <Text style={[styles.cardSub, { color: theme.accent }]}>Selected</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}>
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginTop: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  infoEmoji: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerImage: {
    width: 60,
    height: 60,
  },
  cardLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
