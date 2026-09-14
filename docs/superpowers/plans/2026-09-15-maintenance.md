# September Maintenance Implementation Plan

> Use superpowers:subagent-driven-development for independent implementation and review; operational investigation runs alongside code work.

**Goal:** Restore recoverable service paths, improve diagnostics, integrate compatible maintenance PRs, and release verified code.

**Architecture:** Keep existing Worker, REST, MCP and CLI interfaces. Preserve explicit upstream failures and distinguish account configuration errors from transient failures. No spending-limit increase.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, npm, GitHub Actions.

## Task 1: Error diagnostics

Files: scripts/ops/mcp-smoke.ts, src/core/errors.ts, tests/scripts/mcp-smoke.test.ts and existing error tests.

- [x] Add a failing smoke test returning `{isError:true,content:[{type:'text',text:'Zyte API 호출 실패: 403 Your account has been suspended.'}]}`; assert error is preserved and no JSON parse error appears.
- [x] Add diagnostics tests: known Zyte account suspension and missing credential are nonretryable with operator configuration guidance; ordinary upstream WAF 403 wrapped by 500 remains existing behavior; timeouts/429/5xx remain retryable.
- [x] Run targeted Vitest tests and confirm intended failures.
- [x] Implement minimal error-first parsing and narrowly recognized account/configuration classification. Preserve normal JSON validation.
- [x] Run targeted tests, check, coverage, build; independent spec then quality review.

## Task 2: Operational recovery

- [ ] Zyte billing/stats 확인은 대시보드 로그인 대기입니다. 인증된 운영 health와 정지 응답을 확인했고 비용 한도는 유지했습니다.
- [x] Compare CU and emart24 official requests with deployed failures; inspect GS25 authentication configuration and CGV direct endpoint.
- [x] For each confirmed defect, record request evidence and add a failing regression test in the affected client tests before implementation. Do not invent fallback data or convert failures to success.
- [x] 배포 후 API와 Cloudflare 원격 미리보기로 검증했습니다. GS25 오류 안내는 확인했으며 Zyte·GS25 인증, CU·CGV·디트릭스 운영 실패와 이마트24 지연은 미해결로 기록했습니다.

## Task 3: Dependencies and feature PRs

- [x] Read current PR heads/diffs and lockfile versions; exclude superseded downgrades.
- [x] Integrate compatible patch/minor updates, test installation without peer overrides, run audit and required checks.
- [x] Review PR #183 and #178 actual code. Preserve contributor attribution when integrating; fill verified test/documentation gaps. Recheck complete coverage.
- [x] Resolve superseded PRs and merge verified work within user authorization, preserving original branches.

## Task 4: Release and verification

- [x] Independent final review, npm run check, npm run test:coverage, npm audit, npm run build, npm run release:dry-run.
- [ ] Version/tag commit, push matching Git state, publish npm using configured credentials or workflow. Verify registry version and gitHead.
- [ ] Verify deployment workflow and representative deployed API/MCP calls; record limitations with evidence.
- [ ] Update personal PROJECT.md and maintenance report, send completion notification.
