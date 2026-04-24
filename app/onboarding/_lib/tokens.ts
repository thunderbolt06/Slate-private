export const INK = '#073B4C';
export const CREAM = '#FDFDFD';
export const RED = '#EF476F';
export const YELLOW = '#FFD166';
export const BLUE = '#118AB2';
export const GREEN = '#06D6A0';
export const PURPLE = '#8338EC';
export const ORANGE = '#FF6B35';

export const FREDOKA = "var(--font-fredoka), Fredoka, sans-serif";
export const NUNITO = "var(--font-sans), Nunito, sans-serif";

export const PHASES = [
  { steps: [0, 1, 2, 3], label: 'About you', phase: 1 },
  { steps: [4, 5, 6, 7], label: 'Your style', phase: 2 },
  { steps: [8, 9], label: 'Your class', phase: 3 },
  { steps: [10, 11], label: 'Get started', phase: 4 },
] as const;

export const PHASE_TOTAL = PHASES.length;

export const getPhase = (step: number) =>
  PHASES.find((p) => (p.steps as readonly number[]).includes(step)) ?? PHASES[PHASES.length - 1];

export interface OnboardingAnswers {
  name?: string;
  goal?: 'student' | 'upskill' | 'career' | 'curious' | 'teach' | 'other';
  source?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  interests: string[];
  customInterests?: { key: string; label: string }[];
  style?: 'visual' | 'audio' | 'reading' | 'hands';
  time?: 5 | 15 | 30 | 60;
  mate?: 'notes' | 'deep' | 'funny' | 'curious';
  demoPick?: DemoTopicKey;
}

export type DemoTopicKey = 'llm' | 'rome' | 'habits' | 'money' | 'cook' | 'space';

export const DEMO_TOPIC_LABELS: Record<DemoTopicKey, string> = {
  llm: 'How AI Actually Thinks',
  rome: 'Why Empires Rise and Fall',
  habits: 'The Science of Building Habits',
  money: 'Money Basics Nobody Taught You',
  cook: 'Cook Five Things Really Well',
  space: 'Is There Life Out There?',
};
