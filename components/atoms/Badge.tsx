import React from 'react';
import { DS_COLORS, DS_SPACING, DS_TYPOGRAPHY } from '../design-system/tokens';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

/**
 * Badge Component - Etiqueta de estado o contador
 * Alineado al Design System
 */
const Badge: React.FC<BadgeProps> = ({ 
  variant = 'primary', 
  size = 'md',
  children,
  className = ''
}) => {
  const colorMap: Record<string, string> = {
    primary: DS_COLORS.primary,
    secondary: DS_COLORS.secondary,
    success: DS_COLORS.success,
    danger: DS_COLORS.danger,
    warning: DS_COLORS.warning,
    info: DS_COLORS.info,
  };

  const sizeMap: Record<string, { padding: string; fontSize: string }> = {
    sm: { padding: `${DS_SPACING.s1} ${DS_SPACING.s2}`, fontSize: DS_TYPOGRAPHY.textXs },
    md: { padding: `${DS_SPACING.s2} ${DS_SPACING.s3}`, fontSize: DS_TYPOGRAPHY.textSm },
    lg: { padding: `${DS_SPACING.s2} ${DS_SPACING.s4}`, fontSize: DS_TYPOGRAPHY.textBase },
  };

  const config = sizeMap[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: config.padding,
        fontSize: config.fontSize,
        fontWeight: DS_TYPOGRAPHY.fontBold,
        backgroundColor: colorMap[variant],
        color: '#ffffff',
        borderRadius: '9999px',
        whiteSpace: 'nowrap',
      }}
      className={className}
    >
      {children}
    </span>
  );
};

export default Badge;
