export type ReplyIntent =
  | 'interested'
  | 'later'
  | 'not_fit'
  | 'stop'
  | 'unknown';

export interface ReplyTriageResult {
  intent: ReplyIntent;
  confidence: number;
  reasons: string[];
  suggestedAction:
    | 'book_teardown'
    | 'follow_up_later'
    | 'close_lost'
    | 'suppress_contact'
    | 'manual_review';
  deferDays?: number;
}

const STOP_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bstop\b/i,
  /\bdo not contact\b/i,
  /\bdon't contact\b/i,
  /\bremove me\b/i,
  /\blaat me met rust\b/i,
  /\bverwijder mij\b/i,
  /\bniet meer mailen\b/i,
  /\bgeen e-mails?\b/i,
];

const NOT_FIT_PATTERNS = [
  /\bgeen budget\b/i,
  /\bnot (a )?fit\b/i,
  /\bnot relevant\b/i,
  /\bal opgelost\b/i,
  /\balready (have|solved)\b/i,
  /\bgeen prioriteit\b/i,
  /\bwe doen dit intern\b/i,
  /\bno budget\b/i,
  /\bnot interested\b/i,
];

const LATER_PATTERNS = [
  /\blater\b/i,
  /\bvolgende maand\b/i,
  /\bover \d+ (weken|week|maanden|maand)\b/i,
  /\bna de zomer\b/i,
  /\bnu geen tijd\b/i,
  /\bnu niet\b/i,
  /\bremind me\b/i,
  /\bfollow up (later|next month)\b/i,
  /\bkom hier later op terug\b/i,
];

const INTERESTED_PATTERNS = [
  /\bgeinteresseerd\b/i,
  /\binteresse\b/i,
  /\bklinkt goed\b/i,
  /\blaten we\b/i,
  /\bplan\b/i,
  /\bgesprek\b/i,
  /\bdemo\b/i,
  /\bcall\b/i,
  /\bteardown\b/i,
  /\bwhen can we\b/i,
  /\blet'?s (book|talk|do)\b/i,
  /\byes\b/i,
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countMatches(text: string, patterns: RegExp[]): number {
  let matches = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) matches += 1;
  }
  return matches;
}

function inferDeferDays(text: string): number | undefined {
  if (/\bvolgende maand\b/i.test(text) || /\bnext month\b/i.test(text))
    return 30;
  if (/\bna de zomer\b/i.test(text)) return 60;
  const weekMatch = text.match(/\bover (\d+) week/i);
  if (weekMatch?.[1]) {
    const weeks = Number(weekMatch[1]);
    if (Number.isFinite(weeks) && weeks > 0) return weeks * 7;
  }
  const monthMatch = text.match(/\bover (\d+) maand/i);
  if (monthMatch?.[1]) {
    const months = Number(monthMatch[1]);
    if (Number.isFinite(months) && months > 0) return months * 30;
  }
  return 14;
}

export function triageReplyText(input: {
  subject?: string | null;
  bodyText?: string | null;
}): ReplyTriageResult {
  const subject = normalizeText(input.subject ?? '');
  const body = normalizeText(input.bodyText ?? '');
  const text = `${subject} ${body}`.trim();

  if (!text) {
    return {
      intent: 'unknown',
      confidence: 0.3,
      reasons: ['Empty reply body'],
      suggestedAction: 'manual_review',
    };
  }

  const stopHits = countMatches(text, STOP_PATTERNS);
  const notFitHits = countMatches(text, NOT_FIT_PATTERNS);
  const laterHits = countMatches(text, LATER_PATTERNS);
  const interestedHits = countMatches(text, INTERESTED_PATTERNS);

  if (stopHits > 0) {
    return {
      intent: 'stop',
      confidence: Math.min(0.75 + stopHits * 0.08, 0.98),
      reasons: ['Detected unsubscribe / do-not-contact language'],
      suggestedAction: 'suppress_contact',
    };
  }

  if (notFitHits > 0 && interestedHits === 0) {
    return {
      intent: 'not_fit',
      confidence: Math.min(0.7 + notFitHits * 0.08, 0.95),
      reasons: ['Detected no-fit / no-budget language'],
      suggestedAction: 'close_lost',
    };
  }

  if (laterHits > 0) {
    return {
      intent: 'later',
      confidence: Math.min(0.68 + laterHits * 0.08, 0.94),
      reasons: ['Detected postpone language'],
      suggestedAction: 'follow_up_later',
      deferDays: inferDeferDays(text),
    };
  }

  if (interestedHits > 0) {
    return {
      intent: 'interested',
      confidence: Math.min(0.66 + interestedHits * 0.07, 0.93),
      reasons: ['Detected positive interest language'],
      suggestedAction: 'book_teardown',
    };
  }

  return {
    intent: 'unknown',
    confidence: 0.45,
    reasons: ['No clear intent markers found'],
    suggestedAction: 'manual_review',
  };
}
