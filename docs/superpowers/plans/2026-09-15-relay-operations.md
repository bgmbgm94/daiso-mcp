# Mac 중계 운영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** 승인된 Mac 중계를 제한된 자원과 인증 경계 안에서 운영합니다.
**Architecture:** Worker → Access → Tunnel → localhost 중계 → 소유한 전용 Chromium. 계정·프로세스·입출력·요청량을 제한합니다.
**Tech Stack:** Node.js, Playwright, Vitest, macOS launchd, Cloudflare APIs.

## Task 1: 브라우저 수명과 서버 종료

Files: scripts/relay/start.ts, browser.ts, 새 lifecycle/소유 프로세스 모듈, tests/relay 대응 테스트.

- [x] 기존 baseline 테스트를 확인합니다.
- [x] RED: 반복 요청에 `newPage` 한 번, 교체 전 `close` 완료, close 지연·실패에 새 launch 0회, 팝업 회수·crash·timeout·shutdown 테스트를 작성하고 실패를 확인합니다.
- [x] GREEN: 단일 소유 세션과 Node watchdog, 30분/200회 교체, RSS 1GiB 점검, bounded graceful/force cleanup을 구현합니다. 소유 여부 확인 없는 PID 종료는 금지합니다.
- [x] 본문 2MiB 상한, health 상태와 종료/리스너 정리를 검증합니다. 수명 모듈을 coverage 대상에 포함합니다.
- [x] 사양 리뷰 후 품질 리뷰를 수행합니다.

## Task 2: 인증 전달과 호출량 제한

Files: src/services/oliveyoung/transport.ts, src/api/response.ts, REST/MCP 옵션 전달부, scripts/relay/quota.ts, oliveyoung.ts, tests.

- [x] RED: Access 두 헤더 전달·부분 설정 거절·인자 override 금지, 30/분·3000/일 경계와 재시작 보존·저장 실패 테스트를 작성합니다.
- [x] GREEN: Worker secret 바인딩에서만 Access 헤더를 전달합니다. 파일 기반 원자적 quota와 본문 읽기 전 큐 슬롯 확보를 구현합니다.
- [x] 사양 리뷰 후 품질 리뷰를 수행합니다.

## Task 3: 설치와 운영 연결

Files: scripts/relay 설치/운영 도구, docs/oliveyoung-free-relay.md, 개인 scratch의 비밀 파일.

- [ ] 전용 표준 계정에 검토 가능한 설치 스크립트를 준비합니다. 관리자 인증과 GUI 로그인은 사용자에게 필요한 시점에 요청합니다.
- [ ] 고정 Tunnel/DNS와 Access Service Auth 정책을 구성합니다. 생성 식별자와 복구 절차를 기록합니다. 비밀을 stdout에 출력하지 않습니다.
- [ ] launchd singleton·재시작 간격·로그 크기 관리·소유 프로세스 회수 검사를 설치하고 로컬 반복 smoke를 수행합니다.
- [ ] Worker secrets 연결 후 Access 거절·인증 통과·실제 MCP 조회를 확인합니다.

## Task 4: 통합과 기록

- [ ] `npm run check`, `npm run test:coverage` 100%, `npm run build`, `npm audit`를 확인합니다.
- [ ] 리뷰된 커밋을 PR로 올리고 CI·Coverage·CodeQL을 확인한 뒤 승인 범위 안에서 병합·배포합니다.
- [ ] 배포 결과, RSS·탭·프로세스 회수 실측과 미완료 조건을 개인 PROJECT.md에 기록합니다.
