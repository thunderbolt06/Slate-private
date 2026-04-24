'use client';

import React from 'react';
import { INK, FREDOKA, NUNITO, YELLOW } from '../_lib/tokens';
import { StepLayout } from './primitives';
import type { OnboardingAnswers, DemoTopicKey } from '../_lib/tokens';
import { DEMO_COURSES } from '../_lib/demo-courses';
import { PricingPanel } from './pricing-panel';

// ── Step 10: Pick a demo course ──
export const Step10DemoPick = ({
  value,
  onChange,
  onNext,
  name,
}: {
  value?: DemoTopicKey;
  onChange: (v: DemoTopicKey) => void;
  onNext: () => void;
  name?: string;
}) => (
  <StepLayout
    bgVariant="default"
    maxWidth={960}
    eyebrow={name ? `Ready when you are, ${name}` : 'Pick a starter'}
    title="Which class should we open first?"
    subtitle="Six ready-to-go courses, hand-picked for a 15-20 min first run. You can explore more later."
  >
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      {DEMO_COURSES.map((c) => {
        const selected = value === c.key;
        return (
          <button
            key={c.key}
            onClick={() => {
              onChange(c.key);
              onNext();
            }}
            style={{
              background: selected ? c.color + '22' : '#fff',
              border: `3px solid ${INK}`,
              borderRadius: 22,
              boxShadow: selected ? `6px 6px 0 ${INK}` : `4px 4px 0 ${INK}`,
              padding: '20px 18px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'all .15s ease',
              transform: selected ? 'translate(-2px,-2px)' : 'translate(0,0)',
              position: 'relative',
              minHeight: 220,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: c.color,
                  border: `2.5px solid ${INK}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                {c.emoji}
              </div>
              <div
                style={{
                  fontFamily: FREDOKA,
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: INK,
                  background: '#fff',
                  border: `2px solid ${INK}`,
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                {c.subject}
              </div>
            </div>
            <div
              style={{
                fontFamily: FREDOKA,
                fontWeight: 700,
                fontSize: 19,
                color: INK,
                lineHeight: 1.15,
              }}
            >
              {c.title}
            </div>
            <p
              style={{
                fontFamily: NUNITO,
                fontSize: 13.5,
                color: '#495057',
                lineHeight: 1.5,
                margin: 0,
                flex: 1,
              }}
            >
              {c.description}
            </p>
            <div
              style={{
                display: 'flex',
                gap: 8,
                fontFamily: FREDOKA,
                fontWeight: 700,
                fontSize: 11,
                color: '#6B7B85',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <span>⏱ {c.minutes} min</span>
              <span>·</span>
              <span>{c.lessons} lessons</span>
            </div>
            {selected && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: INK,
                  color: '#fff',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
            )}
          </button>
        );
      })}
    </div>
  </StepLayout>
);

// ── Step 11: Pricing / plan pick ──
export const Step11Pricing = ({
  answers,
  onFree,
}: {
  answers: OnboardingAnswers;
  onFree: () => void;
}) => (
  <StepLayout
    bgVariant="warm"
    maxWidth={1140}
    eyebrow="⭐ Last step · start your 7-day free trial"
    title={
      answers.name
        ? `${answers.name}, your personal classroom is ready.`
        : 'Your personal classroom is ready.'
    }
    subtitle={
      <>
        Try everything free for 7 days.{' '}
        <strong style={{ color: INK }}>Cancel anytime</strong>, you won&apos;t be charged today.
      </>
    }
    footer={
      <>
        <button
          onClick={onFree}
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            fontFamily: NUNITO,
            fontWeight: 700,
            fontSize: 14,
            color: '#6B7B85',
            textDecoration: 'underline',
          }}
        >
          Continue on Free for now
        </button>
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('pro-trial-cta');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => (el as HTMLButtonElement).focus(), 450);
            }
          }}
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            fontFamily: NUNITO,
            fontSize: 13,
            color: '#6B7B85',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              background: YELLOW,
              padding: '4px 12px',
              borderRadius: 999,
              border: `2px solid ${INK}`,
              boxShadow: `2px 2px 0 ${INK}`,
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 11,
              color: INK,
              letterSpacing: '0.08em',
            }}
          >
            7-DAY FREE TRIAL
          </span>
          Cancel anytime
        </button>
      </>
    }
  >
    <PricingPanel onFreeContinue={onFree} />
  </StepLayout>
);
