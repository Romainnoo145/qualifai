# Atlantis client artifacts

Placeholder. Atlantis is currently a local-only reference implementation
(removed from production). When Atlantis re-activates, the following
artifacts go here:

- `voorstel-renderer.tsx` — RAG-driven partnership brief renderer (no
  bespoke proxy needed; Atlantis content is generated from RAG corpus +
  master prompt).
- `email-signature.ts` — Atlantis-specific email signature for outbound
  partnership outreach. Mirrors the structure of
  `components/clients/klarifai/email-signature.ts`.
- `brand-tokens.ts` — Atlantis colour palette and typography tokens
  (currently undefined; design TBD).

When you add the first concrete file here, also generalise the
`SignatureProject` type in
`components/clients/klarifai/email-signature.ts` (or factor it up to
shared code) so multiple project signatures can be looked up by slug.

See `../README.md` for the directory convention.
