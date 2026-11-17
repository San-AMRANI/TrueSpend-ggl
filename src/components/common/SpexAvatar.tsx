import React, { Suspense, lazy, useState, useEffect } from 'react';
import {
  useTheme,
  type ResolvedThemeId,
  type ThemeId,
} from '../../context/ThemeContext';
import {
  SPEX_ANIMATION_STATES,
  type SpexAnimationState,
} from './SpexSprite';
import {
  getCachedSpexAvatarSrc,
  getSpexThemeEditionMeta,
  loadSpexAvatarSrc,
} from './spexAvatarAssets';

const SpexSprite = lazy(() =>
  import('./SpexSprite').then((m) => ({ default: m.SpexSprite }))
);
const SpexStudioModal = lazy(() =>
  import('./SpexStudioModal').then((m) => ({ default: m.SpexStudioModal }))
);

export interface SpexAvatarProps {
  className?: string;
  size?: number | string;
  animated?: boolean;
  state?: SpexAnimationState;
  lookAtCursor?: boolean;
  useSprite?: boolean;
  themeId?: ThemeId | ResolvedThemeId;
  clickable?: boolean;
}

export const SpexAvatar: React.FC<SpexAvatarProps> = ({
  className = 'w-full h-full',
  size,
  animated = false,
  state,
  lookAtCursor = false,
  useSprite,
  themeId,
  clickable = false,
}) => {
  const { resolvedTheme } = useTheme();
  const activeThemeId: ResolvedThemeId =
    themeId && themeId !== 'system' ? (themeId as ResolvedThemeId) : resolvedTheme;
  const avatarMeta = getSpexThemeEditionMeta(activeThemeId);
  const style = size ? { width: size, height: size } : undefined;

  const shouldRenderSprite = Boolean(useSprite ?? (animated || state || lookAtCursor));
  const activeSpriteState: SpexAnimationState = state || 'idle';

  const [imgSrc, setImgSrc] = useState<string>(
    () => getCachedSpexAvatarSrc(activeThemeId) || '/spex-avatar.png'
  );
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    if (shouldRenderSprite) return;
    let cancelled = false;
    const cached = getCachedSpexAvatarSrc(activeThemeId);
    if (cached) {
      setImgSrc(cached);
      return;
    }
    void loadSpexAvatarSrc(activeThemeId).then((src) => {
      if (!cancelled) setImgSrc(src);
    });
    return () => {
      cancelled = true;
    };
  }, [activeThemeId, shouldRenderSprite]);

  const handleAvatarClick = (e: React.MouseEvent) => {
    if (!clickable) return;
    e.stopPropagation();
    e.preventDefault();
    setIsLightboxOpen(true);
  };

  return (
    <>
      <span
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleAvatarClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsLightboxOpen(true);
                }
              }
            : undefined
        }
        style={style}
        className={`inline-flex items-center justify-center shrink-0 select-none ${
          clickable ? 'cursor-pointer group/spex focus:outline-none' : ''
        } ${
          animated || clickable ? 'hover:scale-105 active:scale-95 transition-transform duration-200' : ''
        } ${className}`}
        title={
          clickable
            ? `${avatarMeta.editionName} (${SPEX_ANIMATION_STATES[activeSpriteState].shortLabel}) — Click to open SPEX Animation Studio`
            : `${avatarMeta.editionName} — TrueSpend AI Financial Intelligence`
        }
      >
        {shouldRenderSprite ? (
          <Suspense
            fallback={
              <img
                src={imgSrc}
                alt={avatarMeta.editionName}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
            }
          >
            <SpexSprite
              state={activeSpriteState}
              lookAtCursor={lookAtCursor}
              interactive={!clickable}
              className="w-full h-full"
            />
          </Suspense>
        ) : (
          <img
            src={imgSrc}
            alt={avatarMeta.editionName}
            loading="lazy"
            className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
            draggable={false}
          />
        )}
      </span>

      {isLightboxOpen && (
        <Suspense fallback={null}>
          <SpexStudioModal
            activeThemeId={activeThemeId}
            initialSpriteState={activeSpriteState}
            onClose={() => setIsLightboxOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export default SpexAvatar;
