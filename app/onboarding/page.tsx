'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressBar } from './_components/primitives';
import {
  Step1Welcome,
  Step2Name,
  Step3Goal,
  Step4Source,
  Step5Level,
  Step6Interests,
  Step7Style,
  Step8Time,
  Step9Mate,
} from './_components/steps-early';
import { Step10DemoPick, Step11Pricing } from './_components/steps-final';
import { GenerationLoader } from './_components/generation-loader';
import { ClassroomPreview } from './_components/classroom-preview';
import { WelcomeScreen } from './_components/welcome-screen';
import { getDemoCourse } from './_lib/demo-courses';
import type { OnboardingAnswers } from './_lib/tokens';

const STORAGE_KEY = 'slate_onboarding';
const TOTAL_STEPS = 14;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({ interests: [] });
  const [customAdded, setCustomAdded] = useState<{ key: string; label: string }[]>([]);

  const patch = useCallback(
    (p: Partial<OnboardingAnswers>) =>
      setAnswers((a) => {
        const next = { ...a, ...p };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      }),
    [],
  );

  const go = (n: number) => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    setStep(n);
  };
  const next = () => go(Math.min(step + 1, TOTAL_STEPS - 1));
  const back = () => go(Math.max(step - 1, 0));

  const persistProfile = useCallback(async (payload: OnboardingAnswers & { customInterests?: unknown }) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...payload, completedAt: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      /* ignore network errors, we keep the localStorage copy */
    }
  }, []);

  // After DemoPick, we persist and slide into the generation loader.
  // Loader -> ClassroomPreview -> Pricing -> WelcomeScreen -> full classroom.
  const onDemoPicked = useCallback(
    (v: OnboardingAnswers['demoPick']) => {
      patch({ demoPick: v });
      persistProfile({ ...answers, demoPick: v, customInterests: customAdded });
      go(10); // generation loader
    },
    [answers, customAdded, patch, persistProfile],
  );

  // Loader done -> classroom preview step.
  const showPreview = useCallback(() => go(11), []);
  // Preview continue -> pricing step.
  const showPricing = useCallback(() => go(12), []);
  // Free-path done on pricing -> welcome.
  const showWelcome = useCallback(() => go(13), []);

  // Called from the Welcome screen (button or auto-redirect).
  // Take the user straight into the classroom they picked during onboarding —
  // landing on the dashboard root left the just-set-up classroom feeling lost
  // for first-time users (NEW-006). Fall back to `/` only if we somehow have
  // no demo selection (shouldn't happen — step 9 is required to advance).
  const goHome = useCallback(() => {
    const picked = answers.demoPick;
    const classroomId = picked ? getDemoCourse(picked)?.classroomId : undefined;
    router.push(classroomId ? `/classroom/${classroomId}` : '/');
  }, [router, answers.demoPick]);

  return (
    <>
      <style jsx global>{`
        @keyframes obRise {
          from { transform: translateY(14px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes obFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes obFloat {
          0%, 100% { transform: translateY(0)    rotate(0deg); }
          50%      { transform: translateY(-14px) rotate(6deg); }
        }
        @keyframes obFloatR {
          0%, 100% { transform: translateY(0)    rotate(0deg); }
          50%      { transform: translateY(-10px) rotate(-8deg); }
        }
        body { background: #FDFDFD; }
      `}</style>

      {step > 0 && step < 10 && (
        <ProgressBar step={step} total={9} onBack={back} />
      )}

      {step === 0 && <Step1Welcome onNext={next} />}
      {step === 1 && (
        <Step2Name value={answers.name} onChange={(v) => patch({ name: v })} onNext={next} />
      )}
      {step === 2 && (
        <Step3Goal
          value={answers.goal}
          name={answers.name}
          onChange={(v) => patch({ goal: v })}
          onNext={next}
        />
      )}
      {step === 3 && (
        <Step4Source value={answers.source} onChange={(v) => patch({ source: v })} onNext={next} />
      )}
      {step === 4 && (
        <Step5Level value={answers.level} onChange={(v) => patch({ level: v })} onNext={next} />
      )}
      {step === 5 && (
        <Step6Interests
          value={answers.interests}
          onChange={(v) => patch({ interests: v })}
          customAdded={customAdded}
          setCustomAdded={setCustomAdded}
          onNext={next}
        />
      )}
      {step === 6 && (
        <Step7Style value={answers.style} onChange={(v) => patch({ style: v })} onNext={next} />
      )}
      {step === 7 && (
        <Step8Time value={answers.time} onChange={(v) => patch({ time: v })} onNext={next} />
      )}
      {step === 8 && (
        <Step9Mate value={answers.mate} onChange={(v) => patch({ mate: v })} onNext={next} />
      )}
      {step === 9 && (
        <Step10DemoPick
          value={answers.demoPick}
          name={answers.name}
          onChange={onDemoPicked}
          onNext={() => { /* auto-advanced via onDemoPicked */ }}
        />
      )}
      {step === 10 && answers.demoPick && (
        <GenerationLoader
          course={getDemoCourse(answers.demoPick)!}
          onDone={showPreview}
        />
      )}
      {step === 11 && answers.demoPick && (
        <ClassroomPreview
          course={getDemoCourse(answers.demoPick)!}
          onContinue={showPricing}
        />
      )}
      {step === 12 && <Step11Pricing answers={answers} onFree={showWelcome} />}
      {step === 13 && (
        <WelcomeScreen
          course={answers.demoPick ? getDemoCourse(answers.demoPick) : undefined}
          name={answers.name}
          onEnter={goHome}
        />
      )}
    </>
  );
}
