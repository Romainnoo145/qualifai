---
name: Always delete replaced pages — no stale routes
description: When a page/route is replaced by a new flow, delete the old file immediately. Don't leave stale pages on disk.
type: feedback
---

When a page or route is replaced by a new flow, delete the old file immediately. Don't leave stale pages on disk.

**Why:** Old `quotes/new` page existed alongside the new quote detail flow. Plans wired buttons to the old route. User had to manually catch this. Stale routes cause confusion and bugs.

**How to apply:** Before wiring navigation to a route, verify the target page is the CURRENT version (check git log for rewrites). When building a replacement flow, delete the old page in the same commit. Search for any references to the old route and update them.
