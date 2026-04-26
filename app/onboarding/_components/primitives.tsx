'use client';

import React, { useState, forwardRef } from 'react';
import {
  INK,
  RED,
  YELLOW,
  BLUE,
  GREEN,
  PURPLE,
  ORANGE,
  FREDOKA,
  NUNITO,
  PHASE_TOTAL,
  getPhase,
} from '../_lib/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'white' | 'ink' | 'green' | 'ghost';
type ButtonSize = 'sm' | 'lg' | 'xl';

const PALETTES: Record<ButtonVariant, { bg: string; color: string }> = {
  primary: { bg: RED, color: '#fff' },
  secondary: { bg: YELLOW, color: INK },
  white: { bg: '#fff', color: INK },
  ink: { bg: INK, color: '#fff' },
  green: { bg: GREEN, color: INK },
  ghost: { bg: 'transparent', color: INK },
};

export const PillBtn = ({
  variant = 'primary',
  size = 'lg',
  children,
  onClick,
  icon,
  style,
  disabled,
  type,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const p = PALETTES[variant];
  const [h, setH] = useState(false);
  const pad = size === 'sm' ? '8px 18px' : size === 'xl' ? '16px 32px' : '12px 26px';
  const fs = size === 'sm' ? 14 : size === 'xl' ? 19 : 16;
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        fontFamily: FREDOKA,
        fontWeight: 700,
        fontSize: fs,
        padding: pad,
        borderRadius: 999,
        border: variant === 'ghost' ? '2px solid transparent' : `3px solid ${INK}`,
        boxShadow: variant === 'ghost' ? 'none' : `4px 4px 0 ${INK}`,
        background: p.bg,
        color: p.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transform: h && !disabled ? 'translate(-1px,-1px)' : 'translate(0,0)',
        transition: 'transform .14s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
      {icon && <span style={{ fontSize: fs + 2 }}>{icon}</span>}
    </button>
  );
};

export const PillInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PillInputInner(props, ref) {
    return (
      <input
        ref={ref}
        {...props}
        style={{
          height: 56,
          borderRadius: 999,
          border: `3px solid ${INK}`,
          padding: '0 24px',
          fontFamily: NUNITO,
          fontSize: 17,
          fontWeight: 600,
          color: INK,
          boxShadow: `4px 4px 0 ${INK}`,
          background: '#fff',
          outline: 'none',
          width: '100%',
          ...(props.style || {}),
        }}
      />
    );
  },
);

export const OptionCard = ({
  label,
  sub,
  emoji,
  color = YELLOW,
  selected,
  onClick,
  size = 'md',
  style,
}: {
  label: string;
  sub?: string;
  emoji?: string;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}) => {
  const [h, setH] = useState(false);
  const pad = size === 'sm' ? '14px 16px' : '18px 20px';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: selected ? color + '22' : '#fff',
        border: `3px solid ${INK}`,
        borderRadius: 20,
        boxShadow: selected ? `6px 6px 0 ${INK}` : h ? `5px 5px 0 ${INK}` : `4px 4px 0 ${INK}`,
        padding: pad,
        textAlign: 'left',
        cursor: 'pointer',
        transform: h || selected ? 'translate(-1px,-1px)' : 'translate(0,0)',
        transition: 'transform .14s ease, box-shadow .14s ease, background .14s ease',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        width: '100%',
        fontFamily: FREDOKA,
        ...style,
      }}
    >
      {emoji && (
        <div
          style={{
            width: 44,
            height: 44,
            minWidth: 44,
            borderRadius: 12,
            background: color,
            border: `2.5px solid ${INK}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          {emoji}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 16,
            color: INK,
            lineHeight: 1.2,
            // Allow long single-word labels (e.g. "Instagram", "YouTube",
            // "Podcast") to wrap to a second line instead of being clipped
            // mid-word by the parent grid cell — NEW-007.
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontFamily: NUNITO,
              fontWeight: 500,
              fontSize: 13,
              color: '#495057',
              marginTop: 3,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: `2.5px solid ${INK}`,
          background: selected ? INK : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {selected ? '✓' : ''}
      </div>
    </button>
  );
};

export const Tag = ({
  color = BLUE,
  children,
  selected,
  onClick,
}: {
  color?: string;
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) => {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        fontFamily: FREDOKA,
        fontWeight: 700,
        fontSize: 14,
        padding: '8px 16px',
        borderRadius: 999,
        border: `2.5px solid ${INK}`,
        background: selected ? color : '#fff',
        color: selected ? '#fff' : INK,
        boxShadow: h ? `4px 4px 0 ${INK}` : `3px 3px 0 ${INK}`,
        cursor: 'pointer',
        transform: h ? 'translate(-1px,-1px)' : 'translate(0,0)',
        transition: 'all .14s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
};

export const Blob = ({
  style,
  delay = 0,
  reverse,
}: {
  style?: React.CSSProperties;
  delay?: number;
  reverse?: boolean;
}) => (
  <div
    style={{
      position: 'absolute',
      border: `3px solid ${INK}`,
      animation: `${reverse ? 'obFloatR' : 'obFloat'} ${6 + (delay % 3)}s ease-in-out ${delay}s infinite`,
      pointerEvents: 'none',
      ...style,
    }}
  />
);

export const ProgressBar = ({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: () => void;
}) => {
  const pct = (step / total) * 100;
  const phaseInfo = getPhase(step);
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: 'clamp(12px, 3vw, 18px) clamp(14px, 3vw, 28px)',
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(8px, 2vw, 16px)',
        background: 'rgba(253,253,253,.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        borderBottom: `1px solid ${INK}15`,
      }}
    >
      <button
        onClick={onBack}
        disabled={step <= 0}
        style={{
          background: '#fff',
          border: `2.5px solid ${INK}`,
          boxShadow: `3px 3px 0 ${INK}`,
          width: 40,
          height: 40,
          borderRadius: '50%',
          cursor: step > 0 ? 'pointer' : 'not-allowed',
          opacity: step > 0 ? 1 : 0.3,
          fontSize: 18,
          color: INK,
          fontWeight: 700,
        }}
      >
        ←
      </button>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: FREDOKA,
          fontWeight: 700,
          fontSize: 18,
          color: INK,
          letterSpacing: '-0.02em',
        }}
      >
        SLATE
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: '#fff',
          border: `2.5px solid ${INK}`,
          borderRadius: 999,
          overflow: 'hidden',
          boxShadow: `3px 3px 0 ${INK}`,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: INK,
            transition: 'width .5s cubic-bezier(.22,1.2,.36,1)',
          }}
        />
      </div>
      <div
        style={{
          fontFamily: FREDOKA,
          fontWeight: 700,
          fontSize: 14,
          color: INK,
          whiteSpace: 'nowrap',
        }}
      >
        {phaseInfo.label}
        <span style={{ color: '#6B7B85', fontWeight: 500 }}>
          {' '}
          {phaseInfo.phase}/{PHASE_TOTAL}
        </span>
      </div>
    </div>
  );
};

export const OnboardBg = ({ variant = 'default' }: { variant?: 'default' | 'warm' | 'cool' }) => {
  const tones: Record<string, string[]> = {
    default: [YELLOW, RED, BLUE, GREEN, PURPLE, ORANGE],
    warm: [YELLOW, ORANGE, RED, YELLOW],
    cool: [BLUE, GREEN, PURPLE, BLUE],
  };
  const colors = tones[variant] || tones.default;
  return (
    <>
      <Blob style={{ top: '12%', left: '6%', width: 72, height: 72, background: colors[0], borderRadius: '50%', opacity: 0.55 }} delay={0} />
      <Blob reverse style={{ top: '18%', right: '8%', width: 64, height: 64, background: colors[1], borderRadius: 16, opacity: 0.5 }} delay={1} />
      <Blob style={{ bottom: '14%', left: '10%', width: 88, height: 88, background: colors[2], borderRadius: '50%', opacity: 0.35 }} delay={2} />
      <Blob reverse style={{ bottom: '22%', right: '6%', width: 56, height: 56, background: colors[3], borderRadius: 20, opacity: 0.45 }} delay={0.5} />
      <Blob style={{ top: '50%', left: '3%', width: 32, height: 32, background: colors[4] || colors[0], borderRadius: 10, opacity: 0.4 }} delay={1.5} />
      <Blob reverse style={{ top: '60%', right: '3%', width: 36, height: 36, background: colors[5] || colors[1], borderRadius: '50%', opacity: 0.3 }} delay={2.2} />
    </>
  );
};

export const StepLayout = ({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 720,
  bgVariant,
}: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  bgVariant?: 'default' | 'warm' | 'cool';
}) => (
  <div
    style={{
      minHeight: '100vh',
      paddingTop: 96,
      paddingBottom: 120,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <OnboardBg variant={bgVariant} />
    <div style={{ width: '100%', maxWidth, padding: '0 clamp(16px, 4vw, 24px)', position: 'relative', zIndex: 2 }}>
      {eyebrow && (
        <div
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 12,
            color: RED,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          {eyebrow}
        </div>
      )}
      {title && (
        <h1
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 'clamp(26px, 6vw, 52px)',
            color: INK,
            letterSpacing: '-0.025em',
            lineHeight: 1.02,
            textAlign: 'center',
            margin: 0,
            textWrap: 'balance' as React.CSSProperties['textWrap'],
          }}
        >
          {title}
        </h1>
      )}
      {subtitle && (
        <p
          style={{
            fontFamily: NUNITO,
            fontSize: 17,
            color: '#495057',
            textAlign: 'center',
            margin: '16px auto 0',
            maxWidth: 560,
            lineHeight: 1.55,
          }}
        >
          {subtitle}
        </p>
      )}
      <div style={{ marginTop: title ? 40 : 0 }}>{children}</div>
    </div>
    {footer && (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'center',
          background: 'rgba(253,253,253,.9)',
          backdropFilter: 'blur(8px)',
          borderTop: `1px solid ${INK}15`,
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {footer}
        </div>
      </div>
    )}
  </div>
);
