'use client';

import React, { useEffect, useState } from 'react';
import { INK, FREDOKA, NUNITO, RED, YELLOW, GREEN, BLUE, PURPLE, ORANGE } from '../_lib/tokens';
import { OnboardBg } from './primitives';
import { CharAvatar, MATES } from './mates';
import type { DemoCourse } from '../_lib/demo-courses';

const CONFETTI_COLORS = [RED, YELLOW, GREEN, BLUE, PURPLE, ORANGE];
const REDIRECT_MS = 4500;

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  drift: number;
  shape: 'square' | 'circle' | 'strip';
}

export function WelcomeScreen({
  course,
  name,
  onEnter,
}: {
  course?: DemoCourse;
  name?: string;
  onEnter: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(REDIRECT_MS / 1000));
  const [pieces] = useState<ConfettiPiece[]>(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2.6 + Math.random() * 2.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 8 + Math.random() * 10,
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 160,
      shape: (['square', 'circle', 'strip'] as const)[i % 3],
    })),
  );

  useEffect(() => {
    const t = setTimeout(onEnter, REDIRECT_MS);
    const i = setInterval(
      () => setSecondsLeft((s) => (s > 1 ? s - 1 : s)),
      1000,
    );
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [onEnter]);

  const sage = MATES.find((m) => m.key === 'teacher') ?? MATES[0];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <OnboardBg variant="warm" />

      {/* Confetti layer */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {pieces.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: -20,
              left: `${p.left}%`,
              width: p.shape === 'strip' ? p.size * 0.4 : p.size,
              height: p.shape === 'strip' ? p.size * 1.4 : p.size,
              background: p.color,
              borderRadius:
                p.shape === 'circle' ? '50%' : p.shape === 'strip' ? 2 : 3,
              border: `1.5px solid ${INK}`,
              animation: `confettiFall ${p.duration}s linear ${p.delay}s infinite`,
              // CSS custom props for drift + rotation targets
              ['--drift' as never]: `${p.drift}px`,
              ['--rot' as never]: `${p.rotate + 720}deg`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          maxWidth: 620,
          animation: 'welcomePop .7s cubic-bezier(.22,1.3,.36,1) both',
        }}
      >
        {/* YOU'RE IN pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: GREEN,
            border: `3px solid ${INK}`,
            boxShadow: `4px 4px 0 ${INK}`,
            borderRadius: 999,
            padding: '8px 18px',
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: INK,
            marginBottom: 24,
            transform: 'rotate(-2deg)',
          }}
        >
          🎉 You&apos;re in
        </div>

        <h1
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 'clamp(40px, 7vw, 68px)',
            color: INK,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: 0,
          }}
        >
          {name ? `Welcome to Slate, ${name}.` : 'Welcome to Slate.'}
        </h1>
        <p
          style={{
            fontFamily: NUNITO,
            fontSize: 18,
            fontWeight: 600,
            color: '#495057',
            margin: '20px auto 0',
            maxWidth: 500,
            lineHeight: 1.5,
          }}
        >
          Your classroom is set up and your teachers are ready.
          {course ? ` Let's dive into ${course.title}.` : ' Let us open it up.'}
        </p>

        {/* Mates row with sage featured */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 32,
            marginBottom: 8,
          }}
        >
          <div style={{ animation: 'obBob 2.2s ease-in-out infinite' }}>
            <CharAvatar body={sage.color} size={96} face={sage.face} />
          </div>
        </div>
        <div
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: INK,
          }}
        >
          {sage.name} is ready to teach
        </div>

        {/* CTA */}
        <button
          onClick={onEnter}
          style={{
            marginTop: 32,
            background: RED,
            color: '#fff',
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${INK}`,
            borderRadius: 18,
            padding: '16px 28px',
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 17,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          Enter my classroom →
        </button>

        <p
          style={{
            fontFamily: NUNITO,
            fontSize: 13,
            fontWeight: 600,
            color: '#6B7B85',
            marginTop: 16,
          }}
        >
          Auto-redirecting in {secondsLeft}s...
        </p>
      </div>

      <style jsx>{`
        @keyframes confettiFall {
          0% {
            transform: translate3d(0, -20px, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 110vh, 0) rotate(var(--rot));
            opacity: 1;
          }
        }
        @keyframes welcomePop {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes obBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}
