import { trace, context } from '@opentelemetry/api';
import { Axiom } from '@axiomhq/js';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let axiomClient: Axiom | null = null;

function getAxiom(): Axiom | null {
  if (!process.env.AXIOM_TOKEN || !process.env.AXIOM_DATASET) return null;
  if (!axiomClient) {
    axiomClient = new Axiom({ token: process.env.AXIOM_TOKEN });
  }
  return axiomClient;
}

function getMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return env in LOG_LEVELS ? (env as LogLevel) : 'info';
}

function isJsonFormat(): boolean {
  return process.env.LOG_FORMAT === 'json';
}

function formatLine(level: LogLevel, tag: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const upperLevel = level.toUpperCase();
  const msg = args
    .map((a) =>
      a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a),
    )
    .join(' ');

  if (isJsonFormat()) {
    return JSON.stringify({ timestamp, level: upperLevel, tag, message: msg });
  }
  return `[${timestamp}] [${upperLevel}] [${tag}] ${msg}`;
}

export function createLogger(tag: string) {
  const emit = (level: LogLevel, args: unknown[]) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[getMinLevel()]) return;

    const line = formatLine(level, tag, args);

    // OpenTelemetry integration: Add log as an event to the current span
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.addEvent('log', {
        level,
        tag,
        message: args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' '),
      });
    }

    // Axiom ingestion
    const axiom = getAxiom();
    if (axiom) {
      const message = args
        .map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
      axiom.ingest(process.env.AXIOM_DATASET!, [{ level, tag, message, _time: new Date().toISOString() }]);
    }

    // Console output
    const fn =
      level === 'debug'
        ? console.debug
        : level === 'warn'
          ? console.warn
          : level === 'error'
            ? console.error
            : console.log;
    fn(line);
  };

  return {
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
  };
}

// Flush buffered Axiom events before process exits
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    if (axiomClient) await axiomClient.flush();
  });
}
