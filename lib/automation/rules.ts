import type { SignalType } from '@prisma/client';

export interface AutomationRule {
  id: string;
  name: string;
  trigger: {
    signalType: SignalType;
    seniorityFilter?: string[];
  };
  action: 'DRAFT_EMAIL' | 'DISCOVER_CONTACTS';
  emailType?: 'INTRO_EMAIL' | 'SIGNAL_TRIGGERED';
  description: string;
}

// Rules defined in code — single-user system, no need for DB-based rules
export const AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'job-change-clevel',
    name: 'C-Level Job Change',
    trigger: {
      signalType: 'JOB_CHANGE',
      seniorityFilter: ['C-Level', 'VP'],
    },
    action: 'DRAFT_EMAIL',
    emailType: 'SIGNAL_TRIGGERED',
    description:
      'When a C-Level or VP contact changes jobs, draft a congratulatory email',
  },
  {
    id: 'promotion',
    name: 'Promotion Detected',
    trigger: {
      signalType: 'PROMOTION',
      seniorityFilter: ['C-Level', 'VP', 'Director'],
    },
    action: 'DRAFT_EMAIL',
    emailType: 'SIGNAL_TRIGGERED',
    description:
      'When a senior contact is promoted, draft a congratulatory email',
  },
  {
    id: 'funding-event',
    name: 'Funding Event',
    trigger: {
      signalType: 'FUNDING_EVENT',
    },
    action: 'DISCOVER_CONTACTS',
    description:
      'When a company receives funding, discover contacts and queue intro emails',
  },
  {
    id: 'headcount-growth',
    name: 'Headcount Growth',
    trigger: {
      signalType: 'HEADCOUNT_GROWTH',
    },
    action: 'DRAFT_EMAIL',
    emailType: 'INTRO_EMAIL',
    description:
      'When a company is growing headcount, draft an intro email about AI automation',
  },
];

export function findMatchingRules(
  signalType: SignalType,
  contactSeniority?: string | null,
): AutomationRule[] {
  return AUTOMATION_RULES.filter((rule) => {
    if (rule.trigger.signalType !== signalType) return false;
    if (rule.trigger.seniorityFilter && contactSeniority) {
      return rule.trigger.seniorityFilter.includes(contactSeniority);
    }
    // If no seniority filter on rule, it matches all
    if (!rule.trigger.seniorityFilter) return true;
    return false;
  });
}
