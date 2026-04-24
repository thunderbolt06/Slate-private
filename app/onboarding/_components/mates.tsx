import React from 'react';
import { BLUE, GREEN, PURPLE, RED, ORANGE, INK } from '../_lib/tokens';

export interface Mate {
  key: 'teacher' | 'notes' | 'deep' | 'funny' | 'curious';
  name: string;
  role: string;
  color: string;
  alwaysIn?: boolean;
  desc: string;
  quote: string;
  face: React.ReactNode;
}

export const MATES: Mate[] = [
  {
    key: 'teacher',
    name: 'Professor Sage',
    role: 'The Teacher',
    color: BLUE,
    alwaysIn: true,
    desc: 'Guides your journey with expert knowledge and clear narration.',
    quote: "I'll explain the big picture, then zoom in where it matters.",
    face: (
      <g>
        <ellipse cx="65" cy="27" rx="30" ry="5" fill="#073B4C" />
        <rect x="48" y="16" width="34" height="13" rx="1" fill="#073B4C" />
        <circle cx="55" cy="50" r="8" fill="none" stroke="#073B4C" strokeWidth="2.5" />
        <circle cx="75" cy="50" r="8" fill="none" stroke="#073B4C" strokeWidth="2.5" />
        <line x1="63" y1="50" x2="67" y2="50" stroke="#073B4C" strokeWidth="2" />
        <circle cx="55" cy="50" r="3" fill="#073B4C" />
        <circle cx="75" cy="50" r="3" fill="#073B4C" />
        <path d="M 56 64 Q 65 72 74 64" fill="none" stroke="#073B4C" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    ),
  },
  {
    key: 'notes',
    name: 'Note Taker',
    role: 'The Recorder',
    color: GREEN,
    desc: 'Captures every key point so you never miss a thing.',
    quote: "Noted. I'll drop a summary in your inbox after class.",
    face: (
      <g>
        <path d="M 39 44 Q 40 22 65 25 Q 90 22 91 44" fill="#5D4037" />
        <line x1="88" y1="32" x2="100" y2="20" stroke="#FFD166" strokeWidth="3.5" strokeLinecap="round" />
        <polygon points="100,20 104,15 97,17" fill="#EF476F" />
        <ellipse cx="55" cy="50" rx="4" ry="3.5" fill="#073B4C" />
        <ellipse cx="75" cy="50" rx="4" ry="3.5" fill="#073B4C" />
        <path d="M 57 63 L 73 63" stroke="#073B4C" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    ),
  },
  {
    key: 'deep',
    name: 'Deep Thinker',
    role: 'The Philosopher',
    color: PURPLE,
    desc: 'Asks the tough questions and digs into the why.',
    quote: "But… why does it actually work that way? Let's go deeper.",
    face: (
      <g>
        <path d="M 39 48 Q 37 22 58 18 Q 78 15 86 24 Q 92 32 91 48" fill="#2D1B69" />
        <circle cx="96" cy="28" r="4" fill="#fff" stroke={INK} />
        <circle cx="105" cy="18" r="6" fill="#fff" stroke={INK} />
        <circle cx="115" cy="8" r="8" fill="#fff" stroke={INK} />
        <circle cx="55" cy="50" r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="75" cy="50" r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="56" cy="48" r="2" fill={INK} />
        <circle cx="76" cy="48" r="2" fill={INK} />
      </g>
    ),
  },
  {
    key: 'funny',
    name: 'Class Clown',
    role: 'The Joker',
    color: RED,
    desc: 'Keeps it light with jokes, memes, and clever asides.',
    quote: 'Calculus? More like calc-you-LOVE this stuff, right? …Right?',
    face: (
      <g>
        <path d="M 44 38 L 47 18 L 54 32 L 60 14 L 65 30 L 70 12 L 76 32 L 83 18 L 86 38" fill="#FF6B35" />
        <path d="M 49 48 Q 54 43 59 48" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 71 48 Q 76 43 81 48" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 52 62 Q 65 76 78 62" fill="#fff" stroke={INK} strokeWidth="2.5" />
      </g>
    ),
  },
  {
    key: 'curious',
    name: 'Curious Mind',
    role: 'The Explorer',
    color: ORANGE,
    desc: "Always asking 'what if' and 'how about…' to spark new angles.",
    quote: 'Wait, does this also apply to…? Oooh, good question.',
    face: (
      <g>
        <path d="M 42 38 Q 44 18 65 16 Q 86 18 88 38" fill="#D35400" />
        <circle cx="53" cy="48" r="6" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="77" cy="48" r="6" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="54" cy="46" r="2.5" fill={INK} />
        <circle cx="78" cy="46" r="2.5" fill={INK} />
        <circle cx="65" cy="62" r="3.5" fill={INK} />
        <text x="96" y="22" fontFamily="Fredoka" fontSize="22" fontWeight="bold" fill="#FF6B35" stroke={INK}>?</text>
      </g>
    ),
  },
];

export const CharAvatar = ({
  body = BLUE,
  size = 110,
  face,
}: {
  body?: string;
  size?: number;
  face?: React.ReactNode;
}) => {
  const w = size;
  const h = (size * 140) / 130;
  return (
    <svg width={w} height={h} viewBox="0 0 130 140">
      <ellipse cx="65" cy="105" rx="38" ry="30" fill={body} stroke={INK} strokeWidth="3.5" />
      <circle cx="65" cy="52" r="28" fill="#FFF0DB" stroke={INK} strokeWidth="3.5" />
      {face}
    </svg>
  );
};
