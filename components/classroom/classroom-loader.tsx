'use client';

import React from 'react';

const INK = '#073B4C';
const YELLOW = '#FFD166';
const RED = '#EF476F';
const GREEN = '#06D6A0';
const BLUE = '#118AB2';
const FREDOKA = 'var(--font-fredoka), Fredoka, sans-serif';
const NUNITO = 'var(--font-sans), Nunito, sans-serif';

const DOT_COLORS = [YELLOW, RED, GREEN, BLUE];

export interface ClassroomLoaderProps {
  label?: string;
  hint?: string;
  variant?: 'page' | 'embed';
}

export function ClassroomLoader({
  label = 'Loading your classroom',
  hint = 'Setting up the stage and waking up your mates…',
  variant = 'page',
}: ClassroomLoaderProps) {
  const isEmbed = variant === 'embed';

  return (
    <div
      style={{
        position: isEmbed ? 'absolute' : 'relative',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: isEmbed ? undefined : '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FDFDFD',
        zIndex: 1,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: 24,
          maxWidth: 360,
        }}
      >
        {/* Bouncing dots */}
        <div
          style={{
            display: 'inline-flex',
            gap: 10,
            padding: '12px 18px',
            background: '#fff',
            border: `3px solid ${INK}`,
            borderRadius: 999,
            boxShadow: `4px 4px 0 ${INK}`,
            marginBottom: 18,
          }}
        >
          {DOT_COLORS.map((c, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: c,
                border: `2px solid ${INK}`,
                display: 'inline-block',
                animation: `clBob 1.1s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 18,
            color: INK,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontFamily: NUNITO,
              fontWeight: 600,
              fontSize: 13,
              color: '#6B7B85',
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            {hint}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes clBob {
          0%, 100% { transform: translateY(0); opacity: 0.55; }
          50%      { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
