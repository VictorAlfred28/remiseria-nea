import type { ReactNode } from 'react';
import logoUbi from '../../assets/login/logoUbi.png';

interface AuthLayoutProps {
  children: ReactNode;
  /** Show logo at top */
  showLogo?: boolean;
  /** Optional hero image (shown only when no logo, fills top half) */
  heroImage?: string;
  /** Optional hero alt text */
  heroAlt?: string;
  /** Background variant */
  bg?: 'deep' | 'gradient';
}

/**
 * Shared layout wrapper for all auth screens.
 * Provides consistent background, safe-area handling, centering,
 * and optional logo / hero image.
 */
export default function AuthLayout({
  children,
  showLogo = true,
  heroImage,
  heroAlt = 'UBI Traslados',
  bg = 'gradient',
}: AuthLayoutProps) {
  const bgClass =
    bg === 'deep'
      ? 'bg-[#04102a]'
      : 'bg-gradient-to-b from-[#061a4a] via-[#08296d] to-[#04153d]';

  return (
    <div
      className={`relative w-full min-h-[100dvh] overflow-x-hidden overscroll-none flex flex-col ${bgClass}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Decorative radial glow */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] rounded-full border border-blue-400/10" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] rounded-full border border-blue-400/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-blue-600/8 blur-[130px] rounded-full" />
      </div>

      {/* Hero image (optional, fills top) */}
      {heroImage && (
        <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)', minHeight: '35vh' }}>
          <img
            src={heroImage}
            alt={heroAlt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: 'scaleX(1.35)',
              transformOrigin: 'center center',
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Scrollable content area */}
      <div
        className="relative z-10 w-full flex-1 overflow-y-auto scrollbar-hide"
        style={{ paddingTop: !heroImage ? 'env(safe-area-inset-top, 0px)' : 0 }}
      >
        <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-full">

          {/* Logo */}
          {showLogo && !heroImage && (
            <div className="mb-8 flex flex-col items-center">
              <img
                src={logoUbi}
                alt="UBI Traslados"
                className="w-48 sm:w-56 object-contain drop-shadow-[0_0_18px_rgba(13,110,253,0.35)]"
                draggable={false}
              />
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
