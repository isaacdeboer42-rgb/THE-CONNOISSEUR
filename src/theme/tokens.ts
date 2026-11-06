import { Platform } from 'react-native';

export const colors = {
  ink: '#0B0E0D',
  inkRaised: '#121715',
  surface: '#171D1A',
  surfaceSoft: '#202824',
  surfaceWarm: '#29231B',
  paper: '#F4F0E7',
  paperMuted: '#C0C4BE',
  paperDim: '#8F9690',
  brass: '#D7AA62',
  brassSoft: '#3A3022',
  ready: '#A9D68D',
  readyDeep: '#1E3223',
  citrus: '#E9C65D',
  alert: '#F0A171',
  alertDeep: '#35241B',
  berry: '#C77B88',
  divider: 'rgba(244, 240, 231, 0.11)',
  shadow: 'rgba(0, 0, 0, 0.32)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', web: 'Inter, system-ui, sans-serif' }),
  bodyMedium: Platform.select({ ios: 'System', android: 'sans-serif-medium', web: 'Inter, system-ui, sans-serif' }),
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const contentMaxWidth = 760;
