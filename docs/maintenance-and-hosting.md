# SEMS2 개발자 인수인계와 서버 이전

2026-09-30 기준. 이번 변경은 실행 구성과 저장 접근 경계를 정리한 1차 리팩토링입니다. 화면 전체 분리, DB 정규화 또는 인증 서비스 교체가 완료된 상태는 아닙니다.

## 개발 시작

Node.js 22와 별도 개발용 Supabase 프로젝트를 사용합니다.

1. 저장소를 내려받고 npm ci를 실행합니다.
2. .env.example을 .env.local로 복사하고 개발 프로젝트 설정을 채웁니다.
3. npm run dev로 개발 서버를 실행합니다.
4. npm run test:unit, npm run lint, npm run build를 실행합니다.
5. npm start로 운영 빌드 동작을 확인합니다.

위 명령은 Windows에서도 Bash 없이 동작합니다. 기존 Sites/Vinext 경로는 dev:sites, build:sites, start:sites로 남았습니다. npm test는 단위 테스트와 Sites 렌더링 검사를 모두 실행하므로 Bash가 필요합니다.

## 코드 안내

| 변경 대상 | 시작할 파일/폴더 | 보존할 규칙 |
| --- | --- | --- |
| 화면 연결과 상태 | app/page.tsx | 아직 큰 파일. 업무별 분리는 후속 작업 |
| 검토·품질·사업장 현황 | components/operations-*.tsx | 서버에서도 권한 검사 |
| 로그인·저장 동기화 | components/auth-gate.tsx | localStorage는 서버 백업이 아님 |
| 역할과 마감 | lib/access-control.ts, lib/submission-deadline.ts | 한국 시간 마감, 법인·사업장 범위 |
| 온실가스 산정 | lib/factor-calculation.ts, lib/workspace-emissions.ts | 단위, 계수 유효기간, 계산 당시 스냅샷 |
| 기타 ESG 집계 | lib/metric-aggregation.ts, lib/workspace-metrics.ts | 비율의 분자·분모 재계산 |
| 제출·확정·반려·삭제 | lib/workspace-integrity.ts | 확정 취소는 이유가 있는 별도 상태 변경 |
| API 요청·검증·응답 | app/api/workspace/route.ts | 검증 후에만 저장 모듈 호출 |
| 업무 데이터 DB 접근 | lib/server/workspace-store.ts | 원자적 저장·재시도·이력 계약 |
| Supabase 클라이언트 | lib/supabase/client.ts, lib/supabase/admin.ts | service_role은 서버 전용 |
| 사용자 생성·권한 | app/api/admin/users/route.ts | Supabase Auth 관리 API 의존 |
| DB 구조·변경 | supabase/schema.sql, supabase/migrations | 아래 SQL 적용 주의사항 |

요청 흐름: 브라우저 → 로그인 토큰 → API의 사용자·조직 확인 → 업무 규칙 검사 → 저장 모듈 → DB 원자적 함수.

저장 모듈은 Supabase 접근을 모아 둔 경계이며 범용 DB 드라이버는 아닙니다. 프로필 인증과 사용자 관리에는 아직 직접 호출이 남아 있습니다. 다른 DB/인증으로 바꿀 때 이 부분도 수정해야 합니다.

## 데이터 계약

- workspace_states의 global 및 organization:<UUID> 범위별 JSON에 업무 자료가 저장됩니다. API가 법인·사업장 범위를 제한합니다.
- revision은 동시 수정 감지에 사용됩니다. 읽은 버전과 현재 버전이 다르면 409 충돌을 반환합니다.
- mutationId와 사용자 ID 조합은 재시도 시 중복 저장을 막습니다. workspace_save_receipts에서 원래 결과를 반환합니다.
- save_workspace_checked는 버전 검사, 데이터 저장, 변경 이력, 영수증을 하나의 트랜잭션으로 처리합니다. 일반 upsert 여러 번으로 대체하면 안 됩니다.
- workspace_change_log와 영수증도 백업·이전 대상입니다. 화면용 audit 배열만 복사해서는 충분하지 않습니다.
- 삭제된 활동자료/지표에는 active:false 기록이 남습니다.
- 확정 자료는 사유와 함께 반려로 되돌린 뒤 별도 저장에서 수정·삭제합니다. 마감·잠금 기간은 먼저 다시 열어야 합니다.

## 웹 서버만 이전

Supabase를 유지하면 DB를 옮기지 않고 Node.js 또는 Docker 서버로 웹 앱을 이전할 수 있습니다. Vercel 전용 저장소는 현재 업무 저장 경로에 없습니다.

### 일반 서버

Node.js 22를 설치하고 위 설치·빌드·시작 명령을 사용합니다. 운영 프로세스는 사내 서비스 관리자(systemd 등)로 관리합니다. 재시작 정책, 로그 보관, HTTPS 프록시, 도메인, 인증서 갱신은 서버 운영자가 설정합니다.

### Docker

Docker/Compose가 있는 서버에서 배포 환경 파일을 저장소 밖에 보관합니다. 파일 형식은 .env.example을 따릅니다.

    docker compose --env-file /secure/sems2.env build
    docker compose --env-file /secure/sems2.env up -d
    docker compose logs --tail 100 web

Compose는 127.0.0.1:3000에만 연결합니다. 같은 호스트의 HTTPS 프록시가 이 주소로 전달하도록 설정합니다. 별도 프록시 컨테이너를 쓰면 네트워크 구성을 조정합니다.

컨테이너는 일반 사용자로 실행하고 업무 데이터를 로컬 디스크에 저장하지 않습니다. 앱 서버를 재생성해도 데이터는 Supabase에 남습니다. 자체 운영하는 Supabase의 영속 볼륨은 별도로 백업해야 합니다.

Dockerfile은 .env 파일과 service_role 키를 이미지에 복사하지 않습니다. 서버 키는 실행 시 전달합니다. CI는 가짜 공개 설정으로 이미지 빌드·실행·미인증 접근 차단을 검사하며 실제 DB 통합 검사를 대체하지 않습니다.

### 환경값

| 값 | 적용 시점 | 변경 시 조치 |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | 빌드 + 실행 | 재빌드·재배포 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 빌드 + 실행 | 재빌드·재배포 |
| SUPABASE_SERVICE_ROLE_KEY | 서버 실행 | 비밀 설정 교체 후 재시작 |

공개 설정은 브라우저 코드에 들어갑니다. 다른 Supabase로 바꿀 때 실행 환경만 변경해서는 안 됩니다. 빌드 값과 실행 값이 같은 프로젝트에 속해야 합니다. 같은 Supabase를 유지하며 웹 서버 위치만 옮기면 기존 값을 사용합니다.

build:standalone 명령은 SEMS_STANDALONE=true로 경량 Node 서버 묶음을 만듭니다. Dockerfile에서 자동 사용합니다. npm start는 기본 npm run build 결과를 사용합니다. 정적 HTML/GitHub Pages만으로 인증·저장 API를 운영할 수 없습니다.

## 점검·전환·복구

1. 현재 커밋, 배포 산출물, 환경값 이름과 보관 위치, 담당자를 기록합니다. 키 값은 문서나 저장소에 남기지 않습니다.
2. 새 서버를 별도 주소로 구축하고 별도 개발 DB에서 시험합니다.
3. /api/live의 200은 앱 프로세스 응답만 뜻합니다. /api/health는 서버 전용 키로 workspace_states를 0건 조회해 Supabase 연결과 읽기 권한을 최대 5초 동안 확인합니다. 업무 데이터는 반환하지 않습니다. 실제 저장·권한·마이그레이션 성공을 보장하는 검사는 아닙니다.
4. 관리자·입력자·조회자로 로그인/조직 범위/입력/제출/반려/확정 취소/삭제/새로고침 후 보존을 확인합니다. 두 탭 동시 저장과 재시도도 검사합니다.
5. Supabase Auth의 Site URL, 허용 리다이렉트 URL, 비밀번호 재설정 메일 링크를 새 도메인에 맞춥니다. 도메인이 바뀌면 브라우저 세션과 로컬 초안은 자동 이전되지 않습니다. 미저장 작업을 보관하고 다시 로그인합니다.
6. 변경 중지 시간을 공지하고 미저장 작업을 마무리한 후 도메인/프록시를 전환합니다. 구 서버를 곧바로 제거하지 않습니다.
7. 로그인·저장 오류와 응답 지연을 관찰합니다. 실패 시 이전 산출물과 도메인 설정으로 복구합니다.

같은 DB를 유지한 앱 이전은 앱 버전/도메인 복구가 중심입니다. DB까지 바꾼 뒤 새 DB에 쓰기가 발생했다면 DNS만 되돌려서는 안 됩니다. 쓰기를 중지하고 새 변경분을 대조·반영해야 합니다.

## Supabase도 이전할 때

일반 PostgreSQL로 업무 데이터만 복사하는 것은 전체 이전이 아닙니다. 다음을 별도로 확보하고 복구 리허설을 진행합니다.

- DB: 조직·사업장·프로필, workspace_states, revision, 서버 이력, 영수증, 함수, 권한, RLS 정책.
- 인증: 사용자 UUID, Auth 데이터, 암호/로그인 제공자 이전 지원 범위, 세션 변경, 메일·비밀번호 재설정 설정. 사용자 UUID 연결을 유지하거나 명시적으로 매핑합니다.
- 파일: 기존 Storage 객체, 메타데이터, 버킷 정책. 신규 증빙 기능을 확대하지 않아도 기존 파일이 있으면 이전 대상입니다.
- 운영: 백업·복구 시점·보존 기간·장애 알림·비밀값·인증서·계정 소유권.

자체 Supabase는 Auth·REST·Storage 운영도 맡아야 합니다. 다른 DB/인증으로 교체한다면 로그인/세션, 사용자 API, 저장 모듈, 파일 접근을 함께 수정합니다. 권한과 원자적 저장 통합 검사가 이전 완료 기준입니다.

과거 migrations에는 데모 정리와 canonical schema 재구성 파일도 있습니다. 운영 DB에 모든 SQL을 자동 재실행하지 마세요. 적용 이력을 확인하고 DBA가 새 변경분만 검토·적용합니다. 현재 보강 SQL은 20260923_workspace_integrity.sql입니다. 이번 리팩토링에는 새 DB 변경이 없습니다.

## 장기 유지보수

관련 테스트 → 코드 검사 → Next 빌드 → 테스트 환경 사용자 흐름 확인 → 개발자 리뷰 → 배포 → 배포 후 확인 순서를 지킵니다. GitHub·Vercel·Supabase·도메인 소유권과 복구 수단은 회사가 관리하고 개발자와 업무 담당자를 각각 지정합니다.

다음 작업은 app/page.tsx의 업무별 분리, 중복 자료형 정리, 실제 테스트 DB 기반 권한·저장 통합 검사입니다. JSON을 관계형 테이블로 바꾸는 작업은 별도 데이터 이전 과제로 취급합니다. 이번 변경만으로 장기 운영 준비가 모두 끝났다고 판정하지 않습니다.

인수인계 완료 기준은 사내 개발자가 독립적으로 설치하고 작은 변경을 작성해 검사·배포·복구할 수 있는 상태입니다.

공식 참고: [Next.js 자체 서버 운영](https://nextjs.org/docs/app/guides/self-hosting), [Standalone 산출물](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## 이번 변경의 검증 기록

2026-09-30 로컬에서 단위 테스트 85개와 기존 렌더링 검사 2개, ESLint, Next 일반 빌드와 standalone 빌드를 통과했습니다. 두 운영 서버 방식에서 /api/live, 미인증 업무/사용자 API의 401, 첫 화면과 정적 파일 응답을 확인했습니다. Docker 미설치로 이미지 자체 빌드·실행은 로컬에서 검증하지 못했으며 GitHub CI에 해당 검사를 추가했습니다. 실제 Supabase 계정의 로그인·쓰기 통합 검사는 이번 검증에 포함되지 않았습니다.
