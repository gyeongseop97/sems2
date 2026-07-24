"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";

type View = "dashboard" | "periods" | "collection" | "review" | "inventory" | "targets" | "evidence" | "indicators" | "audit" | "settings";
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

type TargetStatus = "초안" | "승인" | "종료";
type ReductionTarget = {
  id: string;
  name: string;
  company: string;
  scopes: Scope[];
  baselineYear: number;
  baselineEmissions: number;
  targetYear: number;
  reductionRate: number;
  targetEmissions: number;
  owner: string;
  status: TargetStatus;
  description: string;
  approvedAt?: string;
  updatedAt: string;
};

type PlanStatus = "계획" | "진행중" | "완료" | "지연";
type ReductionPlan = {
  id: string;
  targetId: string;
  title: string;
  company: string;
  site: string;
  scope: Scope;
  category: string;
  department: string;
  owner: string;
  startDate: string;
  endDate: string;
  expectedReduction: number;
  actualReduction: number;
  budget: number;
  progress: number;
  status: PlanStatus;
  verification: string;
  description: string;
  updatedAt: string;
};

const navItems: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "대시보드", icon: "dashboard" },
  { id: "periods", label: "수집 기간", icon: "calendar" },
  { id: "collection", label: "데이터 수집", icon: "database" },
  { id: "review", label: "검토·승인", icon: "check" },
  { id: "inventory", label: "온실가스 인벤토리", icon: "leaf" },
  { id: "targets", label: "감축목표·이행계획", icon: "target" },
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

const initialTargets: ReductionTarget[] = [
  {
    id: "TG-001",
    name: "세원그룹 Scope 1·2 중기 감축목표",
    company: "그룹 전체",
    scopes: ["Scope 1", "Scope 2"],
    baselineYear: 2024,
    baselineEmissions: 15420,
    targetYear: 2030,
    reductionRate: 30,
    targetEmissions: 10794,
    owner: "기획팀",
    status: "승인",
    description: "2024년 확정 인벤토리를 기준으로 Scope 1·2 총배출량을 2030년까지 30% 감축합니다.",
    approvedAt: "2026-02-20",
    updatedAt: "2026-07-01",
  },
  {
    id: "TG-002",
    name: "세원정공 사업장 에너지 감축목표",
    company: "세원정공",
    scopes: ["Scope 1", "Scope 2"],
    baselineYear: 2025,
    baselineEmissions: 5820,
    targetYear: 2030,
    reductionRate: 25,
    targetEmissions: 4365,
    owner: "시설팀",
    status: "초안",
    description: "대구공장 에너지 효율화와 재생에너지 전환을 반영한 법인 단위 목표안입니다.",
    updatedAt: "2026-07-15",
  },
];

const initialPlans: ReductionPlan[] = [
  { id: "RP-001", targetId: "TG-001", title: "대구공장 지붕형 태양광 도입", company: "세원정공", site: "대구공장", scope: "Scope 2", category: "재생에너지", department: "시설팀", owner: "김민수", startDate: "2026-08-01", endDate: "2027-06-30", expectedReduction: 1380, actualReduction: 0, budget: 920000000, progress: 15, status: "진행중", verification: "발전량 계량기·전력구매 내역", description: "자가소비형 태양광 설비 구축 및 월별 발전량을 전력 사용량과 연계합니다.", updatedAt: "2026-07-20" },
  { id: "RP-002", targetId: "TG-001", title: "프레스·용접라인 대기전력 절감", company: "세원테크", site: "경산공장", scope: "Scope 2", category: "에너지 효율", department: "생산기술팀", owner: "이서연", startDate: "2026-03-01", endDate: "2026-12-31", expectedReduction: 620, actualReduction: 185, budget: 180000000, progress: 58, status: "진행중", verification: "설비별 전력계·개선 전후 사용량", description: "비가동 시간 자동 차단과 고효율 설비 교체 효과를 월별로 검증합니다.", updatedAt: "2026-07-18" },
  { id: "RP-003", targetId: "TG-001", title: "냉매 누출 예방점검 강화", company: "세원E&I", site: "영천공장", scope: "Scope 1", category: "비산배출", department: "설비보전팀", owner: "윤태호", startDate: "2026-01-01", endDate: "2026-12-31", expectedReduction: 240, actualReduction: 96, budget: 35000000, progress: 64, status: "진행중", verification: "냉매 충전대장·누출점검표", description: "누출 취약설비를 분기 점검하고 냉매 보충량 감소분을 검증합니다.", updatedAt: "2026-07-10" },
  { id: "RP-004", targetId: "TG-001", title: "업무용 차량 친환경차 전환", company: "세원물산", site: "대구공장", scope: "Scope 1", category: "이동연소", department: "총무팀", owner: "최유진", startDate: "2027-01-01", endDate: "2028-12-31", expectedReduction: 310, actualReduction: 0, budget: 260000000, progress: 0, status: "계획", verification: "차량대장·연료 구매내역", description: "교체주기가 도래한 업무용 내연기관 차량을 친환경차로 순차 전환합니다.", updatedAt: "2026-07-05" },
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
  const key = status === "확정" || status === "완료" ? "done" : status === "검토대기" || status === "수집중" || status === "진행중" ? "pending" : status === "반려" || status === "보완 요청" || status === "지연" ? "rejected" : "draft";
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
  const [targets, setTargets] = useState<ReductionTarget[]>(initialTargets);
  const [plans, setPlans] = useState<ReductionPlan[]>(initialPlans);
  const [periods, setPeriods] = useState<CollectionPeriod[]>(initialPeriods);
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [criteria, setCriteria] = useState<CollectionCriteria>({ variance: 10, evidenceRequired: true, lockConfirmed: true, defaultYear: "2026" });
  const [noticePrefs, setNoticePrefs] = useState<NotificationPrefs>({ deadline: true, review: true, rejected: true, weekly: false });
  const [organizations, setOrganizations] = useState<Record<string,string[]>>(()=>Object.fromEntries(Object.entries(sitesByCompany).map(([key,value])=>[key,[...value]])));
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
        const savedTargets = localStorage.getItem("sems2-targets"); if (savedTargets) setTargets(JSON.parse(savedTargets));
        const savedPlans = localStorage.getItem("sems2-reduction-plans"); if (savedPlans) setPlans(JSON.parse(savedPlans));
        const savedAudit = localStorage.getItem("sems2-audit"); if (savedAudit) setAudit(JSON.parse(savedAudit));
        const savedCriteria = localStorage.getItem("sems2-criteria"); if (savedCriteria) setCriteria(JSON.parse(savedCriteria));
        const savedNotices = localStorage.getItem("sems2-notice-prefs"); if (savedNotices) setNoticePrefs(JSON.parse(savedNotices));
        const savedOrganizations = localStorage.getItem("sems2-organizations"); if (savedOrganizations) setOrganizations(JSON.parse(savedOrganizations));
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
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-targets", JSON.stringify(targets)); }, [targets, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-reduction-plans", JSON.stringify(plans)); }, [plans, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-audit", JSON.stringify(audit)); }, [audit, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-criteria", JSON.stringify(criteria)); }, [criteria, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-notice-prefs", JSON.stringify(noticePrefs)); }, [noticePrefs, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-organizations", JSON.stringify(organizations)); }, [organizations, hydrated]);
  useEffect(() => { document.body.classList.toggle("menu-open", mobileMenu || modalOpen || bulkOpen || guideOpen); return () => document.body.classList.remove("menu-open"); }, [mobileMenu, modalOpen, bulkOpen, guideOpen]);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const addAudit = (action: string, target: string, detail: string, actor = "문경섭") => {
    setAudit(current => [{ id: Math.max(0, ...current.map(item => item.id)) + 1, at: nowLabel(), actor, action, target, detail }, ...current].slice(0, 500));
  };
  const navigate = (view: View) => { setActiveView(view); setMobileMenu(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openForm = (record?: ActivityRecord) => {
    if (record?.status === "검토대기") { showToast("검토 대기 자료는 검토·승인 메뉴에서 처리해 주세요."); return; }
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
    const payload = { version: 3, exportedAt: new Date().toISOString(), periods, records, factors, evidence, indicators, targets, plans, audit, criteria, noticePrefs, organizations };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `SEMS_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    showToast("전체 운영 데이터를 백업했습니다.");
  };
  const restoreBackup = (payload: Record<string, unknown>) => {
    if (!Array.isArray(payload.periods) || !Array.isArray(payload.records) || !Array.isArray(payload.factors)) { showToast("SEMS 백업 파일 형식이 아닙니다."); return; }
    setPeriods(payload.periods as CollectionPeriod[]); setRecords(payload.records as ActivityRecord[]); setFactors(payload.factors as EmissionFactor[]);
    if (Array.isArray(payload.evidence)) setEvidence(payload.evidence as EvidenceItem[]); if (Array.isArray(payload.indicators)) setIndicators(payload.indicators as Indicator[]); if (Array.isArray(payload.audit)) setAudit(payload.audit as AuditEvent[]);
    if (Array.isArray(payload.targets)) setTargets(payload.targets as ReductionTarget[]); if (Array.isArray(payload.plans)) setPlans(payload.plans as ReductionPlan[]);
    if (payload.criteria) setCriteria(payload.criteria as CollectionCriteria); if (payload.noticePrefs) setNoticePrefs(payload.noticePrefs as NotificationPrefs);
    if (payload.organizations) setOrganizations(payload.organizations as Record<string,string[]>);
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
        {notificationsOpen && <NotificationPanel periods={periods} records={records} targets={targets} plans={plans} onClose={() => setNotificationsOpen(false)} onRead={() => { setNotificationsRead(true); setNotificationsOpen(false); showToast("모든 알림을 확인했습니다."); }} />}
        {profileOpen && <ProfilePanel onSettings={() => navigate("settings")} onBackup={exportBackup} />}
      </header>
      <main className="content">
        {activeView === "dashboard" && <Dashboard records={records} periods={periods} targets={targets} plans={plans} onNavigate={navigate} onNew={() => openForm()} />}
        {activeView === "periods" && <Periods periods={periods} records={records} onChange={setPeriods} addAudit={addAudit} showToast={showToast} />}
        {activeView === "collection" && <Collection records={records} periods={periods} criteria={criteria} onNew={() => openForm()} onBulk={() => setBulkOpen(true)} onEdit={openForm} onChange={updateRecords} showToast={showToast} />}
        {activeView === "review" && <Review records={records} periods={periods} criteria={criteria} onChange={updateRecords} showToast={showToast} />}
        {activeView === "inventory" && <Inventory records={records} targets={targets} onNavigate={navigate} showToast={showToast} />}
        {activeView === "targets" && <TargetsAndPlans targets={targets} plans={plans} records={records} organizations={organizations} onTargetsChange={setTargets} onPlansChange={setPlans} addAudit={addAudit} showToast={showToast} />}
        {activeView === "evidence" && <Evidence items={evidence} onChange={setEvidence} showToast={showToast} />}
        {activeView === "indicators" && <Indicators items={indicators} onChange={setIndicators} showToast={showToast} />}
        {activeView === "audit" && <AuditLog items={audit} showToast={showToast} />}
        {activeView === "settings" && <Settings factors={factors} onFactorsChange={setFactors} criteria={criteria} onCriteriaChange={setCriteria} noticePrefs={noticePrefs} onNoticePrefsChange={setNoticePrefs} organizations={organizations} onOrganizationsChange={setOrganizations} onExport={exportBackup} onRestore={restoreBackup} showToast={showToast} />}
      </main>
    </div>
    {modalOpen && <RecordModal record={editing} records={records} periods={periods} factors={factors} criteria={criteria} organizations={organizations} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveRecord} />}
    {bulkOpen && <BulkImport records={records} periods={periods} factors={factors} organizations={organizations} onClose={() => setBulkOpen(false)} onImport={importRecords} />}
    {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
  </div>;
}

function NavButton({ item, active, onClick, count }: { item: { id: View; label: string; icon: IconName }; active: boolean; onClick: () => void; count?: number }) { return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon name={item.icon} /><span>{item.label}</span>{count ? <em>{count}</em> : null}</button>; }

function NotificationPanel({ periods, records, targets, plans, onClose, onRead }: { periods: CollectionPeriod[]; records: ActivityRecord[]; targets: ReductionTarget[]; plans: ReductionPlan[]; onClose: () => void; onRead: () => void }) {
  const active = periods.find(period => period.status === "수집중");
  const pending = records.filter(record => record.status === "검토대기").length;
  const rejected = records.filter(record => record.status === "반려").length;
  const approved = targets.find(target => target.status === "승인" && target.company === "그룹 전체") ?? targets.find(target => target.status === "승인");
  const required = approved ? approved.baselineEmissions - approved.targetEmissions : 0;
  const secured = approved ? plans.filter(plan => plan.targetId === approved.id).reduce((sum,plan)=>sum+plan.expectedReduction,0) : 0;
  const delayed = plans.filter(plan => normalizePlanStatus(plan) === "지연").length;
  return <div className="notification-panel"><div className="panel-title"><strong>업무 알림</strong><button onClick={onClose} aria-label="알림 닫기"><Icon name="close" size={16} /></button></div>
    {active && <div className="notification-item unread"><span className="notification-icon warning"><Icon name="calendar" size={17} /></span><div><strong>{active.name}</strong><p>제출 마감까지 {Math.max(0, daysUntil(active.dueDate))}일 남았습니다.</p><small>{active.dueDate} 마감</small></div></div>}
    <div className="notification-item"><span className="notification-icon success"><Icon name="check" size={17} /></span><div><strong>검토 대기 {pending}건</strong><p>기획실 검토와 확정 처리가 필요합니다.</p><small>현재 기준</small></div></div>
    {rejected > 0 && <div className="notification-item"><span className="notification-icon warning"><Icon name="alert" size={17} /></span><div><strong>보완 요청 {rejected}건</strong><p>담당자 재작성과 재제출이 필요합니다.</p><small>현재 기준</small></div></div>}
    {approved && secured < required && <div className="notification-item"><span className="notification-icon warning"><Icon name="target" size={17} /></span><div><strong>미확보 감축량 {formatNumber(required-secured,0)} tCO₂e</strong><p>승인 목표를 충족할 추가 감축과제가 필요합니다.</p><small>{approved.targetYear}년 목표</small></div></div>}
    {delayed > 0 && <div className="notification-item"><span className="notification-icon warning"><Icon name="clock" size={17} /></span><div><strong>지연 감축과제 {delayed}건</strong><p>지연 사유와 후속조치를 입력해 주세요.</p><small>현재 기준</small></div></div>}
    <button className="all-notifications" onClick={onRead}>모두 확인</button></div>;
}
function ProfilePanel({ onSettings, onBackup }: { onSettings: () => void; onBackup: () => void }) { return <div className="profile-panel"><div><strong>문경섭</strong><span>기획팀 · 시스템 관리자</span></div><button onClick={onSettings}><Icon name="settings" size={16} />시스템 설정</button><button onClick={onBackup}><Icon name="download" size={16} />전체 데이터 백업</button><p>현재 입력 내용은 이 브라우저에 자동 저장됩니다. 정기 백업을 권장합니다.</p></div>; }

function GuideModal({ onClose }: { onClose: () => void }) { return <Overlay title="SEMS 사용 가이드" eyebrow="OPERATING GUIDE" description="기준 설정부터 목표 이행과 개선조치까지 이어지는 실제 운영 순서입니다." onClose={onClose}><div className="guide-steps"><div><span>01</span><strong>산정 기준 설정</strong><p>조직·사업장과 활동자료별 배출계수를 먼저 등록해 일관된 산정 기준을 만듭니다.</p></div><div><span>02</span><strong>수집·검토·인벤토리 확정</strong><p>기간을 개설하고 활동자료와 증빙을 수집·검토한 뒤 기준연도 인벤토리를 확정합니다.</p></div><div><span>03</span><strong>감축목표 수립·승인</strong><p>확정 인벤토리를 기준값으로 불러와 대상 Scope, 목표연도와 감축률을 정합니다.</p></div><div><span>04</span><strong>이행계획 수립</strong><p>승인 목표의 필요 감축량을 사업장별 감축과제로 분해하고 담당·예산·일정을 지정합니다.</p></div><div><span>05</span><strong>실적·증빙 관리</strong><p>월별 배출실적과 과제 진척도, 실제 감축량 및 검증 증빙을 함께 관리합니다.</p></div><div><span>06</span><strong>목표 대비 분석·보완</strong><p>연도별 경로와 실적 차이, 미확보 감축량과 지연 과제를 확인해 추가 과제를 수립합니다.</p></div></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>; }

function Dashboard({ records, periods, targets, plans, onNavigate, onNew }: { records: ActivityRecord[]; periods: CollectionPeriod[]; targets: ReductionTarget[]; plans: ReductionPlan[]; onNavigate: (view: View) => void; onNew: () => void }) {
  const years = [...new Set(records.map(r => r.period.slice(0, 4)))].sort().reverse(); const [year, setYear] = useState(years[0] ?? "2026");
  const data = records.filter(r => r.period.startsWith(year)); const confirmedData = data.filter(r => r.status === "확정"&&r.active!==false); const total = confirmedData.reduce((s, r) => s + r.emissions, 0); const confirmed = confirmedData.length; const pending = data.filter(r => r.status === "검토대기");
  const activePeriod = periods.find(period => period.status === "수집중") ?? periods.find(period => period.status === "검토중");
  const scopeTotals = (["Scope 1", "Scope 2", "Scope 3"] as Scope[]).map(scope => confirmedData.filter(r => r.scope === scope).reduce((s, r) => s + r.emissions, 0));
  const completion = data.length ? Math.round((confirmed / data.length) * 100) : 0; const evidenceRate = data.length ? Math.round(data.filter(r => r.evidence).length / data.length * 1000) / 10 : 0;
  const monthly = Array.from({ length: 12 }, (_, i) => { const month = String(i + 1).padStart(2, "0"); const monthRows = confirmedData.filter(r => r.period === `${year}-${month}`); return { month: `${i + 1}월`, s1: monthRows.filter(r => r.scope === "Scope 1").reduce((s,r)=>s+r.emissions,0), s2: monthRows.filter(r => r.scope === "Scope 2").reduce((s,r)=>s+r.emissions,0), s3: monthRows.filter(r => r.scope === "Scope 3").reduce((s,r)=>s+r.emissions,0) }; });
  const chartMax = Math.max(1, ...monthly.map(m => m.s1 + m.s2 + m.s3)); const percents = scopeTotals.map(v => total ? Math.round(v / total * 100) : 0);
  const approvedTarget = targets.find(target => target.status === "승인" && target.company === "그룹 전체") ?? targets.find(target => target.status === "승인");
  const targetPlans = approvedTarget ? plans.filter(plan => plan.targetId === approvedTarget.id) : [];
  const requiredReduction = approvedTarget ? approvedTarget.baselineEmissions - approvedTarget.targetEmissions : 0;
  const securedReduction = targetPlans.reduce((sum, plan) => sum + plan.expectedReduction, 0);
  const planCoverage = requiredReduction > 0 ? Math.min(100, Math.round(securedReduction / requiredReduction * 100)) : 0;
  return <><PageHeader eyebrow={`${year} ESG PERFORMANCE`} title="ESG 통합 대시보드" description="세원그룹의 ESG 데이터 수집 현황과 주요 성과를 한눈에 확인합니다."><label className="year-select"><Icon name="calendar" size={17} /><select value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />자료 입력</button></PageHeader>
    {activePeriod ? <section className="notice-banner"><div className="notice-icon"><Icon name="alert" /></div><div><strong>{activePeriod.name} · {activePeriod.status === "수집중" ? `제출 마감까지 ${Math.max(0, daysUntil(activePeriod.dueDate))}일` : "기획실 검토 진행 중"}</strong><p>{activePeriod.dataFrom}~{activePeriod.dataTo} 귀속자료 · 검토 대기 {pending.length}건</p></div><button onClick={() => onNavigate(activePeriod.status === "수집중" ? "collection" : "review")}>{activePeriod.status === "수집중" ? "수집 현황 보기" : "검토 화면 열기"} <Icon name="arrow" size={16} /></button></section> : <section className="notice-banner neutral"><div className="notice-icon"><Icon name="calendar" /></div><div><strong>현재 진행 중인 수집기간이 없습니다.</strong><p>수집 기간 메뉴에서 다음 정기수집을 개설해 주세요.</p></div><button onClick={() => onNavigate("periods")}>기간 설정 <Icon name="arrow" size={16} /></button></section>}
    {approvedTarget ? <section className="target-status-banner"><div className="target-status-main"><span><Icon name="target" size={20}/></span><div><small>승인 감축목표</small><strong>{approvedTarget.name}</strong><p>{approvedTarget.baselineYear}년 {formatNumber(approvedTarget.baselineEmissions,0)} tCO₂e → {approvedTarget.targetYear}년 {formatNumber(approvedTarget.targetEmissions,0)} tCO₂e ({approvedTarget.reductionRate}% 감축)</p></div></div><div className="target-status-metrics"><div><span>필요 감축량</span><strong>{formatNumber(requiredReduction,0)}<small> tCO₂e</small></strong></div><div><span>과제 확보율</span><strong>{planCoverage}<small>%</small></strong></div></div><button onClick={()=>onNavigate("targets")}>목표·계획 관리 <Icon name="arrow" size={16}/></button></section> : <section className="notice-banner neutral"><div className="notice-icon"><Icon name="target"/></div><div><strong>승인된 온실가스 감축목표가 없습니다.</strong><p>확정 인벤토리를 기준으로 목표와 실행계획을 먼저 수립해 주세요.</p></div><button onClick={()=>onNavigate("targets")}>목표 설정 <Icon name="arrow" size={16}/></button></section>}
    <section className="kpi-grid"><KpiCard label="온실가스 배출량" value={formatNumber(total, 1)} unit="tCO₂e" trend="확정된 활동자료 기준" trendType="good" icon="leaf" tone="green"/><KpiCard label="데이터 확정률" value={String(completion)} unit="%" trend={`${confirmed}/${data.length}개 항목 확정`} trendType="neutral" icon="database" tone="blue" progress={completion}/><KpiCard label="감축과제 확보율" value={String(planCoverage)} unit="%" trend={approvedTarget?`필요 감축량 중 ${formatNumber(securedReduction,0)} t 확보`:"승인 목표를 먼저 설정하세요."} trendType={planCoverage>=100?"good":"warn"} icon="target" tone="green" progress={planCoverage}/><KpiCard label="증빙 연결률" value={String(evidenceRate)} unit="%" trend={`미연결 증빙 ${data.filter(r => !r.evidence).length}건`} trendType={evidenceRate < 100 ? "warn" : "good"} icon="file" tone="violet" progress={evidenceRate}/></section>
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
    const periodRecords = records.filter(record => record.collectionId === period.id && record.active !== false);
    const unresolved = periodRecords.filter(record => record.status !== "확정");
    if (status === "마감" && (!periodRecords.length || unresolved.length)) {
      showToast(!periodRecords.length ? "등록된 자료가 없어 검토를 마감할 수 없습니다." : `미확정 자료 ${unresolved.length}건을 모두 확정하거나 제외해 주세요.`);
      return;
    }
    if (status === "잠금" && period.status !== "마감") { showToast("검토 마감 후에만 기간을 잠글 수 있습니다."); return; }
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
        <div className="period-actions">{period.status === "예정" && <button className="primary-button compact" onClick={()=>updateStatus(period,"수집중")}>수집 시작</button>}{period.status === "수집중" && <button className="primary-button compact" onClick={()=>updateStatus(period,"검토중")}>제출 마감·검토 시작</button>}{period.status === "검토중" && <button className="primary-button compact" onClick={()=>updateStatus(period,"마감")}>검토 완료·마감</button>}{period.status === "마감" && <button className="primary-button compact" onClick={()=>updateStatus(period,"잠금")}>확정자료 잠금</button>}{["마감","잠금"].includes(period.status) && <button className="secondary-button compact" onClick={()=>updateStatus(period,"수집중")}>기간 다시 열기</button>}<button className="secondary-button compact" onClick={()=>setEditing(period)}>설정 수정</button></div>
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
    <div className="form-section"><h3><span>1</span>수집 기본정보</h3><div className="form-grid"><label className="full-span">수집기간명<input value={form.name} onChange={e=>patch({name:e.target.value})} placeholder="예: 2026년 8월 온실가스 정기수집" required/></label><label>수집 주기<select value={form.cycle} onChange={e=>patch({cycle:e.target.value as CollectionPeriod["cycle"]})}><option>월</option><option>분기</option><option>반기</option><option>연</option><option>수시</option></select></label><label>현재 상태<input value={form.status} readOnly className="readonly-input"/><small className="field-help">상태는 기간 카드의 단계별 버튼으로만 변경됩니다.</small></label><label>귀속 시작월<input type="month" value={form.dataFrom} onChange={e=>patch({dataFrom:e.target.value})} required/></label><label>귀속 종료월<input type="month" value={form.dataTo} onChange={e=>patch({dataTo:e.target.value})} required/></label></div></div>
    <div className="form-section"><h3><span>2</span>운영 일정</h3><div className="form-grid"><label>수집 시작일<input type="date" value={form.openDate} onChange={e=>patch({openDate:e.target.value})} required/></label><label>제출 마감일<input type="date" value={form.dueDate} onChange={e=>patch({dueDate:e.target.value})} required/></label><label>검토 마감일<input type="date" value={form.reviewDate} onChange={e=>patch({reviewDate:e.target.value})} required/></label><Toggle label="제출 시 증빙 필수" checked={form.evidenceRequired} onChange={value=>patch({evidenceRequired:value})}/></div></div>
    <div className="form-section"><h3><span>3</span>수집 대상</h3><div className="check-group"><strong>대상 Scope</strong><div>{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map(scope=><label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={()=>toggleScope(scope)}/>{scope}</label>)}</div></div><div className="check-group"><strong>대상 법인</strong><div>{companies.map(company=><label key={company}><input type="checkbox" checked={form.companies.includes(company)} onChange={()=>toggleCompany(company)}/>{company}</label>)}</div></div><label className="textarea-label">운영 설명<textarea value={form.description} onChange={e=>patch({description:e.target.value})} placeholder="수집 목적과 담당자가 확인할 사항을 적어 주세요."/></label>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div>
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" type="submit"><Icon name="check" size={16}/>저장</button></div>
  </form></Overlay>;
}

function Collection({ records, periods, criteria, onNew, onBulk, onEdit, onChange, showToast }: { records: ActivityRecord[]; periods: CollectionPeriod[]; criteria: CollectionCriteria; onNew: () => void; onBulk: () => void; onEdit: (record: ActivityRecord) => void; onChange: (records: ActivityRecord[], auditInfo?: { action: string; target: string; detail: string }) => void; showToast: (m: string) => void }) {
  const activePeriods = periods.filter(period => ["수집중","검토중"].includes(period.status));
  const [periodId,setPeriodId]=useState(activePeriods[0]?.id ?? periods[0]?.id ?? "전체");
  const [search,setSearch]=useState(""); const [status,setStatus]=useState("전체"); const [company,setCompany]=useState("전체 법인"); const [scope,setScope]=useState("전체 Scope"); const [page,setPage]=useState(1); const pageSize=8;
  const baseFiltered=records.filter(r=>(periodId==="전체"||r.collectionId===periodId)&&(company==="전체 법인"||r.company===company)&&(scope==="전체 Scope"||r.scope===scope)&&`${r.company} ${r.site} ${r.category} ${r.source} ${r.owner} ${r.description??""}`.toLowerCase().includes(search.toLowerCase()));
  const filtered=baseFiltered.filter(r=>status==="전체"||r.status===status);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)); const visible=filtered.slice((Math.min(page,pageCount)-1)*pageSize,Math.min(page,pageCount)*pageSize);
  const exportCsv=()=>{downloadCsv("SEMS_activity_data.csv",["수집기간","법인","사업장","귀속월","Scope","구분","배출원","사용량","단위","배출계수","배출량(tCO2e)","증빙","설명","담당자","부서","상태"],filtered.map(r=>[periods.find(p=>p.id===r.collectionId)?.name??"",r.company,r.site,r.period,r.scope,r.category,r.source,r.usage,r.unit,r.factor,r.emissions,r.evidence,r.description??"",r.owner,r.department,r.status]));showToast("현재 조회 결과를 내려받았습니다.");};
  const submitRecord=(record:ActivityRecord)=>{const period=periods.find(item=>item.id===record.collectionId);if(!period||period.status!=="수집중"){showToast("현재 수집중인 기간의 자료만 제출할 수 있습니다.");return;}if((period.evidenceRequired||criteria.evidenceRequired)&&!record.evidence){showToast("증빙자료를 연결한 뒤 제출해 주세요.");return;}onChange(records.map(item=>item.id===record.id?{...item,status:"검토대기" as RecordStatus,rejectionReason:"",updatedAt:"방금 전"}:item),{action:"검토 제출",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료를 검토 대기로 제출했습니다.`});showToast("기획실 검토 대기로 제출했습니다.");};
  const remove=(record:ActivityRecord)=>{const period=periods.find(item=>item.id===record.collectionId);if(record.locked||record.status==="확정"||period?.status==="잠금"){showToast("확정 또는 잠금된 자료는 삭제할 수 없습니다.");return;}if(!window.confirm("이 활동자료를 삭제하시겠습니까?"))return;onChange(records.filter(item=>item.id!==record.id),{action:"자료 삭제",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료를 삭제했습니다.`});showToast("활동자료를 삭제했습니다.");};
  const variance=(record:ActivityRecord)=>{const prev=records.find(item=>item.company===record.company&&item.site===record.site&&item.scope===record.scope&&item.category===record.category&&item.source===record.source&&item.period===previousMonth(record.period));return prev?.usage?((record.usage-prev.usage)/prev.usage*100):null;};
  return <><PageHeader eyebrow="DATA COLLECTION" title="ESG 데이터 수집" description="개설된 수집기간 안에서 활동자료를 입력하고 중복·증빙·이상치를 검증합니다."><button className="secondary-button" onClick={onBulk}><Icon name="upload" size={17}/>Excel 일괄등록</button><button className="secondary-button" onClick={exportCsv}><Icon name="download" size={17}/>조회결과 내보내기</button><button className="primary-button" onClick={onNew} disabled={!periods.some(item=>item.status==="수집중")}><Icon name="plus" size={17}/>신규 자료 입력</button></PageHeader>
    <div className="period-filter-bar"><div><Icon name="calendar" size={18}/><span>수집기간</span><select value={periodId} onChange={e=>{setPeriodId(e.target.value);setPage(1)}}><option value="전체">전체 기간</option>{periods.map(item=><option value={item.id} key={item.id}>{item.name} · {item.status}</option>)}</select></div>{periods.find(item=>item.id===periodId)&&<span className={`status-badge ${periodTone(periods.find(item=>item.id===periodId)!.status)}`}><span className="status-dot"/>{periods.find(item=>item.id===periodId)!.status}</span>}</div>
    <section className="collection-summary"><SummaryTile label="조회 항목" value={baseFiltered.length} suffix="건" icon="database"/><SummaryTile label="검토 대기" value={baseFiltered.filter(r=>r.status==="검토대기").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="보완 요청" value={baseFiltered.filter(r=>r.status==="반려").length} suffix="건" icon="alert" tone="red"/><SummaryTile label="확정 완료" value={baseFiltered.filter(r=>r.status==="확정").length} suffix="건" icon="check" tone="green"/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","작성중","검토대기","반려","확정"].map(item=><button className={status===item?"active":""} key={item} onClick={()=>{setStatus(item);setPage(1)}}>{item==="반려"?"보완 요청":item}{item!=="전체"&&<span>{baseFiltered.filter(r=>r.status===item).length}</span>}</button>)}</div><div className="filter-actions"><div className="search-box"><Icon name="search" size={17}/><input placeholder="배출원, 담당자, 설명 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><select value={scope} onChange={e=>{setScope(e.target.value);setPage(1)}} aria-label="Scope 필터"><option>전체 Scope</option><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select><select value={company} onChange={e=>{setCompany(e.target.value);setPage(1)}} aria-label="법인 필터"><option>전체 법인</option>{companies.map(c=><option key={c}>{c}</option>)}</select></div></div>
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

function Inventory({records,targets,onNavigate,showToast}:{records:ActivityRecord[];targets:ReductionTarget[];onNavigate:(view:View)=>void;showToast:(m:string)=>void}){
  const years=[...new Set(records.map(r=>r.period.slice(0,4)))].sort().reverse(); const [year,setYear]=useState(years[0]??"2026"); const [scope,setScope]=useState<Scope|null>(null); const base=records.filter(r=>r.period.startsWith(year)&&r.status==="확정"&&r.active!==false); const rows=scope?base.filter(r=>r.scope===scope):base; const total=rows.reduce((s,r)=>s+r.emissions,0);
  const byCompany=companies.map(name=>({name,value:rows.filter(r=>r.company===name).reduce((s,r)=>s+r.emissions,0)})); const max=Math.max(1,...byCompany.map(x=>x.value));
  const approvedTarget=targets.find(target=>target.status==="승인"&&target.company==="그룹 전체")??targets.find(target=>target.status==="승인"); const targetRows=approvedTarget?base.filter(r=>approvedTarget.scopes.includes(r.scope)&&(approvedTarget.company==="그룹 전체"||r.company===approvedTarget.company)):[]; const targetActual=targetRows.reduce((sum,row)=>sum+row.emissions,0); const targetMonths=new Set(targetRows.map(row=>row.period)).size; const annualized=targetMonths?targetActual/targetMonths*12:0; const pathRate=approvedTarget?Math.max(0,Math.min(1,(Number(year)-approvedTarget.baselineYear)/Math.max(1,approvedTarget.targetYear-approvedTarget.baselineYear))):0; const pathway=approvedTarget?approvedTarget.baselineEmissions-(approvedTarget.baselineEmissions-approvedTarget.targetEmissions)*pathRate:0; const pathReduction=approvedTarget?approvedTarget.baselineEmissions-pathway:0; const targetProgress=approvedTarget&&targetMonths&&pathReduction>0?Math.max(0,Math.min(100,Math.round((approvedTarget.baselineEmissions-annualized)/pathReduction*100))):0;
  const exportData=()=>{downloadCsv("sems2_ghg_inventory.csv",["귀속월","법인","사업장","Scope","활동자료","배출원","사용량","단위","배출량(tCO2e)","상태"],rows.map(r=>[r.period,r.company,r.site,r.scope,r.category,r.source,r.usage,r.unit,r.emissions,r.status]));showToast("산정 내역을 내려받았습니다.");};
  return <><PageHeader eyebrow="GHG INVENTORY" title="온실가스 인벤토리" description="활동자료와 배출계수를 연결해 Scope별 배출량을 산정하고 추적합니다."><label className="year-select"><Icon name="calendar" size={17}/><select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="secondary-button" onClick={exportData}><Icon name="download" size={17}/>산정 내역 다운로드</button></PageHeader>
    <section className="inventory-hero"><div><span>{year}년 {scope??"전체 Scope"} 누적 배출량</span><div className="inventory-total"><strong>{formatNumber(total,1)}</strong><em>tCO₂e</em></div><p><b>확정 활동자료 {rows.length}건</b> · 검토 확정 데이터만 반영</p></div>{approvedTarget?<div className="target-block"><div className="target-copy"><span>{approvedTarget.targetYear} 감축경로 달성도</span><strong>{targetMonths?`${targetProgress}%`:"산정 대기"}</strong></div><div className="target-track"><span style={{width:`${targetProgress}%`}}/><i style={{left:"100%"}}/></div><div className="target-labels"><span>{year} 경로 {formatNumber(pathway,0)} t</span><span>{targetMonths?`연환산 ${formatNumber(annualized,0)} t`:"확정 실적 없음"}</span></div><button className="target-link-button" onClick={()=>onNavigate("targets")}>목표 산정근거·이행계획 보기 <Icon name="arrow" size={14}/></button></div>:<div className="target-block empty-target"><div className="target-copy"><span>연결된 감축목표 없음</span><strong>목표 설정 필요</strong></div><p>확정 인벤토리를 기준으로 목표를 먼저 수립해 주세요.</p><button className="target-link-button" onClick={()=>onNavigate("targets")}>감축목표 설정 <Icon name="arrow" size={14}/></button></div>}</section>
    <div className="scope-filter-note"><span>Scope 카드를 누르면 법인별 배출량이 해당 범위로 필터링됩니다.</span>{scope&&<button onClick={()=>setScope(null)}>전체 Scope 보기</button>}</div>
    <section className="inventory-grid"><article className="card"><CardHeader title="Scope별 인벤토리" subtitle="검토 확정 자료 기준"/><div className="inventory-scope-list">{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map((s,i)=><InventoryScope key={s} number={`0${i+1}`} label={s} desc={i===0?"고정연소 · 이동연소 · 비산배출":i===1?"구매 전력 · 구매 열·스팀":"공급망 · 통근 · 출장 · 폐기물"} value={base.filter(r=>r.scope===s).reduce((a,r)=>a+r.emissions,0)} color={i===0?"dark":i===1?"mid":"light"} active={scope===s} onClick={()=>setScope(scope===s?null:s)}/>)}</div></article><article className="card"><CardHeader title="법인별 배출량" subtitle={`${year}년 ${scope??"전체 Scope"} 기준`} action="단위: tCO₂e"/><div className="horizontal-bars">{byCompany.map(item=><div key={item.name}><div><strong>{item.name}</strong><span>{formatNumber(item.value,1)}</span></div><p><span style={{width:`${Math.max(item.value/max*100,item.value?4:0)}%`}}/></p></div>)}</div></article></section>
    <section className="card formula-card"><CardHeader title="배출량 산정 구조" subtitle="원천자료부터 확정 데이터까지의 연결 관계"/><div className="formula-flow"><div><span className="flow-number">1</span><strong>활동자료</strong><small>Scope별 사용량 입력</small></div><Icon name="arrow"/><div><span className="flow-number">2</span><strong>배출계수</strong><small>기준정보에서 자동 적용</small></div><Icon name="arrow"/><div><span className="flow-number">3</span><strong>배출량 산정</strong><small>사용량 × 계수 ÷ 1,000</small></div><Icon name="arrow"/><div className="highlight"><span className="flow-number">4</span><strong>검토·확정</strong><small>증빙 연결 및 이력 보관</small></div></div></section></>;
}
function InventoryScope({number,label,desc,value,color,active,onClick}:{number:string;label:string;desc:string;value:number;color:string;active:boolean;onClick:()=>void}){return <button className={`inventory-scope ${active?"selected":""}`} onClick={onClick}><span className={`scope-number ${color}`}>{number}</span><div><strong>{label}</strong><p>{desc}</p></div><em>{formatNumber(value,1)}<small> tCO₂e</small></em><Icon name="chevron" size={17}/></button>}

function targetInventory(records:ActivityRecord[],company:string,scopes:Scope[],year:number){
  return records.filter(record=>record.status==="확정"&&record.active!==false&&record.period.startsWith(String(year))&&scopes.includes(record.scope)&&(company==="그룹 전체"||record.company===company)).reduce((sum,record)=>sum+record.emissions,0);
}
function targetPath(target:ReductionTarget){
  const duration=Math.max(1,target.targetYear-target.baselineYear);
  return Array.from({length:duration+1},(_,index)=>{const year=target.baselineYear+index;const ratio=index/duration;return {year,value:target.baselineEmissions-(target.baselineEmissions-target.targetEmissions)*ratio};});
}
function normalizePlanStatus(plan:ReductionPlan):PlanStatus{
  if(plan.progress>=100)return "완료";
  if(plan.endDate&&new Date(`${plan.endDate}T23:59:59`).getTime()<Date.now())return "지연";
  return plan.progress>0?"진행중":"계획";
}

function TargetsAndPlans({targets,plans,records,organizations,onTargetsChange,onPlansChange,addAudit,showToast}:{targets:ReductionTarget[];plans:ReductionPlan[];records:ActivityRecord[];organizations:Record<string,string[]>;onTargetsChange:(items:ReductionTarget[])=>void;onPlansChange:(items:ReductionPlan[])=>void;addAudit:(action:string,target:string,detail:string,actor?:string)=>void;showToast:(message:string)=>void}){
  const [selectedId,setSelectedId]=useState(targets.find(target=>target.status==="승인")?.id??targets[0]?.id??"");
  const [targetModal,setTargetModal]=useState<ReductionTarget|null|"new">(null);
  const [planModal,setPlanModal]=useState<ReductionPlan|null|"new">(null);
  const [planFilter,setPlanFilter]=useState("전체");
  const selected=targets.find(target=>target.id===selectedId)??targets[0]??null;
  const linkedPlans=selected?plans.filter(plan=>plan.targetId===selected.id):[];
  const visiblePlans=linkedPlans.filter(plan=>planFilter==="전체"||plan.status===planFilter);
  const required=selected?selected.baselineEmissions-selected.targetEmissions:0;
  const expected=linkedPlans.reduce((sum,plan)=>sum+plan.expectedReduction,0);
  const actual=linkedPlans.reduce((sum,plan)=>sum+plan.actualReduction,0);
  const coverage=required?Math.min(100,Math.round(expected/required*100)):0;
  const delayed=linkedPlans.filter(plan=>normalizePlanStatus(plan)==="지연").length;
  const pathway=selected?targetPath(selected):[];
  const saveTarget=(target:ReductionTarget)=>{
    const isNew=target.id==="NEW-TARGET";
    const before=targets.find(item=>item.id===target.id);
    const materialChanged=Boolean(before?.status==="승인"&&(before.company!==target.company||before.baselineYear!==target.baselineYear||before.targetYear!==target.targetYear||before.reductionRate!==target.reductionRate||before.baselineEmissions!==target.baselineEmissions||before.scopes.join("|")!==target.scopes.join("|")));
    const normalized={...target,id:isNew?`TG-${String(Math.max(0,...targets.map(item=>Number(item.id.replace(/\D/g,""))||0))+1).padStart(3,"0")}`:target.id,status:materialChanged?"초안" as TargetStatus:target.status,approvedAt:materialChanged?undefined:target.approvedAt,updatedAt:nowLabel()};
    onTargetsChange(isNew?[normalized,...targets]:targets.map(item=>item.id===normalized.id?normalized:item));
    setSelectedId(normalized.id);setTargetModal(null);
    addAudit(isNew?"감축목표 수립":"감축목표 수정",normalized.name,`${normalized.baselineYear}년 ${formatNumber(normalized.baselineEmissions,1)} tCO₂e 기준 · ${normalized.targetYear}년 ${normalized.reductionRate}% 감축`);
    showToast(isNew?"새 감축목표를 수립했습니다.":materialChanged?"승인 목표의 핵심 조건이 바뀌어 초안으로 전환했습니다.":"감축목표를 수정했습니다.");
  };
  const approveTarget=(target:ReductionTarget)=>{
    if(target.baselineEmissions<=0){showToast("확정 인벤토리 기준값이 없어 승인할 수 없습니다.");return;}
    onTargetsChange(targets.map(item=>item.id===target.id?{...item,status:"승인" as TargetStatus,approvedAt:new Date().toISOString().slice(0,10),updatedAt:nowLabel()}:item));
    addAudit("감축목표 승인",target.name,`${target.targetYear}년 ${target.reductionRate}% 감축목표를 승인했습니다.`);
    showToast("감축목표를 승인했습니다. 이제 이행계획을 연결할 수 있습니다.");
  };
  const changeTargetStatus=(target:ReductionTarget,status:TargetStatus)=>{
    if(status==="종료"&&!window.confirm("이 목표를 종료 상태로 전환하시겠습니까? 기존 이행계획과 실적은 유지됩니다."))return;
    onTargetsChange(targets.map(item=>item.id===target.id?{...item,status,updatedAt:nowLabel()}:item));
    addAudit(status==="종료"?"감축목표 종료":"감축목표 재개",target.name,status==="종료"?"목표를 종료 상태로 전환하고 기존 이력은 유지했습니다.":"재검토를 위해 목표를 초안 상태로 다시 열었습니다.");
    showToast(status==="종료"?"감축목표를 종료 상태로 전환했습니다.":"감축목표를 초안 상태로 다시 열었습니다.");
  };
  const deleteTarget=(target:ReductionTarget)=>{
    if(plans.some(plan=>plan.targetId===target.id)){showToast("연결된 이행계획이 있어 목표를 삭제할 수 없습니다.");return;}
    if(!window.confirm("이 감축목표를 삭제하시겠습니까?"))return;
    const next=targets.filter(item=>item.id!==target.id);onTargetsChange(next);setSelectedId(next[0]?.id??"");setTargetModal(null);addAudit("감축목표 삭제",target.name,"연결된 이행계획이 없는 목표를 삭제했습니다.");showToast("감축목표를 삭제했습니다.");
  };
  const savePlan=(plan:ReductionPlan)=>{
    const isNew=plan.id==="NEW-PLAN";
    const normalized={...plan,id:isNew?`RP-${String(Math.max(0,...plans.map(item=>Number(item.id.replace(/\D/g,""))||0))+1).padStart(3,"0")}`:plan.id,status:normalizePlanStatus(plan),updatedAt:nowLabel()};
    onPlansChange(isNew?[normalized,...plans]:plans.map(item=>item.id===normalized.id?normalized:item));setPlanModal(null);setSelectedId(normalized.targetId);
    addAudit(isNew?"감축과제 등록":"감축과제 수정",normalized.title,`예상 감축 ${formatNumber(normalized.expectedReduction,1)} tCO₂e · 진척도 ${normalized.progress}%`);
    showToast(isNew?"새 감축과제를 등록했습니다.":"감축과제 실적을 수정했습니다.");
  };
  const deletePlan=(plan:ReductionPlan)=>{
    if(!window.confirm("이 감축과제를 삭제하시겠습니까?"))return;
    onPlansChange(plans.filter(item=>item.id!==plan.id));setPlanModal(null);addAudit("감축과제 삭제",plan.title,"목표에 연결된 이행계획에서 과제를 삭제했습니다.");showToast("감축과제를 삭제했습니다.");
  };
  const exportPlans=()=>{downloadCsv("SEMS_reduction_plan.csv",["목표","과제","법인","사업장","Scope","유형","담당부서","담당자","시작일","종료일","예상감축량","실제감축량","예산","진척도","상태","검증자료"],visiblePlans.map(plan=>[selected?.name??"",plan.title,plan.company,plan.site,plan.scope,plan.category,plan.department,plan.owner,plan.startDate,plan.endDate,plan.expectedReduction,plan.actualReduction,plan.budget,plan.progress,normalizePlanStatus(plan),plan.verification]));showToast("현재 목표의 이행계획을 내려받았습니다.");};
  return <><PageHeader eyebrow="TARGET & ACTION PLAN" title="감축목표·이행계획" description="확정 인벤토리를 기준으로 목표를 수립하고, 필요 감축량을 실행과제로 분해해 실적까지 관리합니다."><button className="secondary-button" onClick={()=>setTargetModal("new")}><Icon name="target" size={17}/>새 목표 설정</button><button className="primary-button" onClick={()=>selected?setPlanModal("new"):showToast("감축목표를 먼저 설정해 주세요.")} disabled={!selected}><Icon name="plus" size={17}/>감축과제 등록</button></PageHeader>
    <section className="logic-flow"><div><span>1</span><strong>인벤토리 확정</strong><small>검토 완료 기준값</small></div><Icon name="arrow"/><div className={targets.length?"done":""}><span>2</span><strong>목표 수립·승인</strong><small>{targets.filter(item=>item.status==="승인").length}건 승인</small></div><Icon name="arrow"/><div className={plans.length?"done":""}><span>3</span><strong>이행계획 분해</strong><small>{plans.length}개 감축과제</small></div><Icon name="arrow"/><div className={actual>0?"done":""}><span>4</span><strong>실적·증빙 입력</strong><small>{formatNumber(actual,0)} t 감축 확인</small></div><Icon name="arrow"/><div className={delayed?"warning":""}><span>5</span><strong>분석·보완조치</strong><small>{delayed?`지연 ${delayed}건`:"정상 이행"}</small></div></section>
    <section className="target-summary"><SummaryTile label="승인 목표" value={targets.filter(item=>item.status==="승인").length} suffix="건" icon="target" tone="green"/><SummaryTile label="연결 과제" value={linkedPlans.length} suffix="건" icon="list"/><SummaryTile label="과제 확보율" value={coverage} suffix="%" icon="check" tone={coverage>=100?"green":"amber"}/><SummaryTile label="지연 과제" value={delayed} suffix="건" icon="alert" tone={delayed?"red":"green"}/></section>
    <section className="target-workspace"><aside className="card target-list"><CardHeader title="감축목표" subtitle="목표를 선택하면 산정근거와 이행계획이 연결됩니다." action={<button className="outline-small" onClick={()=>setTargetModal("new")}><Icon name="plus" size={14}/>추가</button>}/><div>{targets.map(target=><button key={target.id} className={selected?.id===target.id?"active":""} onClick={()=>setSelectedId(target.id)}><span className={`target-state ${target.status}`}>{target.status}</span><strong>{target.name}</strong><p>{target.company} · {target.scopes.join("·")}</p><div><span>{target.baselineYear} → {target.targetYear}</span><b>-{target.reductionRate}%</b></div></button>)}{!targets.length&&<div className="empty-state compact"><Icon name="target"/><strong>등록된 감축목표가 없습니다.</strong></div>}</div></aside>
      <div className="target-detail-column">{selected?<><article className="card target-detail-card"><div className="target-detail-head"><div><span className={`target-state ${selected.status}`}>{selected.status}</span><h2>{selected.name}</h2><p>{selected.description}</p></div><div className="row-actions">{selected.status==="초안"&&<button className="primary-button compact" onClick={()=>approveTarget(selected)}><Icon name="check" size={15}/>목표 승인</button>}{selected.status==="승인"&&<button className="secondary-button compact" onClick={()=>changeTargetStatus(selected,"종료")}><Icon name="lock" size={15}/>목표 종료</button>}{selected.status==="종료"&&<button className="secondary-button compact" onClick={()=>changeTargetStatus(selected,"초안")}><Icon name="refresh" size={15}/>다시 열기</button>}<button className="secondary-button compact" onClick={()=>setTargetModal(selected)}><Icon name="edit" size={15}/>수정</button></div></div><div className="target-number-grid"><div><span>기준연도 배출량</span><strong>{formatNumber(selected.baselineEmissions,1)}<small> tCO₂e</small></strong><em>{selected.baselineYear}년 확정 인벤토리</em></div><div><span>목표연도 배출량</span><strong>{formatNumber(selected.targetEmissions,1)}<small> tCO₂e</small></strong><em>{selected.targetYear}년 · {selected.reductionRate}% 감축</em></div><div><span>필요 감축량</span><strong>{formatNumber(required,1)}<small> tCO₂e</small></strong><em>기준배출량 - 목표배출량</em></div><div className={coverage<100?"warning":""}><span>과제 확보량</span><strong>{formatNumber(expected,1)}<small> tCO₂e</small></strong><em>{coverage}% 확보 · {formatNumber(Math.max(0,required-expected),1)} t 추가 필요</em></div></div><div className="pathway-head"><div><strong>연도별 감축경로</strong><span>기준연도와 목표연도 사이를 선형 경로로 관리합니다.</span></div><span className="target-owner">담당 {selected.owner}</span></div><div className="pathway-table">{pathway.map((point,index)=><div key={point.year} className={point.year===selected.baselineYear||point.year===selected.targetYear?"anchor":""}><span>{point.year}</span><i style={{height:`${Math.max(10,point.value/selected.baselineEmissions*74)}px`}}/><strong>{formatNumber(point.value,0)}</strong><small>{index===0?"기준":point.year===selected.targetYear?"목표":`-${formatNumber((selected.baselineEmissions-point.value)/selected.baselineEmissions*100,1)}%`}</small></div>)}</div></article>
        <article className={`coverage-card card ${coverage<100?"needs-action":"complete"}`}><div><span><Icon name={coverage<100?"alert":"check"} size={19}/></span><div><strong>{coverage<100?"필요 감축량을 충족할 추가 과제가 필요합니다.":"필요 감축량을 과제로 모두 확보했습니다."}</strong><p>필요 {formatNumber(required,0)} t · 확보 {formatNumber(expected,0)} t · 실제 확인 {formatNumber(actual,0)} t</p></div></div><div className="coverage-track"><span style={{width:`${coverage}%`}}/></div><button onClick={()=>setPlanModal("new")}>{coverage<100?"추가 감축과제 수립":"이행계획 점검"} <Icon name="arrow" size={15}/></button></article>
        <article className="card plan-card"><CardHeader title="목표 연계 이행계획" subtitle="과제별 예상·실제 감축량, 일정과 검증자료를 관리합니다." action={<div className="plan-actions"><button className="outline-small" onClick={exportPlans}><Icon name="download" size={14}/>내보내기</button><button className="outline-small" onClick={()=>setPlanModal("new")}><Icon name="plus" size={14}/>과제 등록</button></div>}/><div className="status-tabs plan-tabs">{["전체","계획","진행중","지연","완료"].map(status=><button key={status} className={planFilter===status?"active":""} onClick={()=>setPlanFilter(status)}>{status}<span>{status==="전체"?linkedPlans.length:linkedPlans.filter(plan=>normalizePlanStatus(plan)===status).length}</span></button>)}</div><div className="table-scroll"><table className="data-table plan-table"><thead><tr><th>감축과제</th><th>법인 / 사업장</th><th>Scope</th><th>일정</th><th className="align-right">예상 감축</th><th className="align-right">실제 감축</th><th>진척도</th><th>상태</th><th>작업</th></tr></thead><tbody>{visiblePlans.map(plan=>{const status=normalizePlanStatus(plan);return <tr key={plan.id}><td><strong>{plan.title}</strong><span>{plan.category} · {plan.department}</span></td><td><strong>{plan.company}</strong><span>{plan.site}</span></td><td><span className={`scope-tag s${plan.scope.slice(-1)}`}>{plan.scope}</span></td><td><strong>{plan.startDate.slice(0,7)}</strong><span>~ {plan.endDate.slice(0,7)}</span></td><td className="align-right"><strong>{formatNumber(plan.expectedReduction,1)}</strong><span>tCO₂e</span></td><td className="align-right"><strong>{formatNumber(plan.actualReduction,1)}</strong><span>tCO₂e</span></td><td><div className="inline-progress plan-progress"><span><i style={{width:`${plan.progress}%`}}/></span><strong>{plan.progress}%</strong></div></td><td><StatusBadge status={status}/></td><td><button className="outline-small" onClick={()=>setPlanModal(plan)}><Icon name="edit" size={14}/>실적 입력</button></td></tr>})}</tbody></table>{!visiblePlans.length&&<div className="empty-state"><Icon name="list"/><strong>조건에 맞는 감축과제가 없습니다.</strong><p>목표의 필요 감축량을 사업장별 실행과제로 나눠 등록해 주세요.</p></div>}</div></article></>:<div className="card empty-state target-empty"><Icon name="target"/><strong>감축목표를 먼저 설정해 주세요.</strong><p>기준연도 확정 인벤토리를 불러오면 목표배출량과 필요 감축량이 자동 계산됩니다.</p><button className="primary-button" onClick={()=>setTargetModal("new")}><Icon name="plus" size={16}/>새 목표 설정</button></div>}</div>
    </section>
    {targetModal&&<TargetForm target={targetModal==="new"?null:targetModal} records={records} linkedPlans={targetModal==="new"?0:plans.filter(plan=>plan.targetId===targetModal.id).length} onClose={()=>setTargetModal(null)} onSave={saveTarget} onDelete={targetModal==="new"?undefined:()=>deleteTarget(targetModal)}/>}
    {planModal&&selected&&<PlanForm plan={planModal==="new"?null:planModal} targets={targets} selectedTargetId={selected.id} organizations={organizations} onClose={()=>setPlanModal(null)} onSave={savePlan} onDelete={planModal==="new"?undefined:()=>deletePlan(planModal)}/>}
  </>;
}

function TargetForm({target,records,linkedPlans,onClose,onSave,onDelete}:{target:ReductionTarget|null;records:ActivityRecord[];linkedPlans:number;onClose:()=>void;onSave:(target:ReductionTarget)=>void;onDelete?:()=>void}){
  const confirmedYears=[...new Set(records.filter(record=>record.status==="확정"&&record.active!==false).map(record=>Number(record.period.slice(0,4))))].sort((a,b)=>b-a);
  const firstYear=confirmedYears[0]??new Date().getFullYear();
  const defaultScopes:Scope[]=["Scope 1","Scope 2"];
  const defaultBaseline=targetInventory(records,"그룹 전체",defaultScopes,firstYear);
  const [form,setForm]=useState<ReductionTarget>(target??{id:"NEW-TARGET",name:"",company:"그룹 전체",scopes:defaultScopes,baselineYear:firstYear,baselineEmissions:defaultBaseline,targetYear:firstYear+5,reductionRate:30,targetEmissions:defaultBaseline*.7,owner:"기획팀",status:"초안",description:"",updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const recalculate=(next:Partial<ReductionTarget>,reloadBaseline=false)=>{setForm(current=>{const merged={...current,...next};const baseline=reloadBaseline?targetInventory(records,merged.company,merged.scopes,merged.baselineYear):merged.baselineEmissions;return {...merged,baselineEmissions:baseline,targetEmissions:Math.round(baseline*(1-merged.reductionRate/100)*100)/100};});setError("");};
  const toggleScope=(scope:Scope)=>{const scopes=form.scopes.includes(scope)?form.scopes.filter(item=>item!==scope):[...form.scopes,scope];recalculate({scopes},true);};
  const submit=(event:FormEvent)=>{event.preventDefault();if(!form.scopes.length){setError("대상 Scope를 한 개 이상 선택해 주세요.");return;}if(form.baselineEmissions<=0){setError("선택한 기준연도의 확정 인벤토리가 없습니다. 인벤토리를 먼저 확정해 주세요.");return;}if(form.targetYear<=form.baselineYear){setError("목표연도는 기준연도보다 뒤여야 합니다.");return;}if(form.reductionRate<=0||form.reductionRate>=100){setError("감축률은 0% 초과 100% 미만으로 설정해 주세요.");return;}onSave(form);};
  return <Overlay title={target?"감축목표 수정":"새 감축목표 설정"} eyebrow="REDUCTION TARGET" description="기준값은 확정 인벤토리에서 불러오며 목표배출량과 필요 감축량은 자동 계산됩니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>목표 범위</h3><div className="form-grid"><label className="full-span">목표명<input value={form.name} onChange={event=>recalculate({name:event.target.value})} placeholder="예: 세원그룹 Scope 1·2 2030 감축목표" required/></label><label>대상 조직<select value={form.company} onChange={event=>recalculate({company:event.target.value},true)}><option>그룹 전체</option>{companies.map(company=><option key={company}>{company}</option>)}</select></label><label>목표 담당부서<input value={form.owner} onChange={event=>recalculate({owner:event.target.value})} required/></label></div><div className="check-group"><strong>대상 Scope</strong><div>{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map(scope=><label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={()=>toggleScope(scope)}/>{scope}</label>)}</div></div></div>
    <div className="form-section"><h3><span>2</span>기준연도와 감축수준</h3><div className="form-grid"><label>기준연도<select value={form.baselineYear} onChange={event=>recalculate({baselineYear:Number(event.target.value)},true)}>{confirmedYears.map(year=><option key={year}>{year}</option>)}{target&&!confirmedYears.includes(target.baselineYear)&&<option>{target.baselineYear}</option>}</select></label><label>기준연도 배출량<div className="locked-input"><input value={formatNumber(form.baselineEmissions,2)} readOnly tabIndex={-1}/><Icon name="lock" size={15}/></div><small className="field-help">선택 범위의 확정 인벤토리 합계 · tCO₂e</small></label><label>목표연도<input type="number" min={form.baselineYear+1} max={2050} value={form.targetYear} onChange={event=>recalculate({targetYear:Number(event.target.value)})} required/></label><label>감축률<div className="input-unit"><input type="number" min="0.1" max="99.9" step="0.1" value={form.reductionRate} onChange={event=>recalculate({reductionRate:Number(event.target.value)})} required/><span>%</span></div></label><div className="calculated-field"><span>목표배출량</span><strong>{formatNumber(form.targetEmissions,1)} <small>tCO₂e</small></strong><em>기준배출량 × (1 - 감축률)</em></div><div className="calculated-field reduction"><span>필요 감축량</span><strong>{formatNumber(form.baselineEmissions-form.targetEmissions,1)} <small>tCO₂e</small></strong><em>이행계획으로 확보해야 할 총량</em></div></div></div>
    <div className="form-section"><h3><span>3</span>운영 근거</h3><label className="textarea-label">목표 설명·산정 근거<textarea value={form.description} onChange={event=>recalculate({description:event.target.value})} placeholder="목표 경계, 적용 기준, 제외 범위와 경영진 승인 근거를 적어 주세요." required/></label><div className="target-form-note"><Icon name="alert" size={16}/><span>{form.status==="승인"?"승인된 목표의 수치를 변경하면 변경 이력에 남습니다. 필요 시 내부 승인 절차를 다시 진행해 주세요.":"저장 후 목표 목록에서 승인해야 공식 이행목표로 집계됩니다."}</span></div>{linkedPlans>0&&<div className="target-form-note linked"><Icon name="list" size={16}/><span>이 목표에 {linkedPlans}개의 이행계획이 연결되어 있습니다. 목표 범위를 바꾸면 과제 범위도 함께 확인해 주세요.</span></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>목표 저장</button></div></div></form></Overlay>;
}

function PlanForm({plan,targets,selectedTargetId,organizations,onClose,onSave,onDelete}:{plan:ReductionPlan|null;targets:ReductionTarget[];selectedTargetId:string;organizations:Record<string,string[]>;onClose:()=>void;onSave:(plan:ReductionPlan)=>void;onDelete?:()=>void}){
  const target=targets.find(item=>item.id===(plan?.targetId??selectedTargetId))??targets[0];
  const defaultCompany=target.company==="그룹 전체"?companies[0]:target.company;
  const [form,setForm]=useState<ReductionPlan>(plan??{id:"NEW-PLAN",targetId:target.id,title:"",company:defaultCompany,site:organizations[defaultCompany]?.[0]??"",scope:target.scopes[0],category:"에너지 효율",department:"",owner:"",startDate:`${Math.max(new Date().getFullYear(),target.baselineYear+1)}-01-01`,endDate:`${target.targetYear}-12-31`,expectedReduction:0,actualReduction:0,budget:0,progress:0,status:"계획",verification:"",description:"",updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const selectedTarget=targets.find(item=>item.id===form.targetId)??target;
  const patch=(next:Partial<ReductionPlan>)=>{setForm(current=>({...current,...next}));setError("");};
  const changeTarget=(id:string)=>{const nextTarget=targets.find(item=>item.id===id);if(!nextTarget)return;const company=nextTarget.company==="그룹 전체"?companies[0]:nextTarget.company;setForm(current=>({...current,targetId:id,company,site:organizations[company]?.[0]??"",scope:nextTarget.scopes[0],endDate:`${nextTarget.targetYear}-12-31`}));};
  const submit=(event:FormEvent)=>{event.preventDefault();if(form.startDate>form.endDate){setError("과제 종료일은 시작일보다 빠를 수 없습니다.");return;}if(Number(form.startDate.slice(0,4))<=selectedTarget.baselineYear||Number(form.endDate.slice(0,4))>selectedTarget.targetYear){setError(`과제 일정은 기준연도 이후부터 목표연도 ${selectedTarget.targetYear}년 안에 설정해 주세요.`);return;}if(form.expectedReduction<=0){setError("예상 감축량을 0보다 크게 입력해 주세요.");return;}if(form.actualReduction<0){setError("실제 감축량은 0 이상이어야 합니다.");return;}onSave({...form,status:normalizePlanStatus(form)});};
  return <Overlay title={plan?"감축과제·실적 수정":"새 감축과제 등록"} eyebrow="REDUCTION ACTION" description="승인 목표의 필요 감축량을 실행 단위로 나누고 담당·예산·일정·검증자료를 지정합니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>연결 목표와 과제 범위</h3><div className="form-grid"><label className="full-span">연결 감축목표<select value={form.targetId} onChange={event=>changeTarget(event.target.value)}>{targets.filter(item=>item.status!=="종료"||item.id===form.targetId).map(item=><option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label><label className="full-span">과제명<input value={form.title} onChange={event=>patch({title:event.target.value})} placeholder="예: 경산공장 고효율 공조설비 교체" required/></label><label>법인<select value={form.company} disabled={selectedTarget.company!=="그룹 전체"} onChange={event=>{const company=event.target.value;patch({company,site:organizations[company]?.[0]??""})}}>{companies.filter(company=>selectedTarget.company==="그룹 전체"||company===selectedTarget.company).map(company=><option key={company}>{company}</option>)}</select></label><label>사업장<select value={form.site} onChange={event=>patch({site:event.target.value})}>{(organizations[form.company]??[]).map(site=><option key={site}>{site}</option>)}</select></label><label>Scope<select value={form.scope} onChange={event=>patch({scope:event.target.value as Scope})}>{selectedTarget.scopes.map(scope=><option key={scope}>{scope}</option>)}</select></label><label>감축 유형<select value={form.category} onChange={event=>patch({category:event.target.value})}><option>에너지 효율</option><option>재생에너지</option><option>연료 전환</option><option>공정 개선</option><option>비산배출</option><option>이동연소</option><option>공급망 협력</option><option>기타</option></select></label></div></div>
    <div className="form-section"><h3><span>2</span>일정·담당·예산</h3><div className="form-grid"><label>시작일<input type="date" value={form.startDate} onChange={event=>patch({startDate:event.target.value})} required/></label><label>종료일<input type="date" value={form.endDate} onChange={event=>patch({endDate:event.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={event=>patch({department:event.target.value})} required/></label><label>담당자<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>예상 감축량<div className="input-unit"><input type="number" min="0" step="0.1" value={form.expectedReduction||""} onChange={event=>patch({expectedReduction:Number(event.target.value)})} required/><span>tCO₂e</span></div></label><label>예산<div className="input-unit"><input type="number" min="0" step="10000" value={form.budget||""} onChange={event=>patch({budget:Number(event.target.value)})}/><span>원</span></div></label></div></div>
    <div className="form-section"><h3><span>3</span>이행 실적과 검증</h3><div className="form-grid"><label>진척도<div className="input-unit"><input type="number" min="0" max="100" value={form.progress} onChange={event=>patch({progress:Number(event.target.value)})}/><span>%</span></div></label><label>실제 확인 감축량<div className="input-unit"><input type="number" min="0" step="0.1" value={form.actualReduction||""} onChange={event=>patch({actualReduction:Number(event.target.value)})}/><span>tCO₂e</span></div></label><label className="full-span">검증자료·확인방법<input value={form.verification} onChange={event=>patch({verification:event.target.value})} placeholder="예: 설비별 전력계, 개선 전후 동월 사용량, 준공검사서" required/></label><label className="full-span textarea-label">실행내용·실적 메모<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder="주요 실행 단계, 실적 산정 기준, 지연 사유와 후속조치를 적어 주세요." required/></label></div><div className="plan-status-preview"><span>저장 시 상태</span><StatusBadge status={normalizePlanStatus(form)}/><p>진척도와 종료일을 기준으로 계획·진행중·지연·완료 상태가 자동 판정됩니다.</p></div>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>{plan?"실적 저장":"과제 등록"}</button></div></div></form></Overlay>;
}

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

function BulkImport({ records, periods, factors, organizations, onClose, onImport }: { records: ActivityRecord[]; periods: CollectionPeriod[]; factors: EmissionFactor[]; organizations: Record<string,string[]>; onClose: () => void; onImport: (rows: ActivityRecord[]) => void }) {
  const availablePeriods=periods.filter(period=>period.status==="수집중");
  const [periodId,setPeriodId]=useState(availablePeriods[0]?.id??"");
  const [preview,setPreview]=useState<ActivityRecord[]>([]);
  const [errors,setErrors]=useState<string[]>([]);
  const inputRef=useRef<HTMLInputElement>(null);
  const selectedPeriod=periods.find(period=>period.id===periodId);
  const headers=["법인","사업장","귀속월","Scope","활동자료 구분","배출원","사용량","담당자","담당 부서","증빙 파일명","입력 설명"];
  const downloadTemplate=async()=>{const XLSX=await import("xlsx");const factor=factors.find(item=>item.active&&selectedPeriod?.scopes.includes(item.scope));const company=selectedPeriod?.companies[0]??"세원정공";const sample=[company,organizations[company]?.[0]??"대구공장",selectedPeriod?.dataFrom??"2026-07",factor?.scope??"Scope 2",factor?.category??"구매 전력",factor?.source??"전력",1000,"홍길동","시설팀","전기요금고지서.pdf","원천자료 기준을 적어 주세요."];const sheet=XLSX.utils.aoa_to_sheet([headers,sample]);sheet["!cols"]=headers.map((header,index)=>({wch:index===10?32:Math.max(12,header.length+4)}));const guide=XLSX.utils.aoa_to_sheet([["SEMS 활동자료 일괄등록 안내"],["1. 열 제목은 수정하지 마세요."],["2. Scope·활동자료 구분·배출원은 시스템 설정의 배출계수 명칭과 정확히 일치해야 합니다."],["3. 같은 수집기간·사업장·귀속월·활동자료는 중복 등록되지 않습니다."],["4. 배출계수와 배출량은 등록 시 시스템에서 자동 적용됩니다."],["5. 증빙 파일명은 실제 원본과 동일하게 적어 주세요."]]);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"활동자료 입력");XLSX.utils.book_append_sheet(book,guide,"작성 안내");XLSX.writeFile(book,"SEMS_activity_import_template.xlsx");};
  const readFile=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setErrors([]);setPreview([]);try{const XLSX=await import("xlsx");const data=await file.arrayBuffer();const book=XLSX.read(data,{type:"array"});const sheet=book.Sheets[book.SheetNames[0]];const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""});const next:ActivityRecord[]=[];const issues:string[]=[];const seen=new Set<string>();rows.forEach((row,index)=>{const line=index+2;const company=String(row["법인"]??"").trim();const site=String(row["사업장"]??"").trim();const period=String(row["귀속월"]??"").trim();const scope=String(row["Scope"]??"").trim() as Scope;const category=String(row["활동자료 구분"]??"").trim();const source=String(row["배출원"]??"").trim();const usage=Number(row["사용량"]);const factor=factors.find(item=>item.active&&item.scope===scope&&item.category===category&&item.source===source);if(!selectedPeriod){issues.push(`${line}행: 수집기간을 선택해 주세요.`);return;}if(!selectedPeriod.companies.includes(company)||!organizations[company]?.includes(site)){issues.push(`${line}행: 대상 법인 또는 사업장이 올바르지 않습니다.`);return;}if(!selectedPeriod.scopes.includes(scope)){issues.push(`${line}행: 이 수집기간의 대상 Scope가 아닙니다.`);return;}if(!monthsBetween(selectedPeriod.dataFrom,selectedPeriod.dataTo).includes(period)){issues.push(`${line}행: 귀속월이 수집 대상 기간 밖입니다.`);return;}if(!factor){issues.push(`${line}행: 사용 중인 배출계수와 일치하는 활동자료를 찾지 못했습니다.`);return;}if(!Number.isFinite(usage)||usage<=0){issues.push(`${line}행: 사용량은 0보다 큰 숫자여야 합니다.`);return;}const key=[periodId,company,site,period,scope,category,source].join("|");if(seen.has(key)||records.some(item=>[item.collectionId,item.company,item.site,item.period,item.scope,item.category,item.source].join("|")===key)){issues.push(`${line}행: 이미 등록된 중복 자료입니다.`);return;}seen.add(key);next.push({id:Math.max(0,...records.map(item=>item.id))+next.length+1,collectionId:periodId,company,site,period,scope,category,source,usage,unit:factor.activityUnit,factor:factor.value,emissions:Math.round(usage*factor.value/1000*100)/100,owner:String(row["담당자"]??"").trim()||"미지정",department:String(row["담당 부서"]??"").trim()||"미지정",status:"작성중",evidence:String(row["증빙 파일명"]??"").trim(),description:String(row["입력 설명"]??"").trim(),active:true,createdAt:nowLabel(),updatedAt:"방금 전"});});setPreview(next);setErrors(issues);}catch{setErrors(["파일을 읽을 수 없습니다. 제공된 양식을 사용해 다시 시도해 주세요."]);}finally{event.target.value="";}};
  return <Overlay title="Excel 일괄등록" eyebrow="BULK IMPORT" description="양식 검증을 통과한 행만 작성 중 상태로 등록합니다." onClose={onClose}><div className="form-section"><div className="form-grid"><label>수집기간<select value={periodId} onChange={e=>{setPeriodId(e.target.value);setPreview([]);setErrors([])}}>{availablePeriods.map(period=><option key={period.id} value={period.id}>{period.name}</option>)}</select></label><div className="bulk-buttons"><button className="secondary-button" onClick={downloadTemplate} disabled={!selectedPeriod}><Icon name="download" size={16}/>양식 다운로드</button><button className="primary-button" onClick={()=>inputRef.current?.click()} disabled={!selectedPeriod}><Icon name="upload" size={16}/>파일 선택</button><input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={readFile} hidden/></div></div><div className="factor-notice bulk-notice"><Icon name="lock" size={18}/><p><strong>배출계수는 Excel에서 입력하지 않습니다.</strong><br/>Scope·활동자료·배출원을 기준으로 시스템의 사용 중 계수를 자동 적용합니다.</p></div></div>
    <div className="bulk-result">{preview.length>0&&<div className="bulk-success"><Icon name="check" size={18}/><strong>{preview.length}건 등록 가능</strong><span>중복·기간·배출계수 검증을 통과했습니다.</span></div>}{errors.length>0&&<div className="bulk-errors"><strong><Icon name="alert" size={16}/>{errors.length}건 확인 필요</strong><ul>{errors.slice(0,12).map(error=><li key={error}>{error}</li>)}</ul>{errors.length>12&&<p>외 {errors.length-12}건</p>}</div>}{preview.length>0&&<div className="table-scroll"><table className="data-table compact-table"><thead><tr><th>법인</th><th>귀속월</th><th>Scope</th><th>배출원</th><th>사용량</th><th>배출량</th></tr></thead><tbody>{preview.slice(0,8).map(item=><tr key={item.id}><td>{item.company}</td><td>{item.period}</td><td>{item.scope}</td><td>{item.source}</td><td>{formatNumber(item.usage,1)} {item.unit}</td><td>{formatNumber(item.emissions,2)} t</td></tr>)}</tbody></table></div>}</div>
    <div className="modal-footer"><button className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={!preview.length} onClick={()=>onImport(preview)}><Icon name="check" size={16}/>{preview.length}건 등록</button></div></Overlay>;
}

function Settings({factors,onFactorsChange,criteria,onCriteriaChange,noticePrefs,onNoticePrefsChange,organizations,onOrganizationsChange,onExport,onRestore,showToast}:{factors:EmissionFactor[];onFactorsChange:(x:EmissionFactor[])=>void;criteria:CollectionCriteria;onCriteriaChange:(x:CollectionCriteria)=>void;noticePrefs:NotificationPrefs;onNoticePrefsChange:(x:NotificationPrefs)=>void;organizations:Record<string,string[]>;onOrganizationsChange:(x:Record<string,string[]>)=>void;onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){
  const [tab,setTab]=useState<SettingTab>("factors"); const [factorModal,setFactorModal]=useState<EmissionFactor|null|"new">(null);
  const saveFactor=(factor:EmissionFactor)=>{const normalized=factor.id==="NEW-FACTOR"?{...factor,id:`F-${String(factors.length+1).padStart(3,"0")}`}:factor;const exists=factors.some(f=>f.id===normalized.id);onFactorsChange(exists?factors.map(f=>f.id===normalized.id?normalized:f):[...factors,normalized]);setFactorModal(null);showToast(exists?"배출계수를 수정했습니다.":"새 배출계수를 추가했습니다.");};
  const removeFactor=(id:string)=>{if(!window.confirm("이 배출계수를 삭제하시겠습니까? 기존 활동자료의 산정값은 유지됩니다."))return;onFactorsChange(factors.filter(f=>f.id!==id));setFactorModal(null);showToast("배출계수를 삭제했습니다.");};
  return <><PageHeader eyebrow="SYSTEM SETTINGS" title="시스템 설정" description="조직, 산정 기준, 알림, 권한과 운영 데이터 백업을 관리합니다."/><div className="settings-layout"><aside className="settings-nav"><button className={tab==="organization"?"active":""} onClick={()=>setTab("organization")}><Icon name="building" size={18}/>조직·사업장</button><button className={tab==="factors"?"active":""} onClick={()=>setTab("factors")}><Icon name="leaf" size={18}/>배출계수</button><button className={tab==="criteria"?"active":""} onClick={()=>setTab("criteria")}><Icon name="list" size={18}/>수집 기준</button><button className={tab==="notifications"?"active":""} onClick={()=>setTab("notifications")}><Icon name="bell" size={18}/>알림 설정</button><button className={tab==="permissions"?"active":""} onClick={()=>setTab("permissions")}><Icon name="settings" size={18}/>권한 관리</button><button className={tab==="data"?"active":""} onClick={()=>setTab("data")}><Icon name="database" size={18}/>데이터 백업</button></aside><section className="card settings-content">
    {tab==="factors"&&<><CardHeader title="배출계수 관리" subtitle="활동자료 등록 시 자동 적용되는 기준 계수입니다." action={<button className="outline-small" onClick={()=>setFactorModal("new")}><Icon name="plus" size={15}/>계수 추가</button>}/><div className="factor-notice"><Icon name="lock" size={18}/><p><strong>활동자료 등록 화면에서는 배출계수를 수정할 수 없습니다.</strong><br/>계수 변경은 이 메뉴에서만 가능하며, 기존 활동자료에는 저장 당시의 계수가 유지됩니다.</p></div><div className="table-scroll"><table className="data-table factor-table"><thead><tr><th>Scope</th><th>활동자료</th><th>배출원</th><th>배출계수</th><th>단위</th><th>적용 연도</th><th>출처</th><th>상태</th><th>작업</th></tr></thead><tbody>{factors.map(row=><tr key={row.id}><td><span className={`scope-tag s${row.scope.slice(-1)}`}>{row.scope}</span></td><td>{row.category}</td><td><strong>{row.source}</strong></td><td className="mono"><strong>{formatNumber(row.value,row.value<10?5:1)}</strong></td><td>{row.factorUnit}</td><td>{row.year}</td><td>{row.authority}</td><td><span className={row.active?"active-label":"inactive-label"}>{row.active?"사용 중":"중지"}</span></td><td><button className="outline-small" onClick={()=>setFactorModal(row)}><Icon name="edit" size={14}/>수정</button></td></tr>)}</tbody></table></div></>}
    {tab==="organization"&&<OrganizationSettings organizations={organizations} onChange={onOrganizationsChange} showToast={showToast}/>} {tab==="criteria"&&<><CardHeader title="데이터 수집 기준" subtitle="입력 검증과 확정 데이터 처리 기준을 설정합니다."/><div className="settings-form"><label>기본 귀속연도<select value={criteria.defaultYear} onChange={e=>onCriteriaChange({...criteria,defaultYear:e.target.value})}><option>2026</option><option>2027</option><option>2028</option></select></label><label>전월 대비 이상치 경고 기준<div className="input-unit"><input type="number" min="1" value={criteria.variance} onChange={e=>onCriteriaChange({...criteria,variance:Number(e.target.value)})}/><span>%</span></div></label><Toggle label="제출 시 증빙 연결 필수" checked={criteria.evidenceRequired} onChange={v=>onCriteriaChange({...criteria,evidenceRequired:v})}/><Toggle label="확정 자료 수정 잠금" checked={criteria.lockConfirmed} onChange={v=>onCriteriaChange({...criteria,lockConfirmed:v})}/></div><SettingsFooter onSave={()=>showToast("수집 기준을 저장했습니다.")}/></>}
    {tab==="notifications"&&<><CardHeader title="알림 설정" subtitle="업무 상황별 알림 수신 여부를 설정합니다."/><div className="toggle-list"><Toggle label="수집 마감 3일 전 알림" description="미제출 담당자와 기획팀에 안내" checked={noticePrefs.deadline} onChange={v=>onNoticePrefsChange({...noticePrefs,deadline:v})}/><Toggle label="검토 대기 등록 알림" description="담당 부서가 제출하면 기획팀에 안내" checked={noticePrefs.review} onChange={v=>onNoticePrefsChange({...noticePrefs,review:v})}/><Toggle label="반려 및 보완 요청 알림" description="반려 사유와 재제출 기한 안내" checked={noticePrefs.rejected} onChange={v=>onNoticePrefsChange({...noticePrefs,rejected:v})}/><Toggle label="주간 수집 현황 요약" description="매주 월요일 관리자에게 요약" checked={noticePrefs.weekly} onChange={v=>onNoticePrefsChange({...noticePrefs,weekly:v})}/><div className="server-note"><Icon name="alert" size={17}/>설정은 저장됩니다. 실제 메일·사내 알림 발송은 사내 알림 서버 연결 후 적용됩니다.</div></div><SettingsFooter onSave={()=>showToast("알림 설정을 저장했습니다.")}/></>}
    {tab==="permissions"&&<PermissionSettings showToast={showToast}/>}
    {tab==="data"&&<DataSettings onExport={onExport} onRestore={onRestore} showToast={showToast}/>}</section></div>{factorModal&&<FactorForm factor={factorModal==="new"?null:factorModal} onClose={()=>setFactorModal(null)} onSave={saveFactor} onDelete={factorModal==="new"?undefined:()=>removeFactor(factorModal.id)}/>}</>;
}
function OrganizationSettings({organizations,onChange,showToast}:{organizations:Record<string,string[]>;onChange:(x:Record<string,string[]>)=>void;showToast:(m:string)=>void}){const [selected,setSelected]=useState("세원정공");const [adding,setAdding]=useState(false);const [newSite,setNewSite]=useState("");const addSite=()=>{const name=newSite.trim();if(!name)return;if(organizations[selected].includes(name)){showToast("이미 등록된 사업장입니다.");return;}onChange({...organizations,[selected]:[...organizations[selected],name]});setNewSite("");setAdding(false);showToast(`${selected}에 ${name}을(를) 추가했습니다.`);};const removeSite=(site:string)=>{if(organizations[selected].length<=1){showToast("법인별 사업장은 최소 한 개가 필요합니다.");return;}if(!window.confirm(`${site}을(를) 사업장 목록에서 삭제하시겠습니까?`))return;onChange({...organizations,[selected]:organizations[selected].filter(item=>item!==site)});showToast(`${site}을(를) 삭제했습니다.`);};return <><CardHeader title="조직·사업장" subtitle="여기서 추가한 사업장은 활동자료 입력과 Excel 검증에 바로 반영됩니다."/><div className="organization-grid"><div className="org-list">{companies.map(c=><button key={c} className={selected===c?"active":""} onClick={()=>{setSelected(c);setAdding(false)}}><span className="company-initial">{c.slice(-1)}</span><div><strong>{c}</strong><small>{organizations[c].length}개 사업장</small></div><Icon name="chevron" size={16}/></button>)}</div><div className="site-panel"><div><strong>{selected} 사업장</strong><button className="outline-small" onClick={()=>setAdding(!adding)}><Icon name={adding?"close":"plus"} size={14}/>{adding?"취소":"사업장 추가"}</button></div>{adding&&<div className="inline-add"><input placeholder="새 사업장명" value={newSite} onChange={e=>setNewSite(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSite()}/><button className="primary-button" onClick={addSite}>추가</button></div>}{organizations[selected].map(site=><div className="site-row" key={site}><span><Icon name="building" size={17}/></span><div><strong>{site}</strong><small>사용 중 · 국내 사업장</small></div><button className="icon-row-button danger" onClick={()=>removeSite(site)} aria-label={`${site} 삭제`}><Icon name="trash" size={14}/></button></div>)}</div></div><SettingsFooter onSave={()=>showToast("조직·사업장 설정을 저장했습니다.")}/></>}
function PermissionSettings({showToast}:{showToast:(m:string)=>void}){const [roles,setRoles]=useState([{name:"관리자",desc:"모든 법인 조회·검토·기준정보 관리",members:3,write:true,approve:true},{name:"법인 담당자",desc:"소속 법인 자료 입력·수정·제출",members:12,write:true,approve:false},{name:"조회자",desc:"확정 자료와 대시보드 조회",members:6,write:false,approve:false}]);return <><CardHeader title="권한 관리" subtitle="역할별 화면 접근과 작업 권한을 설계합니다."/><div className="permission-table">{roles.map((r,index)=><div key={r.name}><div><strong>{r.name}</strong><p>{r.desc}</p></div><span>{r.members}명</span><label><input type="checkbox" checked={r.write} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,write:e.target.checked}:x))}/>입력</label><label><input type="checkbox" checked={r.approve} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,approve:e.target.checked}:x))}/>확정</label></div>)}</div><div className="server-note"><Icon name="lock" size={17}/>현재는 권한 설계 화면입니다. 실제 사용자별 접근 제한은 사내 로그인·권한 서버 연결 후 적용됩니다.</div><SettingsFooter onSave={()=>showToast("권한 설계안을 저장했습니다.")}/></>}
function DataSettings({onExport,onRestore,showToast}:{onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){const inputRef=useRef<HTMLInputElement>(null);const restore=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()) as Record<string,unknown>;if(window.confirm("현재 브라우저의 운영 데이터를 백업 파일 내용으로 교체하시겠습니까?"))onRestore(parsed);}catch{showToast("백업 파일을 읽을 수 없습니다.");}finally{event.target.value="";}};return <><CardHeader title="운영 데이터 백업" subtitle="기간·활동자료·목표·이행계획·배출계수·증빙·지표·설정을 한 파일로 보관합니다."/><div className="backup-grid"><article><span className="backup-icon"><Icon name="download"/></span><div><strong>전체 데이터 내보내기</strong><p>정기 백업과 다른 PC로의 이관에 사용할 JSON 파일을 생성합니다.</p><button className="primary-button" onClick={onExport}><Icon name="download" size={16}/>백업 파일 저장</button></div></article><article><span className="backup-icon restore"><Icon name="upload"/></span><div><strong>백업 데이터 복원</strong><p>SEMS에서 내보낸 백업 파일로 현재 운영 데이터를 교체합니다.</p><button className="secondary-button" onClick={()=>inputRef.current?.click()}><Icon name="upload" size={16}/>백업 파일 선택</button><input ref={inputRef} type="file" accept=".json" hidden onChange={restore}/></div></article></div><div className="server-note"><Icon name="alert" size={17}/>현재 버전은 브라우저 단위로 저장됩니다. 다중 사용자 공동 운영은 사내 데이터베이스 연결 후 같은 화면 구조를 그대로 사용합니다.</div></>}
function Toggle({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><div><strong>{label}</strong>{description&&<p>{description}</p>}</div><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span/></label>}
function SettingsFooter({onSave}:{onSave:()=>void}){return <div className="settings-footer"><span>변경 내용은 현재 브라우저에 저장됩니다.</span><button className="primary-button" onClick={onSave}>변경사항 저장</button></div>}
function FactorForm({factor,onClose,onSave,onDelete}:{factor:EmissionFactor|null;onClose:()=>void;onSave:(f:EmissionFactor)=>void;onDelete?:()=>void}){const [form,setForm]=useState<EmissionFactor>(factor??{id:"NEW-FACTOR",scope:"Scope 1",category:"",source:"",value:0,activityUnit:"L",factorUnit:"kgCO₂e/L",year:"2026",authority:"",active:true});const patch=(p:Partial<EmissionFactor>)=>setForm(c=>({...c,...p}));return <Overlay title={factor?"배출계수 수정":"배출계수 추가"} eyebrow="EMISSION FACTOR" description="여기서 저장한 계수만 활동자료 입력 화면에 자동 표시됩니다." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(form)}}><div className="form-section"><div className="form-grid"><label>Scope<select value={form.scope} onChange={e=>patch({scope:e.target.value as Scope})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label><label>활동자료 구분<input value={form.category} onChange={e=>patch({category:e.target.value})} required/></label><label>배출원<input value={form.source} onChange={e=>patch({source:e.target.value})} required/></label><label>활동자료 단위<input value={form.activityUnit} onChange={e=>patch({activityUnit:e.target.value,factorUnit:`kgCO₂e/${e.target.value}`})} required/></label><label>배출계수<input type="number" min="0" step="any" value={form.value||""} onChange={e=>patch({value:Number(e.target.value)})} required/></label><label>계수 단위<input value={form.factorUnit} onChange={e=>patch({factorUnit:e.target.value})} required/></label><label>적용 연도<input value={form.year} onChange={e=>patch({year:e.target.value})} required/></label><label>출처<input value={form.authority} onChange={e=>patch({authority:e.target.value})} required/></label><Toggle label="활동자료 입력 시 사용" checked={form.active} onChange={v=>patch({active:v})}/></div></div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>계수 저장</button></div></div></form></Overlay>}

function RecordModal({record,records,periods,factors,criteria,organizations,onClose,onSave}:{record:ActivityRecord|null;records:ActivityRecord[];periods:CollectionPeriod[];factors:EmissionFactor[];criteria:CollectionCriteria;organizations:Record<string,string[]>;onClose:()=>void;onSave:(r:ActivityRecord)=>void}){
  const editablePeriods=periods.filter(period=>period.status==="수집중"||period.id===record?.collectionId);
  const defaultPeriod=editablePeriods.find(period=>period.status==="수집중")??editablePeriods[0];
  const defaultScope=defaultPeriod?.scopes.includes("Scope 2")?"Scope 2":defaultPeriod?.scopes[0]??"Scope 1";
  const fallback=factors.find(f=>f.scope===defaultScope&&f.active)??factors.find(f=>f.active)??initialFactors[0];
  const defaultCompany=defaultPeriod?.companies[0]??"세원정공";
  const [form,setForm]=useState<ActivityRecord>(record??{id:0,collectionId:defaultPeriod?.id,company:defaultCompany,site:organizations[defaultCompany][0],period:defaultPeriod?.dataFrom??"2026-07",scope:fallback.scope,category:fallback.category,source:fallback.source,usage:0,unit:fallback.activityUnit,factor:fallback.value,emissions:0,owner:"문경섭",department:"기획팀",status:"작성중",evidence:"",description:"",active:true,updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const selectedPeriod=periods.find(period=>period.id===form.collectionId);
  const availableScopes=selectedPeriod?.scopes??(["Scope 1","Scope 2","Scope 3"] as Scope[]);
  const available=factors.filter(f=>f.active&&f.scope===form.scope); const categories=[...new Set(available.map(f=>f.category))]; const sources=available.filter(f=>f.category===form.category); const selected=factors.find(f=>f.scope===form.scope&&f.category===form.category&&f.source===form.source)??null; const patch=(p:Partial<ActivityRecord>)=>setForm(c=>({...c,...p}));
  const applyFactor=(f:EmissionFactor)=>patch({category:f.category,source:f.source,unit:f.activityUnit,factor:f.value});
  const changeScope=(scope:Scope)=>{const first=factors.find(f=>f.active&&f.scope===scope); if(first)setForm(c=>({...c,scope,category:first.category,source:first.source,unit:first.activityUnit,factor:first.value}));};
  const changePeriod=(id:string)=>{const period=periods.find(item=>item.id===id);if(!period)return;const scope=period.scopes.includes(form.scope)?form.scope:period.scopes[0];const first=factors.find(f=>f.active&&f.scope===scope);const company=period.companies.includes(form.company)?form.company:period.companies[0];setForm(current=>({...current,collectionId:id,company,site:organizations[company][0],period:period.dataFrom,scope,category:first?.category??current.category,source:first?.source??current.source,unit:first?.activityUnit??current.unit,factor:first?.value??current.factor}));};
  const duplicate=records.some(item=>item.id!==form.id&&item.collectionId===form.collectionId&&item.company===form.company&&item.site===form.site&&item.period===form.period&&item.scope===form.scope&&item.category===form.category&&item.source===form.source);
  const previous=records.find(item=>item.company===form.company&&item.site===form.site&&item.scope===form.scope&&item.category===form.category&&item.source===form.source&&item.period===previousMonth(form.period));
  const previousYear=records.find(item=>item.company===form.company&&item.site===form.site&&item.scope===form.scope&&item.category===form.category&&item.source===form.source&&item.period===previousMonth(form.period,1));
  const variance=previous?.usage?(form.usage-previous.usage)/previous.usage*100:null;
  const submit=(e:FormEvent)=>{e.preventDefault();if(!selectedPeriod||selectedPeriod.status!=="수집중"){setError("현재 수집중인 기간을 선택해 주세요.");return;}if(!monthsBetween(selectedPeriod.dataFrom,selectedPeriod.dataTo).includes(form.period)){setError("귀속월이 선택한 수집기간의 대상 범위 밖입니다.");return;}if(!form.usage){setError("사용량을 입력해 주세요.");return;}if(duplicate){setError("같은 사업장·귀속월·활동자료가 이미 등록되어 있습니다.");return;}onSave({...form,status:form.status==="반려"?"작성중":form.status,emissions:Math.round(form.usage*form.factor/1000*100)/100,updatedAt:"방금 전"});};
  if(!editablePeriods.length)return <Overlay title="활동자료 입력 불가" eyebrow="ACTIVITY DATA" description="현재 수집중인 기간이 없습니다." onClose={onClose}><div className="empty-state"><Icon name="calendar"/><strong>수집기간을 먼저 개설해 주세요.</strong><p>수집 기간 메뉴에서 대상과 마감일을 설정한 뒤 수집을 시작할 수 있습니다.</p></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>;
  return <Overlay title={record?"활동자료 수정":"신규 활동자료 입력"} eyebrow="ACTIVITY DATA" description="수집기간과 Scope에 맞는 활동자료·배출계수가 자동 연결됩니다." onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>수집기간 및 기본 정보</h3><div className="form-grid"><label className="full-span">수집기간<select value={form.collectionId} onChange={e=>changePeriod(e.target.value)}>{editablePeriods.map(period=><option value={period.id} key={period.id}>{period.name} · {period.status}</option>)}</select></label><label>법인<select value={form.company} onChange={e=>{const company=e.target.value;patch({company,site:organizations[company][0]})}}>{(selectedPeriod?.companies??companies).map(c=><option key={c}>{c}</option>)}</select></label><label>사업장<select value={form.site} onChange={e=>patch({site:e.target.value})}>{organizations[form.company].map(s=><option key={s}>{s}</option>)}</select></label><label>귀속월<select value={form.period} onChange={e=>patch({period:e.target.value})}>{selectedPeriod&&monthsBetween(selectedPeriod.dataFrom,selectedPeriod.dataTo).map(month=><option key={month}>{month}</option>)}</select></label><label>Scope<select value={form.scope} onChange={e=>changeScope(e.target.value as Scope)}>{availableScopes.map(scope=><option key={scope}>{scope}</option>)}</select></label></div></div>
    <div className="scope-context"><span className={`scope-tag s${form.scope.slice(-1)}`}>{form.scope}</span><strong>{form.scope==="Scope 1"?"직접 배출 활동자료":form.scope==="Scope 2"?"구매 에너지 활동자료":"기타 간접 배출 활동자료"}</strong><p>현재 Scope에 해당하는 활동자료만 표시되며 배출계수는 수정할 수 없습니다.</p></div>
    <div className="form-section"><h3><span>2</span>활동자료 및 산정</h3>{available.length?<><div className="form-grid"><label>활동자료 구분<select value={form.category} onChange={e=>{const first=available.find(f=>f.category===e.target.value);if(first)applyFactor(first)}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>배출원<select value={form.source} onChange={e=>{const found=sources.find(f=>f.source===e.target.value);if(found)applyFactor(found)}}>{sources.map(f=><option key={f.id} value={f.source}>{f.source}</option>)}</select></label><label>사용량<div className="input-unit"><input type="number" min="0" step="any" value={form.usage||""} onChange={e=>patch({usage:Number(e.target.value)})} required/><span>{form.unit}</span></div></label><label>단위<input value={form.unit} readOnly className="readonly-input"/></label><label>배출계수<div className="locked-input"><input value={form.factor} readOnly tabIndex={-1}/><Icon name="lock" size={15}/></div><small className="field-help">{selected?.year} · {selected?.authority} 기준 / 시스템 설정에서만 변경 가능</small></label><div className="calculated-field"><span>예상 배출량</span><strong>{formatNumber(form.usage*form.factor/1000,2)} <small>tCO₂e</small></strong><em>사용량 × 배출계수 ÷ 1,000</em></div></div><div className="comparison-grid form-comparison"><ComparisonCard label="전월" record={previous} current={{...form,emissions:0}} threshold={criteria.variance}/><ComparisonCard label="전년 동월" record={previousYear} current={{...form,emissions:0}} threshold={criteria.variance}/></div>{variance!==null&&Math.abs(variance)>=criteria.variance&&<p className="form-warning"><Icon name="alert" size={15}/>전월 대비 {formatNumber(Math.abs(variance),1)}% {variance>0?"증가":"감소"}했습니다. 입력 설명에 변동 사유를 남겨 주세요.</p>}{duplicate&&<p className="form-error"><Icon name="alert" size={14}/>같은 조건의 활동자료가 이미 등록되어 있습니다.</p>}</>:<div className="empty-state"><Icon name="alert"/><strong>이 Scope에 사용 가능한 배출계수가 없습니다.</strong><p>시스템 설정 &gt; 배출계수에서 계수를 먼저 등록해 주세요.</p></div>}</div>
    <div className="form-section"><h3><span>3</span>증빙 및 담당자</h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setError("증빙파일은 20MB 이하만 선택할 수 있습니다.");e.target.value="";return;}setError("");patch({evidence:file.name})}}/><span className="upload-icon"><Icon name="upload"/></span>{form.evidence?<><strong>{form.evidence}</strong><small>원본 파일명과 연결정보가 저장됩니다.</small></>:<><strong>증빙자료를 클릭해 선택하세요.</strong><small>PDF, XLSX, JPG, PNG · 최대 20MB</small></>}</label><div className="form-grid two"><label>담당자<input value={form.owner} onChange={e=>patch({owner:e.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={e=>patch({department:e.target.value})} required/></label><label className="full-span textarea-label">입력 설명·산정 근거<textarea value={form.description??""} onChange={e=>patch({description:e.target.value})} placeholder="원천자료 기준, 전월 대비 변동 사유, 계산 시 가정 등을 적어 주세요."/></label></div>{form.rejectionReason&&<div className="rejection-note"><Icon name="alert" size={16}/><div><strong>이전 보완 요청</strong><p>{form.rejectionReason}</p></div></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div>
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!available.length||duplicate}><Icon name="check" size={17}/>{record?"수정사항 저장":"작성 중으로 저장"}</button></div></form></Overlay>;
}
