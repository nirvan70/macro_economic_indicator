# 한국 매크로 대시보드

통계청·관세청·한국은행의 **CPI, 수출입, 산업활동, 고용, GDP** 를 모아 요약하고, 자료가 갱신되면 메일로 알려 주는 개인용 MVP입니다.

## 빠른 시작

```bash
cp .env.example .env.local
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 데이터·알림 파이프라인

| 명령 | 역할 |
|------|------|
| `npm run ingest` | 공식 API로 최신 구간을 가져와 `data/store.json` 갱신 |
| `npm run ingest:history` | 약 10년 시계열로 교체(가능 범위) |
| `npm run ingest:demo` | CPI 더미 갱신으로 파이프라인 테스트(+ 알림 dry-run) |
| `npm run notify` | `pendingNotifications` 메일 발송 |

### API 키

`.env.local`에 넣습니다 (`cp .env.example .env.local`).

| 변수 | 용도 | 발급 |
|------|------|------|
| `ECOS_API_KEY` | CPI·산업·고용·GDP (한은 ECOS) | https://ecos.bok.or.kr/api/ |
| `DATA_GO_KR_SERVICE_KEY` | 수출입 총괄 무역수지 | https://www.data.go.kr/data/15102108/openapi.do |
| `DATA_GO_KR_ITEM_TRADE_KEY` | 품목별 수출입 (HS) | https://www.data.go.kr/data/15101609/openapi.do |

`ECOS_API_KEY`가 없으면 `sample` 키로 동작하지만 **한 번에 최대 10건**만 옵니다. 10년 시계열은 본인 키가 필요합니다.

SMTP(`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`)를 채우면 실제 메일을 보내고, 비어 있으면 콘솔 dry-run만 수행합니다. 기본 수신 주소는 `byoungho.bae@bok.or.kr` 입니다.

## Cursor Automation

평일 오전 8시(한국 시간 기준)에 에이전트가 저장소를 점검하고 `npm run ingest` 를 실행한 뒤, 신규 자료가 있으면 메일을 보냅니다. API 키·SMTP는 Cloud Agent 시크릿으로 넣습니다.

## 다음 단계

1. KOSIS / ECOS / 관세청 API 키 연결 (`scripts/ingest.ts` stub 교체)
2. 요인 초안을 보도자료 기반으로 고도화
3. 팀 공유 시 DB·배포(Vercel 등)로 전환
# macro_economic_indicator
# macro_economic_indicator
# macro_economic_indicator
# macro_economic_indicator
