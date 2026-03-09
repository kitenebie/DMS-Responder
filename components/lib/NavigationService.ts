import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(name: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (...args: unknown[]) => void)(name, params);
  }
}

export function goBack() {
  if (navigationRef.isReady()) {
    navigationRef.goBack();
  }
}
