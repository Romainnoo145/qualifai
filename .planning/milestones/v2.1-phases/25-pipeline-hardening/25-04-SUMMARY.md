---
phase: 25
plan: 04
subsystem: evidence-pipeline
tags: [scrapling, docker, web-scraping, stealth-fetching, bot-detection]
dependency_graph:
  requires: []
  provides: [scrapling-service, scrapling-ts-client, stealth-web-evidence]
  affects: [web-evidence-adapter, hypothesis-generator]
tech_stack:
  added:
    - Scrapling 0.4.1 (ghcr.io/d4vinci/scrapling:latest) — stealth HTTP fetching
    - FastAPI + uvicorn — Python HTTP wrapper service
    - ThreadPoolExecutor — run sync Scrapling calls from async FastAPI routes
  patterns:
    - Docker microservice wrapping Python library with FastAPI
    - Scrapling-primary + raw-fetch-fallback pattern in evidence ingestion
    - uv pip install for dependency management inside Scrapling base image
key_files:
  created:
    - services/scrapling/Dockerfile
    - services/scrapling/app.py
    - lib/enrichment/scrapling.ts
  modified:
    - docker-compose.yml
    - lib/web-evidence-adapter.ts
decisions:
  - Use DynamicFetcher (not PlayWrightFetcher) — correct class name in Scrapling 0.4.1
  - Run sync fetchers via ThreadPoolExecutor.run_in_executor to avoid asyncio conflict
  - Override base image ENTRYPOINT=[] and use uv run uvicorn to access Scrapling venv
  - Install fastapi via uv pip (not system pip) to share the uv virtual environment
metrics:
  duration: ~8 minutes
  completed: 2026-02-27
  tasks_completed: 4
  files_created: 3
  files_modified: 2
---

# Phase 25 Plan 04: Scrapling Stealth Web Scraping Integration Summary

**One-liner:** Scrapling StealthyFetcher microservice replaces raw fetch() for website evidence ingestion, returning 38–322KB of HTML on previously blocked domains.

## What Was Built

A Docker microservice wrapping the Scrapling Python library in a FastAPI HTTP server, with a TypeScript client wired into the web evidence pipeline as the primary fetcher with raw fetch() as fallback. Snippet length limits increased from 260 to 700 chars to give the AI hypothesis generator more content.

## Tasks Completed

| #   | Task                                                 | Commit  | Files                                                                        |
| --- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| 1   | Build Scrapling Docker service                       | 8882a13 | services/scrapling/Dockerfile, services/scrapling/app.py, docker-compose.yml |
| 2   | Add TypeScript Scrapling client                      | 4574527 | lib/enrichment/scrapling.ts                                                  |
| 3   | Wire Scrapling into web-evidence-adapter             | 29a0df2 | lib/web-evidence-adapter.ts                                                  |
| 4   | Test Scrapling on prospect domains + fix asyncio bug | fc98f6d | services/scrapling/app.py                                                    |

## Test Results (Task 4)

| Domain                 | Before      | After         |
| ---------------------- | ----------- | ------------- |
| motiondesignawards.com | 0 (blocked) | 322,205 chars |
| us3consulting.co.uk    | 0 (blocked) | 38,130 chars  |

Both domains were previously returning empty/fallback evidence due to bot detection. With StealthyFetcher, they now return full page HTML.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Override Scrapling base image ENTRYPOINT**

- **Found during:** Task 1 (first startup attempt)
- **Issue:** `ghcr.io/d4vinci/scrapling:latest` has ENTRYPOINT `["uv", "run", "scrapling"]`. Our `CMD ["uvicorn", ...]` became args to the scrapling CLI instead of running uvicorn.
- **Fix:** Set `ENTRYPOINT []` in Dockerfile and use `CMD ["uv", "run", "uvicorn", ...]` to route through uv's virtual environment.
- **Files modified:** services/scrapling/Dockerfile
- **Commit:** 8882a13

**2. [Rule 1 - Bug] Wrong fetcher class name in app.py**

- **Found during:** Task 1 (import error on startup)
- **Issue:** Plan specified `PlayWrightFetcher` but Scrapling 0.4.1 exports `DynamicFetcher` for Playwright-based fetching.
- **Fix:** Changed import and usage to `DynamicFetcher`.
- **Files modified:** services/scrapling/app.py
- **Commit:** 8882a13

**3. [Rule 1 - Bug] StealthyFetcher sync call blocks asyncio event loop**

- **Found during:** Task 4 (functional testing)
- **Issue:** Scrapling's fetchers use synchronous requests/curl-cffi. Calling them directly inside `async def` FastAPI routes triggered "Playwright sync API inside asyncio loop" error, returning `{success: false}` for all fetches.
- **Fix:** Wrapped both fetch functions in `ThreadPoolExecutor.run_in_executor()` so sync calls run in a thread pool without blocking the event loop.
- **Files modified:** services/scrapling/app.py
- **Commit:** fc98f6d

## Verification Passed

1. `docker compose ps` shows `qualifai-scrapling` running on port 3010
2. `curl http://localhost:3010/health` returns `{"status":"ok"}`
3. `npx tsc --noEmit` — only pre-existing error in `scripts/rerun-hypotheses.ts` (unrelated)
4. `lib/web-evidence-adapter.ts` imports `fetchStealth` from `@/lib/enrichment/scrapling`
5. Snippet limits: meta description 700 chars, firstReadableSnippet 700/600 chars
6. `services/scrapling/Dockerfile` uses `ghcr.io/d4vinci/scrapling:latest`

## Self-Check: PASSED

All created files verified on disk. All 4 task commits confirmed in git log.
