/**
 * Design System Tokens
 * Municipalidad de Santiago de Surco - Seguridad Ciudadana v1.0
 * 
 * Tokens de diseño centralizados para consistencia en toda la aplicación
 */

// ─────────────────────────────────────────
// COLORES
// ─────────────────────────────────────────

export const DS_COLORS = {
  // Primary
  primary: '#005ea5',
  primaryDark: '#003D6B',
  primaryLight: '#E6EEF5',
  
  // Secondary
  secondary: '#00C9A7',
  secondaryDark: '#00A88A',
  secondaryLight: '#E0FAF5',
  
  // Accent
  accent: '#F5A623',
  
  // Estados
  success: '#27AE60',
  danger: '#E03E3E',
  warning: '#F5A623',
  info: '#2F80ED',
  
  // Neutros (Grays)
  gray900: '#1A1A2E',
  gray700: '#4A4A6A',
  gray500: '#8888AA',
  gray300: '#D0D5E8',
  gray100: '#F4F6FB',
} as const;

// ─────────────────────────────────────────
// ESPACIADO (Base 4px)
// ─────────────────────────────────────────

export const DS_SPACING = {
  s1: '4px',
  s2: '8px',
  s3: '12px',
  s4: '16px',
  s5: '20px',
  s6: '24px',
  s8: '32px',
  s10: '40px',
} as const;

// ─────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────

export const DS_RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// ─────────────────────────────────────────
// TIPOGRAFÍA
// ─────────────────────────────────────────

export const DS_TYPOGRAPHY = {
  font: "'Chivo', sans-serif",
  
  // Text Sizes
  textXs: '11px',
  textSm: '13px',
  textBase: '15px',
  textMd: '17px',
  textLg: '20px',
  textXl: '24px',
  text2xl: '30px',
  text3xl: '38px',
  
  // Font Weights
  fontRegular: 400,
  fontSemibold: 600,
  fontBold: 700,
} as const;

// ─────────────────────────────────────────
// SOMBRAS
// ─────────────────────────────────────────

export const DS_SHADOWS = {
  sm: '0 1px 3px rgba(0,0,0,.08)',
  md: '0 4px 12px rgba(0,0,0,.10)',
  lg: '0 8px 24px rgba(0,0,0,.12)',
} as const;

// ─────────────────────────────────────────
// UTILIDADES CSS
// ─────────────────────────────────────────

export const getTokensCss = (): string => `
  :root {
    /* Brand Colors */
    --color-primary: ${DS_COLORS.primary};
    --color-primary-dark: ${DS_COLORS.primaryDark};
    --color-primary-light: ${DS_COLORS.primaryLight};
    --color-secondary: ${DS_COLORS.secondary};
    --color-secondary-dark: ${DS_COLORS.secondaryDark};
    --color-secondary-light: ${DS_COLORS.secondaryLight};
    --color-accent: ${DS_COLORS.accent};
    
    /* Status Colors */
    --color-success: ${DS_COLORS.success};
    --color-danger: ${DS_COLORS.danger};
    --color-warning: ${DS_COLORS.warning};
    --color-info: ${DS_COLORS.info};
    
    /* Neutral Colors */
    --gray-900: ${DS_COLORS.gray900};
    --gray-700: ${DS_COLORS.gray700};
    --gray-500: ${DS_COLORS.gray500};
    --gray-300: ${DS_COLORS.gray300};
    --gray-100: ${DS_COLORS.gray100};
    
    /* Spacing */
    --s1: ${DS_SPACING.s1};
    --s2: ${DS_SPACING.s2};
    --s3: ${DS_SPACING.s3};
    --s4: ${DS_SPACING.s4};
    --s5: ${DS_SPACING.s5};
    --s6: ${DS_SPACING.s6};
    --s8: ${DS_SPACING.s8};
    --s10: ${DS_SPACING.s10};
    
    /* Border Radius */
    --r-sm: ${DS_RADIUS.sm};
    --r-md: ${DS_RADIUS.md};
    --r-lg: ${DS_RADIUS.lg};
    --r-xl: ${DS_RADIUS.xl};
    --r-full: ${DS_RADIUS.full};
    
    /* Typography */
    --text-xs: ${DS_TYPOGRAPHY.textXs};
    --text-sm: ${DS_TYPOGRAPHY.textSm};
    --text-base: ${DS_TYPOGRAPHY.textBase};
    --text-md: ${DS_TYPOGRAPHY.textMd};
    --text-lg: ${DS_TYPOGRAPHY.textLg};
    --text-xl: ${DS_TYPOGRAPHY.textXl};
    --text-2xl: ${DS_TYPOGRAPHY.text2xl};
    --text-3xl: ${DS_TYPOGRAPHY.text3xl};
    
    /* Shadows */
    --shadow-sm: ${DS_SHADOWS.sm};
    --shadow-md: ${DS_SHADOWS.md};
    --shadow-lg: ${DS_SHADOWS.lg};
  }
`;

// ─────────────────────────────────────────
// MAPEO DE ESTADOS POR COLOR
// ─────────────────────────────────────────

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'ACTIVO':
      return DS_COLORS.success;
    case 'FUERA':
      return DS_COLORS.danger;
    case 'CHECK-IN':
      return DS_COLORS.info;
    default:
      return DS_COLORS.gray500;
  }
};

export const getStatusBg = (status: string): string => {
  const color = getStatusColor(status);
  // Retorna una versión más clara del color
  return color + '20'; // 20% opacidad
};

export const getStatusBorder = (status: string): string => {
  return getStatusColor(status) + '40'; // 40% opacidad
};
