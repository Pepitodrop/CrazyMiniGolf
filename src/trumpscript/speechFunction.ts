export interface TrumpSpeechInput {
  strokes: number;
  par: number;
}

export interface TrumpSpeechFunction {
  id: string;
  invoke(input: TrumpSpeechInput): string;
}

const FUNCTION_PATTERN =
  /^MAKE\s+FUNCTION\s+([a-z0-9-]+)\s+GREAT\s+AGAIN\s+WITH\s+STROKES\s+AND\s+PAR\s+SAY\s+"([^"]+)"$/u;
const PLACEHOLDER_PATTERN = /\{([A-Z_]+)\}/gu;
const ALLOWED_PLACEHOLDERS = new Set([
  'STROKES',
  'PAR',
  'MARGIN',
  'RESULT',
  'TREMENDOUS_NUMBER',
]);

function assertScore(value: number, label: string, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > 9999) {
    throw new RangeError(`${label} must be an integer from ${minimum} to 9999.`);
  }
}

function describeResult(strokes: number, par: number): string {
  if (strokes < par) return 'a landslide victory, possibly the biggest victory in mini golf';
  if (strokes === par) return 'a tie, which everybody who understands deals knows is basically a victory';
  return 'a temporary negotiation with the course, because the course was frankly very unfair';
}

export function calculateTremendousNumber(strokes: number, par: number): number {
  const margin = par - strokes;
  const victoryBonus = strokes <= par ? 2024 : 45;
  return Math.abs(strokes * 45 + par * 7 + margin * margin * 11 + victoryBonus) % 1000;
}

export function createTrumpSpeechFunction(source: string): TrumpSpeechFunction {
  const statements = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (statements.length !== 1) {
    throw new Error('A TrumpScript speech function file must contain exactly one function statement.');
  }

  const match = FUNCTION_PATTERN.exec(statements[0] ?? '');
  if (!match) {
    throw new Error(`Unsupported TrumpScript speech function: ${statements[0] ?? ''}`);
  }

  const id = match[1] ?? '';
  const template = match[2] ?? '';
  for (const placeholder of template.matchAll(PLACEHOLDER_PATTERN)) {
    const name = placeholder[1] ?? '';
    if (!ALLOWED_PLACEHOLDERS.has(name)) {
      throw new Error(`Unsupported TrumpScript speech placeholder: ${name}`);
    }
  }

  return {
    id,
    invoke({ strokes, par }): string {
      assertScore(strokes, 'Strokes', 0);
      assertScore(par, 'Par', 1);
      const margin = par - strokes;
      const values: Record<string, string> = {
        STROKES: String(strokes),
        PAR: String(par),
        MARGIN: margin > 0 ? `+${margin}` : String(margin),
        RESULT: describeResult(strokes, par),
        TREMENDOUS_NUMBER: String(calculateTremendousNumber(strokes, par)),
      };
      return template.replace(PLACEHOLDER_PATTERN, (_token, name: string) => values[name] ?? '');
    },
  };
}
