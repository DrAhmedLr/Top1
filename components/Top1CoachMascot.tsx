'use client';

type MascotMood = 'greet' | 'notes' | 'sparkle' | 'focus' | 'cheer';
type ThemeMode = 'male' | 'female' | 'neutral';

const ACCENT_MAP: Record<ThemeMode, {primary: string; glow: string; dark: string}> = {
  male: {primary: '#57b8ff', glow: '#9dd5ff', dark: '#2976b8'},
  female: {primary: '#ff8fb3', glow: '#ffc2d6', dark: '#b8476e'},
  neutral: {primary: '#63d6c1', glow: '#a9ede0', dark: '#2c8a79'},
};

/**
 * Original TOP1 Coach Companion ("Apex") — kinetic obsidian & accent athletic coach mascot
 * with expressive moods for the interactive mobile onboarding and coaching check-ins.
 */
export function Top1CoachMascot({
  mood = 'notes',
  theme = 'male',
  size = 82,
}: {
  mood?: MascotMood;
  theme?: ThemeMode;
  size?: number;
}) {
  const palette = ACCENT_MAP[theme];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 110 110"
      role="img"
      aria-label="TOP1 personal coach companion"
      style={{flex: 'none', display: 'block'}}
    >
      {/* Ground shadow */}
      <ellipse cx="55" cy="99" rx="28" ry="6" fill="rgba(0,0,0,0.45)" />

      {/* Sparkles for motivating / ready screens */}
      {(mood === 'sparkle' || mood === 'cheer') && (
        <g fill="#ffd466">
          <path d="M18 22 L20 28 L26 30 L20 32 L18 38 L16 32 L10 30 L16 28 Z" />
          <path d="M90 14 L91.5 18 L95.5 19.5 L91.5 21 L90 25 L88.5 21 L84.5 19.5 L88.5 18 Z" />
        </g>
      )}

      {/* Feet */}
      <rect x="38" y="84" width="12" height="12" rx="6" fill={palette.dark} />
      <rect x="60" y="84" width="12" height="12" rx="6" fill={palette.dark} />
      <rect x="39" y="92" width="10" height="4" rx="2" fill="#e9f4ff" />
      <rect x="61" y="92" width="10" height="4" rx="2" fill="#e9f4ff" />

      {/* Arms */}
      {mood === 'cheer' ? (
        <>
          <path d="M31 58 C20 48, 17 36, 23 29" stroke={palette.primary} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d="M79 58 C90 48, 93 36, 87 29" stroke={palette.primary} strokeWidth="11" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M31 60 C23 64, 24 75, 33 75" stroke={palette.primary} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M79 60 C87 64, 86 75, 77 75" stroke={palette.primary} strokeWidth="10" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* Body crest / rounded athletic torso */}
      <rect x="30" y="25" width="50" height="62" rx="24" fill={palette.primary} />
      {/* Top tuft / crest */}
      <path d="M51 25 C50 15, 59 13, 62 24 C66 19, 71 21, 67 27 Z" fill={palette.primary} />
      {/* Side ear-pods / athletic sensors */}
      <rect x="22" y="40" width="9" height="18" rx="4.5" fill={palette.dark} />
      <rect x="79" y="40" width="9" height="18" rx="4.5" fill={palette.dark} />

      {/* Energetic lime-emerald athletic headband */}
      <rect x="31" y="34" width="48" height="7" rx="3.5" fill="#4ce37e" />

      {/* Dark obsidian visor face */}
      <rect x="36" y="44" width="38" height="22" rx="11" fill="#111521" />

      {/* Expressive eyes inside visor */}
      {mood === 'cheer' ? (
        <>
          <path d="M43 56 Q48 50 53 56" stroke={palette.glow} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M57 56 Q62 50 67 56" stroke={palette.glow} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </>
      ) : mood === 'focus' ? (
        <>
          <rect x="43" y="51" width="9" height="6" rx="3" fill="#ffffff" />
          <rect x="58" y="51" width="9" height="6" rx="3" fill="#ffffff" />
          <path d="M42 49 L53 51 M68 49 L57 51" stroke={palette.primary} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="47" cy="55" r="5" fill="#ffffff" />
          <circle cx="63" cy="55" r="5" fill="#ffffff" />
          <circle cx="48.5" cy="54.5" r="2.5" fill="#0f1522" />
          <circle cx="64.5" cy="54.5" r="2.5" fill="#0f1522" />
        </>
      )}

      {/* Subtle chest emblem ("1") */}
      <circle cx="55" cy="75" r="7" fill="rgba(13,15,24,0.35)" />
      <text x="55" y="78.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#ffffff">
        1
      </text>

      {/* Clipboard & pencil in notes / greet moods */}
      {(mood === 'notes' || mood === 'greet') && (
        <>
          <rect x="27" y="61" width="16" height="20" rx="3.5" transform="rotate(-12 35 71)" fill="#d97b38" stroke="#8a4718" strokeWidth="1.2" />
          <rect x="31" y="60" width="8" height="3.5" rx="1.5" transform="rotate(-12 35 62)" fill="#e8eef7" />
          <g transform="rotate(28 74 71)">
            <rect x="70" y="60" width="6.5" height="17" rx="1.8" fill="#ffd24c" />
            <polygon points="70,77 76.5,77 73.25,83" fill="#f3d4b6" />
            <rect x="70" y="57.5" width="6.5" height="3.5" rx="1.2" fill="#ff7fa8" />
          </g>
        </>
      )}
    </svg>
  );
}

/**
 * Full-body Athlete Avatar that responds live to sex theme, age cohort, and celebration pose.
 * Keeps an equally strong, capable posture at every age.
 */
export function Top1AthleteAvatar({
  age = 30,
  theme = 'male',
  pose = 'wave',
  size = 185,
}: {
  age?: number;
  theme?: ThemeMode;
  pose?: 'wave' | 'celebrate' | 'ready';
  size?: number;
}) {
  const clamped = Math.max(14, Math.min(85, age));
  const palette = ACCENT_MAP[theme];
  const hair =
    clamped >= 65 ? '#e4ecf5' : clamped >= 50 ? '#a9bacd' : clamped >= 38 ? '#5d4a40' : '#4a3228';
  const stageBadge =
    clamped < 18 ? '18−' : clamped < 30 ? '20s' : clamped < 45 ? '30–40s' : clamped < 60 ? '50s' : '60+';

  return (
    <svg
      width={size}
      height={Math.round(size * 1.15)}
      viewBox="0 0 180 210"
      role="img"
      aria-label={`Athlete avatar (${stageBadge})`}
      style={{display: 'block', marginInline: 'auto'}}
    >
      <ellipse cx="90" cy="196" rx="46" ry="8" fill="rgba(0,0,0,0.45)" />

      {/* Legs & shoes */}
      <path d="M77 124 L74 182" stroke={palette.dark} strokeWidth="18" strokeLinecap="round" />
      <path d="M103 124 L106 182" stroke={palette.dark} strokeWidth="18" strokeLinecap="round" />
      {/* Shoes */}
      <path d="M58 189 C58 181, 82 181, 82 189 Z" fill="#dce5ef" />
      <path d="M98 189 C98 181, 122 181, 122 189 Z" fill="#dce5ef" />
      <rect x="57" y="189" width="26" height="4" rx="2" fill="#8f9eb0" />
      <rect x="97" y="189" width="26" height="4" rx="2" fill="#8f9eb0" />

      {/* Arms by pose */}
      {pose === 'celebrate' ? (
        <>
          <path d="M68 78 L52 34" stroke="#f0be96" strokeWidth="14" strokeLinecap="round" />
          <path d="M112 78 L128 34" stroke="#f0be96" strokeWidth="14" strokeLinecap="round" />
          {/* Left dumbbell */}
          <g transform="rotate(-14 50 28)">
            <rect x="33" y="25" width="34" height="6" rx="3" fill="#23374d" />
            <rect x="31" y="17" width="9" height="22" rx="3.5" fill={palette.primary} />
            <rect x="60" y="17" width="9" height="22" rx="3.5" fill={palette.primary} />
          </g>
          {/* Right dumbbell */}
          <g transform="rotate(14 130 28)">
            <rect x="113" y="25" width="34" height="6" rx="3" fill="#23374d" />
            <rect x="111" y="17" width="9" height="22" rx="3.5" fill={palette.primary} />
            <rect x="140" y="17" width="9" height="22" rx="3.5" fill={palette.primary} />
          </g>
        </>
      ) : pose === 'wave' ? (
        <>
          {/* Left hand on hip */}
          <path d="M68 78 L48 100 L64 114" stroke="#f0be96" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Right arm waving high */}
          <path d="M112 78 L142 36" stroke="#f0be96" strokeWidth="14" strokeLinecap="round" />
          <circle cx="145" cy="30" r="7" fill="#f0be96" />
        </>
      ) : (
        <>
          <path d="M68 78 L50 112" stroke="#f0be96" strokeWidth="14" strokeLinecap="round" />
          <path d="M112 78 L130 112" stroke="#f0be96" strokeWidth="14" strokeLinecap="round" />
        </>
      )}

      {/* Athletic tank torso */}
      <path d="M66 68 L114 68 L110 128 L70 128 Z" rx="14" fill={palette.primary} />
      <rect x="69" y="122" width="42" height="10" rx="4" fill={palette.dark} />

      {/* Neck & head */}
      <rect x="83" y="56" width="14" height="14" rx="6" fill="#e6b087" />
      <circle cx="90" cy="43" r="18" fill="#f2c49e" />
      {/* Hair crown (ages smoothly) */}
      <path d="M71 42 C72 20, 108 20, 109 42 C102 32, 95 31, 90 36 C85 31, 78 32, 71 42 Z" fill={hair} />
      {/* Eyes & warm confident smile */}
      <circle cx="83" cy="44" r="2.7" fill="#171b26" />
      <circle cx="97" cy="44" r="2.7" fill="#171b26" />
      <path d="M84 52 Q90 56 96 52" stroke="#8a5a3c" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Subtle age cohort pill */}
      <rect x="68" y="194" width="44" height="15" rx="7.5" fill="rgba(16,22,36,0.92)" stroke={palette.primary} strokeOpacity="0.65" />
      <text x="90" y="204.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={palette.glow}>
        {stageBadge}
      </text>
    </svg>
  );
}
