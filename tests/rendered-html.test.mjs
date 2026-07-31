import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);

  const reportResponse = await worker.fetch(
    new Request("http://localhost/reports", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(reportResponse.status, 200);
  assert.match(await reportResponse.text(), developmentPreviewMeta);

  const referenceResponse = await worker.fetch(
    new Request("http://localhost/reference-data", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(referenceResponse.status, 200);
  assert.match(await referenceResponse.text(), developmentPreviewMeta);

  const scope3Response = await worker.fetch(
    new Request("http://localhost/scope3-supply-chain", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(scope3Response.status, 200);
  assert.match(await scope3Response.text(), developmentPreviewMeta);
});

test("preserves the latest operating workflow and readable type scale", async () => {
  const [page, styles, factorLibrary, collectionCoverage, taskExpansion, griCatalog] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/emission-factor-library.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/collection-coverage.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/collection-task-expansion.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/gri-workbook-indicators.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /감축목표·이행계획/);
  assert.match(page, /연도별 목표·실적 모니터링/);
  assert.match(page, /배출 전망/);
  assert.match(page, /"내부 감축" \| "외부 감축" \| "비정량 과제"/);
  assert.match(page, /연간 절감비/);
  assert.match(page, /ESG 정량데이터 수집/);
  assert.match(page, /label: "수집 요청"/);
  assert.match(page, /label: "데이터 입력"/);
  assert.match(page, /세부 수집 항목 자동 전개/);
  assert.match(page, /기존 요청 제외/);
  assert.match(page, /확정 완료 제외/);
  assert.match(page, /taskKeys/);
  assert.match(taskExpansion, /periodsForCollectionCycle/);
  assert.match(taskExpansion, /buildMetricCollectionTasks/);
  assert.match(taskExpansion, /buildGHGCollectionTasks/);
  assert.match(taskExpansion, /classifyCollectionTasks/);
  assert.match(page, /수집 커버리지 현황/);
  assert.match(page, /미요청은 요청 범위에서 빠진 항목/);
  assert.match(page, /기타 ESG는 지표의 월·분기·반기·연 수집 주기를 반영합니다/);
  assert.match(collectionCoverage, /buildGHGCoverage/);
  assert.match(collectionCoverage, /buildMetricCoverage/);
  assert.match(collectionCoverage, /monthsForCycle/);
  assert.match(styles, /\.coverage-matrix/);
  assert.match(page, /폐기물 구분/);
  assert.match(page, /법정 의무교육/);
  assert.match(page, /엑셀·GRI 지표 복원/);
  assert.match(page, /지표명, GRI 코드, 담당부서 검색/);
  assert.match(page, /FIXED:"고정 세부값"/);
  assert.match(page, /FixedMetricDetailEditor/);
  assert.match(page, /normalizeMetricSubmissions/);
  assert.match(griCatalog, /RAW_SUPPLEMENTAL_GRI_INDICATORS/);
  assert.match(griCatalog, /세원정공 SR 정량데이터 수집툴 ver\.2\.0/);
  assert.match(griCatalog, /인권 교육 이수 현황/);
  assert.match(griCatalog, /고객만족\(불량건수\)/);
  assert.match(styles, /\.metric-fixed-rows/);
  assert.match(page, /지표 특성에 맞춰 상세 입력 항목과 자동 집계 방식을 선택합니다/);
  assert.match(page, /Scope 1·2 기준연도 배출량/);
  assert.match(page, /균등 배분/);
  assert.match(page, /수동 입력/);
  assert.match(page, /지속가능경영보고서 작성/);
  assert.match(page, /정량지표를 선택하세요/);
  assert.match(page, /표시 연도/);
  assert.match(page, /dataYears/);
  assert.match(page, /기본값은 보고서 연도 기준 최근 3개년입니다/);
  assert.doesNotMatch(page, /확정된 SEMS 데이터를 자동으로 연결합니다/);
  assert.doesNotMatch(page, /확정 ESG 정량데이터 자동 연결/);
  assert.doesNotMatch(page, /SEMS 데이터 표/);
  assert.match(page, /배출계수·산정기준/);
  assert.match(page, /요소를 끌어 이동하고 우측 아래 핸들로 크기를 조절합니다/);
  assert.match(page, /데이터 표/);
  assert.match(page, /이미지 교체/);
  assert.match(page, /ReportDataChart/);
  assert.match(page, /createPageTitleBlock/);
  assert.match(page, /pageTitle:true/);
  assert.match(page, /selectedIndex\+1/);
  assert.match(page, /onPageReorder/);
  assert.match(page, /draggable=\{canManage\}/);
  assert.match(page, /드래그해서 페이지 순서 변경/);
  assert.match(page, /major:20,middle:12,minor:11,table:10/);
  assert.match(page, /REPORT_BODY_SIZE=10/);
  assert.match(page, /REPORT_TABLE_SIZE=8/);
  assert.match(page, /REPORT_CAPTION_SIZE=7/);
  assert.match(page, /가로형 · 현대차 보고서형 16:9/);
  assert.match(page, /기준정보·규제 관리/);
  assert.match(page, /Scope 3 범주별 입력항목/);
  assert.match(page, /15개 범주 기본필드 생성/);
  assert.match(page, /보고기준·공시항목/);
  assert.match(page, /standardCodes=\[\.\.\.new Set/);
  assert.match(page, /규제·준수 관리/);
  assert.match(page, /Scope 3·공급망 관리/);
  assert.match(page, /공급사 마스터/);
  assert.match(page, /자재·제품 마스터/);
  assert.match(page, /이동거리 마스터/);
  assert.match(page, /정량지표 × 보고기준 연결/);
  assert.match(page, /DEFAULT_SCOPE3_FIELD_BLUEPRINTS/);
  assert.match(page, /공급망 수준 진단 요청/);
  assert.match(page, /scope3: "\/scope3-supply-chain"/);
  assert.match(page, /NAV_GROUPS/);
  assert.match(page, /DEFAULT_CALCULATION_FORMULAS/);
  assert.match(page, /sems2-disclosure-standards/);
  assert.match(page, /const VIEW_PATHS: Record<View, string>/);
  assert.match(page, /reports: "\/reports"/);
  assert.match(page, /reference: "\/reference-data"/);
  assert.match(page, /router\.push\(VIEW_PATHS\[view\]\)/);
  assert.match(page, /viewFromPathname\(pathname\)/);
  assert.match(page, /aria-current=\{active\?"page":undefined\}/);
  assert.match(factorLibrary, /EF-S1-WELDING-CO2/);
  assert.match(factorLibrary, /EF-S2-ELECTRICITY-2023/);
  assert.match(factorLibrary, /Cat\.15/);
  assert.match(page, /"예정" \| "수집중" \| "검토중" \| "마감" \| "잠금"/);
  assert.match(page, /title="변경 이력"/);
  assert.match(styles, /body \{ font-size: 16px; line-height: 1\.58; \}/);
  assert.match(styles, /\.report-page-drag \{/);
  assert.match(styles, /\.report-page-item\.drag-before::before/);
  assert.match(styles, /max-width: 1780px/);
  assert.match(styles, /aspect-ratio: 1153\.7 \/ 649\.134/);
  assert.match(styles, /@page landscapeReport \{ size: 407mm 229mm;/);
  assert.match(styles, /\.reference-layout \{/);
  assert.match(styles, /\.scope3-reference-layout \{/);
  assert.match(styles, /\.scope3-workspace \{/);
  assert.match(styles, /\.reference-nav-group \{/);
  assert.match(styles, /\.mapping-summary \{/);
  assert.match(styles, /\.metric-workspace-tabs \{/);
  assert.match(styles, /\.metric-detail-editor \{/);
  assert.match(styles, /\.target-allocation-toggle \{/);
  assert.match(styles, /\.plan-status-preview p \{ font-size: 13px;/);
  assert.match(styles, /\.data-table td \{ height: 78px;/);
});
