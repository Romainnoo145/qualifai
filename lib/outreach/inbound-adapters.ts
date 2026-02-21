export interface NormalizedInboundReply {
  provider: string;
  fromEmail: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  source: string;
  autoTriage: boolean;
  outreachSequenceId?: string;
  metadata: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const casted = asString(value);
    if (casted) return casted;
  }
  return undefined;
}

function extractEmail(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const inBrackets = trimmed.match(/<([^>]+)>/);
    const email = (inBrackets?.[1] ?? trimmed).trim().toLowerCase();
    return email.includes('@') ? email : undefined;
  }

  const record = asRecord(raw);
  if (!record) return undefined;
  return firstString(record.email, record.address);
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCanonical(
  payload: Record<string, unknown>,
): NormalizedInboundReply | null {
  const fromEmail = extractEmail(payload.fromEmail);
  const subject = firstString(payload.subject);
  const bodyText = firstString(payload.bodyText, payload.text);
  const bodyHtml = firstString(payload.bodyHtml, payload.html);
  if (!fromEmail || (!bodyText && !bodyHtml)) return null;

  return {
    provider: 'canonical',
    fromEmail,
    subject,
    bodyText: bodyText ?? stripHtml(bodyHtml ?? ''),
    bodyHtml,
    source: firstString(payload.source) ?? 'inbound-webhook',
    autoTriage: asBoolean(payload.autoTriage) ?? true,
    outreachSequenceId: firstString(payload.outreachSequenceId),
    metadata: {
      adapter: 'canonical',
      ...payload,
    },
  };
}

function normalizeResend(
  payload: Record<string, unknown>,
): NormalizedInboundReply | null {
  const data = asRecord(payload.data) ?? payload;
  const fromEmail = extractEmail(data.from) ?? extractEmail(data.fromEmail);
  const subject = firstString(data.subject);
  const bodyText = firstString(data.text, data.bodyText, data.textBody);
  const bodyHtml = firstString(data.html, data.bodyHtml, data.htmlBody);
  if (!fromEmail || (!bodyText && !bodyHtml)) return null;

  return {
    provider: 'resend',
    fromEmail,
    subject,
    bodyText: bodyText ?? stripHtml(bodyHtml ?? ''),
    bodyHtml,
    source: firstString(data.source, payload.source) ?? 'resend',
    autoTriage: asBoolean(data.autoTriage ?? payload.autoTriage) ?? true,
    outreachSequenceId: firstString(
      data.outreachSequenceId,
      payload.outreachSequenceId,
    ),
    metadata: {
      adapter: 'resend',
      ...payload,
    },
  };
}

function normalizeMailgun(
  payload: Record<string, unknown>,
): NormalizedInboundReply | null {
  const fromEmail = extractEmail(payload.sender) ?? extractEmail(payload.from);
  const subject = firstString(payload.subject);
  const bodyText = firstString(
    payload['body-plain'],
    payload['stripped-text'],
    payload.text,
  );
  const bodyHtml = firstString(
    payload['body-html'],
    payload['stripped-html'],
    payload.html,
  );
  if (!fromEmail || (!bodyText && !bodyHtml)) return null;

  return {
    provider: 'mailgun',
    fromEmail,
    subject,
    bodyText: bodyText ?? stripHtml(bodyHtml ?? ''),
    bodyHtml,
    source: firstString(payload.source) ?? 'mailgun',
    autoTriage: asBoolean(payload.autoTriage) ?? true,
    outreachSequenceId: firstString(
      payload.outreachSequenceId,
      payload['X-Outreach-Sequence-Id'],
      payload['x-outreach-sequence-id'],
    ),
    metadata: {
      adapter: 'mailgun',
      ...payload,
    },
  };
}

function normalizePostmarkOrSendgrid(
  payload: Record<string, unknown>,
): NormalizedInboundReply | null {
  const headers = asRecord(payload.headers);
  const fromEmail =
    extractEmail(payload.From) ??
    extractEmail(payload.from) ??
    extractEmail(payload.FromFull) ??
    extractEmail(payload.fromEmail);
  const subject = firstString(payload.Subject, payload.subject);
  const bodyText = firstString(
    payload.TextBody,
    payload.text,
    payload.bodyText,
  );
  const bodyHtml = firstString(
    payload.HtmlBody,
    payload.html,
    payload.bodyHtml,
  );
  if (!fromEmail || (!bodyText && !bodyHtml)) return null;

  const sequenceHeader =
    firstString(headers?.['x-outreach-sequence-id']) ??
    firstString(headers?.['X-Outreach-Sequence-Id']);
  const sequenceFromCustomArgs = firstString(
    asRecord(payload.customArgs)?.outreachSequenceId,
    asRecord(payload.custom_args)?.outreachSequenceId,
  );

  return {
    provider: 'postmark_sendgrid',
    fromEmail,
    subject,
    bodyText: bodyText ?? stripHtml(bodyHtml ?? ''),
    bodyHtml,
    source: firstString(payload.source) ?? 'email-provider',
    autoTriage: asBoolean(payload.autoTriage) ?? true,
    outreachSequenceId: firstString(
      payload.outreachSequenceId,
      sequenceHeader,
      sequenceFromCustomArgs,
    ),
    metadata: {
      adapter: 'postmark_sendgrid',
      ...payload,
    },
  };
}

export function normalizeInboundReplyPayload(
  raw: unknown,
): NormalizedInboundReply | null {
  const payload = asRecord(raw);
  if (!payload) return null;

  return (
    normalizeCanonical(payload) ??
    normalizeResend(payload) ??
    normalizeMailgun(payload) ??
    normalizePostmarkOrSendgrid(payload)
  );
}
