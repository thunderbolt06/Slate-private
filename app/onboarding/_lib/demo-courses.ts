import { BLUE, GREEN, PURPLE, RED, ORANGE, YELLOW } from './tokens';
import type { DemoTopicKey } from './tokens';

export interface DemoCourse {
  key: DemoTopicKey;
  classroomId: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  subject: string;
  minutes: number;
  lessons: number;
}

export const DEMO_COURSES: DemoCourse[] = [
  {
    key: 'llm',
    classroomId: 'hzvZVAqHML',
    title: 'How AI Actually Thinks',
    description: 'From tokens to transformers. Understand what really happens when you chat with an LLM.',
    emoji: '🧠',
    color: PURPLE,
    subject: 'Technology',
    minutes: 18,
    lessons: 6,
  },
  {
    key: 'rome',
    classroomId: 'nUdmcfleoS',
    title: 'Why Empires Rise and Fall',
    description: 'A whirlwind tour through Rome. The moments that made it, and the ones that broke it.',
    emoji: '🏛️',
    color: ORANGE,
    subject: 'History',
    minutes: 22,
    lessons: 7,
  },
  {
    key: 'habits',
    classroomId: 'fHJKrhdF5r',
    title: 'The Science of Building Habits',
    description: 'Cue, craving, response, reward. The loop your brain runs, and how to hack it.',
    emoji: '🔥',
    color: RED,
    subject: 'Psychology',
    minutes: 15,
    lessons: 5,
  },
  {
    key: 'money',
    classroomId: 'jjDk0LGZWu',
    title: 'Money Basics Nobody Taught You',
    description: 'Compound interest, index funds, tax brackets. What you wish you knew at 18.',
    emoji: '💸',
    color: GREEN,
    subject: 'Business',
    minutes: 20,
    lessons: 6,
  },
  {
    key: 'cook',
    classroomId: 'TFe7w5ff24',
    title: 'Cook Five Things Really Well',
    description: 'Master five core techniques. Suddenly every cookbook unlocks, not just the one you bought.',
    emoji: '🍳',
    color: YELLOW,
    subject: 'Art',
    minutes: 24,
    lessons: 5,
  },
  {
    key: 'space',
    classroomId: 'Lh7x4lBDGs',
    title: 'Is There Life Out There?',
    description: 'Drake, Fermi, exoplanets, biosignatures. How we actually look, and what we might find.',
    emoji: '🛸',
    color: BLUE,
    subject: 'Science',
    minutes: 19,
    lessons: 6,
  },
];

export const getDemoCourse = (key: DemoTopicKey): DemoCourse | undefined =>
  DEMO_COURSES.find((c) => c.key === key);
