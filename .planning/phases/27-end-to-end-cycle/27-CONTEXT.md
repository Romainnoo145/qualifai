# Phase 27: End-to-End Cycle - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the complete outreach cycle with real emails and real replies. Two existing pipeline prospects are used as test subjects, with emails redirected to the admin's own inbox (info@klarifai.nl). The phase proves that the send queue delivers emails, reply webhooks receive and triage responses, and fixes any issues found during testing. Cal.com booking validation is deferred to a follow-up.

</domain>

<decisions>
## Implementation Decisions

### Test prospect selection

- Use 2 existing pipeline prospects (real research data, real email content)
- All outreach emails send to info@klarifai.nl (self-send), not to the actual prospect
- Each prospect tests a different triage path: one interested reply, one not-interested reply

### Email deliverability

- Sender: info@klarifai.nl
- Email provider: Resend (already configured)
- Pre-send checklist: verify SPF/DKIM/DMARC DNS records for klarifai.nl before first send
- Delivery verification: manual inbox check (no automated tooling)

### Reply triage validation

- 2 test cycles total (not 3 — auto-reply test skipped)
- Natural reply style — write realistic replies as the prospect would
- Triage paths covered: interested, not interested
- Auto-reply triage deferred (not tested in this phase)

### Success criteria

- Phase passes when: 2 emails delivered to inbox + 2 replies received and correctly triaged
- Cal.com booking (E2E-03) is deferred — not blocking this phase
- If something breaks during testing: fix in-phase and retest (not just document)
- No separate test report artifact — commit history and GSD verification are sufficient

### Claude's Discretion

- Whether reply triage results need UI visibility or database records suffice
- DNS verification approach (dig/nslookup vs Resend dashboard check)
- Which 2 pipeline prospects to select for testing
- Order of operations (send both first vs sequential send-reply cycles)

</decisions>

<specifics>
## Specific Ideas

- Cal.com API key is available (provided by user) — store in .env when needed for future Cal.com phase
- User's workflow is queue-first: the send queue UI is the entry point for triggering sends
- Existing amber quality gate must allow sending (Phase 26 calibrated thresholds)

</specifics>

<deferred>
## Deferred Ideas

- Cal.com booking trigger + meeting brief generation (E2E-03) — follow-up phase or Phase 27 extension
- Auto-reply triage testing — test later with edge cases
- Automated delivery verification tooling — not needed at current scale

</deferred>

---

_Phase: 27-end-to-end-cycle_
_Context gathered: 2026-02-28_
