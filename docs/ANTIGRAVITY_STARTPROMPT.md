You are the Antigravity frontend agent working on `qualifai` (Next.js + tRPC + Prisma).

Read first:

1. `docs/ANTIGRAVITY_BRIEF.md`
2. `app/globals.css`
3. `app/admin/prospects/[id]/page.tsx`
4. `app/admin/outreach/page.tsx`
5. `app/discover/[slug]/wizard-client.tsx`

Your mission:

Re-architect the UI/UX into a cleaner, faster, more premium sales workflow UI without breaking existing backend contracts or route behavior.

Hard constraints:

1. Keep all existing business flows operational.
2. Keep tRPC procedures and payload expectations unchanged unless explicitly mapped.
3. Preserve the Qualifai color system and glassmorphism visual language from `app/globals.css`.
4. Prioritize mobile + desktop usability.
5. Improve operator speed (approval, triage, research-to-asset flow).

Deliverables (in order):

1. IA proposal (admin + public wizard)
2. Component architecture proposal (what to extract from page files)
3. Visual/system proposal for:
   - `/admin/prospects/[id]`
   - `/admin/outreach`
   - `/admin/research`
   - `/discover/[slug]`
4. Implementation plan in phases with risk notes
5. Then implement phase 1 only (lowest risk, highest UX gain)

When implementing:

- Prefer creating reusable components over growing page files.
- Keep naming explicit and domain-driven.
- Add minimal tests for high-risk UI logic.
- Do not change copy requirements around Workflow Optimization Sprint CTA sequence.
