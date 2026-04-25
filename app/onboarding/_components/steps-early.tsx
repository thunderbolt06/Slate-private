'use client';

import React, { useState, useEffect, useRef } from 'react';
import { INK, RED, YELLOW, BLUE, GREEN, PURPLE, ORANGE, FREDOKA, NUNITO } from '../_lib/tokens';
import { OptionCard, PillBtn, PillInput, StepLayout, Tag } from './primitives';
import { CharAvatar, MATES } from './mates';
import type { OnboardingAnswers } from '../_lib/tokens';

// ── Step 1: Welcome ──
export const Step1Welcome = ({ onNext }: { onNext: () => void }) => (
  <StepLayout bgVariant="default">
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <h1
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 'clamp(44px, 13vw, 120px)',
            color: INK,
            letterSpacing: '-0.035em',
            lineHeight: 0.92,
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          WELCOME
        </h1>
      </div>
      <h2
        style={{
          fontFamily: FREDOKA,
          fontWeight: 700,
          fontSize: 'clamp(24px, 6vw, 48px)',
          color: INK,
          letterSpacing: '-0.02em',
          margin: '0 0 20px',
        }}
      >
        to{' '}
        <span
          style={{
            background: YELLOW,
            padding: '4px 18px',
            border: `3px solid ${INK}`,
            borderRadius: 14,
            boxShadow: `4px 4px 0 ${INK}`,
            display: 'inline-block',
          }}
        >
          SLATE
        </span>
      </h2>
      <p
        style={{
          fontFamily: NUNITO,
          fontSize: 19,
          color: '#495057',
          maxWidth: 520,
          margin: '20px auto 36px',
          lineHeight: 1.55,
        }}
      >
        Your AI-powered classroom. Turn any topic into an interactive course with slides, narration,
        and AI classmates, in under a minute.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
        {MATES.map((m, i) => (
          <div
            key={m.key}
            style={{
              marginLeft: i === 0 ? 0 : -16,
              zIndex: MATES.length - i,
              animation: `obRise .5s cubic-bezier(.22,1.2,.36,1) ${i * 0.08}s backwards`,
            }}
          >
            <CharAvatar body={m.color} size={86} face={m.face} />
          </div>
        ))}
      </div>

      <PillBtn variant="primary" size="xl" onClick={onNext} icon="→">
        Let&apos;s get started
      </PillBtn>

      <div style={{ fontFamily: NUNITO, fontSize: 13, color: '#6B7B85', marginTop: 20 }}>
        Takes about 90 seconds.{' '}
        <span style={{ color: INK, fontWeight: 700 }}>7-day free trial</span>, no charge today.
      </div>
    </div>
  </StepLayout>
);

// ── Step 2: Name ──
export const Step2Name = ({
  value,
  onChange,
  onNext,
}: {
  value?: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <StepLayout
      bgVariant="warm"
      eyebrow="First things first"
      title="What should we call you?"
      subtitle="We'll use this so Professor Sage can say hi in class."
      footer={
        <>
          <div style={{ fontFamily: NUNITO, fontSize: 13, color: '#6B7B85' }}>
            Press Enter or click Continue
          </div>
          <PillBtn onClick={onNext} disabled={!value?.trim()} icon="→">
            Continue
          </PillBtn>
        </>
      }
    >
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <PillInput
          ref={inputRef}
          placeholder="e.g. Alex"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value?.trim()) onNext();
          }}
          style={{ textAlign: 'center', fontSize: 20 }}
        />
        {value?.trim() && (
          <div
            style={{
              fontFamily: FREDOKA,
              fontWeight: 600,
              fontSize: 15,
              color: INK,
              textAlign: 'center',
              marginTop: 20,
              animation: 'obFade .3s ease',
            }}
          >
            Nice to meet you,{' '}
            <span
              style={{
                background: YELLOW,
                padding: '2px 10px',
                borderRadius: 999,
                border: `2px solid ${INK}`,
              }}
            >
              {value.trim()}
            </span>{' '}
            👋
          </div>
        )}
      </div>
    </StepLayout>
  );
};

// ── Step 3: Goal ──
const GOALS = [
  { key: 'student', label: "I'm a student", sub: 'Crush classes, cram smarter, ace exams.', emoji: '🎓', color: YELLOW },
  { key: 'upskill', label: 'Upskilling for work', sub: 'Learn what your job (or next job) needs.', emoji: '💼', color: BLUE },
  { key: 'career', label: 'Switching careers', sub: 'Build a whole new skill stack, fast.', emoji: '🚀', color: RED },
  { key: 'curious', label: 'Curious about everything', sub: 'Learn for the joy of it. No agenda required.', emoji: '✨', color: PURPLE },
  { key: 'teach', label: 'I teach others', sub: 'Build lessons & materials for my students.', emoji: '📚', color: GREEN },
  { key: 'other', label: 'Something else', sub: "I'll tell you later.", emoji: '🤔', color: ORANGE },
] as const;

export const Step3Goal = ({
  value,
  onChange,
  onNext,
  name,
}: {
  value?: string;
  onChange: (v: OnboardingAnswers['goal']) => void;
  onNext: () => void;
  name?: string;
}) => (
  <StepLayout
    bgVariant="warm"
    eyebrow={name ? `Hi ${name}` : 'Quick one'}
    title="Why are you here?"
    subtitle="We'll tailor every course we make for you to fit this."
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      {GOALS.map((g) => (
        <OptionCard
          key={g.key}
          label={g.label}
          sub={g.sub}
          emoji={g.emoji}
          color={g.color}
          selected={value === g.key}
          onClick={() => {
            onChange(g.key as OnboardingAnswers['goal']);
            onNext();
          }}
        />
      ))}
    </div>
  </StepLayout>
);

// ── Step 4: Source ──
const SOURCES = [
  { key: 'tiktok', label: 'TikTok', emoji: '🎵', color: RED },
  { key: 'ig', label: 'Instagram', emoji: '📸', color: PURPLE },
  { key: 'yt', label: 'YouTube', emoji: '▶️', color: RED },
  { key: 'x', label: 'X / Twitter', emoji: '𝕏', color: INK },
  { key: 'search', label: 'Google search', emoji: '🔎', color: BLUE },
  { key: 'friend', label: 'A friend told me', emoji: '🫶', color: YELLOW },
  { key: 'article', label: 'Blog or article', emoji: '📰', color: GREEN },
  { key: 'podcast', label: 'Podcast', emoji: '🎙️', color: ORANGE },
  { key: 'other', label: 'Somewhere else', emoji: '✨', color: PURPLE },
];

export const Step4Source = ({
  value,
  onChange,
  onNext,
}: {
  value?: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) => (
  <StepLayout
    bgVariant="cool"
    eyebrow="Quick question"
    title="How did you find us?"
    subtitle="Totally optional. Helps us say thank you to the right places."
    footer={
      <>
        <span />
        <button
          onClick={onNext}
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
          Skip
        </button>
      </>
    }
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, maxWidth: 640, margin: '0 auto' }}>
      {SOURCES.map((s) => (
        <OptionCard
          key={s.key}
          label={s.label}
          emoji={s.emoji}
          color={s.color}
          size="sm"
          selected={value === s.key}
          onClick={() => {
            onChange(s.key);
            onNext();
          }}
        />
      ))}
    </div>
  </StepLayout>
);

// ── Step 5: Level ──
const LEVELS = [
  { key: 'beginner', label: 'Beginner', sub: "I'm brand new, start from the basics.", emoji: '🌱', color: GREEN },
  { key: 'intermediate', label: 'Intermediate', sub: 'I know some stuff. Challenge me a bit.', emoji: '🧗', color: BLUE },
  { key: 'advanced', label: 'Advanced', sub: 'Skip the fluff. Give me the hard parts.', emoji: '⚡', color: RED },
  { key: 'mixed', label: 'Depends on the topic', sub: 'Ask me each time. It varies.', emoji: '🎚️', color: PURPLE },
] as const;

export const Step5Level = ({
  value,
  onChange,
  onNext,
}: {
  value?: string;
  onChange: (v: OnboardingAnswers['level']) => void;
  onNext: () => void;
}) => (
  <StepLayout
    bgVariant="default"
    eyebrow="Calibrating"
    title="Where are you starting from?"
    subtitle="We'll adjust depth, pace, and vocabulary to match."
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      {LEVELS.map((l) => (
        <OptionCard
          key={l.key}
          label={l.label}
          sub={l.sub}
          emoji={l.emoji}
          color={l.color}
          selected={value === l.key}
          onClick={() => {
            onChange(l.key as OnboardingAnswers['level']);
            onNext();
          }}
        />
      ))}
    </div>
  </StepLayout>
);

// ── Step 6: Interests ──
const INTERESTS = [
  { key: 'ai', label: 'AI & ML', color: PURPLE },
  { key: 'coding', label: 'Coding', color: BLUE },
  { key: 'design', label: 'Design', color: RED },
  { key: 'biz', label: 'Business', color: INK },
  { key: 'finance', label: 'Finance', color: GREEN },
  { key: 'product', label: 'Product', color: ORANGE },
  { key: 'data', label: 'Data Science', color: BLUE },
  { key: 'marketing', label: 'Marketing', color: RED },
  { key: 'history', label: 'History', color: YELLOW },
  { key: 'science', label: 'Science', color: GREEN },
  { key: 'math', label: 'Math', color: PURPLE },
  { key: 'lang', label: 'Languages', color: ORANGE },
  { key: 'writing', label: 'Writing', color: INK },
  { key: 'philosophy', label: 'Philosophy', color: PURPLE },
  { key: 'health', label: 'Health & Fitness', color: GREEN },
  { key: 'music', label: 'Music', color: RED },
  { key: 'art', label: 'Art', color: YELLOW },
  { key: 'cooking', label: 'Cooking', color: ORANGE },
  { key: 'psychology', label: 'Psychology', color: BLUE },
  { key: 'entrepreneur', label: 'Startups', color: RED },
];

export const Step6Interests = ({
  value = [],
  onChange,
  customAdded,
  setCustomAdded,
  onNext,
}: {
  value?: string[];
  onChange: (v: string[]) => void;
  customAdded: { key: string; label: string }[];
  setCustomAdded: (v: { key: string; label: string }[]) => void;
  onNext: () => void;
}) => {
  const [customText, setCustomText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (k: string) => {
    const s = new Set(value);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    onChange([...s]);
  };

  const addCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    const key = 'custom_' + trimmed.toLowerCase().replace(/\s+/g, '_');
    if (!value.includes(key)) {
      setCustomAdded([...customAdded, { key, label: trimmed }]);
      onChange([...value, key]);
    }
    setCustomText('');
    inputRef.current?.focus();
  };

  const removeCustom = (k: string) => {
    setCustomAdded(customAdded.filter((c) => c.key !== k));
    onChange(value.filter((v) => v !== k));
  };

  const selected = value.length;
  const needed = Math.max(0, 3 - selected);

  return (
    <StepLayout
      bgVariant="default"
      eyebrow={selected === 0 ? 'Pick at least 3' : selected < 3 ? `${needed} more to go` : `${selected} selected`}
      title="What do you want to learn?"
      subtitle="We'll pre-seed your library with starter courses. You can always explore more topics later."
      footer={
        <>
          <span />
          <PillBtn onClick={onNext} disabled={selected < 3} icon="→">
            {needed > 0 ? `Pick ${needed} more` : 'Continue'}
          </PillBtn>
        </>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 720, margin: '0 auto' }}>
        {INTERESTS.map((t) => (
          <Tag key={t.key} color={t.color} selected={value.includes(t.key)} onClick={() => toggle(t.key)}>
            {value.includes(t.key) ? '✓ ' : '+ '}
            {t.label}
          </Tag>
        ))}
        {customAdded.map((c) => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Tag color={PURPLE} selected={value.includes(c.key)} onClick={() => toggle(c.key)}>
              {value.includes(c.key) ? '✓ ' : '+ '}
              {c.label}
            </Tag>
            <button
              onClick={() => removeCustom(c.key)}
              style={{
                background: '#fff',
                border: `2px solid ${INK}`,
                borderLeft: 0,
                borderRadius: '0 999px 999px 0',
                padding: '4px 8px 4px 4px',
                cursor: 'pointer',
                color: RED,
                fontWeight: 700,
                fontSize: 13,
                boxShadow: `2px 2px 0 ${INK}`,
                marginLeft: -4,
              }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          maxWidth: 480,
          margin: '22px auto 0',
          background: '#fff',
          border: `3px solid ${INK}`,
          borderRadius: 20,
          boxShadow: `4px 4px 0 ${INK}`,
          padding: '14px 18px',
        }}
      >
        <div
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 12,
            color: '#6B7B85',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Don&apos;t see your topic? Add it
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="e.g. Astronomy, Game dev, Knitting…"
            style={{
              flex: 1,
              height: 44,
              borderRadius: 999,
              border: `2.5px solid ${INK}`,
              padding: '0 16px',
              fontFamily: NUNITO,
              fontWeight: 600,
              fontSize: 15,
              color: INK,
              outline: 'none',
              boxShadow: `2px 2px 0 ${INK}`,
            }}
          />
          <button
            onClick={addCustom}
            disabled={!customText.trim()}
            style={{
              height: 44,
              padding: '0 18px',
              borderRadius: 999,
              border: `2.5px solid ${INK}`,
              background: customText.trim() ? YELLOW : '#F0F4F8',
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 14,
              color: INK,
              boxShadow: `2px 2px 0 ${INK}`,
              cursor: customText.trim() ? 'pointer' : 'not-allowed',
              transition: 'background .15s',
            }}
          >
            Add
          </button>
        </div>
        <div style={{ fontFamily: NUNITO, fontSize: 12, color: '#A8B3BD', marginTop: 6 }}>
          Slate can teach almost anything. Just type it in.
        </div>
      </div>
    </StepLayout>
  );
};

// ── Step 7: Style ──
const STYLES = [
  { key: 'visual', label: 'Visual', sub: 'Show me diagrams, charts, and animations.', emoji: '👁️', color: BLUE },
  { key: 'audio', label: 'Audio', sub: 'Narration-first. I listen on the go.', emoji: '🎧', color: PURPLE },
  { key: 'reading', label: 'Reading', sub: 'Give me well-written notes I can scan.', emoji: '📖', color: YELLOW },
  { key: 'hands', label: 'Hands-on', sub: 'I learn best by doing. Quizzes and problems.', emoji: '✋', color: GREEN },
] as const;

export const Step7Style = ({
  value,
  onChange,
  onNext,
}: {
  value?: string;
  onChange: (v: OnboardingAnswers['style']) => void;
  onNext: () => void;
}) => (
  <StepLayout
    bgVariant="cool"
    eyebrow="How you learn best"
    title="Pick your learning style"
    subtitle="We'll bias course generation toward this, but you can switch anytime."
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      {STYLES.map((s) => (
        <OptionCard
          key={s.key}
          label={s.label}
          sub={s.sub}
          emoji={s.emoji}
          color={s.color}
          selected={value === s.key}
          onClick={() => {
            onChange(s.key as OnboardingAnswers['style']);
            onNext();
          }}
        />
      ))}
    </div>
  </StepLayout>
);

// ── Step 8: Time ──
const TIMES = [
  { key: 5, label: '5 min', sub: 'A snack between meetings', emoji: '🍪', color: YELLOW, perWeek: '≈ 1 mini-course/week' },
  { key: 15, label: '15 min', sub: 'A steady daily habit', emoji: '☕', color: GREEN, perWeek: '≈ 3 lessons/week' },
  { key: 30, label: '30 min', sub: 'Real momentum, recommended', emoji: '🔥', color: RED, perWeek: '≈ 1 full course/week', popular: true },
  { key: 60, label: '60 min', sub: "Deep study mode, let's go", emoji: '⚡', color: PURPLE, perWeek: '≈ 2 full courses/week' },
] as const;

export const Step8Time = ({
  value,
  onChange,
  onNext,
}: {
  value?: number;
  onChange: (v: OnboardingAnswers['time']) => void;
  onNext: () => void;
}) => (
  <StepLayout
    bgVariant="warm"
    eyebrow="Your pace"
    title="How much time per day?"
    subtitle="We'll size every course to fit. Nothing feels overwhelming this way."
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      {TIMES.map((t) => (
        <div key={t.key} style={{ position: 'relative' }}>
          {'popular' in t && t.popular && (
            <div
              style={{
                position: 'absolute',
                top: -10,
                right: 12,
                zIndex: 3,
                background: RED,
                color: '#fff',
                fontFamily: FREDOKA,
                fontWeight: 700,
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 999,
                border: `2px solid ${INK}`,
                letterSpacing: '0.06em',
              }}
            >
              MOST POPULAR
            </div>
          )}
          <OptionCard
            label={t.label}
            sub={`${t.sub} · ${t.perWeek}`}
            emoji={t.emoji}
            color={t.color}
            selected={value === t.key}
            onClick={() => {
              onChange(t.key as OnboardingAnswers['time']);
              onNext();
            }}
          />
        </div>
      ))}
    </div>
  </StepLayout>
);

// ── Step 9: Mate ──
export const Step9Mate = ({
  value,
  onChange,
  onNext,
}: {
  value?: string;
  onChange: (v: OnboardingAnswers['mate']) => void;
  onNext: () => void;
}) => {
  const sidekicks = MATES.filter((m) => !m.alwaysIn);
  return (
    <StepLayout
      bgVariant="default"
      eyebrow="Your cast"
      title="Pick your sidekick"
      subtitle="Professor Sage leads every class. Choose one classmate to ride shotgun. You can change later."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 14,
          maxWidth: 960,
          margin: '0 auto',
        }}
      >
        {sidekicks.map((m) => {
          const selected = value === m.key;
          return (
            <button
              key={m.key}
              onClick={() => {
                onChange(m.key as OnboardingAnswers['mate']);
                onNext();
              }}
              style={{
                background: selected ? m.color + '18' : '#fff',
                border: `3px solid ${INK}`,
                borderRadius: 20,
                boxShadow: selected ? `6px 6px 0 ${INK}` : `4px 4px 0 ${INK}`,
                padding: '18px 14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'all .18s ease',
                position: 'relative',
                transform: selected ? 'translate(-2px,-2px)' : 'translate(0,0)',
              }}
            >
              {selected && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: INK,
                    color: '#fff',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                  }}
                >
                  ✓
                </div>
              )}
              <CharAvatar body={m.color} size={72} face={m.face} />
              <div
                style={{
                  fontFamily: FREDOKA,
                  fontWeight: 700,
                  fontSize: 16,
                  color: INK,
                  marginTop: 8,
                }}
              >
                {m.name}
              </div>
              <div
                style={{
                  fontFamily: FREDOKA,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#fff',
                  background: m.color,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: `2px solid ${INK}`,
                  marginTop: 7,
                }}
              >
                {m.role}
              </div>
              <p
                style={{
                  fontFamily: NUNITO,
                  fontSize: 11.5,
                  color: '#495057',
                  lineHeight: 1.35,
                  margin: '9px 0 0',
                }}
              >
                {m.desc}
              </p>
            </button>
          );
        })}
      </div>
    </StepLayout>
  );
};
