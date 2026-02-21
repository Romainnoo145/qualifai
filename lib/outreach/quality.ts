export type OutreachQualityStatus = 'ready' | 'review' | 'blocked';

export type OutreachPriorityTier = 'P1' | 'P2' | 'P3' | 'P4';

export interface EmailQualityAssessment {
  normalizedEmail: string | null;
  status: OutreachQualityStatus;
  reasons: string[];
  isRoleAddress: boolean;
}

export interface ContactPriorityAssessment {
  score: number;
  tier: OutreachPriorityTier;
  completeness: number;
  status: OutreachQualityStatus;
  reasons: string[];
  email: EmailQualityAssessment;
}

export interface OutreachContactInput {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  seniority?: string | null;
  department?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  linkedinUrl?: string | null;
  outreachStatus?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BLOCKED_LOCAL_PARTS = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
]);

const ROLE_LOCAL_PARTS = new Set([
  'info',
  'hello',
  'sales',
  'support',
  'contact',
  'team',
  'office',
  'admin',
  'billing',
  'finance',
  'hr',
  'careers',
  'jobs',
  'marketing',
  'operations',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'yopmail.com',
  '10minutemail.com',
  'temp-mail.org',
  'trashmail.com',
]);

const TEST_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'invalid',
  'localhost',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function roleAddress(localPart: string): boolean {
  const base = localPart.split('+')[0] ?? localPart;
  return ROLE_LOCAL_PARTS.has(base);
}

function blockedAddress(localPart: string): boolean {
  const base = localPart.split('+')[0] ?? localPart;
  return (
    BLOCKED_LOCAL_PARTS.has(base) ||
    base.includes('no-reply') ||
    base.includes('noreply') ||
    base.includes('do-not-reply') ||
    base.includes('donotreply')
  );
}

function looksLikeTestAddress(email: string, domain: string): boolean {
  if (TEST_DOMAINS.has(domain)) return true;
  return (
    email.includes('test@') ||
    email.includes('fake@') ||
    email.includes('dummy@') ||
    email.includes('sample@')
  );
}

function seniorityScore(raw: string | null | undefined): number {
  const seniority = (raw ?? '').toLowerCase();
  if (!seniority) return 0;
  if (
    seniority.includes('c-level') ||
    seniority.includes('c suite') ||
    seniority.includes('c-suite') ||
    seniority.includes('directie') ||
    seniority.includes('bestuur') ||
    seniority.includes('executive') ||
    seniority.includes('executief') ||
    seniority.includes('founder') ||
    seniority.includes('owner') ||
    seniority.includes('eigenaar') ||
    seniority.includes('dga')
  ) {
    return 30;
  }
  if (
    seniority.includes('vp') ||
    seniority.includes('vice president') ||
    seniority.includes('partner')
  ) {
    return 24;
  }
  if (
    seniority.includes('director') ||
    seniority.includes('head') ||
    seniority.includes('hoofd')
  ) {
    return 18;
  }
  if (seniority.includes('manager')) return 12;
  if (seniority.includes('senior')) return 8;
  if (seniority.includes('entry') || seniority.includes('intern')) return -10;
  return 4;
}

function titleScore(raw: string | null | undefined): number {
  const title = (raw ?? '').toLowerCase();
  if (!title) return 0;
  if (
    title.includes('chief') ||
    title.includes('ceo') ||
    title.includes('coo') ||
    title.includes('cto') ||
    title.includes('cfo') ||
    title.includes('founder') ||
    title.includes('owner') ||
    title.includes('managing director') ||
    title.includes('directeur') ||
    title.includes('algemeen directeur') ||
    title.includes('operationeel directeur') ||
    title.includes('eigenaar') ||
    title.includes('dga')
  ) {
    return 24;
  }
  if (
    title.includes('vp') ||
    title.includes('director') ||
    title.includes('head of') ||
    title.includes('hoofd') ||
    title.includes('bedrijfsleider')
  ) {
    return 18;
  }
  if (
    title.includes('manager') ||
    title.includes('lead') ||
    title.includes('projectleider') ||
    title.includes('werkvoorbereider') ||
    title.includes('planner') ||
    title.includes('service co') ||
    title.includes('operations')
  ) {
    return 12;
  }
  if (
    title.includes('assistant') ||
    title.includes('coordinator') ||
    title.includes('intern') ||
    title.includes('junior')
  ) {
    return -8;
  }
  return 4;
}

function departmentScore(raw: string | null | undefined): number {
  const department = (raw ?? '').toLowerCase();
  if (!department) return 0;
  if (
    department.includes('operations') ||
    department.includes('op') ||
    department.includes('supply') ||
    department.includes('uitvoering')
  ) {
    return 10;
  }
  if (
    department.includes('planning') ||
    department.includes('service') ||
    department.includes('klantenservice') ||
    department.includes('werkvoorbereiding') ||
    department.includes('support')
  ) {
    return -10;
  }
  if (
    department.includes('engineering') ||
    department.includes('product') ||
    department.includes('it') ||
    department.includes('technology')
  ) {
    return 12;
  }
  if (department.includes('finance') || department.includes('revenue'))
    return 10;
  if (department.includes('sales') || department.includes('marketing'))
    return 8;
  if (department.includes('directie') || department.includes('management')) {
    return 12;
  }
  if (department.includes('hr') || department.includes('legal')) return 4;
  return 2;
}

function hasDecisionAuthority(contact: OutreachContactInput): boolean {
  const seniority = (contact.seniority ?? '').toLowerCase();
  const title = (contact.jobTitle ?? '').toLowerCase();
  const department = (contact.department ?? '').toLowerCase();
  const joined = `${seniority} ${title} ${department}`;
  return (
    joined.includes('c-level') ||
    joined.includes('c suite') ||
    joined.includes('c-suite') ||
    joined.includes('ceo') ||
    joined.includes('coo') ||
    joined.includes('cto') ||
    joined.includes('cfo') ||
    joined.includes('chief') ||
    joined.includes('founder') ||
    joined.includes('owner') ||
    joined.includes('eigenaar') ||
    joined.includes('dga') ||
    joined.includes('directeur') ||
    joined.includes('directie') ||
    joined.includes('managing director') ||
    joined.includes('bestuur') ||
    joined.includes('executive') ||
    joined.includes('executief') ||
    joined.includes('vp') ||
    joined.includes('vice president') ||
    joined.includes('head') ||
    joined.includes('hoofd') ||
    joined.includes('partner')
  );
}

function isPlanningOrServiceRole(contact: OutreachContactInput): boolean {
  const title = (contact.jobTitle ?? '').toLowerCase();
  const department = (contact.department ?? '').toLowerCase();
  const seniority = (contact.seniority ?? '').toLowerCase();
  const joined = `${title} ${department} ${seniority}`;
  return (
    joined.includes('planning') ||
    joined.includes('planner') ||
    joined.includes('werkvoorbereider') ||
    joined.includes('service') ||
    joined.includes('klantenservice') ||
    joined.includes('support') ||
    joined.includes('receptie') ||
    joined.includes('frontdesk')
  );
}

function scoreToTier(score: number): OutreachPriorityTier {
  if (score >= 80) return 'P1';
  if (score >= 60) return 'P2';
  if (score >= 40) return 'P3';
  return 'P4';
}

export function assessEmailForOutreach(
  email: string | null | undefined,
): EmailQualityAssessment {
  if (!email || !email.trim()) {
    return {
      normalizedEmail: null,
      status: 'blocked',
      reasons: ['Missing primary email'],
      isRoleAddress: false,
    };
  }

  const normalized = normalizeEmail(email);
  const reasons: string[] = [];

  if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
    reasons.push('Email format is invalid');
  }

  const [localPartRaw, domainRaw] = normalized.split('@');
  const localPart = localPartRaw ?? '';
  const domain = domainRaw ?? '';

  if (!localPart || !domain || !domain.includes('.')) {
    reasons.push('Email domain is invalid');
  }

  if (domain.startsWith('.') || domain.endsWith('.')) {
    reasons.push('Email domain is malformed');
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    reasons.push('Disposable mailbox detected');
  }

  if (blockedAddress(localPart)) {
    reasons.push('No-reply mailbox detected');
  }

  if (looksLikeTestAddress(normalized, domain)) {
    reasons.push('Test/placeholder mailbox detected');
  }

  const isRole = roleAddress(localPart);
  if (reasons.length > 0) {
    return {
      normalizedEmail: normalized,
      status: 'blocked',
      reasons,
      isRoleAddress: isRole,
    };
  }

  if (isRole) {
    return {
      normalizedEmail: normalized,
      status: 'review',
      reasons: ['Role-based mailbox (manual review advised)'],
      isRoleAddress: true,
    };
  }

  return {
    normalizedEmail: normalized,
    status: 'ready',
    reasons: [],
    isRoleAddress: false,
  };
}

export function scoreContactForOutreach(
  contact: OutreachContactInput,
): ContactPriorityAssessment {
  const email = assessEmailForOutreach(contact.primaryEmail);
  const hardReviewReasons: string[] = [];
  const softReasons: string[] = [];
  const decisionAuthority = hasDecisionAuthority(contact);
  const planningOrServiceRole = isPlanningOrServiceRole(contact);

  const hasName = Boolean(
    (contact.firstName ?? '').trim() || (contact.lastName ?? '').trim(),
  );
  const hasPersonaSignal = Boolean(
    (contact.jobTitle ?? '').trim() ||
    (contact.seniority ?? '').trim() ||
    (contact.department ?? '').trim(),
  );

  if (!hasName) hardReviewReasons.push('Missing contact name');
  if (!hasPersonaSignal) {
    hardReviewReasons.push('Missing role context (title/seniority/department)');
  }
  if (email.status === 'review') {
    hardReviewReasons.push(...email.reasons);
  }
  if (!decisionAuthority) {
    hardReviewReasons.push('No clear decision authority signal');
  }
  if (planningOrServiceRole && !decisionAuthority) {
    hardReviewReasons.push(
      'Operational planning/service role without budget authority',
    );
  }

  if (!contact.jobTitle) softReasons.push('Missing job title');
  if (!contact.seniority) softReasons.push('Missing seniority');
  if (!contact.department) softReasons.push('Missing department');
  if (!contact.linkedinUrl) softReasons.push('Missing LinkedIn URL');
  if (!contact.primaryPhone) softReasons.push('Missing primary phone');
  if (!contact.lastName) softReasons.push('Missing last name');

  if (contact.outreachStatus === 'REPLIED') {
    softReasons.push('Already replied recently');
  }
  if (contact.outreachStatus === 'CONVERTED') {
    softReasons.push('Already converted');
  }
  if (contact.outreachStatus === 'OPTED_OUT') {
    hardReviewReasons.push('Contact opted out');
  }

  const completenessFields = [
    contact.jobTitle,
    contact.seniority,
    contact.department,
    email.normalizedEmail,
    contact.primaryPhone,
    contact.linkedinUrl,
  ];
  const present = completenessFields.filter((value) => Boolean(value)).length;
  const completeness = present / completenessFields.length;

  let score = 20;
  score += seniorityScore(contact.seniority);
  score += titleScore(contact.jobTitle);
  score += departmentScore(contact.department);
  score += Math.round(completeness * 20);

  if (hasName) score += 5;
  if (hasPersonaSignal) score += 10;
  else score -= 15;
  if (!contact.primaryPhone) score -= 4;
  if (!contact.linkedinUrl) score -= 2;
  if (decisionAuthority) score += 16;
  else score -= 22;
  if (planningOrServiceRole && !decisionAuthority) score -= 18;

  if (email.status === 'ready') score += 14;
  if (email.status === 'review') score += 5;
  if (email.status === 'blocked') score -= 45;

  if (contact.outreachStatus === 'EMAIL_SENT') {
    score -= 4;
  }
  if (
    contact.outreachStatus === 'REPLIED' ||
    contact.outreachStatus === 'CONVERTED'
  ) {
    score -= 10;
  }
  if (contact.outreachStatus === 'OPTED_OUT') {
    score = -100;
  }

  let status: OutreachQualityStatus = 'ready';
  if (email.status === 'blocked' || contact.outreachStatus === 'OPTED_OUT') {
    status = 'blocked';
  } else if (hardReviewReasons.length > 0) {
    status = 'review';
  }

  const combinedReasons = Array.from(
    new Set([
      ...(status === 'blocked' ? email.reasons : []),
      ...hardReviewReasons,
      ...softReasons,
    ]),
  );
  const normalizedScore = clamp(score, -100, 100);

  return {
    score: normalizedScore,
    tier: scoreToTier(normalizedScore),
    completeness: clamp(Math.round(completeness * 100) / 100, 0, 1),
    status,
    reasons: combinedReasons,
    email,
  };
}
