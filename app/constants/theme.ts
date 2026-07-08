/**
 * App design tokens
 * Dùng chung cho toàn bộ app: color, font, spacing, radius, button, text size
 */

import { Platform } from 'react-native';

const primaryLight = '#16306E';
const primaryDark = '#4F6FAE';
const secondary = '#F4B400';

export const Colors = {
  light: {
    primary: primaryLight,
    primarySoft: '#E8EDF8',
    secondary,
    background: '#F5F7FB',
    surface: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    tint: primaryLight,
    icon: '#687076',
    border: '#E5E7EB',
    buttonPrimary: primaryLight,
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#E8EDF8',
    buttonSecondaryText: '#16306E',
    link: primaryLight,
    danger: '#DC2626',
    success: '#16A34A',
    tabIconDefault: '#687076',
    tabIconSelected: primaryLight,
  },
  dark: {
    primary: primaryDark,
    primarySoft: '#1B2438',
    secondary,
    background: '#151718',
    surface: '#1E2228',
    text: '#ECEDEE',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    tint: '#FFFFFF',
    icon: '#9BA1A6',
    border: '#2A2F36',
    buttonPrimary: primaryDark,
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#1B2438',
    buttonSecondaryText: '#ECEDEE',
    link: '#93C5FD',
    danger: '#F87171',
    success: '#4ADE80',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#FFFFFF',
  },
} as const;

export const Fonts = {
  regular: 'Roboto',
  medium: 'RobotoMedium',
  bold: 'RobotoBold',
  light: 'RobotoLight',
  semibold: 'RobotoSemiBold',
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  headingSm: 28,
  headingMd: 32,
  headingLg: 36,
} as const;

export const LineHeights = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 30,
  xxl: 34,
  headingSm: 36,
  headingMd: 40,
  headingLg: 44,
} as const;

export const FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const ButtonSizes = {
  sm: 44,
  md: 52,
  lg: 60,
} as const;

export const Form = {
  input: {
    height: 44,
    radius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  helper: {
    fontSize: 13,
    marginTop: 6,
  },
  error: {
    fontSize: 13,
    marginTop: 6,
  },
  errorText: {
    fontSize: 13,
    marginTop: 6,
    color: '#DC2626',
  },

  spacing: {
    fieldGap: 16,
    sectionGap: 24,
  },

  password: {
    iconSize: 18,
    hitSlop: 10,
  },
};

export const Layout = {
  screenHorizontalPadding: 16,
  contentHorizontalPadding: 12,
  maxContentWidth: 360,
} as const;