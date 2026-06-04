import React from 'react';
import { DS_COLORS, DS_SPACING, DS_TYPOGRAPHY } from '../design-system/tokens';

interface StatValueProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  color?: string;
  className?: string;
}

/**
 * StatValue Component - Estadística individual (label + valor)
 * Usado en dashboards y KPI cards
 */
const StatValue: React.FC<StatValueProps> = ({
  label,
  value,
  unit,
  color = DS_COLORS.primary,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: DS_SPACING.s2,
      }}
      className={className}
    >
      <label
        style={{
          fontSize: DS_TYPOGRAPHY.textXs,
          fontWeight: DS_TYPOGRAPHY.fontBold,
          color: DS_COLORS.gray500,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: 0,
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: DS_SPACING.s1,
        }}
      >
        <span
          style={{
            fontSize: DS_TYPOGRAPHY.textXl,
            fontWeight: DS_TYPOGRAPHY.fontBold,
            color: color,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: DS_TYPOGRAPHY.textSm,
              fontWeight: DS_TYPOGRAPHY.fontSemibold,
              color: DS_COLORS.gray500,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatValue;
