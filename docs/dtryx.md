# 디트릭스 독립·예술영화관 조회

디트릭스 예매 플랫폼을 사용하는 극장의 상영작, 상영 가능 날짜, 회차별 잔여 좌석을 조회합니다. 공개 원본 API를 직접 사용하며 Zyte나 별도 API 키가 필요하지 않습니다.

## 조회 방법

MCP 도구는 `dtryx_list_cinemas`, `dtryx_list_now_showing`, `dtryx_get_remaining_seats`입니다. 예를 들어 “서울 독립영화관에서 오늘 상영하는 영화와 잔여 좌석을 찾아줘”라고 요청할 수 있습니다.

```bash
npx daiso get /api/dtryx/cinemas --region 서울
npx daiso get /api/dtryx/movies --keyword 모모 --includePlayDates true
npx daiso get /api/dtryx/seats --region 서울 --movieName 경멸 --limit 20
```

- 상영작 조회에는 `cinemaCode` 또는 극장명 `keyword`가 필요합니다. 검색 결과가 여러 곳이면 첫 번째 극장을 선택하므로 정확한 조회에는 극장 코드를 쓰세요.
- 회차 조회에 극장 조건이 없으면 카탈로그 전체를 조회합니다. `region`, `keyword`, `brandCode`를 함께 쓰면 모든 조건에 맞는 극장만 조회합니다.
- `playDate`는 `YYYYMMDD` 또는 `YYYY-MM-DD`를 받으며 생략하면 한국 날짜 기준 오늘입니다. 원본에는 하이픈 날짜로 전달합니다.
- `limit`은 1~200, `timeoutMs`는 1~60000 정수이며 기본값은 각각 50, 15000입니다.
- 일부 극장 조회가 실패하면 성공한 회차와 `failedCinemas`를 함께 반환합니다. 모든 극장 조회가 실패하면 API는 503, MCP는 오류를 반환합니다. 성공적으로 조회한 날에 편성이 없으면 빈 목록일 수 있습니다.

## 카탈로그 범위

현재 확인된 극장 22곳을 `src/services/dtryx/location.ts`에서 관리합니다. 전체 제휴 극장 목록을 보장하지 않습니다. 폐업·이전·신규 입점 여부를 정기적으로 확인해야 합니다. 좌표가 없어 거리순 조회는 제공하지 않습니다.

카탈로그에 없는 극장도 공식 `cinemaCode`와 `brandCode`를 함께 알고 있으면 조회할 수 있습니다. 좌석은 조회 시점의 원본 정보로, 예매 과정에서 달라질 수 있습니다.

## 메가박스 CLI

기존 메가박스 API에 전용 CLI 명령을 추가했습니다.

```bash
npx daiso megabox-theaters 강남 --limit 3
npx daiso megabox-movies --theaterId 1372
npx daiso megabox-seats --theaterId 1372 --limit 10
```

디트릭스는 위의 범용 `get` 명령을 사용합니다. API 명세와 Actions에도 디트릭스 경로가 포함돼 있습니다.
