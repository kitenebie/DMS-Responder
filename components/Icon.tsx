import React from 'react';
import { Svg, Path, Circle, Rect, G, Line } from 'react-native-svg';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
  isDark?: boolean;
}

// Common icon components
const AlertIcon = ({ size = 24, color = '#EF4444' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
  </Svg>
);

const DocumentIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9h4v2h-4v-2zm0 4h4v2h-4v-2z" />
  </Svg>
);

const TimeIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </Svg>
);

const LocationIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </Svg>
);

const InfoIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </Svg>
);

const CheckIcon = ({ size = 24, color = '#10B981' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </Svg>
);

const CloseIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </Svg>
);

const ChevronRightIcon = ({ size = 24, color = '#9CA3AF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </Svg>
);

const SendIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </Svg>
);

const PaperclipIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 8.5l-9.5 9.5a5 5 0 1 1-7.07-7.07L14 1.34a3.5 3.5 0 1 1 4.95 4.95L9.88 15.32a2 2 0 1 1-2.83-2.83L15.5 4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CameraIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20 5h-3.17l-1.84-2H9.01L7.17 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-8 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
  </Svg>
);

const SearchIcon = ({ size = 24, color = '#9CA3AF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </Svg>
);

const ChatIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
  </Svg>
);

const ClockIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </Svg>
);

const MapPinIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </Svg>
);

const ThemeIcon = ({ size = 24, color = '#F8FAFC', isDark = true }: { size?: number; color?: string; isDark?: boolean }) => (
  isDark ? (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </Svg>
  )
);

const FullscreenIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </Svg>
);

const FullscreenExitIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </Svg>
);

const HistoryIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
  </Svg>
);

const BoltIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M7 2v11h3v9l7-12h-4l4-8z" />
  </Svg>
);

const WarningIcon = ({ size = 24, color = '#EF4444' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </Svg>
);

const EmailIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
  </Svg>
);

const LockIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </Svg>
);

const EyeIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </Svg>
);

const EyeOffIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
  </Svg>
);

const LogoutIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
  </Svg>
);

const SunIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" />
    <Line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="2" />
    <Line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="2" />
    <Line x1="2" y1="12" x2="5" y2="12" stroke={color} strokeWidth="2" />
    <Line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" />
    <Line x1="4.5" y1="4.5" x2="6.7" y2="6.7" stroke={color} strokeWidth="2" />
    <Line x1="17.3" y1="17.3" x2="19.5" y2="19.5" stroke={color} strokeWidth="2" />
    <Line x1="4.5" y1="19.5" x2="6.7" y2="17.3" stroke={color} strokeWidth="2" />
    <Line x1="17.3" y1="6.7" x2="19.5" y2="4.5" stroke={color} strokeWidth="2" />
  </Svg>
);

const MoonIcon = ({ size = 24, color = '#F8FAFC' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </Svg>
);

const ClearedReportIcon = ({ size = 24, color = '#10B981' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zm-4 11l2.5 2.5L15 14l3-3-1.5-1.5L11 15l-1.5-1.5L7 14l3 3z"
      fill={color}
    />
  </Svg>
);

const MyLocationIcon = ({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
  </Svg>
);

// Main Icon component
export const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#F8FAFC', style }) => {
  const iconProps = { size, color };

  switch (name) {
    case 'alert':
      return <AlertIcon {...iconProps} />;
    case 'document':
      return <DocumentIcon {...iconProps} />;
    case 'time':
      return <TimeIcon {...iconProps} />;
    case 'location':
      return <LocationIcon {...iconProps} />;
    case 'info':
      return <InfoIcon {...iconProps} />;
    case 'check':
      return <CheckIcon {...iconProps} />;
    case 'close':
      return <CloseIcon {...iconProps} />;
    case 'chevron-right':
      return <ChevronRightIcon {...iconProps} />;
    case 'send':
      return <SendIcon {...iconProps} />;
    case 'paperclip':
      return <PaperclipIcon {...iconProps} />;
    case 'camera':
      return <CameraIcon {...iconProps} />;
    case 'search':
      return <SearchIcon {...iconProps} />;
    case 'chat':
      return <ChatIcon {...iconProps} />;
    case 'clock':
      return <ClockIcon {...iconProps} />;
    case 'map-pin':
      return <MapPinIcon {...iconProps} />;
    case 'theme':
      return <ThemeIcon {...iconProps} />;
    case 'fullscreen':
      return <FullscreenIcon {...iconProps} />;
    case 'fullscreen-exit':
      return <FullscreenExitIcon {...iconProps} />;
    case 'history':
      return <HistoryIcon {...iconProps} />;
    case 'bolt':
      return <BoltIcon {...iconProps} />;
    case 'warning':
      return <WarningIcon {...iconProps} />;
    case 'email':
      return <EmailIcon {...iconProps} />;
    case 'lock':
      return <LockIcon {...iconProps} />;
    case 'eye':
      return <EyeIcon {...iconProps} />;
    case 'eye-off':
      return <EyeOffIcon {...iconProps} />;
    case 'logout':
      return <LogoutIcon {...iconProps} />;
    case 'sun':
      return <SunIcon {...iconProps} />;
    case 'moon':
      return <MoonIcon {...iconProps} />;
    case 'cleared-report':
      return <ClearedReportIcon {...iconProps} />;
    case 'my-location':
      return <MyLocationIcon {...iconProps} />;
    default:
      return null;
  }
};
