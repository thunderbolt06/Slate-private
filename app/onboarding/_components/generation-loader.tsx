'use client';

import React, { useEffect, useState } from 'react';
import { INK, FREDOKA, NUNITO, YELLOW, GREEN, RED, BLUE, PURPLE } from '../_lib/tokens';
import { OnboardBg } from './primitives';
import { CharAvatar, MATES } from './mates';
import type { DemoCourse } from '../_lib/demo-courses';

interface Task {
  label: string;
  hint: string;
  emoji: string;
  color: string;
  ms: number;
}

const TASKS: Task[] = [
  { label: 'Drafting the outline',   hint: 'Picking the best 5 lessons for you',       emoji: '📝', color: YELLOW, ms: 900 },
  { label: 'Generating slides',      hint: 'Mixing visuals, notes, and quick checks',  emoji: '🎨', color: RED,    ms: 1200 },
  { label: 'Recording narration',    hint: 'Professor Sage is warming up her voice',   emoji: '🎙️', color: PURPLE, ms: 1100 },
  { label: 'Inviting your classmates', hint: 'Calling the rest of your crew',          emoji: '👋', color: BLUE,   ms: 900 },
  { label: 'Opening the classroom',  hint: 'Last touch-ups, almost there',             emoji: '✨', color: GREEN,  ms: 800 },
];

export function GenerationLoader({
  course,
  onDone,
}: {
  course: DemoCourse;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const run = () => {
      if (cancelled) return;
      if (i >= TASKS.length) {
        setDone(true);
        setTimeout(() => !cancelled && onDone(), 450);
        return;
      }
      setIdx(i);
      setTimeout(() => {
        i++;
        run();
      }, TASKS[i].ms);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  const progress = done ? 1 : Math.min(1, (idx + 0.5) / TASKS.length);

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingTop: 64,
        paddingBottom: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <OnboardBg variant="default" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 620,
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 12,
            color: RED,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Building your classroom
        </div>
        <h1
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 'clamp(30px, 4.5vw, 44px)',
            color: INK,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          {course.title}
        </h1>

        {/* course chip */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            margin: '24px auto 28px',
            background: '#fff',
            border: `3px solid ${INK}`,
            boxShadow: `4px 4px 0 ${INK}`,
            padding: '8px 14px 8px 10px',
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: course.color,
              border: `2px solid ${INK}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            {course.emoji}
          </span>
          <span
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 13,
              color: INK,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {course.subject} · {course.lessons} lessons · {course.minutes} min
          </span>
        </div>

        {/* Mates row */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          {MATES.map((m, i) => (
            <div
              key={m.key}
              style={{
                marginLeft: i === 0 ? 0 : -12,
                zIndex: MATES.length - i,
                animation: `obBob 2.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            >
              <CharAvatar body={m.color} size={56} face={m.face} />
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 16,
            background: '#fff',
            border: `3px solid ${INK}`,
            borderRadius: 999,
            overflow: 'hidden',
            boxShadow: `4px 4px 0 ${INK}`,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: INK,
              transition: 'width .5s cubic-bezier(.22,1.2,.36,1)',
            }}
          />
        </div>

        {/* Task list */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 auto',
            maxWidth: 480,
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {TASKS.map((t, i) => {
            const state: 'done' | 'active' | 'pending' =
              done || i < idx ? 'done' : i === idx ? 'active' : 'pending';
            return (
              <li
                key={t.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#fff',
                  border: `2.5px solid ${state === 'pending' ? INK + '20' : INK}`,
                  borderRadius: 16,
                  padding: '10px 14px',
                  boxShadow: state === 'pending' ? 'none' : `3px 3px 0 ${INK}`,
                  opacity: state === 'pending' ? 0.55 : 1,
                  transform: state === 'active' ? 'translate(-1px,-1px)' : 'translate(0,0)',
                  transition: 'all .25s ease',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: state === 'done' ? t.color : state === 'active' ? t.color : '#F0F4F8',
                    border: `2px solid ${INK}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {state === 'done' ? '✓' : t.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: FREDOKA,
                      fontWeight: 700,
                      fontSize: 14,
                      color: INK,
                      lineHeight: 1.2,
                    }}
                  >
                    {t.label}
                    {state === 'active' && (
                      <span style={{ display: 'inline-block', marginLeft: 8 }}>
                        <Dots />
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: NUNITO,
                      fontWeight: 600,
                      fontSize: 12,
                      color: '#6B7B85',
                      marginTop: 2,
                    }}
                  >
                    {t.hint}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p
          style={{
            fontFamily: NUNITO,
            fontSize: 13,
            color: '#6B7B85',
            marginTop: 22,
          }}
        >
          This usually takes about a minute. Hang tight.
        </p>
      </div>

      <style jsx>{`
        @keyframes obBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: INK,
            display: 'inline-block',
            animation: `obDot 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes obDot {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40%           { opacity: 1;   transform: translateY(-2px); }
        }
      `}</style>
    </span>
  );
}
