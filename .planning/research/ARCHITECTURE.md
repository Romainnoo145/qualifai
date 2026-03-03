# Architecture — v4.0 Atlantis Partnership Outreach

**Project:** Qualifai — v4.0 milestone additions
**Researched:** 2026-03-03
**Scope:** Integration architecture for multi-project RAG-backed outreach

## Schema Additions (Prisma)

### New Models

```prisma
model Project {
  id              String   @id @default(cuid())
  organizationId  String
  name            String                // "Klarifai" or "Europe's Gate"
  slug            String   @unique      // "klarifai" or "europes-gate"
  projectType     String                // "klarifai" | "atlantis"
  description     String?
  branding        Json?                 // logo, colors, CTA text
  bookingUrl      String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  prospects       Prospect[]
  spvs            SPV[]
  documents       ProjectDocument[]
  organization    Organization @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
}

model SPV {
  id              String   @id @default(cuid())
  projectId       String
  name            String                // "DataCo", "SteelCo"
  slug            String                // "dataco", "steelco"
  description     String?
  metricTemplate  Json?                 // which metrics to display
  createdAt       DateTime @default(now())

  project         Project  @relation(fields: [projectId], references: [id])
  documents       ProjectDocument[]
  prospects       Prospect[]
  @@unique([projectId, slug])
}

model ProjectDocument {
  id              String   @id @default(cuid())
  projectId       String
  spvId           String?               // null = project-wide doc
  documentId      String                // "EG-V-1.0"
  title           String
  volume          String?
  filePath        String
  metadata        Json?                 // frontmatter fields
  createdAt       DateTime @default(now())

  project         Project  @relation(fields: [projectId], references: [id])
  spv             SPV?     @relation(fields: [spvId], references: [id])
  chunks          DocumentChunk[]
  @@unique([projectId, documentId])
  @@index([projectId])
  @@index([spvId])
}

model DocumentChunk {
  id              String   @id @default(cuid())
  documentId      String
  chunkIndex      Int
  content         String
  sectionHeader   String?
  tokenCount      Int
  hasMetrics      Boolean  @default(false)
  hasTable        Boolean  @default(false)
  metadata        Json?
  createdAt       DateTime @default(now())
  // embedding vector(1536) added via raw SQL migration

  document        ProjectDocument @relation(fields: [documentId], references: [id])
  @@index([documentId])
}
```

### Prospect Extensions

```prisma
model Prospect {
  // ADD these fields:
  projectId       String?
  spvId           String?
  project         Project?  @relation(fields: [projectId], references: [id])
  spv             SPV?      @relation(fields: [spvId], references: [id])
  @@index([projectId])
}
```

**Migration strategy:** projectId nullable → backfill existing to Klarifai seed project → make non-nullable.

### EvidenceSourceType Extension

```prisma
enum EvidenceSourceType {
  // ... existing values ...
  RAG_DOCUMENT    // New: RAG-matched document passage
}
```

RAG passages stored as EvidenceItem with: sourceType=RAG_DOCUMENT, sourceUrl=document reference, snippet=passage, metadata={documentId, chunkId, similarity, sectionHeader}.

## New Modules

| Module                                       | Purpose                                            | Est. LOC |
| -------------------------------------------- | -------------------------------------------------- | -------- |
| `lib/rag/chunker.ts`                         | Markdown-aware document chunking                   | ~120     |
| `lib/rag/embedder.ts`                        | OpenAI embedding wrapper                           | ~60      |
| `lib/rag/retriever.ts`                       | pgvector search with metadata filtering            | ~100     |
| `lib/rag/opportunity-generator.ts`           | Bridge external evidence + RAG → opportunity cards | ~200     |
| `scripts/ingest-rag-documents.mjs`           | CLI: read → chunk → embed → store                  | ~150     |
| `scripts/seed-projects.mjs`                  | Seed projects, SPVs, document mappings             | ~80      |
| `server/routers/projects.ts`                 | tRPC router for project/SPV queries                | ~100     |
| `app/discover/[slug]/partnership-client.tsx` | Partnership /discover/ template                    | ~400     |
| `components/features/opportunities/`         | Opportunity card, SPV badge, metrics               | ~300     |

**Total new code:** ~1,500 LOC

## Modified Modules

| Module                          | Change                                               | Risk             |
| ------------------------------- | ---------------------------------------------------- | ---------------- |
| `prisma/schema.prisma`          | 4 new models + Prospect FK + enum                    | Low (additive)   |
| `lib/research-executor.ts`      | After existing pipeline, check projectType → run RAG | Low (new branch) |
| `app/discover/[slug]/page.tsx`  | projectType conditional → partnership vs wizard      | Low              |
| `server/routers/prospects.ts`   | Add projectId/spvId to create/update/filter          | Low              |
| `app/admin/prospects/page.tsx`  | Project filter dropdown                              | Low              |
| `components/layout/sidebar.tsx` | Project selector                                     | Low              |

## Data Flow

```
Atlantis Prospect Flow:

1. Create prospect → assign Europe's Gate + SPV
                        │
2. Trigger research ────┤
                        │
    ┌───────────────────┴──────────────────┐
    │                                      │
    ▼                                      ▼
 External Research              RAG Matching (NEW)
 (existing pipeline)            - Embed prospect query
 - Website, Reviews,            - pgvector similarity
   LinkedIn, News...            - Filter by SPV docs
                                - Top-N passages
    │                                      │
    └───────────────────┬──────────────────┘
                        │
    ┌───────────────────▼──────────────────┐
    │    Opportunity Generation (NEW)       │
    │    AI bridges external + RAG          │
    │    → 2-4 opportunity cards            │
    └───────────────────┬──────────────────┘
                        │
    Quality Gate (adapted) → Admin Review → Outreach → /discover/
```

## /discover/ Template Branching

```typescript
// app/discover/[slug]/page.tsx
const projectType = prospect.project?.projectType ?? 'klarifai';

if (projectType === 'klarifai') {
  return <WizardClient {...existingProps} />;       // existing
} else if (projectType === 'atlantis') {
  return <PartnershipClient {...partnerProps} />;   // new
}
```

Shared components: `<WizardShell>`, `<TrustBar>`, `<CTASection>`, `<SessionTracker>`
Different: card content (`<HypothesisCard>` vs `<OpportunityCard>`)

## Build Order (Suggested Phases)

```
Phase 36: Schema + Seed Data
  → Prisma models, pgvector extension, migration
  → Seed script (2 projects, 8 SPVs, 34 document mappings)
  → Backfill existing prospects to Klarifai project
  → Admin project filter (basic)

Phase 37: RAG Ingestion Pipeline
  → Markdown chunker (header-aware, table-preserving)
  → Embedding wrapper (OpenAI)
  → Ingestion script
  → Run against 34 Atlantis documents

Phase 38: RAG Retrieval + Evidence Integration
  → Retriever (pgvector + SPV/metadata filtering)
  → Integration into research-executor.ts
  → RAG_DOCUMENT enum, EvidenceItem storage
  → Opportunity generation function

Phase 39: Partnership /discover/ Template
  → partnership-client.tsx
  → Opportunity card components (dual evidence, SPV metrics)
  → Template branching in page.tsx
  → Partnership Brief PDF (optional)

Phase 40: Admin + Polish
  → Project selector in sidebar
  → SPV assignment on prospect create/edit
  → Project-level pipeline view

Phase 41: Integration Test + First Real Prospect
  → E2E: create Atlantis prospect → research → RAG → opportunities → /discover/
  → Test with real target company
  → Quality gate calibration for partnership context
```

## Key Integration Risks

1. **pgvector + Prisma:** Use `Unsupported("vector(1536)")` + raw SQL. Vector column migration is manual SQL alongside Prisma migration.
2. **Research pipeline branching:** Add RAG step AFTER existing pipeline, not interwoven. Guard with projectType check.
3. **EvidenceItem dual use:** Same model for external + RAG evidence. Quality gate must handle both sourceTypes correctly.
4. **Nullable projectId:** Backfill migration recommended. Treat null as "klarifai" default during transition.

---

_Researched: 2026-03-03 for v4.0 Atlantis Partnership Outreach_
