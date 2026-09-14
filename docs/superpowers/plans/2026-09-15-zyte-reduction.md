# Zyte 비용 우선 절감 구현 계획

> For agentic workers: Use superpowers:subagent-driven-development for implementation and independent spec/quality review.

**Goal:** 운영 Zyte 호출을 0회로 만들고 무료 조회와 결과 재사용 범위를 확대합니다.

**Architecture:** 공용 Zyte 전송 함수에서 비용 정책을 강제합니다. 키 존재 여부나 REST/MCP/health 진입점에 의존하지 않습니다. 기존 API 계약을 유지하고 무료 원본 요청과 캐시를 보강합니다. 유료 재허용·호출 예산 모드·새 유료 서버 구입은 제외합니다.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, 기존 HTTP 클라이언트와 캐시.

## Task 1: 유료 호출 0회

Files: src/utils/zyte.ts, src/core/errors.ts, src/api/configStatus.ts, tests/utils/zyte.test.ts, tests/core/errors.test.ts, 관련 config/app 테스트.

- [x] 실제 키와 process.env 키가 있어도 기본 requestByZyte는 정책 오류를 반환하고 fetch 호출은 0회인 실패 테스트를 작성합니다. 여러 동시 호출과 retries 옵션도 동일해야 합니다.
- [x] `await expect(requestByZyte({apiKey:'test',url:'https://example.com',retries:3})).rejects.toThrow('비용'); expect(fetchMock).not.toHaveBeenCalled()` 형태로 네트워크 차단을 확인합니다.
- [x] 공용 전송 경계에 정책 차단을 구현합니다. 필요 없는 유료 재시도 코드는 제거합니다. 명시적인 코드 변경 없이 운영 환경키만으로 다시 켜지지 않아야 합니다.
- [x] 정책 오류를 retryable:false로 진단하고 health 설정 화면은 키 보유와 유료 사용 중지를 구분합니다.
- [x] REST/MCP 및 health에서 키가 있어도 Zyte 요청 0회를 검증합니다. 기존 무료 요청이 계속 동작하는지도 확인합니다.
- [x] 표적 테스트, 독립 사양 리뷰, 품질 리뷰를 진행합니다. 공유 작업트리의 커밋은 통합 검증 후 부모가 수행합니다.

## Task 2: 직접 조회 조사와 적용

Files: src/services/oliveyoung/client.ts, 필요 시 src/services/oliveyoung/transport.ts, tests/services/oliveyoung/*, docs/zyte-free-access.md.

- [x] 실제 공식 올리브영 POST 요청의 로컬 응답과 Cloudflare 원격 응답을 비교합니다. Zyte는 호출하지 않습니다.
- [x] `fetch`가 직접 공식 URL을 호출하고 성공 JSON을 파싱하는 회귀 테스트를 먼저 추가합니다. 실패는 오류 또는 명시적인 기존 캐시 경로를 사용하며 빈 성공을 만들지 않습니다.
- [x] 직접 성공이 입증된 전송 경로를 반영합니다. 차단되는 경우 증거를 기록하고 동작하지 않는 대체 URL만 추가하지 않습니다.
- [x] CU·세븐일레븐·CGV·디트릭스 무료 경로와 로컬 실행 가능성을 조사합니다. 기존 개인 장비의 상시 가동 여부와 공개 중계 운영 가능성이 확인되지 않으면 새 인프라는 배포하지 않고 필요한 조건을 기록합니다.

## Task 3: 반복 조회 감소

Files: src/services/seveneleven/readCache.ts, src/services/seveneleven/client.ts, tests/services/seveneleven/readCache.test.ts 및 기존 호출부 테스트. 재고 필드가 없는 세븐일레븐 공개 목록에 먼저 적용합니다.

- [x] 캐시 적용 지점과 기존 TTL을 확인하고 REST와 MCP가 공유하는 서비스 계층에 적용합니다. 무관한 전역 캐시 재작성은 하지 않습니다.
- [x] 같은 키의 동시 요청 2개가 원본 호출 1회로 합쳐지는 테스트, 실패 후 다음 호출 재시도 가능 테스트, 서로 다른 키 분리 테스트를 작성합니다.
- [x] 세븐일레븐 상품·카탈로그·인기 검색어는 5분, 매장은 30분 재사용합니다. 이 새 캐시는 실시간 재고를 저장하지 않습니다. 올리브영의 기존 캐시 동작은 확대하지 않습니다.
- [x] 메모리 크기 제한과 실패 항목 제거를 검증하고 필요 시 결과 복제로 호출자 간 데이터 오염을 방지합니다.

## Task 4: 통합·배포

- [x] `npm run check`, `npm run test:coverage` 네 항목 100%, `npm audit`, `npm run build`, Wrangler dry-run을 실행합니다.
- [x] 전체 diff의 독립 사양/품질 리뷰를 완료했습니다.
- [ ] 문서에 사용 중지 정책, 무료 가능 범위와 미해결 조건을 기록하고 PR을 생성합니다. 검증 후 승인된 유지보수 범위로 병합·배포합니다.
- [ ] 실제 REST/MCP/health에서 유료 정책 오류와 정상 무료 조회를 검증합니다. 원본 장애와 비용 정책에 따른 조회 불가를 구분합니다.
- [ ] 패키지 변경을 버전/태그와 일치하도록 릴리스하고 공개 registry를 검증합니다. 개인 프로젝트 기록과 완료 알림을 갱신합니다.

## 운영 연결 상태

올리브영 로컬 브라우저 중계는 실제 네 API와 인증 거절을 검증하고 종료했습니다. 현재 Mac을 상시 GUI 중계 장비로 사용할지 사용자 응답을 기다리고 있어 공개 터널·LaunchAgent는 생성하지 않았습니다. 기존 개인 Cloudflare 계정에는 활성 터널이 없습니다. 이는 유료 호출 0회 정책의 배포를 막지 않습니다.

최종 로컬 검증: 165개 파일·1,874개 테스트 통과. Statements 4,510/4,510, Branches 4,017/4,017, Functions 1,057/1,057, Lines 4,364/4,364로 모두 100%입니다. 릴레이 핵심 두 모듈을 커버리지 대상에 포함했고 시작 스크립트는 실제 로컬 실행으로 검증했습니다. npm audit 0건, build와 Worker dry-run 통과입니다.
