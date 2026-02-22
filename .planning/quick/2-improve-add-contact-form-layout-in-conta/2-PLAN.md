# Quick Task 2: Improve Add Contact Form Layout

## Goal

Replace cramped single-row flex-wrap layout (4 inputs + buttons all inline) with a 2-column grid that gives each field breathing room.

## Tasks

### Task 1: Restructure form to 2-column grid

**File:** `components/features/prospects/contacts-section.tsx`

- Replace `flex flex-wrap items-end gap-3` with `space-y-4` container
- Row 1: `grid grid-cols-2 gap-3` — First name, Last name
- Row 2: `grid grid-cols-2 gap-3` — Job title, Email
- Row 3: Save + Cancel buttons (separate row, no longer crammed inline)
- Bump padding from `p-4` to `p-5`

## Verification

- `npx tsc --noEmit` passes
- Form fields are 2-per-row instead of 4 inline
