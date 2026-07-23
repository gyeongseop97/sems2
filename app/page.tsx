"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

type View = "dashboard" | "periods" | "collection" | "review" | "inventory" | "evidence" | "indicators" | "audit" | "settings";
type Scope = "Scope 1" | "Scope 2" | "Scope 3";
type RecordStatus = "작성중" | "검토대기" | "반려" | "확정";
type EvidenceStatus = "수집중" | "완료" | "보완 요청" | "미제출";
type PeriodStatus = "예정" | "수집중" | "검토중" | "마감" | "잠금";
type SettingTab = "organization" | "factors" | "criteria" | "notifications" | "permissions" | "data";

type CollectionPeriod = {
  id: string;
  name: string;
  cycle: "월" | "분기" | "반기" | "연" | "수시";
  dataFrom: string;
  dataTo: string;
  openDate: string;
  dueDate: string;
  reviewDate: string;
  scopes: Scope[];
  companies: string[];
  evidenceRequired: boolean;
  status: PeriodStatus;
  description: string;
};

type ActivityRecord = {
  id: number;
  collectionId?: string;
  company: string;
  site: string;
  period: string;
  scope: Scope;
  category: string;
  source: string;
  usage: number;
  unit: string;
  factor: number;
  emissions: number;
  owner: string;
  department: string;
  status: RecordStatus;
  evidence: string;
  description?: string;
  rejectionReason?: string;
  locked?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt: string;
};

type AuditEvent = {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

type CollectionCriteria = {
  variance: number;
  evidenceRequired: boolean;
  lockConfirmed: boolean;
  defaultYear: string;
};

type NotificationPrefs = {
  deadline: boolean;
  review: boolean;
  rejected: boolean;
  weekly: boolean;
};

type EmissionFactor = {
  id: string;
  scope: Scope;
  category: string;
  source: string;
  value: number;
  activityUnit: string;
  factorUnit: string;
  year: string;
  authority: string;
  active: boolean;
};

type EvidenceItem = {
  id: number;
  title: string;
  category: string;
  period: string;
  owner: string;
  received: number;
  total: number;
  due: string;
  status: EvidenceStatus;
};

type Indicator = {
  id: number;
  code: string;
  name: string;
  category: "환경" | "사회" | "지배구조";
  unit: string;
  cycle: string;
  owner: string;
  progress: number;
};

const navItems: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "대시보드", icon: "dashboard" },
  { id: "periods", label: "수집 기간", icon: "calendar" },
  { id: "collection", label: "데이터 수집", icon: "database" },
  { id: "review", label: "검토·승인", icon: "check" },
  { id: "inventory", label: "온실가스 인벤토리", icon: "leaf" },
  { id: "evidence", label: "증빙자료", icon: "file" },
  { id: "indicators", label: "ESG 지표 관리", icon: "list" },
  { id: "audit", label: "변경 이력", icon: "clock" },
];

const initialPeriods: CollectionPeriod[] = [
  {
    id: "CP-2026-07",
    name: "2026년 7월 ESG 정기수집",
    cycle: "월",
    dataFrom: "2026-06",
    dataTo: "2026-06",
    openDate: "2026-07-01",
    dueDate: "2026-07-25",
    reviewDate: "2026-07-31",
    scopes: ["Scope 1", "Scope 2", "Scope 3"],
    companies: ["세원정공", "세원물산", "세원테크", "세원E&I"],
    evidenceRequired: true,
    status: "수집중",
    description: "6월 활동자료와 원천 증빙을 법인별로 수집합니다.",
  },
  {
    id: "CP-2026-06",
    name: "2026년 6월 ESG 정기수집",
    cycle: "월",
    dataFrom: "2026-05",
    dataTo: "2026-05",
    openDate: "2026-06-01",
    dueDate: "2026-06-25",
    reviewDate: "2026-06-30",
    scopes: ["Scope 1", "Scope 2", "Scope 3"],
    companies: ["세원정공", "세원물산", "세원테크", "세원E&I"],
    evidenceRequired: true,
    status: "잠금",
    description: "검토와 확정이 끝난 전월 수집기간입니다.",
  },
  {
    id: "CP-2026-Q3",
    name: "2026년 3분기 ESG 지표수집",
    cycle: "분기",
    dataFrom: "2026-07",
    dataTo: "2026-09",
    openDate: "2026-10-01",
    dueDate: "2026-10-12",
    reviewDate: "2026-10-20",
    scopes: ["Scope 1", "Scope 2", "Scope 3"],
    companies: ["세원정공", "세원물산", "세원테크", "세원E&I"],
    evidenceRequired: true,
    status: "예정",
    description: "3분기 환경·사회·지배구조 정량지표를 정기 수집합니다.",
  },
];

const initialFactors: EmissionFactor[] = [
  { id: "S1-LNG", scope: "Scope 1", category: "고정연소", source: "LNG", value: 2.176, activityUnit: "Nm³", factorUnit: "kgCO₂e/Nm³", year: "2025", authority: "환경부", active: true },
  { id: "S1-DIESEL", scope: "Scope 1", category: "이동연소", source: "경유", value: 2.582, activityUnit: "L", factorUnit: "kgCO₂e/L", year: "2025", authority: "환경부", active: true },
  { id: "S1-GAS", scope: "Scope 1", category: "이동연소", source: "휘발유", value: 2.179, activityUnit: "L", factorUnit: "kgCO₂e/L", year: "2025", authority: "환경부", active: true },
  { id: "S1-R410A", scope: "Scope 1", category: "비산배출", source: "냉매 R-410A", value: 2088, activityUnit: "kg", factorUnit: "kgCO₂e/kg", year: "AR5", authority: "IPCC", active: true },
  { id: "S2-ELEC", scope: "Scope 2", category: "구매 전력", source: "전력", value: 0.45941, activityUnit: "kWh", factorUnit: "kgCO₂e/kWh", year: "2025", authority: "환경부", active: true },
  { id: "S2-STEAM", scope: "Scope 2", category: "구매 열·스팀", source: "외부 공급 스팀", value: 0.221, activityUnit: "kg", factorUnit: "kgCO₂e/kg", year: "2025", authority: "사업자 고지", active: true },
  { id: "S3-PURCHASE", scope: "Scope 3", category: "Cat.1 구매한 제품·서비스", source: "철강 원재료", value: 2.1, activityUnit: "kg", factorUnit: "kgCO₂e/kg", year: "2025", authority: "공급사·LCA DB", active: true },
  { id: "S3-WASTE", scope: "Scope 3", category: "Cat.5 사업장 발생 폐기물", source: "혼합 폐기물", value: 0.467, activityUnit: "kg", factorUnit: "kgCO₂e/kg", year: "2025", authority: "환경부", active: true },
  { id: "S3-TRAVEL", scope: "Scope 3", category: "Cat.6 임직원 출장", source: "승용차 출장", value: 0.171, activityUnit: "km", factorUnit: "kgCO₂e/km", year: "2025", authority: "공시용 계수", active: true },
  { id: "S3-COMMUTE", scope: "Scope 3", category: "Cat.7 임직원 통근", source: "자가용·대중교통", value: 0.121, activityUnit: "km", factorUnit: "kgCO₂e/km", year: "2025", authority: "통근 설문 기준", active: true },
  { id: "S3-LOGISTICS", scope: "Scope 3", category: "Cat.9 다운스트림 운송", source: "화물차 운송", value: 0.109, activityUnit: "ton·km", factorUnit: "kgCO₂e/ton·km", year: "2025", authority: "물류 배출계수", active: true },
];

const initialRecords: ActivityRecord[] = [
  { id: 1, collectionId: "CP-2026-07", company: "세원정공", site: "대구공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 1248500, unit: "kWh", factor: 0.45941, emissions: 573.56, owner: "김민수", department: "시설팀", status: "확정", evidence: "2026_06_electricity.pdf", description: "한국전력 월별 고지서 기준", locked: true, active: true, updatedAt: "07.18 14:20" },
  { id: 2, collectionId: "CP-2026-07", company: "세원정공", site: "대구공장", period: "2026-06", scope: "Scope 1", category: "고정연소", source: "LNG", usage: 84200, unit: "Nm³", factor: 2.176, emissions: 183.22, owner: "김민수", department: "시설팀", status: "검토대기", evidence: "lng_202606.xlsx", description: "도시가스 사용내역 기준", active: true, updatedAt: "07.19 10:12" },
  { id: 3, collectionId: "CP-2026-07", company: "세원테크", site: "경산공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 764800, unit: "kWh", factor: 0.45941, emissions: 351.36, owner: "이서연", department: "생산관리팀", status: "검토대기", evidence: "전기요금_6월.pdf", active: true, updatedAt: "07.20 09:41" },
  { id: 4, collectionId: "CP-2026-07", company: "세원E&I", site: "영천공장", period: "2026-06", scope: "Scope 1", category: "이동연소", source: "경유", usage: 4280, unit: "L", factor: 2.582, emissions: 11.05, owner: "박지훈", department: "총무팀", status: "작성중", evidence: "", active: true, updatedAt: "07.20 16:05" },
  { id: 5, collectionId: "CP-2026-07", company: "세원물산", site: "대구공장", period: "2026-06", scope: "Scope 3", category: "Cat.7 임직원 통근", source: "자가용·대중교통", usage: 384200, unit: "km", factor: 0.121, emissions: 46.49, owner: "최유진", department: "인사팀", status: "반려", evidence: "통근설문_집계.xlsx", rejectionReason: "근무일수 산출근거와 설문 원본을 함께 첨부해 주세요.", active: true, updatedAt: "07.21 11:32" },
  { id: 6, collectionId: "CP-2026-06", company: "세원정공", site: "대구공장", period: "2026-05", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 1194200, unit: "kWh", factor: 0.45941, emissions: 548.57, owner: "김민수", department: "시설팀", status: "확정", evidence: "2026_05_electricity.pdf", locked: true, active: true, updatedAt: "06.17 15:10" },
  { id: 7, collectionId: "CP-2026-07", company: "세원테크", site: "경산공장", period: "2026-06", scope: "Scope 1", category: "비산배출", source: "냉매 R-410A", usage: 18.5, unit: "kg", factor: 2088, emissions: 38.63, owner: "윤태호", department: "설비보전팀", status: "확정", evidence: "냉매충전_점검표.pdf", locked: true, active: true, updatedAt: "07.18 08:52" },
  { id: 8, collectionId: "CP-2026-07", company: "세원E&I", site: "영천공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 496300, unit: "kWh", factor: 0.45941, emissions: 228.01, owner: "정예린", department: "생산관리팀", status: "작성중", evidence: "", active: true, updatedAt: "07.22 13:11" },
];

const initialAudit: AuditEvent[] = [
  { id: 1, at: "2026-07-22 13:11", actor: "정예린", action: "자료 저장", target: "세원E&I · 전력", detail: "2026-06 구매전력 활동자료를 작성 중으로 저장했습니다." },
  { id: 2, at: "2026-07-21 11:32", actor: "문경섭", action: "보완 요청", target: "세원물산 · 임직원 통근", detail: "근무일수 산출근거와 설문 원본 첨부를 요청했습니다." },
  { id: 3, at: "2026-07-20 09:41", actor: "이서연", action: "검토 제출", target: "세원테크 · 전력", detail: "2026-06 활동자료와 증빙을 검토 대기로 제출했습니다." },
];

const initialEvidenceItems: EvidenceItem[] = [
  { id: 1, title: "전력 사용량 및 요금 고지서", category: "온실가스·에너지", period: "월", owner: "시설팀", received: 10, total: 12, due: "2026-07-25", status: "수집중" },
  { id: 2, title: "연료 구매 및 사용 내역", category: "온실가스·에너지", period: "월", owner: "총무팀", received: 8, total: 8, due: "2026-07-25", status: "완료" },
  { id: 3, title: "폐기물 처리 실적 및 인계서", category: "환경", period: "분기", owner: "환경안전팀", received: 5, total: 8, due: "2026-07-31", status: "수집중" },
  { id: 4, title: "안전보건 교육 실시 결과", category: "사회", period: "분기", owner: "안전보건팀", received: 7, total: 8, due: "2026-07-31", status: "수집중" },
  { id: 5, title: "협력사 ESG 평가 결과", category: "공급망", period: "반기", owner: "구매팀", received: 8, total: 8, due: "2026-07-15", status: "완료" },
];

const initialIndicators: Indicator[] = [
  { id: 1, code: "E-01", name: "온실가스 배출량 (Scope 1·2)", category: "환경", unit: "tCO₂e", cycle: "월", owner: "시설팀", progress: 92 },
  { id: 2, code: "E-02", name: "에너지 사용량", category: "환경", unit: "MWh", cycle: "월", owner: "시설팀", progress: 92 },
  { id: 3, code: "E-04", name: "폐기물 발생 및 재활용량", category: "환경", unit: "ton", cycle: "월", owner: "환경안전팀", progress: 75 },
  { id: 4, code: "S-03", name: "산업재해 및 근로손실률", category: "사회", unit: "건 / %", cycle: "월", owner: "안전보건팀", progress: 100 },
  { id: 5, code: "S-07", name: "교육훈련 시간", category: "사회", unit: "시간", cycle: "분기", owner: "인사팀", progress: 88 },
  { id: 6, code: "G-02", name: "윤리·준법 교육 이수율", category: "지배구조", unit: "%", cycle: "분기", owner: "기획팀", progress: 100 },
];

const companies = ["세원정공", "세원물산", "세원테크", "세원E&I"];
const sitesByCompany: Record<string, string[]> = {
  세원정공: ["대구공장"], 세원물산: ["대구공장"], 세원테크: ["경산공장"], "세원E&I": ["영천공장"],
};

type IconName = "dashboard" | "database" | "leaf" | "file" | "list" | "settings" | "bell" | "search" | "plus" | "download" | "menu" | "close" | "chevron" | "check" | "clock" | "alert" | "building" | "upload" | "calendar" | "more" | "arrow" | "target" | "bolt" | "droplet" | "trash" | "edit" | "lock" | "refresh";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C14.4 3 20 4 20 4s1 5.6-2.1 10.2A7 7 0 0 1 11 20Z"/><path d="M4 21c2.2-5.8 6-9.6 12-12"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.61.53 1.12 1.1 1.37.18.08.37.12.55.12H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, plus: <><path d="M12 5v14M5 12h14"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>, menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>, chevron: <path d="m9 18 6-6-6-6"/>, check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, alert: <><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    building: <><path d="M3 21h18M6 21V5l6-3 6 3v16M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>, bolt: <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/>,
    droplet: <path d="M12 2s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z"/>, trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>, lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    refresh: <><path d="M20 7h-5V2"/><path d="M20 7a8 8 0 1 0 1 8"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatNumber(value: number, digits = 0) { return value.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
function csvEscape(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function downloadCsv(filename: string, header: (string | number)[], rows: (string | number)[][]) {
  const blob = new Blob(["\ufeff" + [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function nowLabel() {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(/\. /g, "-").replace(".", "");
}
function daysUntil(date: string) {
  const target = new Date(`${date}T23:59:59`);
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}
function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const result: string[] = [];
  for (let cursor = fy * 12 + fm - 1; cursor <= ty * 12 + tm - 1; cursor += 1) {
    result.push(`${Math.floor(cursor / 12)}-${String(cursor % 12 + 1).padStart(2, "0")}`);
  }
  return result;
}
function previousMonth(period: string, yearOffset = 0) {
  const [year, month] = period.split("-").map(Number);
  const cursor = year * 12 + month - 1 - (yearOffset ? 12 : 1);
  return `${Math.floor(cursor / 12)}-${String(cursor % 12 + 1).padStart(2, "0")}`;
}
function periodTone(status: PeriodStatus) {
  return status === "수집중" ? "done" : status === "검토중" ? "pending" : status === "예정" ? "draft" : status === "잠금" ? "locked" : "closed";
}

function StatusBadge({ status }: { status: string }) {
  const key = status === "확정" || status === "완료" ? "done" : status === "검토대기" || status === "수집중" ? "pending" : status === "반려" || status === "보완 요청" ? "rejected" : "draft";
  return <span className={`status-badge ${key}`}><span className="status-dot" />{status}</span>;
}

function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{children && <div className="page-actions">{children}</div>}</div>;
}

function Overlay({ title, eyebrow, description, onClose, children, size = "normal" }: { title: string; eyebrow: string; description?: string; onClose: () => void; children: ReactNode; size?: "normal" | "small" }) {
  useEffect(() => { const close = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", close); document.body.classList.add("menu-open"); return () => { window.removeEventListener("keydown", close); document.body.classList.remove("menu-open"); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className={`record-modal ${size === "small" ? "small-modal" : ""}`} role="dialog" aria-modal="true"><div className="modal-header"><div><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="close" /></button></div>{children}</div></div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [records, setRecords] = useState<ActivityRecord[]>(initialRecords);
  const [factors, setFactors] = useState<EmissionFactor[]>(initialFactors);
  const [evidence, setEvidence] = useState<EvidenceItem[]>(initialEvidenceItems);
  const [indicators, setIndicators] = useState<Indicator[]>(initialIndicators);
  const [periods, setPeriods] = useState<CollectionPeriod[]>(initialPeriods);
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [criteria, setCriteria] = useState<CollectionCriteria>({ variance: 10, evidenceRequired: true, lockConfirmed: true, defaultYear: "2026" });
  const [noticePrefs, setNoticePrefs] = useState<NotificationPrefs>({ deadline: true, review: true, rejected: true, weekly: false });
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRecord | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedPeriods = localStorage.getItem("sems2-periods"); if (savedPeriods) setPeriods(JSON.parse(savedPeriods));
        const savedRecords = localStorage.getItem("sems2-records"); if (savedRecords) setRecords((JSON.parse(savedRecords) as ActivityRecord[]).map(r => ({ ...r, collectionId: r.collectionId ?? (r.period === "2026-05" ? "CP-2026-06" : "CP-2026-07"), active: r.active ?? true, source: r.source === "한국전력" ? "전력" : r.source, category: r.category === "임직원 통근" ? "Cat.7 임직원 통근" : r.category })));
        const savedFactors = localStorage.getItem("sems2-factors"); if (savedFactors) setFactors(JSON.parse(savedFactors));
        const savedEvidence = localStorage.getItem("sems2-evidence"); if (savedEvidence) setEvidence(JSON.parse(savedEvidence));
        const savedIndicators = localStorage.getItem("sems2-indicators"); if (savedIndicators) setIndicators(JSON.parse(savedIndicators));
        const savedAudit = localStorage.getItem("sems2-audit"); if (savedAudit) setAudit(JSON.parse(savedAudit));
        const savedCriteria = localStorage.getItem("sems2-criteria"); if (savedCriteria) setCriteria(JSON.parse(savedCriteria));
        const savedNotices = localStorage.getItem("sems2-notice-prefs"); if (savedNotices) setNoticePrefs(JSON.parse(savedNotices));
      } catch { /* 손상된 로컬 값 대신 기본 운영 구성을 사용합니다. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-periods", JSON.stringify(periods)); }, [periods, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-records", JSON.stringify(records)); }, [records, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-factors", JSON.stringify(factors)); }, [factors, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-evidence", JSON.stringify(evidence)); }, [evidence, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-indicators", JSON.stringify(indicators)); }, [indicators, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-audit", JSON.stringify(audit)); }, [audit, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-criteria", JSON.stringify(criteria)); }, [criteria, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-notice-prefs", JSON.stringify(noticePrefs)); }, [noticePrefs, hydrated]);
  useEffect(() => { document.body.classList.toggle("menu-open", mobileMenu || modalOpen || bulkOpen || guideOpen); return () => document.body.classList.remove("menu-open"); }, [mobileMenu, modalOpen, bulkOpen, guideOpen]);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const addAudit = (action: string, target: string, detail: string, actor = "문경섭") => {
    setAudit(current => [{ id: Math.max(0, ...current.map(item => item.id)) + 1, at: nowLabel(), actor, action, target, detail }, ...current].slice(0, 500));
  };
  const navigate = (view: View) => { setActiveView(view); setMobileMenu(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openForm = (record?: ActivityRecord) => {
    if (record?.locked || periods.find(period => period.id === record?.collectionId)?.status === "잠금") {
      showToast("잠금된 자료는 수정할 수 없습니다. 수집 기간을 다시 열어야 합니다.");
      return;
    }
    setEditing(record ?? null); setModalOpen(true);
  };
  const saveRecord = (record: ActivityRecord) => {
    const exists = record.id !== 0 && records.some(item => item.id === record.id);
    const duplicate = records.some(item => item.id !== record.id && item.collectionId === record.collectionId && item.company === record.company && item.site === record.site && item.period === record.period && item.scope === record.scope && item.category === record.category && item.source === record.source);
    if (duplicate) { showToast("같은 수집기간·사업장·귀속월·활동자료가 이미 등록되어 있습니다."); return; }
    const saved = exists ? record : { ...record, id: Math.max(0, ...records.map(item => item.id)) + 1, createdAt: nowLabel(), active: true };
    setRecords(exists ? records.map(item => item.id === saved.id ? saved : item) : [saved, ...records]);
    addAudit(exists ? "자료 수정" : "자료 등록", `${saved.company} · ${saved.source}`, `${saved.period} ${saved.scope} 활동자료 ${formatNumber(saved.usage, saved.usage < 100 ? 1 : 0)} ${saved.unit}`);
    setModalOpen(false); setEditing(null); showToast(exists ? "입력 자료를 수정했습니다." : "새 활동자료를 저장했습니다.");
  };
  const updateRecords = (next: ActivityRecord[], auditInfo?: { action: string; target: string; detail: string }) => { setRecords(next); if (auditInfo) addAudit(auditInfo.action, auditInfo.target, auditInfo.detail); };
  const importRecords = (rows: ActivityRecord[]) => {
    setRecords(current => [...rows, ...current]);
    addAudit("Excel 일괄등록", `${rows.length}건`, `${rows.length}건의 활동자료를 검증 후 일괄 등록했습니다.`);
    setBulkOpen(false); showToast(`${rows.length}건을 일괄 등록했습니다.`);
  };
  const exportBackup = () => {
    const payload = { version: 2, exportedAt: new Date().toISOString(), periods, records, factors, evidence, indicators, audit, criteria, noticePrefs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `SEMS_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    showToast("전체 운영 데이터를 백업했습니다.");
  };
  const restoreBackup = (payload: Record<string, unknown>) => {
    if (!Array.isArray(payload.periods) || !Array.isArray(payload.records) || !Array.isArray(payload.factors)) { showToast("SEMS 백업 파일 형식이 아닙니다."); return; }
    setPeriods(payload.periods as CollectionPeriod[]); setRecords(payload.records as ActivityRecord[]); setFactors(payload.factors as EmissionFactor[]);
    if (Array.isArray(payload.evidence)) setEvidence(payload.evidence as EvidenceItem[]); if (Array.isArray(payload.indicators)) setIndicators(payload.indicators as Indicator[]); if (Array.isArray(payload.audit)) setAudit(payload.audit as AuditEvent[]);
    if (payload.criteria) setCriteria(payload.criteria as CollectionCriteria); if (payload.noticePrefs) setNoticePrefs(payload.noticePrefs as NotificationPrefs);
    addAudit("데이터 복원", "전체 운영 데이터", "백업 파일에서 기간·활동자료·기준정보를 복원했습니다."); showToast("백업 데이터를 복원했습니다.");
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span>S</span></div><div><strong>SEMS</strong><small>Sewon ESG Management</small></div><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기"><Icon name="close" /></button></div>
      <nav className="main-nav" aria-label="주 메뉴"><span className="nav-group-label">OVERVIEW</span>{navItems.slice(0, 1).map(item => <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => navigate(item.id)} />)}<span className="nav-group-label">ESG MANAGEMENT</span>{navItems.slice(1).map(item => <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => navigate(item.id)} count={item.id === "review" ? records.filter(r => r.status === "검토대기").length : undefined} />)}</nav>
      <div className="sidebar-bottom"><button className={`nav-button ${activeView === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Icon name="settings" /><span>시스템 설정</span></button><div className="help-card"><div className="help-icon">?</div><strong>도움이 필요하신가요?</strong><p>입력 기준과 실제 사용 순서를 확인하세요.</p><button onClick={() => { setGuideOpen(true); setMobileMenu(false); }}>사용 가이드 <Icon name="arrow" size={14} /></button></div></div>
    </aside>
    {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" />}
    <div className="workspace">
      <header className="topbar"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Icon name="menu" /></button><div className="breadcrumb"><span>SEMS</span><Icon name="chevron" size={14} /><strong>{navItems.find(n => n.id === activeView)?.label ?? "시스템 설정"}</strong></div><div className="topbar-actions"><div className="demo-label operating"><span /> 운영 데이터 자동저장</div><button className="icon-button notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label="알림"><Icon name="bell" />{!notificationsRead && <span className="notification-dot" />}</button><button className="profile profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><div className="avatar">문</div><div><strong>문경섭</strong><span>기획팀 · 관리자</span></div><Icon name="chevron" size={15} /></button></div>
        {notificationsOpen && <NotificationPanel periods={periods} records={records} onClose={() => setNotificationsOpen(false)} onRead={() => { setNotificationsRead(true); setNotificationsOpen(false); showToast("모든 알림을 확인했습니다."); }} />}
        {profileOpen && <ProfilePanel onSettings={() => navigate("settings")} onBackup={exportBackup} />}
      </header>
      <main className="content">
        {activeView === "dashboard" && <Dashboard records={records} periods={periods} onNavigate={navigate} onNew={() => openForm()} />}
        {activeView === "periods" && <Periods periods={periods} records={records} onChange={setPeriods} addAudit={addAudit} showToast={showToast} />}
        {activeView === "collection" && <Collection records={records} periods={periods} criteria={criteria} onNew={() => openForm()} onBulk={() => setBulkOpen(true)} onEdit={openForm} onChange={updateRecords} showToast={showToast} />}
        {activeView === "review" && <Review records={records} periods={periods} criteria={criteria} onChange={updateRecords} showToast={showToast} />}
        {activeView === "inventory" && <Inventory records={records} showToast={showToast} />}
        {activeView === "evidence" && <Evidence items={evidence} onChange={setEvidence} showToast={showToast} />}
        {activeView === "indicators" && <Indicators items={indicators} onChange={setIndicators} showToast={showToast} />}
        {activeView === "audit" && <AuditLog items={audit} showToast={showToast} />}
        {activeView === "settings" && <Settings factors={factors} onFactorsChange={setFactors} criteria={criteria} onCriteriaChange={setCriteria} noticePrefs={noticePrefs} onNoticePrefsChange={setNoticePrefs} onExport={exportBackup} onRestore={restoreBackup} showToast={showToast} />}
      </main>
    </div>
    {modalOpen && <RecordModal record={editing} records={records} periods={periods} factors={factors} criteria={criteria} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveRecord} />}
    {bulkOpen && <BulkImport records={records} periods={periods} factors={factors} onClose={() => setBulkOpen(false)} onImport={importRecords} />}
    {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
  </div>;
}

function NavButton({ item, active, onClick, count }: { item: { id: View; label: string; icon: IconName }; active: boolean; onClick: () => void; count?: number }) { return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon name={item.icon} /><span>{item.label}</span>{count ? <em>{count}</em> : null}</button>; }

function NotificationPanel({ periods, records, onClose, onRead }: { periods: CollectionPeriod[]; records: ActivityRecord[]; onClose: () => void; onRead: () => void }) {
  const active = periods.find(period => period.status === "수집중");
  const pending = records.filter(record => record.status === "검토대기").length;
  const rejected = records.filter(record => record.status === "반려").length;
  return <div className="notification-panel"><div className="panel-title"><strong>업무 알림</strong><button onClick={onClose} aria-label="알림 닫기"><Icon name="close" size={16} /></button></div>
    {active && <div className="notification-item unread"><span className="notification-icon warning"><Icon name="calendar" size={17} /></span><div><strong>{active.name}</strong><p>제출 마감까지 {Math.max(0, daysUntil(active.dueDate))}일 남았습니다.</p><small>{active.dueDate} 마감</small></div></div>}
    <div className="notification-item"><span className="notification-icon success"><Icon name="check" size={17} /></span><div><strong>검토 대기 {pending}건</strong><p>기획실 검토와 확정 처리가 필요합니다.</p><small>현재 기준</small></div></div>
    {rejected > 0 && <div className="notification-item"><span className="notification-icon warning"><Icon name="alert" size={17} /></span><div><strong>보완 요청 {rejected}건</strong><p>담당자 재작성과 재제출이 필요합니다.</p><small>현재 기준</small></div></div>}
    <button className="all-notifications" onClick={onRead}>모두 확인</button></div>;
}
function ProfilePanel({ onSettings, onBackup }: { onSettings: () => void; onBackup: () => void }) { return <div className="profile-panel"><div><strong>문경섭</strong><span>기획팀 · 시스템 관리자</span></div><button onClick={onSettings}><Icon name="settings" size={16} />시스템 설정</button><button onClick={onBackup}><Icon name="download" size={16} />전체 데이터 백업</button><p>현재 입력 내용은 이 브라우저에 자동 저장됩니다. 정기 백업을 권장합니다.</p></div>; }

function GuideModal({ onClose }: { onClose: () => void }) { return <Overlay title="SEMS 사용 가이드" eyebrow="OPERATING GUIDE" description="수집기간 개설부터 마감·잠금까지의 실제 운영 순서입니다." onClose={onClose}><div className="guide-steps"><div><span>01</span><strong>수집기간 개설</strong><p>대상 귀속기간, 제출·검토 마감일, 법인과 Scope를 정한 뒤 수집을 시작합니다.</p></div><div><span>02</span><strong>활동자료 등록</strong><p>Scope를 선택하면 해당 활동자료만 표시되며 승인된 배출계수가 자동 적용됩니다.</p></div><div><span>03</span><strong>검증·제출</strong><p>중복, 증빙, 전월·전년 대비 이상치를 확인하고 검토 대기로 제출합니다.</p></div><div><span>04</span><strong>검토·보완·확정</strong><p>기획실에서 증빙과 산정값을 검토하고 보완 요청 또는 확정 처리합니다.</p></div><div><span>05</span><strong>마감·잠금</strong><p>검토가 끝난 기간을 잠그면 확정 자료 수정과 삭제가 차단됩니다.</p></div><div><span>06</span><strong>백업·보고</strong><p>인벤토리와 증빙 현황을 내려받고 운영 데이터 전체를 정기 백업합니다.</p></div></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>; }

function Dashboard({ records, periods, onNavigate, onNew }: { records: ActivityRecord[]; periods: CollectionPeriod[]; onNavigate: (view: View) => void; onNew: () => void }) {
  const years = [...new Set(records.map(r => r.period.slice(0, 4)))].sort().reverse(); const [year, setYear] = useState(years[0] ?? "2026");
  const data = records.filter(r => r.period.startsWith(year)); const total = data.reduce((s, r) => s + r.emissions, 0); const confirmed = data.filter(r => r.status === "확정").length; const pending = data.filter(r => r.status === "검토대기");
  const activePeriod = periods.find(period => period.status === "수집중") ?? periods.find(period => period.status === "검토중");
  const scopeTotals = (["Scope 1", "Scope 2", "Scope 3"] as Scope[]).map(scope => data.filter(r => r.scope === scope).reduce((s, r) => s + r.emissions, 0));
  const completion = data.length ? Math.round((confirmed / data.length) * 100) : 0; const evidenceRate = data.length ? Math.round(data.filter(r => r.evidence).length / data.length * 1000) / 10 : 0;
  const monthly = Array.from({ length: 6 }, (_, i) => { const month = String(i + 1).padStart(2, "0"); const monthRows = data.filter(r => r.period === `${year}-${month}`); return { month: `${i + 1}월`, s1: monthRows.filter(r => r.scope === "Scope 1").reduce((s,r)=>s+r.emissions,0), s2: monthRows.filter(r => r.scope === "Scope 2").reduce((s,r)=>s+r.emissions,0), s3: monthRows.filter(r => r.scope === "Scope 3").reduce((s,r)=>s+r.emissions,0) }; });
  const chartMax = Math.max(1, ...monthly.map(m => m.s1 + m.s2 + m.s3)); const percents = scopeTotals.map(v => total ? Math.round(v / total * 100) : 0);
  return <><PageHeader eyebrow={`${year} ESG PERFORMANCE`} title="ESG 통합 대시보드" description="세원그룹의 ESG 데이터 수집 현황과 주요 성과를 한눈에 확인합니다."><label className="year-select"><Icon name="calendar" size={17} /><select value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />자료 입력</button></PageHeader>
    {activePeriod ? <section className="notice-banner"><div className="notice-icon"><Icon name="alert" /></div><div><strong>{activePeriod.name} · {activePeriod.status === "수집중" ? `제출 마감까지 ${Math.max(0, daysUntil(activePeriod.dueDate))}일` : "기획실 검토 진행 중"}</strong><p>{activePeriod.dataFrom}~{activePeriod.dataTo} 귀속자료 · 검토 대기 {pending.length}건</p></div><button onClick={() => onNavigate(activePeriod.status === "수집중" ? "collection" : "review")}>{activePeriod.status === "수집중" ? "수집 현황 보기" : "검토 화면 열기"} <Icon name="arrow" size={16} /></button></section> : <section className="notice-banner neutral"><div className="notice-icon"><Icon name="calendar" /></div><div><strong>현재 진행 중인 수집기간이 없습니다.</strong><p>수집 기간 메뉴에서 다음 정기수집을 개설해 주세요.</p></div><button onClick={() => onNavigate("periods")}>기간 설정 <Icon name="arrow" size={16} /></button></section>}
    <section className="kpi-grid"><KpiCard label="온실가스 배출량" value={formatNumber(total, 1)} unit="tCO₂e" trend="등록된 활동자료 기준" trendType="good" icon="leaf" tone="green"/><KpiCard label="데이터 확정률" value={String(completion)} unit="%" trend={`${confirmed}/${data.length}개 항목 확정`} trendType="neutral" icon="database" tone="blue" progress={completion}/><KpiCard label="검토 대기" value={String(pending.length)} unit="건" trend="기획실 검토가 필요합니다." trendType={pending.length ? "warn" : "good"} icon="clock" tone="amber"/><KpiCard label="증빙 연결률" value={String(evidenceRate)} unit="%" trend={`미연결 증빙 ${data.filter(r => !r.evidence).length}건`} trendType={evidenceRate < 100 ? "warn" : "good"} icon="file" tone="violet" progress={evidenceRate}/></section>
    <section className="dashboard-grid"><article className="card emissions-chart-card"><CardHeader title="월별 온실가스 배출 추이" subtitle="Scope 1·2·3 합산 배출량" action="단위: tCO₂e"/><div className="chart-legend"><span><i className="scope1"/>Scope 1</span><span><i className="scope2"/>Scope 2</span><span><i className="scope3"/>Scope 3</span></div><div className="bar-chart"><div className="axis-labels"><span>{formatNumber(chartMax,0)}</span><span>{formatNumber(chartMax*.75,0)}</span><span>{formatNumber(chartMax*.5,0)}</span><span>{formatNumber(chartMax*.25,0)}</span><span>0</span></div><div className="grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{monthly.map(item => { const sum=item.s1+item.s2+item.s3; return <div className="bar-group" key={item.month}><div className="bar-stack chart-scaled" style={{height:`${Math.max(sum/chartMax*170,4)}px`}}><span className="scope3" style={{height:`${sum ? item.s3/sum*100 : 0}%`}}/><span className="scope2" style={{height:`${sum ? item.s2/sum*100 : 0}%`}}/><span className="scope1" style={{height:`${sum ? item.s1/sum*100 : 0}%`}}/>{sum>0&&<b>{formatNumber(sum,0)}</b>}</div><small>{item.month}</small></div>; })}</div></div></article>
      <article className="card scope-card"><CardHeader title="Scope별 배출 구성" subtitle={`${year}년 누적 기준`}/><div className="donut-wrap"><div className="donut" style={{background:`conic-gradient(#156b55 0 ${percents[0]}%, #42a585 ${percents[0]}% ${percents[0]+percents[1]}%, #a6d7c7 ${percents[0]+percents[1]}% 100%)`}}><div><strong>{formatNumber(total,1)}</strong><span>tCO₂e</span></div></div></div><div className="scope-breakdown"><ScopeRow label="Scope 1" value={scopeTotals[0]} color="dark" percent={percents[0]}/><ScopeRow label="Scope 2" value={scopeTotals[1]} color="mid" percent={percents[1]}/><ScopeRow label="Scope 3" value={scopeTotals[2]} color="light" percent={percents[2]}/></div></article>
      <article className="card collection-card"><CardHeader title="법인별 확정 현황" subtitle={`${year}년 등록 자료 기준`} action={<button onClick={()=>onNavigate("collection")}>전체보기 <Icon name="arrow" size={14}/></button>}/><div className="company-progress">{companies.map(name => { const rows=data.filter(r=>r.company===name); const val=rows.length?Math.round(rows.filter(r=>r.status==="확정").length/rows.length*100):0; return <ProgressRow key={name} label={name} value={val} detail={`${rows.filter(r=>r.status==="확정").length} / ${rows.length}`}/>; })}</div></article>
      <article className="card review-card"><CardHeader title="검토 대기 자료" subtitle={`${pending.length}건의 자료가 확인을 기다리고 있습니다.`} action={<button onClick={()=>onNavigate("review")}>전체보기 <Icon name="arrow" size={14}/></button>}/><div className="review-list">{pending.length ? pending.slice(0,3).map(record=><button className="review-item" key={record.id} onClick={()=>onNavigate("review")}><div className={`source-icon ${record.scope==="Scope 1"?"green":"blue"}`}><Icon name={record.scope==="Scope 1"?"droplet":"bolt"} size={18}/></div><div><strong>{record.category} · {record.source}</strong><span>{record.company} / {record.site}</span></div><em>{formatNumber(record.emissions,1)} t</em><Icon name="chevron" size={16}/></button>):<div className="empty-state compact"><Icon name="check"/><strong>검토 대기 자료가 없습니다.</strong></div>}</div></article></section></>;
}

function KpiCard({label,value,unit,trend,trendType,icon,tone,progress}:{label:string;value:string;unit:string;trend:string;trendType:string;icon:IconName;tone:string;progress?:number}){return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon}/></div><div className="kpi-label">{label}</div><div className="kpi-value"><strong>{value}</strong><span>{unit}</span></div>{progress!==undefined&&<div className="mini-progress"><span style={{width:`${progress}%`}}/></div>}<div className={`kpi-trend ${trendType}`}>{trendType==="good"&&"✓"}{trendType==="warn"&&"!"} {trend}</div></article>}
function CardHeader({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action&&<div className="card-action">{action}</div>}</div>}
function ScopeRow({label,value,color,percent}:{label:string;value:number;color:string;percent:number}){return <div className="scope-row"><span><i className={color}/>{label}</span><strong>{formatNumber(value,1)}<small> t</small></strong><em>{percent}%</em></div>}
function ProgressRow({label,value,detail}:{label:string;value:number;detail:string}){return <div className="progress-row"><div><strong>{label}</strong><span>{detail}개 항목</span><em>{value}%</em></div><div className="progress-track"><span style={{width:`${value}%`}}/></div></div>}

function Periods({ periods, records, onChange, addAudit, showToast }: { periods: CollectionPeriod[]; records: ActivityRecord[]; onChange: (items: CollectionPeriod[]) => void; addAudit: (action: string, target: string, detail: string, actor?: string) => void; showToast: (m: string) => void }) {
  const [editing, setEditing] = useState<CollectionPeriod | "new" | null>(null);
  const updateStatus = (period: CollectionPeriod, status: PeriodStatus) => {
    if (status === "잠금" && records.some(record => record.collectionId === period.id && record.status === "검토대기")) { showToast("검토 대기 자료가 남아 있어 잠글 수 없습니다."); return; }
    const next = periods.map(item => item.id === period.id ? { ...item, status } : item);
    onChange(next);
    addAudit("수집기간 상태 변경", period.name, `${period.status}에서 ${status}(으)로 변경했습니다.`);
    showToast(`${period.name}을(를) ${status} 상태로 변경했습니다.`);
  };
  const save = (period: CollectionPeriod) => {
    const exists = periods.some(item => item.id === period.id);
    onChange(exists ? periods.map(item => item.id === period.id ? period : item) : [period, ...periods]);
    addAudit(exists ? "수집기간 수정" : "수집기간 개설", period.name, `${period.dataFrom}~${period.dataTo} 귀속자료 / 제출 ${period.dueDate} / 검토 ${period.reviewDate}`);
    setEditing(null); showToast(exists ? "수집기간 설정을 수정했습니다." : "새 수집기간을 개설했습니다.");
  };
  return <><PageHeader eyebrow="COLLECTION PERIOD" title="수집 기간 관리" description="귀속기간, 대상 법인·Scope, 제출·검토 마감과 잠금 상태를 운영합니다."><button className="primary-button" onClick={() => setEditing("new")}><Icon name="plus" size={17}/>수집기간 개설</button></PageHeader>
    <section className="period-summary collection-summary"><SummaryTile label="수집 진행" value={periods.filter(item=>item.status==="수집중").length} suffix="건" icon="calendar" tone="green"/><SummaryTile label="검토 진행" value={periods.filter(item=>item.status==="검토중").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="예정" value={periods.filter(item=>item.status==="예정").length} suffix="건" icon="list"/><SummaryTile label="잠금 완료" value={periods.filter(item=>item.status==="잠금").length} suffix="건" icon="lock"/></section>
    <section className="period-grid">{periods.map(period => {
      const rows = records.filter(record => record.collectionId === period.id);
      const submitted = rows.filter(record => ["검토대기","확정"].includes(record.status)).length;
      const confirmed = rows.filter(record => record.status === "확정").length;
      const completion = rows.length ? Math.round(confirmed / rows.length * 100) : 0;
      return <article className="card period-card" key={period.id}><div className="period-card-top"><div><span className={`status-badge ${periodTone(period.status)}`}><span className="status-dot"/>{period.status}</span><h2>{period.name}</h2><p>{period.description}</p></div><button className="icon-button" onClick={()=>setEditing(period)} aria-label="기간 수정"><Icon name="edit" size={17}/></button></div>
        <div className="period-dates"><div><span>귀속기간</span><strong>{period.dataFrom === period.dataTo ? period.dataFrom : `${period.dataFrom} ~ ${period.dataTo}`}</strong></div><div><span>수집기간</span><strong>{period.openDate} ~ {period.dueDate}</strong></div><div><span>검토마감</span><strong>{period.reviewDate}</strong></div></div>
        <div className="period-targets"><span>{period.cycle} 수집</span><span>{period.companies.length}개 법인</span><span>{period.scopes.join(" · ")}</span><span>{period.evidenceRequired ? "증빙 필수" : "증빙 선택"}</span></div>
        <div className="period-progress"><div><span>등록 {rows.length}건 · 제출 {submitted}건 · 확정 {confirmed}건</span><strong>{completion}%</strong></div><div className="progress-track"><span style={{width:`${completion}%`}}/></div></div>
        <div className="period-actions">{period.status === "예정" && <button className="primary-button compact" onClick={()=>updateStatus(period,"수집중")}>수집 시작</button>}{period.status === "수집중" && <button className="primary-button compact" onClick={()=>updateStatus(period,"검토중")}>제출 마감·검토 시작</button>}{period.status === "검토중" && <button className="primary-button compact" onClick={()=>updateStatus(period,"잠금")}>검토 완료·잠금</button>}{["마감","잠금"].includes(period.status) && <button className="secondary-button compact" onClick={()=>updateStatus(period,"수집중")}>기간 다시 열기</button>}<button className="secondary-button compact" onClick={()=>setEditing(period)}>설정 수정</button></div>
      </article>;
    })}</section>
    {editing && <PeriodForm item={editing === "new" ? null : editing} existing={periods} onClose={()=>setEditing(null)} onSave={save}/>}
  </>;
}

function PeriodForm({ item, existing, onClose, onSave }: { item: CollectionPeriod | null; existing: CollectionPeriod[]; onClose: () => void; onSave: (item: CollectionPeriod) => void }) {
  const nextId = `CP-${new Date().getFullYear()}-${String(existing.length + 1).padStart(2,"0")}`;
  const [form, setForm] = useState<CollectionPeriod>(item ?? { id: nextId, name: "", cycle: "월", dataFrom: "2026-07", dataTo: "2026-07", openDate: "2026-08-01", dueDate: "2026-08-25", reviewDate: "2026-08-31", scopes: ["Scope 1","Scope 2"], companies: [...companies], evidenceRequired: true, status: "예정", description: "" });
  const [error, setError] = useState("");
  const patch = (next: Partial<CollectionPeriod>) => setForm(current => ({ ...current, ...next }));
  const toggleScope = (scope: Scope) => patch({ scopes: form.scopes.includes(scope) ? form.scopes.filter(item => item !== scope) : [...form.scopes, scope] });
  const toggleCompany = (company: string) => patch({ companies: form.companies.includes(company) ? form.companies.filter(item => item !== company) : [...form.companies, company] });
  const submit = (event: FormEvent) => { event.preventDefault(); if (form.dataFrom > form.dataTo) { setError("귀속기간 종료월은 시작월보다 빠를 수 없습니다."); return; } if (form.openDate > form.dueDate || form.dueDate > form.reviewDate) { setError("수집 시작일 → 제출 마감일 → 검토 마감일 순서로 설정해 주세요."); return; } if (!form.scopes.length || !form.companies.length) { setError("대상 법인과 Scope를 한 개 이상 선택해 주세요."); return; } onSave(form); };
  return <Overlay title={item ? "수집기간 수정" : "새 수집기간 개설"} eyebrow="COLLECTION SCHEDULE" description="기간이 수집중일 때만 담당자가 활동자료를 등록·제출할 수 있습니다." onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>수집 기본정보</h3><div className="form-grid"><label className="full-span">수집기간명<input value={form.name} onChange={e=>patch({name:e.target.value})} placeholder="예: 2026년 8월 ESG 정기수집" required/></label><label>수집 주기<select value={form.cycle} onChange={e=>patch({cycle:e.target.value as CollectionPeriod["cycle"]})}><option>월</option><option>분기</option><option>반기</option><option>연</option><option>수시</option></select></label><label>상태<select value={form.status} onChange={e=>patch({status:e.target.value as PeriodStatus})}><option>예정</option><option>수집중</option><option>검토중</option><option>마감</option><option>잠금</option></select></label><label>귀속 시작월<input type="month" value={form.dataFrom} onChange={e=>patch({dataFrom:e.target.value})} required/></label><label>귀속 종료월<input type="month" value={form.dataTo} onChange={e=>patch({dataTo:e.target.value})} required/></label></div></div>
    <div className="form-section"><h3><span>2</span>운영 일정</h3><div className="form-grid"><label>수집 시작일<input type="date" value={form.openDate} onChange={e=>patch({openDate:e.target.value})} required/></label><label>제출 마감일<input type="date" value={form.dueDate} onChange={e=>patch({dueDate:e.target.value})} required/></label><label>검토 마감일<input type="date" value={form.reviewDate} onChange={e=>patch({reviewDate:e.target.value})} required/></label><Toggle label="제출 시 증빙 필수" checked={form.evidenceRequired} onChange={value=>patch({evidenceRequired:value})}/></div></div>
    <div className="form-section"><h3><span>3</span>수집 대상</h3><div className="check-group"><strong>대상 Scope</strong><div>{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map(scope=><label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={()=>toggleScope(scope)}/>{scope}</label>)}</div></div><div className="check-group"><strong>대상 법인</strong><div>{companies.map(company=><label key={company}><input type="checkbox" checked={form.companies.includes(company)} onChange={()=>toggleCompany(company)}/>{company}</label>)}</div></div><label className="textarea-label">운영 설명<textarea value={form.description} onChange={e=>patch({description:e.target.value})} placeholder="수집 목적과 담당자가 확인할 사항을 적어 주세요."/></label>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div>
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" type="submit"><Icon name="check" size={16}/>저장</button></div>
  </form></Overlay>;
}

function Collection({ records, periods, criteria, onNew, onBulk, onEdit, onChange, showToast }: { records: ActivityRecord[]; periods: CollectionPeriod[]; criteria: CollectionCriteria; onNew: () => void; onBulk: () => void; onEdit: (record: ActivityRecord) => void; onChange: (records: ActivityRecord[], auditInfo?: { action: string; target: string; detail: string }) => void; showToast: (m: string) => void }) {
  const activePeriods = periods.filter(period => ["수집중","검토중"].includes(period.status));
  const [periodId,setPeriodId]=useState(activePeriods[0]?.id ?? periods[0]?.id ?? "전체");
  const [search,setSearch]=useState(""); const [status,setStatus]=useState("전체"); const [company,setCompany]=useState("전체 법인"); const [scope,setScope]=useState("전체 Scope"); const [page,setPage]=useState(1); const pageSize=8;
  const filtered=records.filter(r=>(periodId==="전체"||r.collectionId===periodId)&&(status==="전체"||r.status===status)&&(company==="전체 법인"||r.company===company)&&(scope==="전체 Scope"||r.scope===scope)&&`${r.company} ${r.site} ${r.category} ${r.source} ${r.owner} ${r.description??""}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)); const visible=filtered.slice((Math.min(page,pageCount)-1)*pageSize,Math.min(page,pageCount)*pageSize);
  const exportCsv=()=>{downloadCsv("SEMS_activity_data.csv",["수집기간","법인","사업장","귀속월","Scope","구분","배출원","사용량","단위","배출계수","배출량(tCO2e)","증빙","설명","담당자","부서","상태"],filtered.map(r=>[periods.find(p=>p.id===r.collectionId)?.name??"",r.company,r.site,r.period,r.scope,r.category,r.source,r.usage,r.unit,r.factor,r.emissions,r.evidence,r.description??"",r.owner,r.department,r.status]));showToast("현재 조회 결과를 내려받았습니다.");};
  const submitRecord=(record:ActivityRecord)=>{const period=periods.find(item=>item.id===record.collectionId);if(!period||period.status!=="수집중"){showToast("현재 수집중인 기간의 자료만 제출할 수 있습니다.");return;}if((period.evidenceRequired||criteria.evidenceRequired)&&!record.evidence){showToast("증빙자료를 연결한 뒤 제출해 주세요.");return;}onChange(records.map(item=>item.id===record.id?{...item,status:"검토대기" as RecordStatus,rejectionReason:"",updatedAt:"방금 전"}:item),{action:"검토 제출",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료를 검토 대기로 제출했습니다.`});showToast("기획실 검토 대기로 제출했습니다.");};
  const remove=(record:ActivityRecord)=>{const period=periods.find(item=>item.id===record.collectionId);if(record.locked||record.status==="확정"||period?.status==="잠금"){showToast("확정 또는 잠금된 자료는 삭제할 수 없습니다.");return;}if(!window.confirm("이 활동자료를 삭제하시겠습니까?"))return;onChange(records.filter(item=>item.id!==record.id),{action:"자료 삭제",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료를 삭제했습니다.`});showToast("활동자료를 삭제했습니다.");};
  const variance=(record:ActivityRecord)=>{const prev=records.find(item=>item.company===record.company&&item.site===record.site&&item.scope===record.scope&&item.category===record.category&&item.source===record.source&&item.period===previousMonth(record.period));return prev?.usage?((record.usage-prev.usage)/prev.usage*100):null;};
  return <><PageHeader eyebrow="DATA COLLECTION" title="ESG 데이터 수집" description="개설된 수집기간 안에서 활동자료를 입력하고 중복·증빙·이상치를 검증합니다."><button className="secondary-button" onClick={onBulk}><Icon name="upload" size={17}/>Excel 일괄등록</button><button className="secondary-button" onClick={exportCsv}><Icon name="download" size={17}/>조회결과 내보내기</button><button className="primary-button" onClick={onNew} disabled={!periods.some(item=>item.status==="수집중")}><Icon name="plus" size={17}/>신규 자료 입력</button></PageHeader>
    <div className="period-filter-bar"><div><Icon name="calendar" size={18}/><span>수집기간</span><select value={periodId} onChange={e=>{setPeriodId(e.target.value);setPage(1)}}><option value="전체">전체 기간</option>{periods.map(item=><option value={item.id} key={item.id}>{item.name} · {item.status}</option>)}</select></div>{periods.find(item=>item.id===periodId)&&<span className={`status-badge ${periodTone(periods.find(item=>item.id===periodId)!.status)}`}><span className="status-dot"/>{periods.find(item=>item.id===periodId)!.status}</span>}</div>
    <section className="collection-summary"><SummaryTile label="조회 항목" value={filtered.length} suffix="건" icon="database"/><SummaryTile label="검토 대기" value={filtered.filter(r=>r.status==="검토대기").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="보완 요청" value={filtered.filter(r=>r.status==="반려").length} suffix="건" icon="alert" tone="red"/><SummaryTile label="확정 완료" value={filtered.filter(r=>r.status==="확정").length} suffix="건" icon="check" tone="green"/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","작성중","검토대기","반려","확정"].map(item=><button className={status===item?"active":""} key={item} onClick={()=>{setStatus(item);setPage(1)}}>{item==="반려"?"보완 요청":item}{item!=="전체"&&<span>{filtered.filter(r=>r.status===item).length}</span>}</button>)}</div><div className="filter-actions"><div className="search-box"><Icon name="search" size={17}/><input placeholder="배출원, 담당자, 설명 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><select value={scope} onChange={e=>{setScope(e.target.value);setPage(1)}} aria-label="Scope 필터"><option>전체 Scope</option><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select><select value={company} onChange={e=>{setCompany(e.target.value);setPage(1)}} aria-label="법인 필터"><option>전체 법인</option>{companies.map(c=><option key={c}>{c}</option>)}</select></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>귀속월</th><th>법인 / 사업장</th><th>Scope</th><th>활동자료 / 배출원</th><th className="align-right">사용량</th><th>전월 대비</th><th className="align-right">배출량</th><th>증빙</th><th>담당자</th><th>상태</th><th>작업</th></tr></thead><tbody>{visible.map(record=>{const change=variance(record);const isLocked=Boolean(record.locked||periods.find(item=>item.id===record.collectionId)?.status==="잠금");return <tr key={record.id} onDoubleClick={()=>onEdit(record)} className={isLocked?"locked-row":""}><td className="mono">{record.period}</td><td><strong>{record.company}</strong><span>{record.site}</span></td><td><span className={`scope-tag s${record.scope.slice(-1)}`}>{record.scope}</span></td><td><strong>{record.category}</strong><span>{record.source}</span></td><td className="align-right"><strong>{formatNumber(record.usage,record.usage<100?1:0)}</strong><span>{record.unit}</span></td><td>{change===null?<span className="muted">비교자료 없음</span>:<span className={`variance ${Math.abs(change)>=criteria.variance?"warning":""}`}>{change>=0?"+":""}{formatNumber(change,1)}%</span>}</td><td className="align-right"><strong>{formatNumber(record.emissions,2)}</strong><span>tCO₂e</span></td><td>{record.evidence?<span className="file-linked" title={record.evidence}><Icon name="file" size={15}/>연결</span>:<span className="file-missing">미연결</span>}</td><td><strong>{record.owner}</strong><span>{record.department}</span></td><td><StatusBadge status={record.status}/>{isLocked&&<span className="mini-lock"><Icon name="lock" size={12}/>잠금</span>}</td><td><div className="row-actions">{["작성중","반려"].includes(record.status)&&!isLocked&&<button onClick={()=>submitRecord(record)}>제출</button>}<button className="icon-row-button" onClick={()=>onEdit(record)} disabled={isLocked||record.status==="검토대기"} aria-label="수정"><Icon name="edit" size={15}/></button><button className="icon-row-button danger" onClick={()=>remove(record)} disabled={isLocked||record.status==="검토대기"} aria-label="삭제"><Icon name="trash" size={15}/></button></div></td></tr>})}</tbody></table>{!visible.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 활동자료가 없습니다.</strong><p>필터를 바꾸거나 수집중인 기간에 새 자료를 입력해 주세요.</p></div>}</div>
      <div className="table-footer"><span>총 {filtered.length}건 · {Math.min(page,pageCount)}/{pageCount}페이지</span><div className="pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>{Array.from({length:pageCount},(_,i)=><button key={i} className={page===i+1?"active":""} onClick={()=>setPage(i+1)}>{i+1}</button>)}<button disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>›</button></div></div></section></>;
}

function Review({ records, periods, criteria, onChange, showToast }: { records: ActivityRecord[]; periods: CollectionPeriod[]; criteria: CollectionCriteria; onChange: (records: ActivityRecord[], auditInfo?: { action: string; target: string; detail: string }) => void; showToast: (m: string) => void }) {
  const queue = records.filter(record => record.status === "검토대기");
  const [selectedId, setSelectedId] = useState<number | null>(queue[0]?.id ?? null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const selected = records.find(record => record.id === selectedId) ?? queue[0] ?? null;
  const visible = queue.filter(record => `${record.company} ${record.source} ${record.owner}`.toLowerCase().includes(search.toLowerCase()));
  const comparison = (period: string) => selected ? records.find(record => record.company === selected.company && record.site === selected.site && record.scope === selected.scope && record.category === selected.category && record.source === selected.source && record.period === period) : null;
  const prev = selected ? comparison(previousMonth(selected.period)) : null;
  const prevYear = selected ? comparison(previousMonth(selected.period, 1)) : null;
  const approve = () => { if (!selected) return; const period = periods.find(item=>item.id===selected.collectionId); if (period?.status==="잠금") { showToast("잠금된 수집기간의 자료는 처리할 수 없습니다."); return; } onChange(records.map(record=>record.id===selected.id?{...record,status:"확정" as RecordStatus,locked:criteria.lockConfirmed,rejectionReason:"",updatedAt:"방금 전"}:record),{action:"자료 확정",target:`${selected.company} · ${selected.source}`,detail:`${selected.period} 활동자료 ${formatNumber(selected.emissions,2)} tCO₂e를 검토·확정했습니다.`});showToast("활동자료를 검토·확정했습니다.");setSelectedId(queue.find(item=>item.id!==selected.id)?.id??null);setReason("");};
  const reject = () => { if (!selected) return; if (!reason.trim()) { showToast("보완 요청 사유를 입력해 주세요."); return; } onChange(records.map(record=>record.id===selected.id?{...record,status:"반려" as RecordStatus,rejectionReason:reason.trim(),locked:false,updatedAt:"방금 전"}:record),{action:"보완 요청",target:`${selected.company} · ${selected.source}`,detail:reason.trim()});showToast("담당자에게 보완 요청 상태로 돌렸습니다.");setSelectedId(queue.find(item=>item.id!==selected.id)?.id??null);setReason("");};
  return <><PageHeader eyebrow="REVIEW & APPROVAL" title="검토·승인" description="제출된 활동자료와 증빙, 전월·전년 값을 대조해 확정하거나 보완을 요청합니다."><button className="secondary-button" onClick={()=>{downloadCsv("SEMS_review_queue.csv",["법인","사업장","귀속월","Scope","활동자료","사용량","배출량","증빙","담당자"],visible.map(record=>[record.company,record.site,record.period,record.scope,record.source,record.usage,record.emissions,record.evidence,record.owner]));showToast("검토 대기 목록을 내려받았습니다.");}}><Icon name="download" size={17}/>대기목록 내보내기</button></PageHeader>
    <section className="review-workspace"><aside className="card review-queue"><CardHeader title={`검토 대기 ${queue.length}건`} subtitle="제출 순서대로 확인하세요."/><div className="queue-search search-box"><Icon name="search" size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="법인, 배출원, 담당자 검색"/></div><div className="queue-list">{visible.map(record=><button key={record.id} className={selected?.id===record.id?"active":""} onClick={()=>{setSelectedId(record.id);setReason("")}}><div className={`source-icon ${record.scope==="Scope 1"?"green":"blue"}`}><Icon name={record.scope==="Scope 1"?"droplet":"bolt"} size={17}/></div><div><strong>{record.source}</strong><span>{record.company} · {record.period}</span></div><em>{formatNumber(record.emissions,2)} t</em></button>)}{!visible.length&&<div className="empty-state compact"><Icon name="check"/><strong>검토 대기 자료가 없습니다.</strong></div>}</div></aside>
      <article className="card review-detail">{selected ? <><div className="review-detail-head"><div><span className={`scope-tag s${selected.scope.slice(-1)}`}>{selected.scope}</span><h2>{selected.category} · {selected.source}</h2><p>{selected.company} / {selected.site} · 귀속월 {selected.period}</p></div><StatusBadge status={selected.status}/></div>
        <div className="review-metrics"><div><span>사용량</span><strong>{formatNumber(selected.usage,selected.usage<100?1:0)} <small>{selected.unit}</small></strong></div><div><span>배출계수</span><strong>{formatNumber(selected.factor,selected.factor<10?5:1)}</strong></div><div><span>산정 배출량</span><strong>{formatNumber(selected.emissions,2)} <small>tCO₂e</small></strong></div></div>
        <div className="comparison-grid"><ComparisonCard label="전월" record={prev} current={selected} threshold={criteria.variance}/><ComparisonCard label="전년 동월" record={prevYear} current={selected} threshold={criteria.variance}/></div>
        <div className="review-info"><div><span>증빙자료</span><strong className={selected.evidence?"":"danger-text"}>{selected.evidence||"미연결"}</strong></div><div><span>담당자</span><strong>{selected.owner} · {selected.department}</strong></div><div className="full"><span>입력 설명</span><strong>{selected.description||"설명 없음"}</strong></div></div>
        <label className="review-reason">보완 요청 사유<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="담당자가 무엇을 보완해야 하는지 구체적으로 입력해 주세요."/></label>
        <div className="review-actions"><button className="danger-button" onClick={reject}><Icon name="alert" size={16}/>보완 요청</button><button className="primary-button" onClick={approve} disabled={!selected.evidence && (periods.find(item=>item.id===selected.collectionId)?.evidenceRequired||criteria.evidenceRequired)}><Icon name="check" size={17}/>검토 확정</button></div>
      </> : <div className="empty-state review-empty"><Icon name="check"/><strong>모든 제출자료를 확인했습니다.</strong><p>새 자료가 제출되면 여기에 표시됩니다.</p></div>}</article>
    </section></>;
}

function ComparisonCard({ label, record, current, threshold }: { label: string; record: ActivityRecord | null | undefined; current: ActivityRecord; threshold: number }) {
  const change = record?.usage ? (current.usage - record.usage) / record.usage * 100 : null;
  return <div className="comparison-card"><span>{label} 비교</span>{record ? <><strong>{formatNumber(record.usage,record.usage<100?1:0)} <small>{record.unit}</small></strong><em className={change!==null&&Math.abs(change)>=threshold?"warning":""}>{change!==null&&change>=0?"+":""}{change===null?"-":`${formatNumber(change,1)}%`}</em></> : <><strong>-</strong><em>비교자료 없음</em></>}</div>;
}

function SummaryTile({label,value,suffix,icon,tone="blue"}:{label:string;value:number;suffix:string;icon:IconName;tone?:string}){return <div className="summary-tile"><div className={`summary-icon ${tone}`}><Icon name={icon} size={19}/></div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>}

function Inventory({records,showToast}:{records:ActivityRecord[];showToast:(m:string)=>void}){
  const years=[...new Set(records.map(r=>r.period.slice(0,4)))].sort().reverse(); const [year,setYear]=useState(years[0]??"2026"); const [scope,setScope]=useState<Scope|null>(null); const base=records.filter(r=>r.period.startsWith(year)&&r.status==="확정"&&r.active!==false); const rows=scope?base.filter(r=>r.scope===scope):base; const total=rows.reduce((s,r)=>s+r.emissions,0);
  const byCompany=companies.map(name=>({name,value:rows.filter(r=>r.company===name).reduce((s,r)=>s+r.emissions,0)})); const max=Math.max(1,...byCompany.map(x=>x.value));
  const exportData=()=>{downloadCsv("sems2_ghg_inventory.csv",["귀속월","법인","사업장","Scope","활동자료","배출원","사용량","단위","배출량(tCO2e)","상태"],rows.map(r=>[r.period,r.company,r.site,r.scope,r.category,r.source,r.usage,r.unit,r.emissions,r.status]));showToast("산정 내역을 내려받았습니다.");};
  return <><PageHeader eyebrow="GHG INVENTORY" title="온실가스 인벤토리" description="활동자료와 배출계수를 연결해 Scope별 배출량을 산정하고 추적합니다."><label className="year-select"><Icon name="calendar" size={17}/><select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="secondary-button" onClick={exportData}><Icon name="download" size={17}/>산정 내역 다운로드</button></PageHeader>
    <section className="inventory-hero"><div><span>{year}년 {scope??"전체 Scope"} 누적 배출량</span><div className="inventory-total"><strong>{formatNumber(total,1)}</strong><em>tCO₂e</em></div><p><b>확정 활동자료 {rows.length}건</b> · 검토 확정 데이터만 반영</p></div><div className="target-block"><div className="target-copy"><span>2030 감축목표 진행률</span><strong>32.1%</strong></div><div className="target-track"><span style={{width:"32.1%"}}/><i style={{left:"72%"}}/></div><div className="target-labels"><span>기준연도 2023</span><span>2030 목표 -15%</span></div></div></section>
    <div className="scope-filter-note"><span>Scope 카드를 누르면 법인별 배출량이 해당 범위로 필터링됩니다.</span>{scope&&<button onClick={()=>setScope(null)}>전체 Scope 보기</button>}</div>
    <section className="inventory-grid"><article className="card"><CardHeader title="Scope별 인벤토리" subtitle="검토 확정 자료 기준"/><div className="inventory-scope-list">{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map((s,i)=><InventoryScope key={s} number={`0${i+1}`} label={s} desc={i===0?"고정연소 · 이동연소 · 비산배출":i===1?"구매 전력 · 구매 열·스팀":"공급망 · 통근 · 출장 · 폐기물"} value={base.filter(r=>r.scope===s).reduce((a,r)=>a+r.emissions,0)} color={i===0?"dark":i===1?"mid":"light"} active={scope===s} onClick={()=>setScope(scope===s?null:s)}/>)}</div></article><article className="card"><CardHeader title="법인별 배출량" subtitle={`${year}년 ${scope??"전체 Scope"} 기준`} action="단위: tCO₂e"/><div className="horizontal-bars">{byCompany.map(item=><div key={item.name}><div><strong>{item.name}</strong><span>{formatNumber(item.value,1)}</span></div><p><span style={{width:`${Math.max(item.value/max*100,item.value?4:0)}%`}}/></p></div>)}</div></article></section>
    <section className="card formula-card"><CardHeader title="배출량 산정 구조" subtitle="원천자료부터 확정 데이터까지의 연결 관계"/><div className="formula-flow"><div><span className="flow-number">1</span><strong>활동자료</strong><small>Scope별 사용량 입력</small></div><Icon name="arrow"/><div><span className="flow-number">2</span><strong>배출계수</strong><small>기준정보에서 자동 적용</small></div><Icon name="arrow"/><div><span className="flow-number">3</span><strong>배출량 산정</strong><small>사용량 × 계수 ÷ 1,000</small></div><Icon name="arrow"/><div className="highlight"><span className="flow-number">4</span><strong>검토·확정</strong><small>증빙 연결 및 이력 보관</small></div></div></section></>;
}
function InventoryScope({number,label,desc,value,color,active,onClick}:{number:string;label:string;desc:string;value:number;color:string;active:boolean;onClick:()=>void}){return <button className={`inventory-scope ${active?"selected":""}`} onClick={onClick}><span className={`scope-number ${color}`}>{number}</span><div><strong>{label}</strong><p>{desc}</p></div><em>{formatNumber(value,1)}<small> tCO₂e</small></em><Icon name="chevron" size={17}/></button>}

function Evidence({items,onChange,showToast}:{items:EvidenceItem[];onChange:(x:EvidenceItem[])=>void;showToast:(m:string)=>void}){
  const [status,setStatus]=useState("전체"); const [search,setSearch]=useState(""); const [requestOpen,setRequestOpen]=useState(false); const [editing,setEditing]=useState<EvidenceItem|null>(null); const filtered=items.filter(i=>(status==="전체"||i.status===status)&&`${i.title} ${i.category} ${i.owner}`.toLowerCase().includes(search.toLowerCase()));
  const received=items.reduce((s,i)=>s+i.received,0), total=items.reduce((s,i)=>s+i.total,0), rate=total?Math.round(received/total*100):0;
  const exportList=()=>{downloadCsv("sems2_evidence_list.csv",["증빙자료","분류","주기","담당","수집","대상","마감","상태"],filtered.map(i=>[i.title,i.category,i.period,i.owner,i.received,i.total,i.due,i.status]));showToast("증빙자료 목록을 내려받았습니다.");};
  const save=(item:EvidenceItem)=>{const exists=items.some(i=>i.id===item.id);onChange(exists?items.map(i=>i.id===item.id?item:i):[item,...items]);setEditing(null);setRequestOpen(false);showToast(exists?"증빙 수집 현황을 수정했습니다.":"증빙 요청 항목을 등록했습니다. 실제 발송은 서버 연결 후 가능합니다.");};
  const remove=(id:number)=>{if(!window.confirm("이 증빙 요청 항목을 삭제하시겠습니까?"))return;onChange(items.filter(i=>i.id!==id));setEditing(null);showToast("증빙 요청 항목을 삭제했습니다.");};
  return <><PageHeader eyebrow="EVIDENCE MANAGEMENT" title="ESG 증빙자료" description="ESG 평가와 공시에 필요한 증빙을 주기별로 요청하고 수집 현황을 관리합니다."><button className="secondary-button" onClick={exportList}><Icon name="download" size={17}/>목록 내보내기</button><button className="primary-button" onClick={()=>setRequestOpen(true)}><Icon name="upload" size={17}/>증빙 요청 등록</button></PageHeader>
    <section className="evidence-overview"><div className="evidence-score"><div className="radial-score" style={{background:`radial-gradient(circle at center, white 57%, transparent 59%), conic-gradient(#2d8d70 ${rate}%, #e8eeeb 0)`}}><strong>{rate}</strong><span>%</span></div><div><span>7월 증빙 수집률</span><strong>{received} / {total}건 수집 완료</strong><p>등록된 요청 항목 기준입니다.</p></div></div><div className="evidence-stats"><div><span>완료 항목</span><strong>{items.filter(i=>i.status==="완료").length}</strong></div><div><span>수집중</span><strong>{items.filter(i=>i.status==="수집중").length}</strong></div><div><span>보완 요청</span><strong>{items.filter(i=>i.status==="보완 요청").length}</strong></div><div><span>미제출</span><strong className="danger">{items.filter(i=>i.status==="미제출").length}</strong></div></div></section>
    <section className="card evidence-card"><div className="data-toolbar"><div className="status-tabs">{["전체","수집중","완료","보완 요청","미제출"].map(s=><button key={s} className={status===s?"active":""} onClick={()=>setStatus(s)}>{s} <span>{s==="전체"?items.length:items.filter(i=>i.status===s).length}</span></button>)}</div><div className="search-box"><Icon name="search" size={17}/><input placeholder="증빙자료 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div></div><div className="evidence-list">{filtered.map((item,index)=><button className="evidence-row evidence-row-button" key={item.id} onClick={()=>setEditing(item)}><div className={`doc-icon c${index%3}`}><Icon name="file"/></div><div className="evidence-main"><div><span className="category-label">{item.category}</span><strong>{item.title}</strong></div><p><span>수집 주기 <b>{item.period}</b></span><span>담당 <b>{item.owner}</b></span><span>마감 <b>{item.due}</b></span></p></div><div className="evidence-progress"><div><strong>{item.received}</strong> / {item.total}건 <em>{Math.round(item.received/item.total*100)}%</em></div><div className="progress-track"><span style={{width:`${item.received/item.total*100}%`}}/></div></div><StatusBadge status={item.status}/><Icon name="chevron" size={17}/></button>)}{!filtered.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 증빙자료가 없습니다.</strong></div>}</div></section>
    {requestOpen&&<EvidenceForm item={null} nextId={Math.max(0,...items.map(i=>i.id))+1} onClose={()=>setRequestOpen(false)} onSave={save}/>} {editing&&<EvidenceForm item={editing} nextId={editing.id} onClose={()=>setEditing(null)} onSave={save} onDelete={()=>remove(editing.id)}/>}</>;
}
function EvidenceForm({item,nextId,onClose,onSave,onDelete}:{item:EvidenceItem|null;nextId:number;onClose:()=>void;onSave:(i:EvidenceItem)=>void;onDelete?:()=>void}){
  const [form,setForm]=useState<EvidenceItem>(item??{id:nextId,title:"",category:"환경",period:"월",owner:"",received:0,total:4,due:"2026-07-31",status:"미제출"}); const patch=(p:Partial<EvidenceItem>)=>setForm(c=>({...c,...p}));
  return <Overlay title={item?"증빙 수집 현황 수정":"증빙 요청 등록"} eyebrow="EVIDENCE REQUEST" description="요청 항목은 브라우저에 저장됩니다. 담당자 메일 발송은 서버 연결 후 동작합니다." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave({...form,status:form.received>=form.total?"완료":form.received>0?"수집중":form.status});}}><div className="form-section"><div className="form-grid"><label>증빙자료명<input value={form.title} onChange={e=>patch({title:e.target.value})} required/></label><label>분류<select value={form.category} onChange={e=>patch({category:e.target.value})}><option>온실가스·에너지</option><option>환경</option><option>사회</option><option>공급망</option><option>지배구조</option></select></label><label>수집 주기<select value={form.period} onChange={e=>patch({period:e.target.value})}><option>월</option><option>분기</option><option>반기</option><option>연</option><option>변경 시</option></select></label><label>담당 부서<input value={form.owner} onChange={e=>patch({owner:e.target.value})} required/></label><label>대상 건수<input type="number" min="1" value={form.total} onChange={e=>patch({total:Number(e.target.value)})}/></label><label>수집 건수<input type="number" min="0" max={form.total} value={form.received} onChange={e=>patch({received:Number(e.target.value)})}/></label><label>마감일<input type="date" value={form.due} onChange={e=>patch({due:e.target.value})}/></label><label>상태<select value={form.status} onChange={e=>patch({status:e.target.value as EvidenceStatus})}><option>미제출</option><option>수집중</option><option>보완 요청</option><option>완료</option></select></label></div></div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" type="submit"><Icon name="check" size={16}/>저장</button></div></div></form></Overlay>;
}

function Indicators({items,onChange,showToast}:{items:Indicator[];onChange:(x:Indicator[])=>void;showToast:(m:string)=>void}){
  const [category,setCategory]=useState("전체"); const [search,setSearch]=useState(""); const [editing,setEditing]=useState<Indicator|null|"new">(null); const filtered=items.filter(i=>(category==="전체"||i.category===category)&&`${i.code} ${i.name} ${i.owner}`.toLowerCase().includes(search.toLowerCase()));
  const save=(row:Indicator)=>{const exists=items.some(i=>i.id===row.id);onChange(exists?items.map(i=>i.id===row.id?row:i):[...items,row]);setEditing(null);showToast(exists?"지표 정보를 수정했습니다.":"새 ESG 지표를 등록했습니다.");};
  const remove=(id:number)=>{if(!window.confirm("이 지표를 삭제하시겠습니까?"))return;onChange(items.filter(i=>i.id!==id));setEditing(null);showToast("지표를 삭제했습니다.");};
  return <><PageHeader eyebrow="ESG METRICS" title="ESG 지표 관리" description="평가·공시에서 공통 활용할 ESG 정량지표와 담당 체계를 관리합니다."><button className="secondary-button" onClick={()=>{downloadCsv("sems2_esg_indicators.csv",["코드","구분","지표명","단위","주기","담당","수집률"],filtered.map(i=>[i.code,i.category,i.name,i.unit,i.cycle,i.owner,i.progress]));showToast("지표 목록을 내려받았습니다.");}}><Icon name="download" size={17}/>목록 내보내기</button><button className="primary-button" onClick={()=>setEditing("new")}><Icon name="plus" size={17}/>지표 등록</button></PageHeader>
    <section className="pillar-grid"><PillarCard code="E" title="환경" count={items.filter(i=>i.category==="환경").length} color="green" progress={average(items.filter(i=>i.category==="환경"))}/><PillarCard code="S" title="사회" count={items.filter(i=>i.category==="사회").length} color="blue" progress={average(items.filter(i=>i.category==="사회"))}/><PillarCard code="G" title="지배구조" count={items.filter(i=>i.category==="지배구조").length} color="violet" progress={average(items.filter(i=>i.category==="지배구조"))}/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","환경","사회","지배구조"].map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c} <span>{c==="전체"?items.length:items.filter(i=>i.category===c).length}</span></button>)}</div><div className="search-box"><Icon name="search" size={17}/><input placeholder="지표명 또는 코드 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div></div><div className="table-scroll"><table className="data-table indicator-table"><thead><tr><th>지표 코드</th><th>구분</th><th>지표명</th><th>단위</th><th>수집 주기</th><th>담당 부서</th><th>수집률</th><th>작업</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} onDoubleClick={()=>setEditing(row)}><td><strong className="indicator-code">{row.code}</strong></td><td><span className={`pillar-tag ${row.category==="환경"?"e":row.category==="사회"?"s":"g"}`}>{row.category}</span></td><td><strong>{row.name}</strong></td><td>{row.unit}</td><td>{row.cycle}</td><td>{row.owner}</td><td><div className="inline-progress"><span><i style={{width:`${row.progress}%`}}/></span><strong>{row.progress}%</strong></div></td><td><button className="outline-small" onClick={()=>setEditing(row)}><Icon name="edit" size={14}/>수정</button></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 지표가 없습니다.</strong></div>}</div></section>
    {editing&&<IndicatorForm item={editing==="new"?null:editing} nextId={Math.max(0,...items.map(i=>i.id))+1} onClose={()=>setEditing(null)} onSave={save} onDelete={editing==="new"?undefined:()=>remove(editing.id)}/>}</>;
}
function average(items:Indicator[]){return items.length?Math.round(items.reduce((s,i)=>s+i.progress,0)/items.length):0}
function PillarCard({code,title,count,color,progress}:{code:string;title:string;count:number;color:string;progress:number}){return <article className={`pillar-card ${color}`}><div className="pillar-letter">{code}</div><div><span>{title} 지표</span><strong>{count}<small>개 지표</small></strong><p>평균 수집률 <b>{progress}%</b></p></div><div className="pillar-progress" style={{background:`conic-gradient(currentColor ${progress}%, #edf1f0 0)`}}><span/></div></article>}
function IndicatorForm({item,nextId,onClose,onSave,onDelete}:{item:Indicator|null;nextId:number;onClose:()=>void;onSave:(i:Indicator)=>void;onDelete?:()=>void}){const [form,setForm]=useState<Indicator>(item??{id:nextId,code:"",name:"",category:"환경",unit:"",cycle:"월",owner:"",progress:0});const patch=(p:Partial<Indicator>)=>setForm(c=>({...c,...p}));return <Overlay title={item?"ESG 지표 수정":"ESG 지표 등록"} eyebrow="METRIC MASTER" description="수집 주기와 담당 부서를 함께 지정합니다." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(form)}}><div className="form-section"><div className="form-grid"><label>지표 코드<input value={form.code} onChange={e=>patch({code:e.target.value.toUpperCase()})} required/></label><label>구분<select value={form.category} onChange={e=>patch({category:e.target.value as Indicator["category"]})}><option>환경</option><option>사회</option><option>지배구조</option></select></label><label className="full-span">지표명<input value={form.name} onChange={e=>patch({name:e.target.value})} required/></label><label>단위<input value={form.unit} onChange={e=>patch({unit:e.target.value})} required/></label><label>수집 주기<select value={form.cycle} onChange={e=>patch({cycle:e.target.value})}><option>월</option><option>분기</option><option>반기</option><option>연</option></select></label><label>담당 부서<input value={form.owner} onChange={e=>patch({owner:e.target.value})} required/></label><label>수집률 (%)<input type="number" min="0" max="100" value={form.progress} onChange={e=>patch({progress:Number(e.target.value)})}/></label></div></div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>저장</button></div></div></form></Overlay>}

function AuditLog({ items, showToast }: { items: AuditEvent[]; showToast: (m: string) => void }) {
  const [search,setSearch]=useState(""); const [action,setAction]=useState("전체");
  const actions=[...new Set(items.map(item=>item.action))];
  const filtered=items.filter(item=>(action==="전체"||item.action===action)&&`${item.actor} ${item.action} ${item.target} ${item.detail}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader eyebrow="AUDIT TRAIL" title="변경 이력" description="등록·수정·제출·반려·확정·기간 변경 내역을 시간순으로 추적합니다."><button className="secondary-button" onClick={()=>{downloadCsv("SEMS_audit_log.csv",["일시","사용자","작업","대상","상세"],filtered.map(item=>[item.at,item.actor,item.action,item.target,item.detail]));showToast("변경 이력을 내려받았습니다.");}}><Icon name="download" size={17}/>이력 내보내기</button></PageHeader>
    <section className="card audit-card"><div className="data-toolbar"><div className="search-box"><Icon name="search" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="사용자, 대상, 상세내용 검색"/></div><select value={action} onChange={e=>setAction(e.target.value)}><option>전체</option>{actions.map(item=><option key={item}>{item}</option>)}</select></div><div className="audit-list">{filtered.map(item=><div className="audit-row" key={item.id}><span className="audit-icon"><Icon name={item.action.includes("확정")?"check":item.action.includes("요청")?"alert":item.action.includes("기간")?"calendar":"edit"} size={16}/></span><div><strong>{item.action}</strong><p>{item.detail}</p><span>{item.target}</span></div><div><strong>{item.actor}</strong><span>{item.at}</span></div></div>)}{!filtered.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 변경 이력이 없습니다.</strong></div>}</div></section></>;
}

function BulkImport({ records, periods, factors, onClose, onImport }: { records: ActivityRecord[]; periods: CollectionPeriod[]; factors: EmissionFactor[]; onClose: () => void; onImport: (rows: ActivityRecord[]) => void }) {
  const availablePeriods=periods.filter(period=>period.status==="수집중");
  const [periodId,setPeriodId]=useState(availablePeriods[0]?.id??"");
  const [preview,setPreview]=useState<ActivityRecord[]>([]);
  const [errors,setErrors]=useState<string[]>([]);
  const inputRef=useRef<HTMLInputElement>(null);
  const selectedPeriod=periods.find(period=>period.id===periodId);
  const headers=["법인","사업장","귀속월","Scope","활동자료 구분","배출원","사용량","담당자","담당 부서","증빙 파일명","입력 설명"];
  const downloadTemplate=()=>{const factor=factors.find(item=>item.active&&selectedPeriod?.scopes.includes(item.scope));const sample=[selectedPeriod?.companies[0]??"세원정공",sitesByCompany[selectedPeriod?.companies[0]??"세원정공"]?.[0]??"대구공장",selectedPeriod?.dataFrom??"2026-07",factor?.scope??"Scope 2",factor?.category??"구매 전력",factor?.source??"전력",1000,"홍길동","시설팀","전기요금고지서.pdf","원천자료 기준을 적어 주세요."];const sheet=XLSX.utils.aoa_to_sheet([headers,sample]);sheet["!cols"]=headers.map((header,index)=>({wch:index===10?32:Math.max(12,header.length+4)}));const guide=XLSX.utils.aoa_to_sheet([["SEMS 활동자료 일괄등록 안내"],["1. 열 제목은 수정하지 마세요."],["2. Scope·활동자료 구분·배출원은 시스템 설정의 배출계수 명칭과 정확히 일치해야 합니다."],["3. 같은 수집기간·사업장·귀속월·활동자료는 중복 등록되지 않습니다."],["4. 배출계수와 배출량은 등록 시 시스템에서 자동 적용됩니다."],["5. 증빙 파일명은 실제 원본과 동일하게 적어 주세요."]]);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"활동자료 입력");XLSX.utils.book_append_sheet(book,guide,"작성 안내");XLSX.writeFile(book,"SEMS_activity_import_template.xlsx");};
  const readFile=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setErrors([]);setPreview([]);try{const data=await file.arrayBuffer();const book=XLSX.read(data,{type:"array"});const sheet=book.Sheets[book.SheetNames[0]];const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""});const next:ActivityRecord[]=[];const issues:string[]=[];const seen=new Set<string>();rows.forEach((row,index)=>{const line=index+2;const company=String(row["법인"]??"").trim();const site=String(row["사업장"]??"").trim();const period=String(row["귀속월"]??"").trim();const scope=String(row["Scope"]??"").trim() as Scope;const category=String(row["활동자료 구분"]??"").trim();const source=String(row["배출원"]??"").trim();const usage=Number(row["사용량"]);const factor=factors.find(item=>item.active&&item.scope===scope&&item.category===category&&item.source===source);if(!selectedPeriod){issues.push(`${line}행: 수집기간을 선택해 주세요.`);return;}if(!selectedPeriod.companies.includes(company)||!sitesByCompany[company]?.includes(site)){issues.push(`${line}행: 대상 법인 또는 사업장이 올바르지 않습니다.`);return;}if(!selectedPeriod.scopes.includes(scope)){issues.push(`${line}행: 이 수집기간의 대상 Scope가 아닙니다.`);return;}if(!monthsBetween(selectedPeriod.dataFrom,selectedPeriod.dataTo).includes(period)){issues.push(`${line}행: 귀속월이 수집 대상 기간 밖입니다.`);return;}if(!factor){issues.push(`${line}행: 사용 중인 배출계수와 일치하는 활동자료를 찾지 못했습니다.`);return;}if(!Number.isFinite(usage)||usage<=0){issues.push(`${line}행: 사용량은 0보다 큰 숫자여야 합니다.`);return;}const key=[periodId,company,site,period,scope,category,source].join("|");if(seen.has(key)||records.some(item=>[item.collectionId,item.company,item.site,item.period,item.scope,item.category,item.source].join("|")===key)){issues.push(`${line}행: 이미 등록된 중복 자료입니다.`);return;}seen.add(key);next.push({id:Math.max(0,...records.map(item=>item.id))+next.length+1,collectionId:periodId,company,site,period,scope,category,source,usage,unit:factor.activityUnit,factor:factor.value,emissions:Math.round(usage*factor.value/1000*100)/100,owner:String(row["담당자"]??"").trim()||"미지정",department:String(row["담당 부서"]??"").trim()||"미지정",status:"작성중",evidence:String(row["증빙 파일명"]??"").trim(),description:String(row["입력 설명"]??"").trim(),active:true,createdAt:nowLabel(),updatedAt:"방금 전"});});setPreview(next);setErrors(issues);}catch{setErrors(["파일을 읽을 수 없습니다. 제공된 양식을 사용해 다시 시도해 주세요."]);}finally{event.target.value="";}};
  return <Overlay title="Excel 일괄등록" eyebrow="BULK IMPORT" description="양식 검증을 통과한 행만 작성 중 상태로 등록합니다." onClose={onClose}><div className="form-section"><div className="form-grid"><label>수집기간<select value={periodId} onChange={e=>{setPeriodId(e.target.value);setPreview([]);setErrors([])}}>{availablePeriods.map(period=><option key={period.id} value={period.id}>{period.name}</option>)}</select></label><div className="bulk-buttons"><button className="secondary-button" onClick={downloadTemplate} disabled={!selectedPeriod}><Icon name="download" size={16}/>양식 다운로드</button><button className="primary-button" onClick={()=>inputRef.current?.click()} disabled={!selectedPeriod}><Icon name="upload" size={16}/>파일 선택</button><input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={readFile} hidden/></div></div><div className="factor-notice bulk-notice"><Icon name="lock" size={18}/><p><strong>배출계수는 Excel에서 입력하지 않습니다.</strong><br/>Scope·활동자료·배출원을 기준으로 시스템의 사용 중 계수를 자동 적용합니다.</p></div></div>
    <div className="bulk-result">{preview.length>0&&<div className="bulk-success"><Icon name="check" size={18}/><strong>{preview.length}건 등록 가능</strong><span>중복·기간·배출계수 검증을 통과했습니다.</span></div>}{errors.length>0&&<div className="bulk-errors"><strong><Icon name="alert" size={16}/>{errors.length}건 확인 필요</strong><ul>{errors.slice(0,12).map(error=><li key={error}>{error}</li>)}</ul>{errors.length>12&&<p>외 {errors.length-12}건</p>}</div>}{preview.length>0&&<div className="table-scroll"><table className="data-table compact-table"><thead><tr><th>법인</th><th>귀속월</th><th>Scope</th><th>배출원</th><th>사용량</th><th>배출량</th></tr></thead><tbody>{preview.slice(0,8).map(item=><tr key={item.id}><td>{item.company}</td><td>{item.period}</td><td>{item.scope}</td><td>{item.source}</td><td>{formatNumber(item.usage,1)} {item.unit}</td><td>{formatNumber(item.emissions,2)} t</td></tr>)}</tbody></table></div>}</div>
    <div className="modal-footer"><button className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={!preview.length} onClick={()=>onImport(preview)}><Icon name="check" size={16}/>{preview.length}건 등록</button></div></Overlay>;
}

function Settings({factors,onFactorsChange,criteria,onCriteriaChange,noticePrefs,onNoticePrefsChange,onExport,onRestore,showToast}:{factors:EmissionFactor[];onFactorsChange:(x:EmissionFactor[])=>void;criteria:CollectionCriteria;onCriteriaChange:(x:CollectionCriteria)=>void;noticePrefs:NotificationPrefs;onNoticePrefsChange:(x:NotificationPrefs)=>void;onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){
  const [tab,setTab]=useState<SettingTab>("factors"); const [factorModal,setFactorModal]=useState<EmissionFactor|null|"new">(null);
  const saveFactor=(factor:EmissionFactor)=>{const normalized=factor.id==="NEW-FACTOR"?{...factor,id:`F-${String(factors.length+1).padStart(3,"0")}`}:factor;const exists=factors.some(f=>f.id===normalized.id);onFactorsChange(exists?factors.map(f=>f.id===normalized.id?normalized:f):[...factors,normalized]);setFactorModal(null);showToast(exists?"배출계수를 수정했습니다.":"새 배출계수를 추가했습니다.");};
  const removeFactor=(id:string)=>{if(!window.confirm("이 배출계수를 삭제하시겠습니까? 기존 활동자료의 산정값은 유지됩니다."))return;onFactorsChange(factors.filter(f=>f.id!==id));setFactorModal(null);showToast("배출계수를 삭제했습니다.");};
  return <><PageHeader eyebrow="SYSTEM SETTINGS" title="시스템 설정" description="조직, 산정 기준, 알림, 권한과 운영 데이터 백업을 관리합니다."/><div className="settings-layout"><aside className="settings-nav"><button className={tab==="organization"?"active":""} onClick={()=>setTab("organization")}><Icon name="building" size={18}/>조직·사업장</button><button className={tab==="factors"?"active":""} onClick={()=>setTab("factors")}><Icon name="leaf" size={18}/>배출계수</button><button className={tab==="criteria"?"active":""} onClick={()=>setTab("criteria")}><Icon name="list" size={18}/>수집 기준</button><button className={tab==="notifications"?"active":""} onClick={()=>setTab("notifications")}><Icon name="bell" size={18}/>알림 설정</button><button className={tab==="permissions"?"active":""} onClick={()=>setTab("permissions")}><Icon name="settings" size={18}/>권한 관리</button><button className={tab==="data"?"active":""} onClick={()=>setTab("data")}><Icon name="database" size={18}/>데이터 백업</button></aside><section className="card settings-content">
    {tab==="factors"&&<><CardHeader title="배출계수 관리" subtitle="활동자료 등록 시 자동 적용되는 기준 계수입니다." action={<button className="outline-small" onClick={()=>setFactorModal("new")}><Icon name="plus" size={15}/>계수 추가</button>}/><div className="factor-notice"><Icon name="lock" size={18}/><p><strong>활동자료 등록 화면에서는 배출계수를 수정할 수 없습니다.</strong><br/>계수 변경은 이 메뉴에서만 가능하며, 기존 활동자료에는 저장 당시의 계수가 유지됩니다.</p></div><div className="table-scroll"><table className="data-table factor-table"><thead><tr><th>Scope</th><th>활동자료</th><th>배출원</th><th>배출계수</th><th>단위</th><th>적용 연도</th><th>출처</th><th>상태</th><th>작업</th></tr></thead><tbody>{factors.map(row=><tr key={row.id}><td><span className={`scope-tag s${row.scope.slice(-1)}`}>{row.scope}</span></td><td>{row.category}</td><td><strong>{row.source}</strong></td><td className="mono"><strong>{formatNumber(row.value,row.value<10?5:1)}</strong></td><td>{row.factorUnit}</td><td>{row.year}</td><td>{row.authority}</td><td><span className={row.active?"active-label":"inactive-label"}>{row.active?"사용 중":"중지"}</span></td><td><button className="outline-small" onClick={()=>setFactorModal(row)}><Icon name="edit" size={14}/>수정</button></td></tr>)}</tbody></table></div></>}
    {tab==="organization"&&<OrganizationSettings showToast={showToast}/>} {tab==="criteria"&&<><CardHeader title="데이터 수집 기준" subtitle="입력 검증과 확정 데이터 처리 기준을 설정합니다."/><div className="settings-form"><label>기본 귀속연도<select value={criteria.defaultYear} onChange={e=>onCriteriaChange({...criteria,defaultYear:e.target.value})}><option>2026</option><option>2027</option><option>2028</option></select></label><label>전월 대비 이상치 경고 기준<div className="input-unit"><input type="number" min="1" value={criteria.variance} onChange={e=>onCriteriaChange({...criteria,variance:Number(e.target.value)})}/><span>%</span></div></label><Toggle label="제출 시 증빙 연결 필수" checked={criteria.evidenceRequired} onChange={v=>onCriteriaChange({...criteria,evidenceRequired:v})}/><Toggle label="확정 자료 수정 잠금" checked={criteria.lockConfirmed} onChange={v=>onCriteriaChange({...criteria,lockConfirmed:v})}/></div><SettingsFooter onSave={()=>showToast("수집 기준을 저장했습니다.")}/></>}
    {tab==="notifications"&&<><CardHeader title="알림 설정" subtitle="업무 상황별 알림 수신 여부를 설정합니다."/><div className="toggle-list"><Toggle label="수집 마감 3일 전 알림" description="미제출 담당자와 기획팀에 안내" checked={noticePrefs.deadline} onChange={v=>onNoticePrefsChange({...noticePrefs,deadline:v})}/><Toggle label="검토 대기 등록 알림" description="담당 부서가 제출하면 기획팀에 안내" checked={noticePrefs.review} onChange={v=>onNoticePrefsChange({...noticePrefs,review:v})}/><Toggle label="반려 및 보완 요청 알림" description="반려 사유와 재제출 기한 안내" checked={noticePrefs.rejected} onChange={v=>onNoticePrefsChange({...noticePrefs,rejected:v})}/><Toggle label="주간 수집 현황 요약" description="매주 월요일 관리자에게 요약" checked={noticePrefs.weekly} onChange={v=>onNoticePrefsChange({...noticePrefs,weekly:v})}/><div className="server-note"><Icon name="alert" size={17}/>설정은 저장됩니다. 실제 메일·사내 알림 발송은 사내 알림 서버 연결 후 적용됩니다.</div></div><SettingsFooter onSave={()=>showToast("알림 설정을 저장했습니다.")}/></>}
    {tab==="permissions"&&<PermissionSettings showToast={showToast}/>}
    {tab==="data"&&<DataSettings onExport={onExport} onRestore={onRestore} showToast={showToast}/>}</section></div>{factorModal&&<FactorForm factor={factorModal==="new"?null:factorModal} onClose={()=>setFactorModal(null)} onSave={saveFactor} onDelete={factorModal==="new"?undefined:()=>removeFactor(factorModal.id)}/>}</>;
}
function OrganizationSettings({showToast}:{showToast:(m:string)=>void}){const [selected,setSelected]=useState("세원정공");const [siteMap,setSiteMap]=useState<Record<string,string[]>>(()=>Object.fromEntries(Object.entries(sitesByCompany).map(([key,value])=>[key,[...value]])));const [adding,setAdding]=useState(false);const [newSite,setNewSite]=useState("");const addSite=()=>{const name=newSite.trim();if(!name)return;if(siteMap[selected].includes(name)){showToast("이미 등록된 사업장입니다.");return;}setSiteMap({...siteMap,[selected]:[...siteMap[selected],name]});setNewSite("");setAdding(false);showToast(`${selected}에 ${name}을(를) 추가했습니다.`);};return <><CardHeader title="조직·사업장" subtitle="활동자료를 수집할 법인과 사업장을 확인합니다."/><div className="organization-grid"><div className="org-list">{companies.map(c=><button key={c} className={selected===c?"active":""} onClick={()=>{setSelected(c);setAdding(false)}}><span className="company-initial">{c.slice(-1)}</span><div><strong>{c}</strong><small>{siteMap[c].length}개 사업장</small></div><Icon name="chevron" size={16}/></button>)}</div><div className="site-panel"><div><strong>{selected} 사업장</strong><button className="outline-small" onClick={()=>setAdding(!adding)}><Icon name={adding?"close":"plus"} size={14}/>{adding?"취소":"사업장 추가"}</button></div>{adding&&<div className="inline-add"><input placeholder="새 사업장명" value={newSite} onChange={e=>setNewSite(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSite()}/><button className="primary-button" onClick={addSite}>추가</button></div>}{siteMap[selected].map(site=><div className="site-row" key={site}><span><Icon name="building" size={17}/></span><div><strong>{site}</strong><small>사용 중 · 국내 사업장</small></div><span className="active-label">사용 중</span></div>)}</div></div><SettingsFooter onSave={()=>showToast("조직·사업장 설정을 저장했습니다.")}/></>}
function PermissionSettings({showToast}:{showToast:(m:string)=>void}){const [roles,setRoles]=useState([{name:"관리자",desc:"모든 법인 조회·검토·기준정보 관리",members:3,write:true,approve:true},{name:"법인 담당자",desc:"소속 법인 자료 입력·수정·제출",members:12,write:true,approve:false},{name:"조회자",desc:"확정 자료와 대시보드 조회",members:6,write:false,approve:false}]);return <><CardHeader title="권한 관리" subtitle="역할별 화면 접근과 작업 권한을 설계합니다."/><div className="permission-table">{roles.map((r,index)=><div key={r.name}><div><strong>{r.name}</strong><p>{r.desc}</p></div><span>{r.members}명</span><label><input type="checkbox" checked={r.write} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,write:e.target.checked}:x))}/>입력</label><label><input type="checkbox" checked={r.approve} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,approve:e.target.checked}:x))}/>확정</label></div>)}</div><div className="server-note"><Icon name="lock" size={17}/>현재는 권한 설계 화면입니다. 실제 사용자별 접근 제한은 사내 로그인·권한 서버 연결 후 적용됩니다.</div><SettingsFooter onSave={()=>showToast("권한 설계안을 저장했습니다.")}/></>}
function DataSettings({onExport,onRestore,showToast}:{onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){const inputRef=useRef<HTMLInputElement>(null);const restore=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()) as Record<string,unknown>;if(window.confirm("현재 브라우저의 운영 데이터를 백업 파일 내용으로 교체하시겠습니까?"))onRestore(parsed);}catch{showToast("백업 파일을 읽을 수 없습니다.");}finally{event.target.value="";}};return <><CardHeader title="운영 데이터 백업" subtitle="기간·활동자료·배출계수·증빙·지표·설정을 한 파일로 보관합니다."/><div className="backup-grid"><article><span className="backup-icon"><Icon name="download"/></span><div><strong>전체 데이터 내보내기</strong><p>정기 백업과 다른 PC로의 이관에 사용할 JSON 파일을 생성합니다.</p><button className="primary-button" onClick={onExport}><Icon name="download" size={16}/>백업 파일 저장</button></div></article><article><span className="backup-icon restore"><Icon name="upload"/></span><div><strong>백업 데이터 복원</strong><p>SEMS에서 내보낸 백업 파일로 현재 운영 데이터를 교체합니다.</p><button className="secondary-button" onClick={()=>inputRef.current?.click()}><Icon name="upload" size={16}/>백업 파일 선택</button><input ref={inputRef} type="file" accept=".json" hidden onChange={restore}/></div></article></div><div className="server-note"><Icon name="alert" size={17}/>현재 버전은 브라우저 단위로 저장됩니다. 다중 사용자 공동 운영은 사내 데이터베이스 연결 후 같은 화면 구조를 그대로 사용합니다.</div></>}
function Toggle({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><div><strong>{label}</strong>{description&&<p>{description}</p>}</div><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span/></label>}
function SettingsFooter({onSave}:{onSave:()=>void}){return <div className="settings-footer"><span>변경 내용은 현재 브라우저에 저장됩니다.</span><button className="primary-button" onClick={onSave}>변경사항 저장</button></div>}
function FactorForm({factor,onClose,onSave,onDelete}:{factor:EmissionFactor|null;onClose:()=>void;onSave:(f:EmissionFactor)=>void;onDelete?:()=>void}){const [form,setForm]=useState<EmissionFactor>(factor??{id:"NEW-FACTOR",scope:"Scope 1",category:"",source:"",value:0,activityUnit:"L",factorUnit:"kgCO₂e/L",year:"2026",authority:"",active:true});const patch=(p:Partial<EmissionFactor>)=>setForm(c=>({...c,...p}));return <Overlay title={factor?"배출계수 수정":"배출계수 추가"} eyebrow="EMISSION FACTOR" description="여기서 저장한 계수만 활동자료 입력 화면에 자동 표시됩니다." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(form)}}><div className="form-section"><div className="form-grid"><label>Scope<select value={form.scope} onChange={e=>patch({scope:e.target.value as Scope})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label><label>활동자료 구분<input value={form.category} onChange={e=>patch({category:e.target.value})} required/></label><label>배출원<input value={form.source} onChange={e=>patch({source:e.target.value})} required/></label><label>활동자료 단위<input value={form.activityUnit} onChange={e=>patch({activityUnit:e.target.value,factorUnit:`kgCO₂e/${e.target.value}`})} required/></label><label>배출계수<input type="number" min="0" step="any" value={form.value||""} onChange={e=>patch({value:Number(e.target.value)})} required/></label><label>계수 단위<input value={form.factorUnit} onChange={e=>patch({factorUnit:e.target.value})} required/></label><label>적용 연도<input value={form.year} onChange={e=>patch({year:e.target.value})} required/></label><label>출처<input value={form.authority} onChange={e=>patch({authority:e.target.value})} required/></label><Toggle label="활동자료 입력 시 사용" checked={form.active} onChange={v=>patch({active:v})}/></div></div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>계수 저장</button></div></div></form></Overlay>}

function RecordModal({record,records,periods,factors,criteria,onClose,onSave}:{record:ActivityRecord|null;records:ActivityRecord[];periods:CollectionPeriod[];factors:EmissionFactor[];criteria:CollectionCriteria;onClose:()=>void;onSave:(r:ActivityRecord)=>void}){
  const editablePeriods=periods.filter(period=>period.status==="수집중"||period.id===record?.collectionId);
  const defaultPeriod=editablePeriods.find(period=>period.status==="수집중")??editablePeriods[0];
  const defaultScope=defaultPeriod?.scopes.includes("Scope 2")?"Scope 2":defaultPeriod?.scopes[0]??"Scope 1";
  const fallback=factors.find(f=>f.scope===defaultScope&&f.active)??factors.find(f=>f.active)??initialFactors[0];
  const [form,setForm]=useState<ActivityRecord>(record??{id:0,collectionId:defaultPeriod?.id,company:defaultPeriod?.companies[0]??"세원정공",site:sitesByCompany[defaultPeriod?.companies[0]??"세원정공"][0],period:defaultPeriod?.dataFrom??"2026-07",scope:fallback.scope,category:fallback.category,source:fallback.source,usage:0,unit:fallback.activityUnit,factor:fallback.value,emissions:0,owner:"문경섭",department:"기획팀",status:"작성중",evidence:"",description:"",active:true,updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const selectedPeriod=periods.find(period=>period.id===form.collectionId);
  const availableScopes=selectedPeriod?.scopes??(["Scope 1","Scope 2","Scope 3"] as Scope[]);
  const available=factors.filter(f=>f.active&&f.scope===form.scope); const categories=[...new Set(available.map(f=>f.category))]; const sources=available.filter(f=>f.category===form.category); const selected=factors.find(f=>f.scope===form.scope&&f.category===form.category&&f.source===form.source)??null; const patch=(p:Partial<ActivityRecord>)=>setForm(c=>({...c,...p}));
  const applyFactor=(f:EmissionFactor)=>patch({category:f.category,source:f.source,unit:f.activityUnit,factor:f.value});
  const changeScope=(scope:Scope)=>{const first=factors.find(f=>f.active&&f.scope===scope); if(first)setForm(c=>({...c,scope,category:first.category,source:first.source,unit:first.activityUnit,factor:first.value}));};
  const changePeriod=(id:string)=>{const period=periods.find(item=>item.id===id);if(!period)return;const scope=period.scopes.includes(form.scope)?form.scope:period.scopes[0];const first=factors.find(f=>f.active&&f.scope===scope);const company=period.companies.includes(form.company)?form.company:period.companies[0];setForm(current=>({...current,collectionId:id,company,site:sitesByCompany[company][0],period:period.dataFrom,scope,category:first?.category??current.category,source:first?.source??current.source,unit:first?.activityUnit??current.unit,factor:first?.value??current.factor}));};
  const duplicate=records.some(item=>item.id!==form.id&&item.collectionId===form.collectionId&&item.company===form.company&&item.site===form.site&&item.period===form.period&&item.scope===form.scope&&item.category===form.category&&item.source===form.source);
  const previous=records.find(item=>item.company===form.company&&item.site===form.site&&item.scope===form.scope&&item.category===form.category&&item.source===form.source&&item.period===previousMonth(form.period));
  const previousYear=records.find(item=>item.company===form.company&&item.site===form.site&&item.scope===form.scope&&item.category===form.category&&item.source===form.source&&item.period===previousMonth(form.period,1));
  const variance=previous?.usage?(form.usage-previous.usage)/previous.usage*100:null;
  const submit=(e:FormEvent)=>{e.preventDefault();if(!selectedPeriod||selectedPeriod.status!=="수집중"){setError("현재 수집중인 기간을 선택해 주세요.");return;}if(!monthsBetween(selectedPeriod.dataFrom,selectedPeriod.dataTo).includes(form.period)){setError("귀속월이 선택한 수집기간의 대상 범위 밖입니다.");return;}if(!form.usage){setError("사용량을 입력해 주세요.");return;}if(duplicate){setError("같은 사업장·귀속월·활동자료가 이미 등록되어 있습니다.");return;}onSave({...form,status:form.status==="반려"?"작성중":form.status,emissions:Math.round(form.usage*form.factor/1000*100)/100,updatedAt:"방금 전"});};
  if(!editablePeriods.length)return <Overlay title="활동자료 입력 불가" eyebrow="ACTIVITY DATA" description="현재 수집중인 기간이 없습니다." onClose={onClose}><div className="empty-state"><Icon name="calendar"/><strong>수집기간을 먼저 개설해 주세요.</strong><p>수집 기간 메뉴에서 대상과 마감일을 설정한 뒤 수집을 시작할 수 있습니다.</p></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>;
  return <Overlay title={record?"활동자료 수정":"신규 활동자료 입력"} eyebrow="ACTIVITY DATA" description="수집기간과 Scope에 맞는 활동자료·배출계수가 자동 연결됩니다." onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>수집기간 및 기본 정보</h3><div className="form-grid"><label className="full-span">수집기간<select value={form.collectionId} onChange={e=>changePeriod(e.target.value)}>{editablePeriods.map(period=><option value={period.id} key={period.id}>{period.name} · {period.status}</option>)}</select></label><label>법인<select value={form.company} onChange={e=>{const company=e.target.value;patch({company,site:sitesByCompany[company][0]})}}>{(selectedPeriod?.companies??companies).map(c=><option key={c}>{c}</option>)}</select></label><label>사업장<select value={form.site} onChange={e=>patch({site:e.target.value})}>{sitesByCompany[form.company].map(s=><option key={s}>{s}</option>)}</select></label><label>귀속월<select value={form.period} onChange={e=>patch({period:e.target.value})}>{selectedPeriod&&monthsBetween(selectedPeriod.dataFrom,selectedPeriod.dataTo).map(month=><option key={month}>{month}</option>)}</select></label><label>Scope<select value={form.scope} onChange={e=>changeScope(e.target.value as Scope)}>{availableScopes.map(scope=><option key={scope}>{scope}</option>)}</select></label></div></div>
    <div className="scope-context"><span className={`scope-tag s${form.scope.slice(-1)}`}>{form.scope}</span><strong>{form.scope==="Scope 1"?"직접 배출 활동자료":form.scope==="Scope 2"?"구매 에너지 활동자료":"기타 간접 배출 활동자료"}</strong><p>현재 Scope에 해당하는 활동자료만 표시되며 배출계수는 수정할 수 없습니다.</p></div>
    <div className="form-section"><h3><span>2</span>활동자료 및 산정</h3>{available.length?<><div className="form-grid"><label>활동자료 구분<select value={form.category} onChange={e=>{const first=available.find(f=>f.category===e.target.value);if(first)applyFactor(first)}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>배출원<select value={form.source} onChange={e=>{const found=sources.find(f=>f.source===e.target.value);if(found)applyFactor(found)}}>{sources.map(f=><option key={f.id} value={f.source}>{f.source}</option>)}</select></label><label>사용량<div className="input-unit"><input type="number" min="0" step="any" value={form.usage||""} onChange={e=>patch({usage:Number(e.target.value)})} required/><span>{form.unit}</span></div></label><label>단위<input value={form.unit} readOnly className="readonly-input"/></label><label>배출계수<div className="locked-input"><input value={form.factor} readOnly tabIndex={-1}/><Icon name="lock" size={15}/></div><small className="field-help">{selected?.year} · {selected?.authority} 기준 / 시스템 설정에서만 변경 가능</small></label><div className="calculated-field"><span>예상 배출량</span><strong>{formatNumber(form.usage*form.factor/1000,2)} <small>tCO₂e</small></strong><em>사용량 × 배출계수 ÷ 1,000</em></div></div><div className="comparison-grid form-comparison"><ComparisonCard label="전월" record={previous} current={{...form,emissions:0}} threshold={criteria.variance}/><ComparisonCard label="전년 동월" record={previousYear} current={{...form,emissions:0}} threshold={criteria.variance}/></div>{variance!==null&&Math.abs(variance)>=criteria.variance&&<p className="form-warning"><Icon name="alert" size={15}/>전월 대비 {formatNumber(Math.abs(variance),1)}% {variance>0?"증가":"감소"}했습니다. 입력 설명에 변동 사유를 남겨 주세요.</p>}{duplicate&&<p className="form-error"><Icon name="alert" size={14}/>같은 조건의 활동자료가 이미 등록되어 있습니다.</p>}</>:<div className="empty-state"><Icon name="alert"/><strong>이 Scope에 사용 가능한 배출계수가 없습니다.</strong><p>시스템 설정 &gt; 배출계수에서 계수를 먼저 등록해 주세요.</p></div>}</div>
    <div className="form-section"><h3><span>3</span>증빙 및 담당자</h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setError("증빙파일은 20MB 이하만 선택할 수 있습니다.");e.target.value="";return;}setError("");patch({evidence:file.name})}}/><span className="upload-icon"><Icon name="upload"/></span>{form.evidence?<><strong>{form.evidence}</strong><small>원본 파일명과 연결정보가 저장됩니다.</small></>:<><strong>증빙자료를 클릭해 선택하세요.</strong><small>PDF, XLSX, JPG, PNG · 최대 20MB</small></>}</label><div className="form-grid two"><label>담당자<input value={form.owner} onChange={e=>patch({owner:e.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={e=>patch({department:e.target.value})} required/></label><label className="full-span textarea-label">입력 설명·산정 근거<textarea value={form.description??""} onChange={e=>patch({description:e.target.value})} placeholder="원천자료 기준, 전월 대비 변동 사유, 계산 시 가정 등을 적어 주세요."/></label></div>{form.rejectionReason&&<div className="rejection-note"><Icon name="alert" size={16}/><div><strong>이전 보완 요청</strong><p>{form.rejectionReason}</p></div></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div>
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!available.length||duplicate}><Icon name="check" size={17}/>{record?"수정사항 저장":"작성 중으로 저장"}</button></div></form></Overlay>;
}
