# September Maintenance Implementation Plan

> Use superpowers:subagent-driven-development for independent implementation and review; operational investigation runs alongside code work.

**Goal:** Restore recoverable service paths, improve diagnostics, integrate compatible maintenance PRs, and release verified code.

**Architecture:** Keep existing Worker, REST, MCP and CLI interfaces. Preserve explicit upstream failures and distinguish account configuration errors from transient failures. No spending-limit increase.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, npm, GitHub Actions.

## Task 1: Error diagnostics

Files: scripts/ops/mcp-smoke.ts, src/core/errors.ts, tests/scripts/mcp-smoke.test.ts and existing error tests.

- [ ] Add a failing smoke test returning `{isError:true,content:[{type:'text',text:'Zyte API 호출 실패: 403 Your account has been suspended.'}]}`; assert error is preserved and no JSON parse error appears.
- [ ] Add diagnostics tests: known Zyte account suspension and missing credential are nonretryable with operator configuration guidance; ordinary upstream WAF 403 wrapped by 500 remains existing behavior; timeouts/429/5xx remain retryable.
- [ ] Run targeted Vitest tests and confirm intended failures.
- [ ] Implement minimal error-first parsing and narrowly recognized account/configuration classification. Preserve normal JSON validation.
- [ ] Run targeted tests, check, coverage, build; independent spec then quality review.

## Task 2: Operational recovery

- [ ] Check authenticated existing health data and Zyte billing/stats read-only, without changing spending limits.
- [ ] Compare CU and emart24 official requests with deployed failures; inspect GS25 authentication configuration and CGV direct endpoint.
- [ ] For each confirmed defect, record request evidence and add a failing regression test in the affected client tests before implementation. Do not invent fallback data or convert failures to success.
- [ ] Validate recovered path in deployment; document unresolved external credentials/account restrictions.

## Task 3: Dependencies and feature PRs

- [ ] Read current PR heads/diffs and lockfile versions; exclude superseded downgrades.
- [ ] Integrate compatible patch/minor updates, test installation without peer overrides, run audit and required checks.
- [ ] Review PR #183 and #178 actual code. Preserve contributor attribution when integrating; fill verified test/documentation gaps. Recheck complete coverage.
- [ ] Resolve superseded PRs and merge verified work within user authorization, preserving original branches.

## Task 4: Release and verification

- [ ] Independent final review, npm run check, npm run test:coverage, npm audit, npm run build, npm run release:dry-run.
- [ ] Version/tag commit, push matching Git state, publish npm using configured credentials or workflow. Verify registry version and gitHead.
- [ ] Verify deployment workflow and representative deployed API/MCP calls; record limitations with evidence.
- [ ] Update personal PROJECT.md and maintenance report, send completion notification.
