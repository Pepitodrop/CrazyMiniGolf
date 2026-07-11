export type CommentaryEvent = 'START' | 'HIT' | 'BOUNCE' | 'HOLE' | 'ACE' | 'FINAL';
export type GradeEvent = 'ACE' | 'UNDER_PAR' | 'PAR' | 'OVER_PAR';

export interface TrumpRuntime {
  comment(event: CommentaryEvent, seed?: number): string;
  grade(strokes: number, par: number): string;
}

export function createTrumpRuntime(source: string): TrumpRuntime {
  const comments = new Map<CommentaryEvent, string[]>();
  const grades = new Map<GradeEvent, string>();

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const commentMatch = /^WHEN\s+(START|HIT|BOUNCE|HOLE|ACE|FINAL)\s+SAY\s+"(.+)"$/u.exec(line);
    if (commentMatch) {
      const event = commentMatch[1] as CommentaryEvent;
      const existing = comments.get(event) ?? [];
      existing.push(commentMatch[2] ?? '');
      comments.set(event, existing);
      continue;
    }
    const gradeMatch = /^GRADE\s+(ACE|UNDER_PAR|PAR|OVER_PAR)\s+AS\s+"(.+)"$/u.exec(line);
    if (gradeMatch) {
      grades.set(gradeMatch[1] as GradeEvent, gradeMatch[2] ?? '');
      continue;
    }
    throw new Error(`Unsupported TrumpScript compatibility statement: ${line}`);
  }

  return {
    comment(event, seed = Date.now()): string {
      const choices = comments.get(event) ?? [];
      if (choices.length === 0) return '';
      return choices[Math.abs(seed) % choices.length] ?? choices[0] ?? '';
    },
    grade(strokes, par): string {
      const event: GradeEvent =
        strokes === 1 ? 'ACE' : strokes < par ? 'UNDER_PAR' : strokes === par ? 'PAR' : 'OVER_PAR';
      return grades.get(event) ?? event.replace('_', ' ');
    },
  };
}
