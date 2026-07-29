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
  assert.match(factorLibrary, /EF-S1-WELDING-CO2/);
  assert.match(factorLibrary, /EF-S2-ELECTRICITY-2023/);
  assert.match(factorLibrary, /Cat\.15/);
  assert.match(page, /"예정" \| "수집중" \| "검토중" \| "마감" \| "잠금"/);
  assert.match(page, /title="변경 이력"/);
  assert.match(styles, /body \{ font-size: 16px; line-height: 1\.58; \}/);
  assert.match(styles, /\.plan-status-preview p \{ font-size: 13px;/);
  assert.match(styles, /\.data-table td \{ height: 78px;/);
});
