'use client';

import React, { useEffect, useState } from 'react';
import { INK, FREDOKA, NUNITO, RED, YELLOW } from '../_lib/tokens';
import { OnboardBg } from './primitives';
import { setPendingIntroPayload } from '@/lib/classroom/pending-intro';
import type { DemoCourse } from '../_lib/demo-courses';
import { ClassroomLoader } from '@/components/classroom/classroom-loader';

export function ClassroomPreview({
  course,
  onContinue,
}: {
  course: DemoCourse;
  onContinue: () => void;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    setPendingIntroPayload({
      stageId: course.classroomId,
      name: course.title,
      description: course.description,
      language: 'en-US',
    });
    setIframeLoaded(false);
  }, [course]);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '48px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <OnboardBg variant="cool" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1180,
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: RED,
              marginBottom: 10,
            }}
          >
            Your classroom is live
          </div>
          <h1
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 'clamp(28px, 4.5vw, 44px)',
              color: INK,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Step inside{' '}
            <span
              style={{
                background: YELLOW,
                padding: '0 12px',
                border: `3px solid ${INK}`,
                borderRadius: 12,
                boxShadow: `3px 3px 0 ${INK}`,
                display: 'inline-block',
                transform: 'rotate(-1deg)',
              }}
            >
              {course.title}
            </span>
          </h1>
          <p
            style={{
              fontFamily: NUNITO,
              fontSize: 15,
              fontWeight: 600,
              color: '#495057',
              maxWidth: 560,
              margin: '14px auto 0',
              lineHeight: 1.5,
            }}
          >
            Take a quick look around. This is the real thing, just embedded here. Continue to lock
            in your plan and open it full screen.
          </p>
        </div>

        {/* iframe frame */}
        <div
          style={{
            background: '#fff',
            border: `3px solid ${INK}`,
            borderRadius: 24,
            boxShadow: `8px 8px 0 ${INK}`,
            overflow: 'hidden',
          }}
        >
          {/* Fake chrome */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: `2px solid ${INK}15`,
              background: '#FAFBFC',
            }}
          >
            <span style={dot('#FF5F57')} />
            <span style={dot('#FEBC2E')} />
            <span style={dot('#28C840')} />
            <div
              style={{
                marginLeft: 10,
                fontFamily: NUNITO,
                fontWeight: 700,
                fontSize: 12,
                color: '#6B7B85',
                background: '#fff',
                border: `1.5px solid ${INK}15`,
                borderRadius: 999,
                padding: '3px 14px',
              }}
            >
              slate.app/classroom/{course.classroomId}
            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', height: 640 }}>
            <iframe
              src={`/classroom/${course.classroomId}?embed=1`}
              title={course.title}
              onLoad={() => setIframeLoaded(true)}
              style={{
                width: '100%',
                height: '100%',
                border: 0,
                display: 'block',
                background: '#FDFDFD',
              }}
              allow="autoplay; microphone; camera"
            />
            {!iframeLoaded && (
              <ClassroomLoader
                variant="embed"
                label="Opening your classroom"
                hint="Loading slides, agents, and narration…"
              />
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 28,
          }}
        >
          <button
            onClick={onContinue}
            style={{
              background: RED,
              color: '#fff',
              border: `3px solid ${INK}`,
              boxShadow: `5px 5px 0 ${INK}`,
              borderRadius: 18,
              padding: '16px 32px',
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 17,
              cursor: 'pointer',
            }}
          >
            Looks great, let&apos;s go →
          </button>
        </div>
      </div>
    </div>
  );
}

function dot(color: string): React.CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: color,
    border: `1.5px solid ${INK}20`,
    display: 'inline-block',
  };
}
