import React from 'react';

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
    <div
      style={style}
      className={`inline-flex items-center justify-center shrink-0 select-none ${animated ? 'hover:scale-105 transition-transform duration-300' : ''} ${className}`}
      title="Spex — TrueSpend AI Financial Intelligence"
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm overflow-visible"
      >
        <defs>
          {/* Helmet Navy Metallic Gradient */}
          <linearGradient id="spexNavyGrad" x1="50" y1="20" x2="150" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4A559E" />
            <stop offset="35%" stopColor="#323B7C" />
            <stop offset="70%" stopColor="#22285E" />
            <stop offset="100%" stopColor="#14183D" />
          </linearGradient>

          {/* Helmet Specular Highlight */}
          <linearGradient id="spexHighlight" x1="100" y1="20" x2="100" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8E99E6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4A559E" stopOpacity="0" />
          </linearGradient>

          {/* Gold Metallic Trim */}
          <linearGradient id="spexGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>

          {/* Pearl White Body Armor */}
          <linearGradient id="spexWhite" x1="70" y1="100" x2="130" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Neon Visor Glass */}
          <linearGradient id="spexVisorGlass" x1="50" y1="50" x2="150" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#065F46" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#047857" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#064E3B" stopOpacity="0.9" />
          </linearGradient>

          {/* Neon Mint Glow Filter */}
          <filter id="neonMintGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="corePulseGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Floating Pod Shadow */}
        <ellipse cx="100" cy="188" rx="36" ry="7" fill="#0F172A" fillOpacity="0.18" />

        {/* Back Wings / Thrusters (Left & Right) */}
        {/* Left Wing */}
        <path
          d="M 60 115 L 26 122 Q 22 123 25 127 L 44 140 Q 47 142 51 138 L 68 126 Z"
          fill="url(#spexWhite)"
          stroke="url(#spexGold)"
          strokeWidth="1.5"
        />
        <path
          d="M 30 123 L 56 129 L 52 136 Z"
          fill="#323B7C"
        />

        {/* Right Wing (Prominent) */}
        <path
          d="M 140 115 L 176 100 Q 182 98 180 105 L 166 130 Q 164 133 160 131 L 136 126 Z"
          fill="url(#spexWhite)"
          stroke="url(#spexGold)"
          strokeWidth="1.5"
        />
        <path
          d="M 144 116 L 174 103 L 163 124 Z"
          fill="#323B7C"
        />

        {/* Lower Body Base / Floating Capsule */}
        <ellipse cx="100" cy="148" rx="36" ry="26" fill="url(#spexNavyGrad)" />
        <ellipse cx="100" cy="162" rx="20" ry="12" fill="#14183D" />

        {/* Pearl White Chest Armor Plate */}
        <path
          d="M 68 116 C 68 108 76 102 100 102 C 124 102 132 108 132 116 C 132 136 124 158 100 158 C 76 158 68 136 68 116 Z"
          fill="url(#spexWhite)"
          stroke="#CBD5E1"
          strokeWidth="1"
        />

        {/* Chest Glowing Pulse Reactor (The Spex Financial Pulse) */}
        <circle cx="100" cy="132" r="15" fill="#10B981" fillOpacity="0.2" />
        <circle cx="100" cy="132" r="14" stroke="#34D399" strokeWidth="2" fill="none" opacity="0.6" />
        <circle cx="100" cy="132" r="10" stroke="#10B981" strokeWidth="2.5" fill="none" filter="url(#corePulseGlow)" />
        <circle cx="100" cy="132" r="6" fill="#6EE7B7" filter="url(#neonMintGlow)" />
        <circle cx="100" cy="132" r="3" fill="#ECFDF5" />

        {/* Right Waving Arm & Hand */}
        <g className={animated ? 'origin-[65px_120px] animate-bounce' : ''}>
          <path
            d="M 72 120 C 65 116 54 118 48 126 C 44 131 46 138 52 142 C 58 146 68 142 74 135 Z"
            fill="url(#spexNavyGrad)"
          />
          {/* Forearm & Hand */}
          <ellipse cx="44" cy="126" rx="8" ry="8" fill="#4A559E" stroke="url(#spexGold)" strokeWidth="1" />
          {/* Cute Waving Fingers */}
          <circle cx="37" cy="122" r="3" fill="#323B7C" />
          <circle cx="41" cy="118" r="3" fill="#323B7C" />
          <circle cx="46" cy="117" r="3" fill="#323B7C" />
          <circle cx="50" cy="120" r="3" fill="#323B7C" />
        </g>

        {/* Left Arm (Relaxed) */}
        <path
          d="M 130 124 C 136 122 144 125 147 132 C 150 138 147 145 142 148 C 137 151 131 146 128 138 Z"
          fill="url(#spexNavyGrad)"
        />
        <circle cx="145" cy="144" r="5" fill="#323B7C" />

        {/* Main Head (Large Spherical Metallic Helmet) */}
        <ellipse cx="100" cy="74" rx="52" ry="48" fill="url(#spexNavyGrad)" />
        {/* Specular Top Shine */}
        <ellipse cx="100" cy="40" rx="34" ry="12" fill="url(#spexHighlight)" />

        {/* Ear Modules (Left & Right) */}
        {/* Left Ear */}
        <ellipse cx="48" cy="74" rx="6" ry="12" fill="#22285E" stroke="url(#spexGold)" strokeWidth="1.5" />
        <ellipse cx="48" cy="74" rx="3.5" ry="8" fill="#10B981" opacity="0.8" />
        {/* Right Ear */}
        <ellipse cx="152" cy="74" rx="6" ry="12" fill="#22285E" stroke="url(#spexGold)" strokeWidth="1.5" />
        <ellipse cx="152" cy="74" rx="3.5" ry="8" fill="#10B981" opacity="0.8" />

        {/* Forehead Gold Embossed "SPEX" Brandmark */}
        <g>
          <text
            x="100"
            y="43"
            textAnchor="middle"
            fill="url(#spexGold)"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="10"
            fontWeight="900"
            letterSpacing="2.5"
            opacity="0.95"
            filter="drop-shadow(0 1px 1px rgba(0,0,0,0.5))"
          >
            SPEX
          </text>
        </g>

        {/* Smart Visor Frame Outer Shape */}
        <path
          d="M 64 60 C 58 60 52 66 52 74 C 52 84 60 92 70 92 C 82 92 90 85 100 85 C 110 85 118 92 130 92 C 140 92 148 84 148 74 C 148 66 142 60 136 60 C 122 60 112 66 100 66 C 88 66 78 60 64 60 Z"
          fill="url(#spexVisorGlass)"
          stroke="#34D399"
          strokeWidth="3.5"
          filter="url(#neonMintGlow)"
        />

        {/* Visor Inner Glass Reflection / Highlight */}
        <path
          d="M 64 63 C 59 63 55 67 55 73 C 55 76 57 78 60 78 C 66 78 72 74 80 74 C 88 74 94 77 100 77 C 106 77 112 74 120 74 C 128 74 134 78 140 78 C 143 78 145 76 145 73 C 145 67 141 63 136 63 Z"
          fill="#FFFFFF"
          fillOpacity="0.22"
        />

        {/* Glowing Happy Curved Eyes (^ ^) */}
        {/* Left Eye */}
        <path
          d="M 68 76 Q 78 66 88 76"
          stroke="#6EE7B7"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#neonMintGlow)"
        />
        <path
          d="M 70 76 Q 78 68 86 76"
          stroke="#ECFDF5"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Right Eye */}
        <path
          d="M 112 76 Q 122 66 132 76"
          stroke="#6EE7B7"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#neonMintGlow)"
        />
        <path
          d="M 114 76 Q 122 68 130 76"
          stroke="#ECFDF5"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Chin / Collar Gold Trim Accent */}
        <path
          d="M 85 96 Q 100 100 115 96"
          stroke="url(#spexGold)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      </svg>
    </div>
  );
};

export default SpexAvatar;
