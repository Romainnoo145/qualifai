# Offerte Lifecycle Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bloated QuoteForm with a notes-driven AI-assisted offerte flow: meeting notes → AI narrative → line items → brochure preview → email send → view tracking.

**Architecture:** Three new schema fields on Quote (meetingNotes, narrativeGeneratedAt, viewedAt). New tRPC mutation `quotes.generateNarrative` calls Gemini 2.5 Pro with meeting notes + ProspectAnalysis + firmographics. Quote detail page rewritten as single-column flow. Brochure pages 2-3 wired to read narrative from active quote. Email send via existing Resend integration.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma (PostgreSQL), Google Generative AI (Gemini 2.5 Pro), Resend, Tailwind CSS v4

---

## File Map

**Schema:**

- Modify: `prisma/schema.prisma` — add 3 fields to Quote

**Backend:**

- Create: `lib/analysis/quote-narrative-generator.ts` — AI generation logic
- Modify: `server/routers/quotes.ts` — add `generateNarrative` + `updateNotes` + `recordView` mutations
- Modify: `lib/state-machines/quote.ts` — add SENT→VIEWED transition trigger

**Admin UI:**

- Modify: `app/admin/quotes/[id]/page.tsx` — full rewrite to notes→narrative→lines→actions flow
- Create: `components/features/quotes/narrative-preview.tsx` — readable text with inline edit
- Create: `components/features/quotes/line-items-editor.tsx` — inline editable table
- Create: `components/features/quotes/email-compose.tsx` — email compose with brochure link

**Brochure:**

- Modify: `app/offerte/[slug]/page.tsx` — add view tracking API call
- Modify: `components/features/offerte/brochure-cover.tsx` — wire pages 2-3 to quote narrative
- Create: `app/api/offerte/viewed/route.ts` — lightweight view tracking endpoint

---

### Task 1: Schema — add meetingNotes, narrativeGeneratedAt, viewedAt to Quote

**Files:**

- Modify: `prisma/schema.prisma:758-805`
- Create: `prisma/migrations/20260418000000_quote_offerte_lifecycle/migration.sql`

- [ ] **Step 1: Add fields to Quote model**

In `prisma/schema.prisma`, inside `model Quote { ... }`, before the `// Active voorstel flag` comment, add:

```prisma
  // Offerte lifecycle (2026-04-18 redesign)
  meetingNotes         String?   @db.Text
  narrativeGeneratedAt DateTime?
  viewedAt             DateTime?
```

- [ ] **Step 2: Apply migration via docker exec**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "ALTER TABLE \"Quote\" ADD COLUMN IF NOT EXISTS \"meetingNotes\" TEXT; ALTER TABLE \"Quote\" ADD COLUMN IF NOT EXISTS \"narrativeGeneratedAt\" TIMESTAMPTZ; ALTER TABLE \"Quote\" ADD COLUMN IF NOT EXISTS \"viewedAt\" TIMESTAMPTZ;"
```

- [ ] **Step 3: Create migration file**

```bash
mkdir -p prisma/migrations/20260418000000_quote_offerte_lifecycle
```

Write `prisma/migrations/20260418000000_quote_offerte_lifecycle/migration.sql`:

```sql
-- Offerte lifecycle: meeting notes, AI generation timestamp, view tracking
ALTER TABLE "Quote" ADD COLUMN "meetingNotes" TEXT;
ALTER TABLE "Quote" ADD COLUMN "narrativeGeneratedAt" TIMESTAMPTZ;
ALTER TABLE "Quote" ADD COLUMN "viewedAt" TIMESTAMPTZ;
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server|lib)/" | head -10
git add prisma/schema.prisma prisma/migrations/20260418000000_quote_offerte_lifecycle/
git commit -m "feat(schema): add meetingNotes, narrativeGeneratedAt, viewedAt to Quote"
```

---

### Task 2: AI narrative generator — `lib/analysis/quote-narrative-generator.ts`

**Files:**

- Create: `lib/analysis/quote-narrative-generator.ts`

This module takes meeting notes + prospect analysis + firmographics and calls Gemini 2.5 Pro to produce Dutch narrative (introductie, uitdaging, aanpak) + suggested line items.

- [ ] **Step 1: Create the generator module**

```typescript
/**
 * quote-narrative-generator.ts — AI-powered offerte narrative drafting.
 *
 * Takes Romano's meeting notes + the prospect's research analysis +
 * firmographics and produces Dutch boardroom-quality narrative for
 * the brochure (introductie, uitdaging, aanpak) + suggested line items.
 *
 * Uses Gemini 2.5 Pro via the same retry layer as master-analyzer.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_PRO } from '@/lib/ai/constants';

let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return genaiClient;
}

export interface NarrativeGenerationInput {
  meetingNotes: string;
  prospectName: string;
  prospectDomain: string | null;
  prospectIndustry: string | null;
  prospectCity: string | null;
  prospectEmployeeCount: number | null;
  /** The latest analysis-v2 content JSON, if available */
  analysisContent: unknown | null;
}

export interface GeneratedNarrative {
  introductie: string;
  uitdaging: string;
  aanpak: string;
  suggestedLines: {
    omschrijving: string;
    uren: number;
    tarief: number;
  }[];
}

const SYSTEM_PROMPT = `Je bent een senior consultant bij Klarifai, een Nederlands softwareontwikkelingsbureau.
Je schrijft offerte-narratieven voor prospect-voorstellen. Je toon is professioneel, direct, en zakelijk.
Schrijf in het Nederlands. Geen filler, geen smalltalk, elk woord telt.

Je ontvangt:
1. Gespreksnotities van een meeting/telefoongesprek met de prospect
2. AI-onderzoeksdata over de prospect (als beschikbaar)
3. Firmographics (branche, omvang, locatie)

Produceer een JSON object met exact deze structuur:
{
  "introductie": "1-2 alinea's: waarom we dit voorstel schrijven, context van het gesprek",
  "uitdaging": "2-3 alinea's: wat er stuk is of beter kan, onderbouwd met feiten uit het gesprek en onderzoek",
  "aanpak": "2-3 alinea's: hoe Klarifai dit oplost, concreet en gefaseerd",
  "suggestedLines": [
    { "omschrijving": "Wat wordt opgeleverd", "uren": 20, "tarief": 95 }
  ]
}

Regels:
- Schrijf vanuit Klarifai's perspectief ("wij", "ons team")
- Refereer aan specifieke pijnpunten die in het gesprek naar voren kwamen
- Als er onderzoeksdata is, verrijk de uitdaging met concrete feiten
- Tarieven variëren van €80-€120 per uur afhankelijk van complexiteit
- Suggereer realistische uren per regel (discovery 16-24u, development 40-120u, support 8-16u)
- Antwoord ALLEEN met valid JSON, geen markdown, geen uitleg`;

export async function generateQuoteNarrative(
  input: NarrativeGenerationInput,
): Promise<GeneratedNarrative> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({ model: GEMINI_MODEL_PRO });

  const parts: string[] = [];

  parts.push(`## Gespreksnotities\n\n${input.meetingNotes}`);

  parts.push(
    `\n\n## Prospect profiel\n` +
      `Bedrijf: ${input.prospectName}\n` +
      `Website: ${input.prospectDomain ?? 'onbekend'}\n` +
      `Branche: ${input.prospectIndustry ?? 'onbekend'}\n` +
      `Locatie: ${input.prospectCity ?? 'onbekend'}\n` +
      `Medewerkers: ${input.prospectEmployeeCount ?? 'onbekend'}`,
  );

  if (input.analysisContent) {
    const analysis = input.analysisContent as Record<string, unknown>;
    const sections =
      (analysis.sections as Array<{ title: string; body: string }>) ?? [];
    const summary = (analysis.executiveSummary as string) ?? '';

    if (summary || sections.length > 0) {
      parts.push(`\n\n## AI-onderzoeksdata\n`);
      if (summary) parts.push(`Samenvatting: ${summary}\n`);
      for (const s of sections.slice(0, 5)) {
        parts.push(`### ${s.title}\n${s.body}\n`);
      }
    }
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: parts.join('\n') }] }],
    systemInstruction: { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const text = result.response.text();
  const parsed = JSON.parse(text) as GeneratedNarrative;

  // Validate shape
  if (!parsed.introductie || !parsed.uitdaging || !parsed.aanpak) {
    throw new Error('AI response missing required narrative fields');
  }
  if (!Array.isArray(parsed.suggestedLines)) {
    parsed.suggestedLines = [];
  }

  return parsed;
}
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(lib)/" | head -10
git add lib/analysis/quote-narrative-generator.ts
git commit -m "feat(ai): add quote narrative generator using Gemini 2.5 Pro

Takes meeting notes + prospect analysis + firmographics, produces
Dutch introductie/uitdaging/aanpak + suggested line items."
```

---

### Task 3: tRPC — add generateNarrative, updateNotes, recordView mutations

**Files:**

- Modify: `server/routers/quotes.ts`

- [ ] **Step 1: Add `updateNotes` mutation**

After the `setActiveProposal` mutation in `server/routers/quotes.ts`, add:

```typescript
  updateNotes: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        meetingNotes: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx as unknown as ScopedCtx, input.id);
      return ctx.db.quote.update({
        where: { id: input.id },
        data: { meetingNotes: input.meetingNotes },
        select: { id: true, meetingNotes: true },
      });
    }),
```

- [ ] **Step 2: Add `generateNarrative` mutation**

Import at top of file:

```typescript
import { generateQuoteNarrative } from '@/lib/analysis/quote-narrative-generator';
```

Add mutation:

```typescript
  generateNarrative: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, prospect: { projectId: ctx.projectId } },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              industry: true,
              city: true,
              employeeCount: true,
              prospectAnalyses: {
                where: { version: 'analysis-v2' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { content: true },
              },
            },
          },
        },
      });
      if (!quote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Quote not found in active project scope',
        });
      }
      if (!quote.meetingNotes?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Meeting notes are required before generating narrative',
        });
      }

      const analysis = quote.prospect.prospectAnalyses[0]?.content ?? null;

      const result = await generateQuoteNarrative({
        meetingNotes: quote.meetingNotes,
        prospectName: quote.prospect.companyName ?? quote.prospect.domain ?? 'Prospect',
        prospectDomain: quote.prospect.domain,
        prospectIndustry: quote.prospect.industry,
        prospectCity: quote.prospect.city,
        prospectEmployeeCount: quote.prospect.employeeCount,
        analysisContent: analysis,
      });

      return ctx.db.$transaction(async (tx) => {
        // Update narrative fields
        const updated = await tx.quote.update({
          where: { id: input.id },
          data: {
            introductie: result.introductie,
            uitdaging: result.uitdaging,
            aanpak: result.aanpak,
            narrativeGeneratedAt: new Date(),
          },
          include: { lines: { orderBy: { position: 'asc' } } },
        });

        // If no existing lines, create suggested lines
        if (updated.lines.length === 0 && result.suggestedLines.length > 0) {
          await tx.quoteLine.createMany({
            data: result.suggestedLines.map((l, idx) => ({
              quoteId: input.id,
              fase: l.omschrijving,
              omschrijving: l.omschrijving,
              uren: l.uren,
              tarief: l.tarief,
              position: idx,
            })),
          });
        }

        return tx.quote.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            lines: { orderBy: { position: 'asc' } },
            prospect: {
              select: {
                id: true,
                slug: true,
                readableSlug: true,
                companyName: true,
              },
            },
          },
        });
      });
    }),
```

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server|lib)/" | head -10
git add server/routers/quotes.ts
git commit -m "feat(quotes): add generateNarrative + updateNotes mutations

generateNarrative calls Gemini with meeting notes + prospect analysis,
writes narrative back to quote + creates suggested line items.
updateNotes saves meeting notes on blur."
```

---

### Task 4: View tracking — API route + state machine update

**Files:**

- Create: `app/api/offerte/viewed/route.ts`
- Modify: `lib/state-machines/quote.ts`

- [ ] **Step 1: Create view tracking API route**

```typescript
/**
 * POST /api/offerte/viewed — lightweight view tracking.
 *
 * Called by the brochure client component when the page loads.
 * Records viewedAt on the active quote and transitions SENT → VIEWED.
 * No auth required — the slug is the access token.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { prospectId } = (await request.json()) as { prospectId: string };
    if (!prospectId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const quote = await prisma.quote.findFirst({
      where: { prospectId, isActiveProposal: true },
      select: { id: true, status: true, viewedAt: true },
    });

    if (!quote) {
      return NextResponse.json({ ok: false, reason: 'no-active-quote' });
    }

    // Only record first view
    if (!quote.viewedAt) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          viewedAt: new Date(),
          // Transition SENT → VIEWED if currently SENT
          ...(quote.status === 'SENT' ? { status: 'VIEWED' } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app)/" | head -10
git add app/api/offerte/viewed/route.ts
git commit -m "feat(offerte): add view tracking API endpoint

Records viewedAt on active quote when client opens brochure.
Transitions SENT → VIEWED on first open."
```

---

### Task 5: Narrative preview component

**Files:**

- Create: `components/features/quotes/narrative-preview.tsx`

- [ ] **Step 1: Create component**

```typescript
'use client';

import { useState } from 'react';
import { PenLine, Check, X } from 'lucide-react';

interface NarrativeSection {
  label: string;
  field: 'introductie' | 'uitdaging' | 'aanpak';
  value: string;
  placeholder: string;
}

interface NarrativePreviewProps {
  introductie: string;
  uitdaging: string;
  aanpak: string;
  isGenerated: boolean;
  isReadOnly: boolean;
  onUpdate: (field: 'introductie' | 'uitdaging' | 'aanpak', value: string) => void;
}

export function NarrativePreview({
  introductie,
  uitdaging,
  aanpak,
  isGenerated,
  isReadOnly,
  onUpdate,
}: NarrativePreviewProps) {
  const sections: NarrativeSection[] = [
    {
      label: 'Introductie',
      field: 'introductie',
      value: introductie,
      placeholder: 'Waarom we dit voorstel schrijven — wordt gegenereerd vanuit je gespreksnotities.',
    },
    {
      label: 'De uitdaging',
      field: 'uitdaging',
      value: uitdaging,
      placeholder: 'Wat er stuk is of beter kan — wordt verrijkt met onderzoeksdata.',
    },
    {
      label: 'Onze aanpak',
      field: 'aanpak',
      value: aanpak,
      placeholder: 'Hoe Klarifai dit oplost — concreet en gefaseerd.',
    },
  ];

  if (!isGenerated && !introductie && !uitdaging && !aanpak) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] text-[var(--color-muted)]">
          Nog niet gegenereerd. Voeg je gespreksnotities toe en klik op
          &quot;Genereer voorstel&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <NarrativeSectionBlock
          key={section.field}
          {...section}
          isReadOnly={isReadOnly}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function NarrativeSectionBlock({
  label,
  field,
  value,
  placeholder,
  isReadOnly,
  onUpdate,
}: NarrativeSection & {
  isReadOnly: boolean;
  onUpdate: (field: 'introductie' | 'uitdaging' | 'aanpak', value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing && !isReadOnly) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {label}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                onUpdate(field, draft);
                setEditing(false);
              }}
              className="admin-btn-sm admin-btn-primary"
            >
              <Check className="h-3 w-3" /> Opslaan
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              className="admin-btn-sm admin-btn-secondary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="input-minimal w-full text-[15px] leading-[1.6]"
        />
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        {!isReadOnly && value && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {value ? (
        <div className="text-[15px] leading-[1.6] text-[var(--color-ink)] whitespace-pre-wrap">
          {value}
        </div>
      ) : (
        <p className="text-[14px] text-[var(--color-muted)] italic">{placeholder}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(components)/" | head -10
git add components/features/quotes/narrative-preview.tsx
git commit -m "feat(quotes): add NarrativePreview component

Document-style readable sections with hover-to-edit. Shows placeholder
when narrative not yet generated."
```

---

### Task 6: Line items editor component

**Files:**

- Create: `components/features/quotes/line-items-editor.tsx`

- [ ] **Step 1: Create component**

```typescript
'use client';

import { Plus, Trash2 } from 'lucide-react';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';

export interface LineItemDraft {
  omschrijving: string;
  uren: number;
  tarief: number;
}

interface LineItemsEditorProps {
  lines: LineItemDraft[];
  btwPercentage: number;
  isReadOnly: boolean;
  onChange: (lines: LineItemDraft[]) => void;
}

export function LineItemsEditor({
  lines,
  btwPercentage,
  isReadOnly,
  onChange,
}: LineItemsEditorProps) {
  const totals = computeQuoteTotals(
    lines.map((l) => ({ uren: l.uren, tarief: l.tarief })),
    btwPercentage,
  );

  const updateLine = (index: number, patch: Partial<LineItemDraft>) => {
    const next = lines.map((l, i) => (i === index ? { ...l, ...patch } : l));
    onChange(next);
  };

  const addLine = () => {
    onChange([...lines, { omschrijving: '', uren: 0, tarief: 95 }]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Omschrijving
            </th>
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-right w-[80px]">
              Uren
            </th>
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-right w-[100px]">
              Tarief
            </th>
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-right w-[120px]">
              Subtotaal
            </th>
            {!isReadOnly && <th className="w-[40px]" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className="border-b border-[var(--color-border)]"
            >
              <td className="py-2 pr-4">
                {isReadOnly ? (
                  <span className="text-[var(--color-ink)]">
                    {line.omschrijving || '—'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={line.omschrijving}
                    onChange={(e) =>
                      updateLine(i, { omschrijving: e.target.value })
                    }
                    placeholder="Wat wordt opgeleverd"
                    className="w-full bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:bg-[var(--color-surface-2)] rounded px-2 py-1 -mx-2 transition-colors"
                  />
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {isReadOnly ? (
                  <span className="tabular-nums text-[var(--color-ink)]">
                    {line.uren}
                  </span>
                ) : (
                  <input
                    type="number"
                    value={line.uren}
                    onChange={(e) =>
                      updateLine(i, { uren: Number(e.target.value) || 0 })
                    }
                    min={0}
                    className="w-full bg-transparent text-right text-[var(--color-ink)] tabular-nums outline-none focus:bg-[var(--color-surface-2)] rounded px-2 py-1 transition-colors"
                  />
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {isReadOnly ? (
                  <span className="tabular-nums text-[var(--color-ink)]">
                    €{line.tarief}
                  </span>
                ) : (
                  <input
                    type="number"
                    value={line.tarief}
                    onChange={(e) =>
                      updateLine(i, { tarief: Number(e.target.value) || 0 })
                    }
                    min={0}
                    className="w-full bg-transparent text-right text-[var(--color-ink)] tabular-nums outline-none focus:bg-[var(--color-surface-2)] rounded px-2 py-1 transition-colors"
                  />
                )}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums font-medium text-[var(--color-ink)]">
                {formatEuro(line.uren * line.tarief)}
              </td>
              {!isReadOnly && (
                <td className="py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-[var(--color-muted)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!isReadOnly && (
        <button
          type="button"
          onClick={addLine}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Regel toevoegen
        </button>
      )}

      {/* Totals */}
      <div className="mt-6 border-t border-[var(--color-border)] pt-4 ml-auto w-[280px] space-y-2">
        <div className="flex justify-between text-[12px]">
          <span className="uppercase tracking-wider text-[var(--color-muted)]">
            Subtotaal
          </span>
          <span className="tabular-nums text-[var(--color-ink)]">
            {formatEuro(totals.netto)}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="uppercase tracking-wider text-[var(--color-muted)]">
            BTW {btwPercentage}%
          </span>
          <span className="tabular-nums text-[var(--color-ink)]">
            {formatEuro(totals.btw)}
          </span>
        </div>
        <div className="flex justify-between text-[14px] font-medium border-t-2 border-[var(--color-gold)] pt-2">
          <span className="uppercase tracking-wider text-[var(--color-ink)]">
            Totaal incl. BTW
          </span>
          <span className="tabular-nums text-[var(--color-ink)]">
            {formatEuro(totals.bruto)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(components)/" | head -10
git add components/features/quotes/line-items-editor.tsx
git commit -m "feat(quotes): add LineItemsEditor with inline editing + totals

Variable rate per line, transparent inline inputs, gold underline
on total. Add/remove rows when not read-only."
```

---

### Task 7: Email compose component

**Files:**

- Create: `components/features/quotes/email-compose.tsx`

- [ ] **Step 1: Create component**

```typescript
'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';

interface EmailComposeProps {
  defaultTo: string;
  defaultSubject: string;
  brochureUrl: string;
  isSubmitting: boolean;
  onSend: (data: { to: string; subject: string; body: string }) => void;
  onCancel: () => void;
}

export function EmailCompose({
  defaultTo,
  defaultSubject,
  brochureUrl,
  isSubmitting,
  onSend,
  onCancel,
}: EmailComposeProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(
    `Beste,\n\nHierbij ons voorstel voor de besproken werkzaamheden.\n\nBekijk het volledige voorstel via onderstaande link:\n${brochureUrl}\n\nMocht je vragen hebben, dan hoor ik het graag.\n\nMet vriendelijke groet,\nRomano Kanters\nKlarifai`,
  );

  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Email versturen
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="email@bedrijf.nl"
          className="input-minimal w-full text-[13px]"
        />
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input-minimal w-full text-[13px]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="input-minimal w-full text-[13px] leading-[1.6]"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSend({ to, subject, body })}
          disabled={isSubmitting || !to.trim()}
          className="admin-btn-primary inline-flex items-center gap-2"
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting ? 'Versturen...' : 'Verstuur definitief'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(components)/" | head -10
git add components/features/quotes/email-compose.tsx
git commit -m "feat(quotes): add EmailCompose component

Inline email compose with pre-filled brochure link, prospect email,
and subject. Sends via parent callback."
```

---

### Task 8: Quote detail page — full rewrite

**Files:**

- Modify: `app/admin/quotes/[id]/page.tsx` (full rewrite)

This is the centerpiece. Replaces the current two-column QuoteForm layout with the notes → narrative → line items → actions flow.

- [ ] **Step 1: Rewrite the page**

Full rewrite of `app/admin/quotes/[id]/page.tsx`. The new page:

1. Queries quote with `meetingNotes`, `narrativeGeneratedAt`, lines, prospect (including contacts for email)
2. Renders: header → notes block → narrative preview → line items → actions
3. Wires up `updateNotes`, `generateNarrative`, `update` (for lines), `setActiveProposal` mutations
4. Email compose opens inline, sends via a new `quotes.sendEmail` mutation (or reuses existing send flow)

Key implementation details:

- `meetingNotes` auto-saves on blur via `updateNotes` mutation
- "Genereer voorstel" button calls `generateNarrative` with loading state
- Narrative uses `NarrativePreview` component (Task 5)
- Line items use `LineItemsEditor` component (Task 6)
- Lines save on individual field blur via debounced `update` mutation
- "Preview brochure" opens `/offerte/{readableSlug}` in new tab
- "Verstuur per email" toggles `EmailCompose` component (Task 7)
- Status timeline shows: created → sent → viewed → accepted as compact pills

The page should use the design system tokens: white canvas, gold gradient buttons, Sora font, soft corners, minimal borders. No `glass-card`, no `font-black`, no `slate-*`.

Import and use these components:

```typescript
import { NarrativePreview } from '@/components/features/quotes/narrative-preview';
import {
  LineItemsEditor,
  type LineItemDraft,
} from '@/components/features/quotes/line-items-editor';
import { EmailCompose } from '@/components/features/quotes/email-compose';
import { QuoteStatusBadge } from '@/components/features/quotes/quote-status-badge';
import { QuoteVersionConfirm } from '@/components/features/quotes/quote-version-confirm';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';
```

The page is ~250 lines. Keep all component logic in the imported components — the page file is orchestration only.

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server)/" | head -10
npx eslint "app/admin/quotes/[id]/page.tsx" 2>&1 | tail -10
git add "app/admin/quotes/[id]/page.tsx"
git commit -m "feat(admin): rewrite quote detail to notes → narrative → lines → actions

Single-column flow: meeting notes with AI generate button, narrative
preview with inline edit, line items table, email compose + brochure
preview. Removes QuoteForm dependency."
```

---

### Task 9: Brochure wire-up — pages 2-3 read from quote narrative

**Files:**

- Modify: `app/offerte/[slug]/page.tsx` — pass narrative to BrochureCover
- Modify: `components/features/offerte/brochure-cover.tsx` — wire Uitdaging + Aanpak pages

- [ ] **Step 1: Update server component to pass narrative**

In `app/offerte/[slug]/page.tsx`, the active quote query already exists (Fase B). Extend the `quote` prop passed to `BrochureCover` to include narrative:

Add to the quote prop shape:

```typescript
quote={
  activeQuote
    ? {
        nummer: activeQuote.nummer,
        onderwerp: activeQuote.onderwerp,
        btwPercentage: activeQuote.btwPercentage,
        introductie: activeQuote.introductie ?? null,
        uitdaging: activeQuote.uitdaging ?? null,
        aanpak: activeQuote.aanpak ?? null,
        lines: activeQuote.lines.map((l) => ({
          fase: l.fase,
          omschrijving: l.omschrijving ?? '',
          uren: l.uren,
          tarief: l.tarief,
        })),
      }
    : null
}
```

- [ ] **Step 2: Update BrochureQuote type**

In `components/features/offerte/brochure-cover.tsx`, update the `BrochureQuote` type to include narrative:

```typescript
export type BrochureQuote = {
  nummer: string;
  onderwerp: string;
  btwPercentage: number;
  introductie: string | null;
  uitdaging: string | null;
  aanpak: string | null;
  lines: {
    fase: string;
    omschrijving: string;
    uren: number;
    tarief: number;
  }[];
} | null;
```

- [ ] **Step 3: Wire Uitdaging page**

Pass `quote` to the `Uitdaging` component. In the component, if `quote?.uitdaging` exists, render it as the body text instead of the hardcoded pillars array. Keep the visual structure (section label, heading, background) but replace the content.

```typescript
// In Uitdaging component, after the heading:
{quote?.uitdaging ? (
  <div style={{
    fontSize: '17px',
    fontWeight: 300,
    lineHeight: 1.6,
    color: TEXT_MUTED_ON_NAVY,
    maxWidth: '680px',
    whiteSpace: 'pre-wrap',
  }}>
    {quote.uitdaging}
  </div>
) : (
  // existing hardcoded pillars as fallback
)}
```

- [ ] **Step 4: Wire Aanpak page similarly**

Same pattern for Aanpak — if `quote?.aanpak` exists, render it. Otherwise keep hardcoded fallback.

- [ ] **Step 5: Add view tracking call**

In `BrochureCover`, add a `useEffect` that fires on mount:

```typescript
useEffect(() => {
  if (!prospect) return;
  fetch('/api/offerte/viewed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prospectId: prospect.id }),
  }).catch(() => {});
}, [prospect]);
```

Note: this requires passing `prospect.id` through to BrochureCover. Update the server component and BrochureProspect type to include `id`.

- [ ] **Step 6: Verify + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components)/" | head -10
npx eslint app/offerte/ components/features/offerte/brochure-cover.tsx 2>&1 | tail -10
git add app/offerte/ components/features/offerte/brochure-cover.tsx
git commit -m "feat(offerte): wire brochure pages 2-3 to quote narrative + view tracking

Uitdaging and Aanpak pages read from active quote's AI-generated
narrative. Falls back to hardcoded content when no quote. View
tracking records first open via /api/offerte/viewed."
```

---

### Task 10: Final validation

- [ ] **Step 1: Full typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "^(app|components|server|lib)/" | head -20
npx eslint app/admin/quotes/ components/features/quotes/ lib/analysis/quote-narrative-generator.ts app/api/offerte/ 2>&1 | tail -20
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -o /dev/null -w "quote-detail %{http_code}\n" http://localhost:9200/admin/quotes
curl -s -o /dev/null -w "offerte %{http_code}\n" http://localhost:9200/offerte/marfa
```

- [ ] **Step 3: Manual browser verification**

1. Open `/admin/quotes` → click a quote → see new notes→narrative→lines layout
2. Type meeting notes in textarea → click "Genereer voorstel" → see AI narrative appear
3. Edit a line item → totals update live
4. Click "Preview brochure" → brochure opens with real narrative on pages 2-3
5. Toggle "Actief voorstel" → refresh brochure → narrative updates
6. Click "Verstuur per email" → compose form appears with brochure link
