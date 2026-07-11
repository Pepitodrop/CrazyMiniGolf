import { TrumpFeatureController } from './controller';

export type CommentaryEvent = 'START' | 'HIT' | 'BOUNCE' | 'HOLE' | 'ACE' | 'FINAL';
export type GradeEvent = 'ACE' | 'UNDER_PAR' | 'PAR' | 'OVER_PAR';
export type RoundGradeEvent = 'UNDER_PAR' | 'PAR' | 'OVER_PAR';
export type TrumpFeatureKind = 'CHALLENGE' | 'EASTER';

export interface TrumpTheme {
  accent: string;
  secondary: string;
}

export interface TrumpGameplayContext {
  levelId: number;
  strokes: number;
  par: number;
  bounces: number;
  shots: number;
  maxPowerUsed: number;
  lastPower: number;
  diagonalShots: number;
}

export type TrumpCondition =
  | { type: 'ACE' }
  | { type: 'UNDER_PAR' }
  | { type: 'PAR_OR_BETTER' }
  | { type: 'NO_BOUNCE' }
  | { type: 'BOUNCES_AT_LEAST'; value: number }
  | { type: 'STROKES_AT_MOST'; value: number }
  | { type: 'SHOTS_AT_MOST'; value: number }
  | { type: 'MAX_POWER' }
  | { type: 'LAST_POWER'; value: number }
  | { type: 'DIAGONAL_SHOTS_AT_LEAST'; value: number };

export interface TrumpFeature {
  id: string;
  kind: TrumpFeatureKind;
  levelId: number | null;
  title: string;
  conditions: TrumpCondition[];
  points: number;
  message: string;
}

export interface TrumpRuntimeCompletion {
  grade: string;
  awards: TrumpFeature[];
  saved: boolean;
}

export interface TrumpRuntime {
  comment(event: CommentaryEvent, seed?: number): string;
  grade(strokes: number, par: number): string;
  roundTitle(strokes: number, par: number): string;
  startLevel(levelId: number): void;
  recordShot(shot: { strength: number; diagonal: boolean }): void;
  recordBounce(): void;
  completeLevel(levelId: number, strokes: number, par: number): TrumpRuntimeCompletion;
  tip(levelId: number): string;
  theme(levelId: number): TrumpTheme | null;
  challenges(levelId: number): TrumpFeature[];
  evaluate(context: TrumpGameplayContext): TrumpFeature[];
  getFeature(id: string): TrumpFeature | null;
  describe(feature: TrumpFeature): string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9999) {
    throw new Error(`${label} must be an integer from 1 to 9999.`);
  }
  return parsed;
}

function parseCondition(source: string): TrumpCondition {
  if (source === 'ACE') return { type: 'ACE' };
  if (source === 'UNDER_PAR') return { type: 'UNDER_PAR' };
  if (source === 'PAR_OR_BETTER') return { type: 'PAR_OR_BETTER' };
  if (source === 'NO_BOUNCE') return { type: 'NO_BOUNCE' };
  if (source === 'MAX_POWER') return { type: 'MAX_POWER' };

  const numeric =
    /^(BOUNCES_AT_LEAST|STROKES_AT_MOST|SHOTS_AT_MOST|LAST_POWER|DIAGONAL_SHOTS_AT_LEAST)\s+(\d+)$/u.exec(
      source,
    );
  if (!numeric) throw new Error(`Unsupported TrumpScript condition: ${source}`);

  const type = numeric[1] as Exclude<
    TrumpCondition['type'],
    'ACE' | 'UNDER_PAR' | 'PAR_OR_BETTER' | 'NO_BOUNCE' | 'MAX_POWER'
  >;
  return { type, value: parsePositiveInteger(numeric[2] ?? '', type) };
}

function parseConditions(source: string): TrumpCondition[] {
  const conditions = source
    .split(/\s+AND\s+/u)
    .map((condition) => parseCondition(condition.trim()));
  if (conditions.length === 0) throw new Error('A TrumpScript feature needs a condition.');
  return conditions;
}

function conditionMatches(condition: TrumpCondition, context: TrumpGameplayContext): boolean {
  switch (condition.type) {
    case 'ACE':
      return context.strokes === 1;
    case 'UNDER_PAR':
      return context.strokes < context.par;
    case 'PAR_OR_BETTER':
      return context.strokes <= context.par;
    case 'NO_BOUNCE':
      return context.bounces === 0;
    case 'BOUNCES_AT_LEAST':
      return context.bounces >= condition.value;
    case 'STROKES_AT_MOST':
      return context.strokes <= condition.value;
    case 'SHOTS_AT_MOST':
      return context.shots <= condition.value;
    case 'MAX_POWER':
      return context.maxPowerUsed >= 14;
    case 'LAST_POWER':
      return context.lastPower === condition.value;
    case 'DIAGONAL_SHOTS_AT_LEAST':
      return context.diagonalShots >= condition.value;
  }
}

function conditionLabel(condition: TrumpCondition): string {
  switch (condition.type) {
    case 'ACE':
      return 'finish in one stroke';
    case 'UNDER_PAR':
      return 'finish under par';
    case 'PAR_OR_BETTER':
      return 'finish at par or better';
    case 'NO_BOUNCE':
      return 'finish without a bounce';
    case 'BOUNCES_AT_LEAST':
      return `make at least ${condition.value} bounce${condition.value === 1 ? '' : 's'}`;
    case 'STROKES_AT_MOST':
      return `finish in at most ${condition.value} strokes`;
    case 'SHOTS_AT_MOST':
      return `take at most ${condition.value} shots`;
    case 'MAX_POWER':
      return 'use maximum power';
    case 'LAST_POWER':
      return `use power ${condition.value} on the final shot`;
    case 'DIAGONAL_SHOTS_AT_LEAST':
      return `use at least ${condition.value} diagonal shot${condition.value === 1 ? '' : 's'}`;
  }
}

export function createTrumpRuntime(source: string): TrumpRuntime {
  const comments = new Map<CommentaryEvent, string[]>();
  const grades = new Map<GradeEvent, string>();
  const roundTitles = new Map<RoundGradeEvent, string>();
  const tips = new Map<number, string>();
  const themes = new Map<number, TrumpTheme>();
  const features = new Map<string, TrumpFeature>();

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const commentMatch = /^WHEN\s+(START|HIT|BOUNCE|HOLE|ACE|FINAL)\s+SAY\s+"([^"]*)"$/u.exec(line);
    if (commentMatch) {
      const event = commentMatch[1] as CommentaryEvent;
      const existing = comments.get(event) ?? [];
      existing.push(commentMatch[2] ?? '');
      comments.set(event, existing);
      continue;
    }

    const gradeMatch = /^GRADE\s+(ACE|UNDER_PAR|PAR|OVER_PAR)\s+AS\s+"([^"]*)"$/u.exec(line);
    if (gradeMatch) {
      grades.set(gradeMatch[1] as GradeEvent, gradeMatch[2] ?? '');
      continue;
    }

    const roundMatch = /^ROUND\s+(UNDER_PAR|PAR|OVER_PAR)\s+AS\s+"([^"]*)"$/u.exec(line);
    if (roundMatch) {
      roundTitles.set(roundMatch[1] as RoundGradeEvent, roundMatch[2] ?? '');
      continue;
    }

    const tipMatch = /^TIP\s+LEVEL\s+(\d+)\s+SAY\s+"([^"]*)"$/u.exec(line);
    if (tipMatch) {
      const levelId = parsePositiveInteger(tipMatch[1] ?? '', 'Level id');
      tips.set(levelId, tipMatch[2] ?? '');
      continue;
    }

    const themeMatch =
      /^THEME\s+LEVEL\s+(\d+)\s+ACCENT\s+"(#[0-9a-f]{6})"\s+SECONDARY\s+"(#[0-9a-f]{6})"$/iu.exec(
        line,
      );
    if (themeMatch) {
      const levelId = parsePositiveInteger(themeMatch[1] ?? '', 'Level id');
      const accent = themeMatch[2] ?? '';
      const secondary = themeMatch[3] ?? '';
      if (!HEX_COLOR.test(accent) || !HEX_COLOR.test(secondary)) {
        throw new Error(`Invalid TrumpScript theme color: ${line}`);
      }
      themes.set(levelId, { accent, secondary });
      continue;
    }

    const featureMatch =
      /^(CHALLENGE|EASTER)\s+([a-z0-9-]+)\s+LEVEL\s+(ANY|\d+)\s+TITLE\s+"([^"]+)"\s+WHEN\s+(.+?)\s+AWARD\s+(\d+)\s+SAY\s+"([^"]+)"$/u.exec(
        line,
      );
    if (featureMatch) {
      const id = featureMatch[2] ?? '';
      if (features.has(id)) throw new Error(`Duplicate TrumpScript feature id: ${id}`);
      const levelToken = featureMatch[3] ?? 'ANY';
      const feature: TrumpFeature = {
        id,
        kind: featureMatch[1] as TrumpFeatureKind,
        levelId: levelToken === 'ANY' ? null : parsePositiveInteger(levelToken, 'Level id'),
        title: featureMatch[4] ?? '',
        conditions: parseConditions(featureMatch[5] ?? ''),
        points: parsePositiveInteger(featureMatch[6] ?? '', 'Award points'),
        message: featureMatch[7] ?? '',
      };
      features.set(id, feature);
      continue;
    }

    throw new Error(`Unsupported TrumpScript compatibility statement: ${line}`);
  }

  const gradeResult = (strokes: number, par: number): string => {
    const event: GradeEvent =
      strokes === 1 ? 'ACE' : strokes < par ? 'UNDER_PAR' : strokes === par ? 'PAR' : 'OVER_PAR';
    return grades.get(event) ?? event.replace('_', ' ');
  };
  const roundResult = (strokes: number, par: number): string => {
    const event: RoundGradeEvent =
      strokes < par ? 'UNDER_PAR' : strokes === par ? 'PAR' : 'OVER_PAR';
    return roundTitles.get(event) ?? event.replace('_', ' ');
  };
  const levelChallenges = (levelId: number): TrumpFeature[] =>
    [...features.values()].filter(
      (feature) =>
        feature.kind === 'CHALLENGE' && (feature.levelId === null || feature.levelId === levelId),
    );
  const evaluateFeatures = (context: TrumpGameplayContext): TrumpFeature[] =>
    [...features.values()].filter(
      (feature) =>
        (feature.levelId === null || feature.levelId === context.levelId) &&
        feature.conditions.every((condition) => conditionMatches(condition, context)),
    );
  const describeFeature = (feature: TrumpFeature): string =>
    feature.conditions.map(conditionLabel).join(' and ');

  const controller =
    typeof document === 'undefined'
      ? null
      : new TrumpFeatureController({
          tip: (levelId) => tips.get(levelId) ?? '',
          theme: (levelId) => themes.get(levelId) ?? null,
          challenges: levelChallenges,
          evaluate: evaluateFeatures,
          getFeature: (id) => features.get(id) ?? null,
          describe: describeFeature,
        });

  return {
    comment(event, seed = Date.now()): string {
      const choices = comments.get(event) ?? [];
      if (choices.length === 0) return '';
      return choices[Math.abs(seed) % choices.length] ?? choices[0] ?? '';
    },
    grade: gradeResult,
    roundTitle: roundResult,
    startLevel(levelId): void {
      controller?.startLevel(levelId);
    },
    recordShot(shot): void {
      controller?.recordShot(shot);
    },
    recordBounce(): void {
      controller?.recordBounce();
    },
    completeLevel(levelId, strokes, par): TrumpRuntimeCompletion {
      const result = controller?.completeLevel(levelId, strokes, par);
      return {
        grade: gradeResult(strokes, par),
        awards: result?.awards ?? [],
        saved: result?.saved ?? true,
      };
    },
    tip(levelId): string {
      return tips.get(levelId) ?? '';
    },
    theme(levelId): TrumpTheme | null {
      return themes.get(levelId) ?? null;
    },
    challenges: levelChallenges,
    evaluate: evaluateFeatures,
    getFeature(id): TrumpFeature | null {
      return features.get(id) ?? null;
    },
    describe: describeFeature,
  };
}
