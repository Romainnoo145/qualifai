# Per-client artifacts

This directory holds artifacts that vary per Project (per client). The
goal: onboarding a new client should be data — `INSERT INTO Project ...`
— plus, where the client needs custom UI or templates, a new
subdirectory here.

## Convention

Each client gets a subdirectory matching their `Project.slug`:

```
components/clients/
  klarifai/        # slug 'klarifai'
  atlantis/        # slug 'europes-gate' (legacy slug, predates this convention)
  client-z/        # slug 'client-z'
```

## What lives here

Anything that is genuinely client-specific:

- React components (renderers, branded layouts)
- Email signature templates (HTML string builders)
- Brand tokens (colour palette, typography, radii)
- Static assets that don't fit `public/` (e.g., per-client SVG logos
  used inside React components)

Files here do not have to be React components. The directory name
"clients" reflects the audience (one client per subdirectory), not the
type of content. The Klarifai email signature lives here despite being
a plain HTML-string helper because it's a Klarifai-specific artifact.

## What does NOT live here

- Shared logic (state machines, tRPC routers, DB helpers) — those go in
  `lib/` or `server/`.
- Shared UI primitives (buttons, glass cards, layout shells) — those go
  in `components/ui/` and `components/features/`.
- Anything used by every client — promote it out of `clients/`.

## Renderer dispatch

This refactor does NOT introduce a `Project.metadata.renderers`
dispatch layer or dynamic-import registry. We will design that when we
have two concrete renderers in hand (currently one — Klarifai's
bespoke voorstel proxy in `app/voorstel/[slug]/route.ts` is not yet
relocated here, and Atlantis's RAG-driven renderer doesn't exist yet).

When the second renderer is built, the dispatch layer will land in the
same PR.

## Auth

Per-client admin authentication is decoupled from this directory: it
runs through `Project.adminSecretHash` lookups in `server/admin-auth.ts`.
Admin login is data-driven — no code change needed when onboarding a
new client.
