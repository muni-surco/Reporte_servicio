import React from 'react';
import { DS_COLORS } from '../design-system/tokens';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
  className?: string;
}

/**
 * Icon Component - Wrapper para Lucide Icons
 * Proporciona acceso a iconografía consistente con el Design System
 */
const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 20, 
  color, 
  stroke = 2, 
  className = '' 
}) => {
  return (
    <i 
      data-lucide={name}
      style={{
        width: size,
        height: size,
        color: color || 'currentColor',
        strokeWidth: stroke,
      }}
      className={className}
    />
  );
};

export default Icon;
