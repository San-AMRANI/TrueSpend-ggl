import React from 'react';
import spexAvatarSrc from '../../assets/spex-avatar.png';

interface SpexAvatarProps {
  className?: string;
  size?: number | string;
  animated?: boolean;
}

export const SpexAvatar: React.FC<SpexAvatarProps> = ({
  className = 'w-full h-full',
  size,
  animated = false,
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <span
      style={style}
      className={`inline-flex items-center justify-center shrink-0 select-none ${
        animated ? 'hover:scale-105 transition-transform duration-300' : ''
      } ${className}`}
      title="Spex — TrueSpend AI Financial Intelligence"
    >
      <img
        src={spexAvatarSrc}
        alt="Spex AI Character"
        className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
        draggable={false}
      />
    </span>
  );
};

export default SpexAvatar;
