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
});

test("preserves the latest operating workflow and readable type scale", async () => {
  const [page, styles, factorLibrary] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/emission-factor-library.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /감축목표·이행계획/);
  assert.match(page, /연도별 목표·실적 모니터링/);
  assert.match(page, /배출 전망/);
  assert.match(page, /"내부 감축" \| "외부 감축" \| "비정량 과제"/);
  assert.match(page, /연간 절감비/);
  assert.match(page, /ESG 정량데이터 수집/);
  assert.match(page, /지속가능경영보고서 작성/);
  assert.match(page, /교육시간·용수·대기오염·폐기물/);
  assert.match(page, /확정 ESG 정량데이터 자동 연결/);
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
  assert.match(styles, /\.plan-status-preview p \{ font-size: 13px;/);
  assert.match(styles, /\.data-table td \{ height: 78px;/);
});
