# SEMS 2

세원그룹의 법인·사업장별 ESG 활동자료와 정량지표를 수집하고 검토·집계하는 웹 애플리케이션입니다.

## 운영 흐름

- 법인·사업장·기간별 수집 요청과 요청/미입력/검토/확정 현황
- 온실가스 활동자료, 기타 ESG 지표 입력 및 Excel·CSV 가져오기
- 실제값, 실제 0, 해당 없음, 추정값의 구분과 사유 기록
- 활동량·단위·계수 유효기간 검사 및 산정 당시 계수 기록 보존
- 제출자료 검토 작업함, 보완 요청, 검토 의견, 품질 확인 이력
- 조직별 기간 집계 후 조직 간 합산, 비율의 분자·분모 재계산
- 미제출·미확정 자료의 마감 차단과 확정값 수정 보호
- 서버 저장 충돌 감지, 미저장 변경 내려받기, 서버 변경 전후값 조회

증빙 첨부·연결, ERP·외부 프로그램 연계, 협력사 관리의 확장은 이번 개선 범위에 포함하지 않았습니다.

## 데이터와 인증

Next.js/React 화면에서 Supabase Auth로 로그인하고 `/api/workspace`를 통해 사용자 역할과 법인·사업장 범위에 맞는 데이터를 읽고 저장합니다. `localStorage`는 브라우저 화면의 작업 캐시이며 서버 저장 확인 전에는 저장 완료로 표시하지 않습니다.

Supabase 환경값은 배포 환경 또는 `.env.local`에 설정합니다. 공개 클라이언트 설정은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, 서버 전용 설정은 `SUPABASE_SERVICE_ROLE_KEY`입니다. 서비스 역할 키를 공개 변수에 넣거나 저장소에 커밋하지 마세요.

**이 버전은 애플리케이션 배포 전에 DB 마이그레이션 적용이 필요합니다.** 기존 스키마 이후 `supabase/migrations/20260923_workspace_integrity.sql`을 적용하세요. 구버전 탭은 새로 로그인해야 합니다. 상세 적용 순서와 충돌 처리 제약은 [저장·이력 적용 안내](docs/workspace-integrity-rollout.md)를 참조하세요.

## 개발과 검사

Node.js 22를 기준으로 개발·운영합니다. `.env.example`을 `.env.local`로 복사하고 별도 개발용 Supabase를 설정하세요.

```bash
npm ci
npm run dev
npm run test:unit
npm run lint
npm run build
npm run test:server
npm start
```

Vercel과 일반 Node 서버는 같은 Next.js 빌드를 사용합니다. Dockerfile과 compose.yaml도 제공합니다. 기존 Sites/Vinext 경로는 `dev:sites`, `build:sites`, `start:sites`로 유지하며 `npm test`의 전체 회귀 검사에는 Bash가 필요합니다.

개발자 코드 안내, 환경변수, Docker 실행, 서버 이전·복구 절차와 남은 개선 범위는 [개발자 인수인계·서버 이전 안내](docs/maintenance-and-hosting.md)를 확인하세요.

## 주요 구성

- `app/page.tsx`, `app/operations.css`: 업무 화면과 연결
- `components/operations-*.tsx`: 검토·품질·사업장 현황·서버 이력 화면
- `lib/metric-aggregation.ts`, `lib/factor-calculation.ts`: 집계와 배출량 산정
- `lib/activity-import.ts`: 열 매핑과 가져오기 검증
- `components/auth-gate.tsx`, `app/api/workspace/route.ts`: 인증·조회·저장 동기화
- `lib/workspace-*.ts`: 저장·상태 전이·수치·마감 검증
- `supabase/migrations/20260923_workspace_integrity.sql`: 원자적 저장과 서버 변경 이력

개선 내용과 검증 범위는 [운영 개선 내역](docs/operations-improvements.md)에 정리합니다.