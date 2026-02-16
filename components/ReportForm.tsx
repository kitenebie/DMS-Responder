import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { ReportForm as ReportFormType } from '@/types';
import { getTheme } from '@/utils';
import { ip } from './lib/domain';

interface ReportFormProps {
  form: ReportFormType;
  onUpdateForm: (field: keyof ReportFormType, value: string) => void;
  onSubmit: () => void;
  photoUri?: string | null;
  onPhotoCaptured: (uri: string) => void;
  onRemovePhoto: () => void;
  submitting?: boolean;
  isDarkMode: boolean;
  incidentId?: string | number | null;
}

export const ReportForm: React.FC<ReportFormProps> = ({ isDarkMode, incidentId }) => {
  const theme = getTheme(isDarkMode);
  const { height } = useWindowDimensions();
  const [hasError, setHasError] = useState(false);

  const normalizedId =
    typeof incidentId === 'number' ? String(incidentId) : incidentId?.trim() ?? '';
  const themeParam = isDarkMode ? 'dark' : 'light';
  const webViewDecelerationRate = Platform.OS === 'ios' ? 0.998 : 0.985;
  const injectedJavaScript = useMemo(
    () => `
      (function() {
        function applyTweaks() {
          try {
            const styleId = 'rn-reportform-tweaks';
            if (!document.getElementById(styleId)) {
              const style = document.createElement('style');
              style.id = styleId;
              style.innerHTML = \`
                html, body {
                  -webkit-overflow-scrolling: touch;
                  scroll-behavior: smooth;
                  overscroll-behavior: contain;
                }
                .rn-actions-compact {
                  margin-top: 12px !important;
                }
                .rn-actions-compact button {
                  padding-top: 6px !important;
                  padding-bottom: 6px !important;
                }
              \`;
              document.head.appendChild(style);
            }

            const actionRow = document.querySelector('form > div:last-of-type');
            if (actionRow) {
              actionRow.classList.add('rn-actions-compact');
            }

            const cancelButtons = Array.from(document.querySelectorAll('button'))
              .filter(btn => /cancel|reset/i.test(btn.textContent || ''));
            cancelButtons.forEach(btn => {
              const parent = btn.parentElement;
              if (parent) {
                parent.classList.add('rn-actions-compact');
              }
            });
          } catch (e) {
            // Ignore DOM injection errors
          }
        }

        applyTweaks();
        const observer = new MutationObserver(() => applyTweaks());
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
        setTimeout(() => observer.disconnect(), 5000);
      })();
      true;
    `,
    []
  );

  const formUrl = useMemo(() => {
    if (!normalizedId) return null;
    return `${ip}/form/${encodeURIComponent(normalizedId)}/theme/${encodeURIComponent(themeParam)}`;
  }, [normalizedId, themeParam]);

  if (!normalizedId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.messageContainer}>
          <Text style={[styles.messageTitle, { color: theme.text }]}>Report form unavailable</Text>
          <Text style={[styles.messageText, { color: theme.textSecondary }]}>
            Missing incident ID. Please reopen the incident and try again.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {hasError || !formUrl ? (
        <View style={styles.messageContainer}>
          <Text style={[styles.messageTitle, { color: theme.text }]}>Unable to load form</Text>
          <Text style={[styles.messageText, { color: theme.textSecondary }]}>
            Check your connection and try again.
          </Text>
        </View>
      ) : (
        <WebView
          source={{ uri: formUrl }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          injectedJavaScript={injectedJavaScript}
          nestedScrollEnabled
          scrollEnabled
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          decelerationRate={webViewDecelerationRate}
          androidLayerType="hardware"
          renderToHardwareTextureAndroid
          startInLoadingState
          onError={() => setHasError(true)}
          onHttpError={() => setHasError(true)}
          renderLoading={() => (
            <View style={[styles.loadingContainer, { backgroundColor: theme.surface }]}>
              <ActivityIndicator size="small" color={theme.text} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading report form...
              </Text>
            </View>
          )}
          style={[styles.webView, { height: Math.max(520, Math.round(height * 0.75)) }]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 0,
    borderWidth: 2,
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  messageContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
