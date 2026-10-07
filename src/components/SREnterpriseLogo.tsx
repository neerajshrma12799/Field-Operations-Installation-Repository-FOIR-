import React from 'react';

interface SREnterpriseLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
}

export const SREnterpriseLogo: React.FC<SREnterpriseLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  textColor,
}) => {
  const sizeMap = {
    xs: { icon: 28, text: 'text-sm' },
    sm: { icon: 36, text: 'text-base' },
    md: { icon: 44, text: 'text-lg' },
    lg: { icon: 56, text: 'text-xl' },
    xl: { icon: 72, text: 'text-2xl' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Crisp SVG Monogram */}
      <svg
        viewBox="0 0 512 512"
        width={currentSize.icon}
        height={currentSize.icon}
        className="shrink-0 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="512" height="512" rx="108" fill="#ffffff" />
        <g fill="#1d63d8">
          {/* Upper stadium arc from left to right */}
          <path d="M 170 138 C 125 138, 92 172, 92 218 C 92 260, 120 292, 162 302 L 212 254 C 185 248, 142 242, 142 215 C 142 190, 165 178, 195 178 L 315 178 C 360 178, 392 195, 392 230 C 392 265, 360 282, 315 282 L 270 282 L 400 412 L 448 412 C 418 382, 392 355, 370 332 C 415 318, 442 280, 442 230 C 442 168, 392 138, 320 138 Z" />
          {/* Solid diagonal ribbon */}
          <polygon points="128,142 448,418 392,418 72,142" />
          {/* Serif "Enterprise" below monogram */}
          <text
            x="256"
            y="428"
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontSize="62"
            fontWeight="700"
            letterSpacing="1.5"
            fill="#1d63d8"
          >
            Enterprise
          </text>
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={`font-black tracking-tight ${textColor || 'text-slate-900'} ${currentSize.text}`}
          >
            RR Enterprise
          </span>
          <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">
            Smart Meter &amp; Infra
          </span>
        </div>
      )}
    </div>
  );
};
