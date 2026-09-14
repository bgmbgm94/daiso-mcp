# 올리브영 무료 브라우저 릴레이

2026-09-15 검증: 이 Mac의 일반 HTTP 요청은 올리브영 검색 API에서 HTTP 403 보안 검증 HTML을 받았습니다. 개인 프로필과 분리한 **화면 있는 Chromium**에서는 네 API 모두 HTTP 200, `status: SUCCESS`였습니다. 새 headless 브라우저는 보안 검증 화면에 머물렀습니다. 따라서 GUI 로그인 세션, 브라우저, 전원과 네트워크를 유지할 수 있는 운영 호스트가 필요합니다. 설정만 추가했다고 복구된 것으로 판단하면 안 됩니다.

## 실행

저장소의 개발 의존성을 설치한 뒤 실행합니다. Playwright Chromium이 없다면 `npx playwright install chromium`으로 설치하거나, 이미 설치한 Chromium 실행 파일의 절대 경로를 `OY_BROWSER_EXECUTABLE`에 지정합니다.

```sh
# 토큰은 별도 비밀 저장소/환경에서 주입합니다. 로그나 저장소에 기록하지 않습니다.
export OY_RELAY_TOKEN='<전용 임의 토큰>'
# 선택 사항: 기본 포트 4319, Playwright 기본 Chromium 사용
export OY_RELAY_PORT=4319
# export OY_BROWSER_EXECUTABLE='/absolute/path/to/chromium'
npx tsx scripts/relay/start.ts
```

서버는 `127.0.0.1`에만 바인딩합니다. 홈페이지의 정상 `/store/` 페이지가 열린 뒤 준비 메시지를 출력합니다. 브라우저와 서버는 SIGINT/SIGTERM으로 종료합니다. 화면 없는 서버에서는 현재 검증 결과대로 작동하지 않을 수 있습니다. 세션이 보안 검증으로 바뀌면 조회는 실패하며, 운영자가 전용 브라우저 접속을 확인하고 릴레이를 재시작해야 합니다.

Cloudflare Worker에서 쓰려면 승인된 별도 연결 경로가 필요합니다. 이번 구현은 공개 터널, LaunchAgent 또는 상시 실행을 자동 생성하지 않습니다.

## Worker/MCP 설정

- `OY_RELAY_URL`: 운영자가 관리하는 릴레이의 기본 HTTPS 주소. 개발 시 `http://127.0.0.1:4319` 허용.
- `OY_RELAY_TOKEN`: 릴레이와 같은 전용 Bearer 토큰.

이 값은 Worker 바인딩에서 REST 핸들러와 MCP 서비스로 전달됩니다. MCP 도구 사용자 인자로 설정할 수 없습니다. 릴레이가 설정되어 있으면 먼저 릴레이를 호출하고, 없으면 공식 API에 직접 요청합니다. 직접 요청 실패 시 운영자에게 릴레이 설정 안내를 반환합니다. 어느 경로도 Zyte를 호출하지 않습니다.

## 허용 요청

`POST /v1/oliveyoung/{operation}`에 JSON 본문과 `Authorization: Bearer …`를 보냅니다. 대상 호스트는 `https://www.oliveyoung.co.kr`로 고정하며 임의 URL은 받지 않습니다.

| operation | JSON 필드 |
| --- | --- |
| `find-store` | `lat`, `lon`, `pageIdx`, `searchWords`, `pogKeys`, `serviceKeys`, `mapLat`, `mapLon` |
| `product-search-v3` | `includeSoldOut`, `keyword`, `page`, `sort`, `size` |
| `stock-goods-info-v3` | `goodsNo` |
| `stock-stores` | `productId`, `lat`, `lon`, `pageIdx`, `searchWords`, `mapLat`, `mapLon` |

숫자·문자열·불리언 타입과 필드 목록을 검증합니다. 요청 본문은 최대 16 KiB입니다. 인증 실패는 브라우저 작업 전에 401, 잘못된 경로는 404, 잘못된 본문은 400/413입니다. 한 브라우저 작업만 동시에 실행하며, 실행·대기를 합쳐 8개를 넘으면 503입니다. 취소되었거나 15초 이상 대기한 요청은 실행하지 않습니다. 브라우저 fetch는 본문을 읽을 때까지 15초 제한을 적용합니다. 정상 HTTP 200과 `SUCCESS` JSON만 반환하며, HTML·상태 오류·네트워크 실패는 원문이나 비밀을 노출하지 않는 502가 됩니다.

기존 상품·매장·재고의 실패 시 30분 캐시 재사용 동작은 이 전송 변경에서 확대하지 않았습니다. 캐시 데이터가 실시간 재고를 보장하지는 않습니다.

## 검증 기록

- 직접 Node POST: `find-store`, `product-search-v3` 모두 HTTP 403, 보안 검증 HTML.
- 새로 연 headed Chromium: 별도 로그인과 개인 쿠키 없이 네 API 성공.
- 구현한 서버를 임시 포트 `14319`에 띄워 로컬 HTTP로 검증: 잘못된 토큰 401; `find-store` 200/SUCCESS/9개, `product-search-v3` 200/SUCCESS/382개, `stock-goods-info-v3` 200/SUCCESS, `stock-stores` 200/SUCCESS/9개.
- 실제 smoke는 설치된 Chrome for Testing 148 실행 파일을 `OY_BROWSER_EXECUTABLE`로 지정했습니다. 종료 후 포트 리스너가 남지 않은 것을 확인했습니다.
- 테스트: `npx vitest run tests/relay tests/services/oliveyoung tests/api/oliveyoung-handlers.test.ts tests/app/app-api-oliveyoung.test.ts tests/app/app-api-actions.test.ts`.

공개 Worker에서 이 로컬 Mac으로 연결되는 경로는 이번 smoke로 검증한 범위에 포함되지 않습니다.
