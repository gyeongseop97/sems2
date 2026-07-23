"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

type View = "dashboard" | "collection" | "inventory" | "evidence" | "indicators" | "settings";
type Scope = "Scope 1" | "Scope 2" | "Scope 3";
type RecordStatus = "작성중" | "검토대기" | "반려" | "확정";
type EvidenceStatus = "수집중" | "완료" | "보완 요청" | "미제출";
type SettingTab = "organization" | "factors" | "criteria" | "notifications" | "permissions";

type ActivityRecord = {
  id: number;
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
  updatedAt: string;
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
  { id: "collection", label: "데이터 수집", icon: "database" },
  { id: "inventory", label: "온실가스 인벤토리", icon: "leaf" },
  { id: "evidence", label: "증빙자료", icon: "file" },
  { id: "indicators", label: "ESG 지표 관리", icon: "list" },
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
  { id: 1, company: "세원정공", site: "대구공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 1248500, unit: "kWh", factor: 0.45941, emissions: 573.56, owner: "김민수", department: "시설팀", status: "확정", evidence: "2026_06_electricity.pdf", updatedAt: "07.18 14:20" },
  { id: 2, company: "세원정공", site: "대구공장", period: "2026-06", scope: "Scope 1", category: "고정연소", source: "LNG", usage: 84200, unit: "Nm³", factor: 2.176, emissions: 183.22, owner: "김민수", department: "시설팀", status: "검토대기", evidence: "lng_202606.xlsx", updatedAt: "07.19 10:12" },
  { id: 3, company: "세원테크", site: "경산공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 764800, unit: "kWh", factor: 0.45941, emissions: 351.36, owner: "이서연", department: "생산관리팀", status: "검토대기", evidence: "전기요금_6월.pdf", updatedAt: "07.20 09:41" },
  { id: 4, company: "세원E&I", site: "영천공장", period: "2026-06", scope: "Scope 1", category: "이동연소", source: "경유", usage: 4280, unit: "L", factor: 2.582, emissions: 11.05, owner: "박지훈", department: "총무팀", status: "작성중", evidence: "", updatedAt: "07.20 16:05" },
  { id: 5, company: "세원물산", site: "대구공장", period: "2026-06", scope: "Scope 3", category: "Cat.7 임직원 통근", source: "자가용·대중교통", usage: 384200, unit: "km", factor: 0.121, emissions: 46.49, owner: "최유진", department: "인사팀", status: "반려", evidence: "통근설문_집계.xlsx", updatedAt: "07.21 11:32" },
  { id: 6, company: "세원정공", site: "대구공장", period: "2026-05", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 1194200, unit: "kWh", factor: 0.45941, emissions: 548.57, owner: "김민수", department: "시설팀", status: "확정", evidence: "2026_05_electricity.pdf", updatedAt: "06.17 15:10" },
  { id: 7, company: "세원테크", site: "경산공장", period: "2026-06", scope: "Scope 1", category: "비산배출", source: "냉매 R-410A", usage: 18.5, unit: "kg", factor: 2088, emissions: 38.63, owner: "윤태호", department: "설비보전팀", status: "확정", evidence: "냉매충전_점검표.pdf", updatedAt: "07.18 08:52" },
  { id: 8, company: "세원E&I", site: "영천공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "전력", usage: 496300, unit: "kWh", factor: 0.45941, emissions: 228.01, owner: "정예린", department: "생산관리팀", status: "작성중", evidence: "", updatedAt: "07.22 13:11" },
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
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRecord | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedRecords = localStorage.getItem("sems2-records"); if (savedRecords) setRecords((JSON.parse(savedRecords) as ActivityRecord[]).map(r => ({ ...r, source: r.source === "한국전력" ? "전력" : r.source, category: r.category === "임직원 통근" ? "Cat.7 임직원 통근" : r.category })));
        const savedFactors = localStorage.getItem("sems2-factors"); if (savedFactors) setFactors(JSON.parse(savedFactors));
        const savedEvidence = localStorage.getItem("sems2-evidence"); if (savedEvidence) setEvidence(JSON.parse(savedEvidence));
        const savedIndicators = localStorage.getItem("sems2-indicators"); if (savedIndicators) setIndicators(JSON.parse(savedIndicators));
      } catch { /* retain the built-in demonstration set */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-records", JSON.stringify(records)); }, [records, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-factors", JSON.stringify(factors)); }, [factors, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-evidence", JSON.stringify(evidence)); }, [evidence, hydrated]);
  useEffect(() => { if (!hydrated) return; localStorage.setItem("sems2-indicators", JSON.stringify(indicators)); }, [indicators, hydrated]);
  useEffect(() => { document.body.classList.toggle("menu-open", mobileMenu || modalOpen || guideOpen); return () => document.body.classList.remove("menu-open"); }, [mobileMenu, modalOpen, guideOpen]);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const navigate = (view: View) => { setActiveView(view); setMobileMenu(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openForm = (record?: ActivityRecord) => { setEditing(record ?? null); setModalOpen(true); };
  const saveRecord = (record: ActivityRecord) => {
    const exists = record.id !== 0 && records.some(item => item.id === record.id);
    const saved = exists ? record : { ...record, id: Math.max(0, ...records.map(item => item.id)) + 1 };
    setRecords(exists ? records.map(item => item.id === saved.id ? saved : item) : [saved, ...records]);
    setModalOpen(false); setEditing(null); showToast(exists ? "입력 자료를 수정했습니다." : "새 활동자료를 저장했습니다.");
  };
  const resetDemo = () => { setRecords(initialRecords); setFactors(initialFactors); setEvidence(initialEvidenceItems); setIndicators(initialIndicators); localStorage.removeItem("sems2-records"); localStorage.removeItem("sems2-factors"); localStorage.removeItem("sems2-evidence"); localStorage.removeItem("sems2-indicators"); setProfileOpen(false); showToast("데모 데이터를 초기 상태로 복원했습니다."); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span>S</span></div><div><strong>SEMS</strong><small>Sewon ESG Management</small></div><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기"><Icon name="close" /></button></div>
      <nav className="main-nav" aria-label="주 메뉴"><span className="nav-group-label">OVERVIEW</span>{navItems.slice(0, 1).map(item => <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => navigate(item.id)} />)}<span className="nav-group-label">ESG MANAGEMENT</span>{navItems.slice(1).map(item => <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => navigate(item.id)} count={item.id === "collection" ? records.filter(r => r.status === "검토대기").length : undefined} />)}</nav>
      <div className="sidebar-bottom"><button className={`nav-button ${activeView === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Icon name="settings" /><span>시스템 설정</span></button><div className="help-card"><div className="help-icon">?</div><strong>도움이 필요하신가요?</strong><p>입력 기준과 실제 사용 순서를 확인하세요.</p><button onClick={() => { setGuideOpen(true); setMobileMenu(false); }}>사용 가이드 <Icon name="arrow" size={14} /></button></div></div>
    </aside>
    {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" />}
    <div className="workspace">
      <header className="topbar"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Icon name="menu" /></button><div className="breadcrumb"><span>SEMS</span><Icon name="chevron" size={14} /><strong>{navItems.find(n => n.id === activeView)?.label ?? "시스템 설정"}</strong></div><div className="topbar-actions"><div className="demo-label"><span /> 로컬 시연 모드</div><button className="icon-button notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label="알림"><Icon name="bell" />{!notificationsRead && <span className="notification-dot" />}</button><button className="profile profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><div className="avatar">문</div><div><strong>문경섭</strong><span>기획팀 · 관리자</span></div><Icon name="chevron" size={15} /></button></div>
        {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} onRead={() => { setNotificationsRead(true); setNotificationsOpen(false); showToast("모든 알림을 확인했습니다."); }} />}
        {profileOpen && <ProfilePanel onSettings={() => navigate("settings")} onReset={resetDemo} />}
      </header>
      <main className="content">
        {activeView === "dashboard" && <Dashboard records={records} onNavigate={navigate} onNew={() => openForm()} />}
        {activeView === "collection" && <Collection records={records} onNew={() => openForm()} onEdit={openForm} onChange={setRecords} showToast={showToast} />}
        {activeView === "inventory" && <Inventory records={records} showToast={showToast} />}
        {activeView === "evidence" && <Evidence items={evidence} onChange={setEvidence} showToast={showToast} />}
        {activeView === "indicators" && <Indicators items={indicators} onChange={setIndicators} showToast={showToast} />}
        {activeView === "settings" && <Settings factors={factors} onFactorsChange={setFactors} showToast={showToast} />}
      </main>
    </div>
    {modalOpen && <RecordModal record={editing} factors={factors} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveRecord} />}
    {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
  </div>;
}

function NavButton({ item, active, onClick, count }: { item: { id: View; label: string; icon: IconName }; active: boolean; onClick: () => void; count?: number }) { return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon name={item.icon} /><span>{item.label}</span>{count ? <em>{count}</em> : null}</button>; }

function NotificationPanel({ onClose, onRead }: { onClose: () => void; onRead: () => void }) { return <div className="notification-panel"><div className="panel-title"><strong>알림</strong><button onClick={onClose} aria-label="알림 닫기"><Icon name="close" size={16} /></button></div><div className="notification-item unread"><span className="notification-icon warning"><Icon name="clock" size={17} /></span><div><strong>검토 대기 자료 2건</strong><p>6월 온실가스 활동자료가 검토를 기다리고 있습니다.</p><small>12분 전</small></div></div><div className="notification-item"><span className="notification-icon success"><Icon name="check" size={17} /></span><div><strong>세원테크 자료 제출 완료</strong><p>6월 구매전력 자료가 제출되었습니다.</p><small>어제</small></div></div><button className="all-notifications" onClick={onRead}>모두 읽음 처리</button></div>; }
function ProfilePanel({ onSettings, onReset }: { onSettings: () => void; onReset: () => void }) { return <div className="profile-panel"><div><strong>문경섭</strong><span>기획팀 · 시스템 관리자</span></div><button onClick={onSettings}><Icon name="settings" size={16} />시스템 설정</button><button onClick={onReset}><Icon name="refresh" size={16} />데모 데이터 초기화</button><p>실제 계정 전환은 사내 로그인 서버 연결 후 제공됩니다.</p></div>; }

function GuideModal({ onClose }: { onClose: () => void }) { return <Overlay title="SEMS 사용 가이드" eyebrow="QUICK GUIDE" description="자료 등록부터 확정까지의 기본 흐름입니다." onClose={onClose}><div className="guide-steps"><div><span>01</span><strong>기준정보 확인</strong><p>시스템 설정에서 Scope별 활동자료와 배출계수를 먼저 확인합니다.</p></div><div><span>02</span><strong>활동자료 등록</strong><p>Scope를 선택하면 해당 범위의 활동자료만 표시되며 계수는 자동 적용됩니다.</p></div><div><span>03</span><strong>증빙 연결·제출</strong><p>고지서나 사용내역 파일을 선택한 뒤 검토대기 상태로 제출합니다.</p></div><div><span>04</span><strong>기획실 검토·확정</strong><p>자료와 증빙을 대조하고 확정하면 인벤토리와 대시보드에 반영됩니다.</p></div></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>; }

function Dashboard({ records, onNavigate, onNew }: { records: ActivityRecord[]; onNavigate: (view: View) => void; onNew: () => void }) {
  const years = [...new Set(records.map(r => r.period.slice(0, 4)))].sort().reverse(); const [year, setYear] = useState(years[0] ?? "2026");
  const data = records.filter(r => r.period.startsWith(year)); const total = data.reduce((s, r) => s + r.emissions, 0); const confirmed = data.filter(r => r.status === "확정").length; const pending = data.filter(r => r.status === "검토대기");
  const scopeTotals = (["Scope 1", "Scope 2", "Scope 3"] as Scope[]).map(scope => data.filter(r => r.scope === scope).reduce((s, r) => s + r.emissions, 0));
  const completion = data.length ? Math.round((confirmed / data.length) * 100) : 0; const evidenceRate = data.length ? Math.round(data.filter(r => r.evidence).length / data.length * 1000) / 10 : 0;
  const monthly = Array.from({ length: 6 }, (_, i) => { const month = String(i + 1).padStart(2, "0"); const monthRows = data.filter(r => r.period === `${year}-${month}`); return { month: `${i + 1}월`, s1: monthRows.filter(r => r.scope === "Scope 1").reduce((s,r)=>s+r.emissions,0), s2: monthRows.filter(r => r.scope === "Scope 2").reduce((s,r)=>s+r.emissions,0), s3: monthRows.filter(r => r.scope === "Scope 3").reduce((s,r)=>s+r.emissions,0) }; });
  const chartMax = Math.max(1, ...monthly.map(m => m.s1 + m.s2 + m.s3)); const percents = scopeTotals.map(v => total ? Math.round(v / total * 100) : 0);
  return <><PageHeader eyebrow={`${year} ESG PERFORMANCE`} title="ESG 통합 대시보드" description="세원그룹의 ESG 데이터 수집 현황과 주요 성과를 한눈에 확인합니다."><label className="year-select"><Icon name="calendar" size={17} /><select value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />자료 입력</button></PageHeader>
    <section className="notice-banner"><div className="notice-icon"><Icon name="alert" /></div><div><strong>7월 데이터 수집 마감까지 2일 남았습니다.</strong><p>검토 대기 {pending.length}건이 있습니다. 담당 부서의 제출 현황을 확인해 주세요.</p></div><button onClick={() => onNavigate("collection")}>수집 현황 보기 <Icon name="arrow" size={16} /></button></section>
    <section className="kpi-grid"><KpiCard label="온실가스 배출량" value={formatNumber(total, 1)} unit="tCO₂e" trend="등록된 활동자료 기준" trendType="good" icon="leaf" tone="green"/><KpiCard label="데이터 확정률" value={String(completion)} unit="%" trend={`${confirmed}/${data.length}개 항목 확정`} trendType="neutral" icon="database" tone="blue" progress={completion}/><KpiCard label="검토 대기" value={String(pending.length)} unit="건" trend="기획실 검토가 필요합니다." trendType={pending.length ? "warn" : "good"} icon="clock" tone="amber"/><KpiCard label="증빙 연결률" value={String(evidenceRate)} unit="%" trend={`미연결 증빙 ${data.filter(r => !r.evidence).length}건`} trendType={evidenceRate < 100 ? "warn" : "good"} icon="file" tone="violet" progress={evidenceRate}/></section>
    <section className="dashboard-grid"><article className="card emissions-chart-card"><CardHeader title="월별 온실가스 배출 추이" subtitle="Scope 1·2·3 합산 배출량" action="단위: tCO₂e"/><div className="chart-legend"><span><i className="scope1"/>Scope 1</span><span><i className="scope2"/>Scope 2</span><span><i className="scope3"/>Scope 3</span></div><div className="bar-chart"><div className="axis-labels"><span>{formatNumber(chartMax,0)}</span><span>{formatNumber(chartMax*.75,0)}</span><span>{formatNumber(chartMax*.5,0)}</span><span>{formatNumber(chartMax*.25,0)}</span><span>0</span></div><div className="grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{monthly.map(item => { const sum=item.s1+item.s2+item.s3; return <div className="bar-group" key={item.month}><div className="bar-stack chart-scaled" style={{height:`${Math.max(sum/chartMax*170,4)}px`}}><span className="scope3" style={{height:`${sum ? item.s3/sum*100 : 0}%`}}/><span className="scope2" style={{height:`${sum ? item.s2/sum*100 : 0}%`}}/><span className="scope1" style={{height:`${sum ? item.s1/sum*100 : 0}%`}}/>{sum>0&&<b>{formatNumber(sum,0)}</b>}</div><small>{item.month}</small></div>; })}</div></div></article>
      <article className="card scope-card"><CardHeader title="Scope별 배출 구성" subtitle={`${year}년 누적 기준`}/><div className="donut-wrap"><div className="donut" style={{background:`conic-gradient(#156b55 0 ${percents[0]}%, #42a585 ${percents[0]}% ${percents[0]+percents[1]}%, #a6d7c7 ${percents[0]+percents[1]}% 100%)`}}><div><strong>{formatNumber(total,1)}</strong><span>tCO₂e</span></div></div></div><div className="scope-breakdown"><ScopeRow label="Scope 1" value={scopeTotals[0]} color="dark" percent={percents[0]}/><ScopeRow label="Scope 2" value={scopeTotals[1]} color="mid" percent={percents[1]}/><ScopeRow label="Scope 3" value={scopeTotals[2]} color="light" percent={percents[2]}/></div></article>
      <article className="card collection-card"><CardHeader title="법인별 확정 현황" subtitle={`${year}년 등록 자료 기준`} action={<button onClick={()=>onNavigate("collection")}>전체보기 <Icon name="arrow" size={14}/></button>}/><div className="company-progress">{companies.map(name => { const rows=data.filter(r=>r.company===name); const val=rows.length?Math.round(rows.filter(r=>r.status==="확정").length/rows.length*100):0; return <ProgressRow key={name} label={name} value={val} detail={`${rows.filter(r=>r.status==="확정").length} / ${rows.length}`}/>; })}</div></article>
      <article className="card review-card"><CardHeader title="검토 대기 자료" subtitle={`${pending.length}건의 자료가 확인을 기다리고 있습니다.`} action={<button onClick={()=>onNavigate("collection")}>전체보기 <Icon name="arrow" size={14}/></button>}/><div className="review-list">{pending.length ? pending.slice(0,3).map(record=><button className="review-item" key={record.id} onClick={()=>onNavigate("collection")}><div className={`source-icon ${record.scope==="Scope 1"?"green":"blue"}`}><Icon name={record.scope==="Scope 1"?"droplet":"bolt"} size={18}/></div><div><strong>{record.category} · {record.source}</strong><span>{record.company} / {record.site}</span></div><em>{formatNumber(record.emissions,1)} t</em><Icon name="chevron" size={16}/></button>):<div className="empty-state compact"><Icon name="check"/><strong>검토 대기 자료가 없습니다.</strong></div>}</div></article></section></>;
}

function KpiCard({label,value,unit,trend,trendType,icon,tone,progress}:{label:string;value:string;unit:string;trend:string;trendType:string;icon:IconName;tone:string;progress?:number}){return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon}/></div><div className="kpi-label">{label}</div><div className="kpi-value"><strong>{value}</strong><span>{unit}</span></div>{progress!==undefined&&<div className="mini-progress"><span style={{width:`${progress}%`}}/></div>}<div className={`kpi-trend ${trendType}`}>{trendType==="good"&&"✓"}{trendType==="warn"&&"!"} {trend}</div></article>}
function CardHeader({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action&&<div className="card-action">{action}</div>}</div>}
function ScopeRow({label,value,color,percent}:{label:string;value:number;color:string;percent:number}){return <div className="scope-row"><span><i className={color}/>{label}</span><strong>{formatNumber(value,1)}<small> t</small></strong><em>{percent}%</em></div>}
function ProgressRow({label,value,detail}:{label:string;value:number;detail:string}){return <div className="progress-row"><div><strong>{label}</strong><span>{detail}개 항목</span><em>{value}%</em></div><div className="progress-track"><span style={{width:`${value}%`}}/></div></div>}

function Collection({ records, onNew, onEdit, onChange, showToast }: { records: ActivityRecord[]; onNew: () => void; onEdit: (record: ActivityRecord) => void; onChange: (records: ActivityRecord[]) => void; showToast: (m: string) => void }) {
  const [search,setSearch]=useState(""); const [status,setStatus]=useState("전체"); const [company,setCompany]=useState("전체 법인"); const [scope,setScope]=useState("전체 Scope"); const [page,setPage]=useState(1); const pageSize=6;
  const filtered=records.filter(r=>(status==="전체"||r.status===status)&&(company==="전체 법인"||r.company===company)&&(scope==="전체 Scope"||r.scope===scope)&&`${r.company} ${r.site} ${r.category} ${r.source} ${r.owner}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)); const visible=filtered.slice((Math.min(page,pageCount)-1)*pageSize,Math.min(page,pageCount)*pageSize);
  const exportCsv=()=>{downloadCsv("sems2_activity_data.csv",["법인","사업장","귀속월","Scope","구분","배출원","사용량","단위","배출계수","배출량(tCO2e)","담당자","상태"],filtered.map(r=>[r.company,r.site,r.period,r.scope,r.category,r.source,r.usage,r.unit,r.factor,r.emissions,r.owner,r.status]));showToast("현재 조회 결과를 내려받았습니다.");};
  const updateStatus=(id:number,next:RecordStatus)=>{onChange(records.map(r=>r.id===id?{...r,status:next,updatedAt:"방금 전"}:r));showToast(next==="확정"?"자료를 검토·확정했습니다.":"자료를 검토 대기로 제출했습니다.");};
  const remove=(id:number)=>{if(!window.confirm("이 활동자료를 삭제하시겠습니까?"))return;onChange(records.filter(r=>r.id!==id));showToast("활동자료를 삭제했습니다.");};
  return <><PageHeader eyebrow="DATA COLLECTION" title="ESG 데이터 수집" description="법인·사업장별 활동자료를 입력하고 증빙과 검토 상태를 관리합니다."><button className="secondary-button" onClick={exportCsv}><Icon name="download" size={17}/>Excel 내보내기</button><button className="primary-button" onClick={onNew}><Icon name="plus" size={17}/>신규 자료 입력</button></PageHeader>
    <section className="collection-summary"><SummaryTile label="전체 항목" value={records.length} suffix="건" icon="database"/><SummaryTile label="검토 대기" value={records.filter(r=>r.status==="검토대기").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="반려" value={records.filter(r=>r.status==="반려").length} suffix="건" icon="alert" tone="red"/><SummaryTile label="확정 완료" value={records.filter(r=>r.status==="확정").length} suffix="건" icon="check" tone="green"/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","작성중","검토대기","반려","확정"].map(item=><button className={status===item?"active":""} key={item} onClick={()=>{setStatus(item);setPage(1)}}>{item}{item!=="전체"&&<span>{records.filter(r=>r.status===item).length}</span>}</button>)}</div><div className="filter-actions"><div className="search-box"><Icon name="search" size={17}/><input placeholder="배출원, 담당자 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><select value={scope} onChange={e=>{setScope(e.target.value);setPage(1)}} aria-label="Scope 필터"><option>전체 Scope</option><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select><select value={company} onChange={e=>{setCompany(e.target.value);setPage(1)}} aria-label="법인 필터"><option>전체 법인</option>{companies.map(c=><option key={c}>{c}</option>)}</select></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>귀속월</th><th>법인 / 사업장</th><th>Scope</th><th>활동자료 / 배출원</th><th className="align-right">사용량</th><th className="align-right">배출량</th><th>증빙</th><th>담당자</th><th>상태</th><th>작업</th></tr></thead><tbody>{visible.map(record=><tr key={record.id} onDoubleClick={()=>onEdit(record)}><td className="mono">{record.period}</td><td><strong>{record.company}</strong><span>{record.site}</span></td><td><span className={`scope-tag s${record.scope.slice(-1)}`}>{record.scope}</span></td><td><strong>{record.category}</strong><span>{record.source}</span></td><td className="align-right"><strong>{formatNumber(record.usage,record.usage<100?1:0)}</strong><span>{record.unit}</span></td><td className="align-right"><strong>{formatNumber(record.emissions,2)}</strong><span>tCO₂e</span></td><td>{record.evidence?<span className="file-linked"><Icon name="file" size={15}/>연결</span>:<span className="file-missing">미연결</span>}</td><td><strong>{record.owner}</strong><span>{record.department}</span></td><td><StatusBadge status={record.status}/></td><td><div className="row-actions">{record.status==="작성중"&&<button onClick={()=>updateStatus(record.id,"검토대기")}>제출</button>}{record.status==="검토대기"&&<button className="confirm" onClick={()=>updateStatus(record.id,"확정")}>확정</button>}<button className="icon-row-button" onClick={()=>onEdit(record)} aria-label="수정"><Icon name="edit" size={15}/></button><button className="icon-row-button danger" onClick={()=>remove(record.id)} aria-label="삭제"><Icon name="trash" size={15}/></button></div></td></tr>)}</tbody></table>{!visible.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 활동자료가 없습니다.</strong><p>필터를 바꾸거나 신규 자료를 입력해 주세요.</p></div>}</div>
      <div className="table-footer"><span>총 {filtered.length}건 · {Math.min(page,pageCount)}/{pageCount}페이지</span><div className="pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>{Array.from({length:pageCount},(_,i)=><button key={i} className={page===i+1?"active":""} onClick={()=>setPage(i+1)}>{i+1}</button>)}<button disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>›</button></div></div></section></>;
}
function SummaryTile({label,value,suffix,icon,tone="blue"}:{label:string;value:number;suffix:string;icon:IconName;tone?:string}){return <div className="summary-tile"><div className={`summary-icon ${tone}`}><Icon name={icon} size={19}/></div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>}

function Inventory({records,showToast}:{records:ActivityRecord[];showToast:(m:string)=>void}){
  const years=[...new Set(records.map(r=>r.period.slice(0,4)))].sort().reverse(); const [year,setYear]=useState(years[0]??"2026"); const [scope,setScope]=useState<Scope|null>(null); const base=records.filter(r=>r.period.startsWith(year)); const rows=scope?base.filter(r=>r.scope===scope):base; const total=rows.reduce((s,r)=>s+r.emissions,0);
  const byCompany=companies.map(name=>({name,value:rows.filter(r=>r.company===name).reduce((s,r)=>s+r.emissions,0)})); const max=Math.max(1,...byCompany.map(x=>x.value));
  const exportData=()=>{downloadCsv("sems2_ghg_inventory.csv",["귀속월","법인","사업장","Scope","활동자료","배출원","사용량","단위","배출량(tCO2e)","상태"],rows.map(r=>[r.period,r.company,r.site,r.scope,r.category,r.source,r.usage,r.unit,r.emissions,r.status]));showToast("산정 내역을 내려받았습니다.");};
  return <><PageHeader eyebrow="GHG INVENTORY" title="온실가스 인벤토리" description="활동자료와 배출계수를 연결해 Scope별 배출량을 산정하고 추적합니다."><label className="year-select"><Icon name="calendar" size={17}/><select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="secondary-button" onClick={exportData}><Icon name="download" size={17}/>산정 내역 다운로드</button></PageHeader>
    <section className="inventory-hero"><div><span>{year}년 {scope??"전체 Scope"} 누적 배출량</span><div className="inventory-total"><strong>{formatNumber(total,1)}</strong><em>tCO₂e</em></div><p><b>활동자료 {rows.length}건</b> · 현재 등록 데이터 기준</p></div><div className="target-block"><div className="target-copy"><span>2030 감축목표 진행률</span><strong>32.1%</strong></div><div className="target-track"><span style={{width:"32.1%"}}/><i style={{left:"72%"}}/></div><div className="target-labels"><span>기준연도 2023</span><span>2030 목표 -15%</span></div></div></section>
    <div className="scope-filter-note"><span>Scope 카드를 누르면 법인별 배출량이 해당 범위로 필터링됩니다.</span>{scope&&<button onClick={()=>setScope(null)}>전체 Scope 보기</button>}</div>
    <section className="inventory-grid"><article className="card"><CardHeader title="Scope별 인벤토리" subtitle="등록된 전체 상태 자료 포함"/><div className="inventory-scope-list">{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map((s,i)=><InventoryScope key={s} number={`0${i+1}`} label={s} desc={i===0?"고정연소 · 이동연소 · 비산배출":i===1?"구매 전력 · 구매 열·스팀":"공급망 · 통근 · 출장 · 폐기물"} value={base.filter(r=>r.scope===s).reduce((a,r)=>a+r.emissions,0)} color={i===0?"dark":i===1?"mid":"light"} active={scope===s} onClick={()=>setScope(scope===s?null:s)}/>)}</div></article><article className="card"><CardHeader title="법인별 배출량" subtitle={`${year}년 ${scope??"전체 Scope"} 기준`} action="단위: tCO₂e"/><div className="horizontal-bars">{byCompany.map(item=><div key={item.name}><div><strong>{item.name}</strong><span>{formatNumber(item.value,1)}</span></div><p><span style={{width:`${Math.max(item.value/max*100,item.value?4:0)}%`}}/></p></div>)}</div></article></section>
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

function Settings({factors,onFactorsChange,showToast}:{factors:EmissionFactor[];onFactorsChange:(x:EmissionFactor[])=>void;showToast:(m:string)=>void}){
  const [tab,setTab]=useState<SettingTab>("factors"); const [factorModal,setFactorModal]=useState<EmissionFactor|null|"new">(null); const [criteria,setCriteria]=useState({variance:10,evidenceRequired:true,lockConfirmed:true,defaultYear:"2026"}); const [noticePrefs,setNoticePrefs]=useState({deadline:true,review:true,rejected:true,weekly:false});
  const saveFactor=(factor:EmissionFactor)=>{const normalized=factor.id==="NEW-FACTOR"?{...factor,id:`F-${String(factors.length+1).padStart(3,"0")}`}:factor;const exists=factors.some(f=>f.id===normalized.id);onFactorsChange(exists?factors.map(f=>f.id===normalized.id?normalized:f):[...factors,normalized]);setFactorModal(null);showToast(exists?"배출계수를 수정했습니다.":"새 배출계수를 추가했습니다.");};
  const removeFactor=(id:string)=>{if(!window.confirm("이 배출계수를 삭제하시겠습니까? 기존 활동자료의 산정값은 유지됩니다."))return;onFactorsChange(factors.filter(f=>f.id!==id));setFactorModal(null);showToast("배출계수를 삭제했습니다.");};
  return <><PageHeader eyebrow="SYSTEM SETTINGS" title="시스템 설정" description="조직, 산정 기준, 알림 등 SEMS 운영에 필요한 기준정보를 관리합니다."/><div className="settings-layout"><aside className="settings-nav"><button className={tab==="organization"?"active":""} onClick={()=>setTab("organization")}><Icon name="building" size={18}/>조직·사업장</button><button className={tab==="factors"?"active":""} onClick={()=>setTab("factors")}><Icon name="leaf" size={18}/>배출계수</button><button className={tab==="criteria"?"active":""} onClick={()=>setTab("criteria")}><Icon name="list" size={18}/>수집 기준</button><button className={tab==="notifications"?"active":""} onClick={()=>setTab("notifications")}><Icon name="bell" size={18}/>알림 설정</button><button className={tab==="permissions"?"active":""} onClick={()=>setTab("permissions")}><Icon name="settings" size={18}/>권한 관리</button></aside><section className="card settings-content">
    {tab==="factors"&&<><CardHeader title="배출계수 관리" subtitle="활동자료 등록 시 자동 적용되는 기준 계수입니다." action={<button className="outline-small" onClick={()=>setFactorModal("new")}><Icon name="plus" size={15}/>계수 추가</button>}/><div className="factor-notice"><Icon name="lock" size={18}/><p><strong>활동자료 등록 화면에서는 배출계수를 수정할 수 없습니다.</strong><br/>계수 변경은 이 메뉴에서만 가능하며, 기존 활동자료에는 저장 당시의 계수가 유지됩니다.</p></div><div className="table-scroll"><table className="data-table factor-table"><thead><tr><th>Scope</th><th>활동자료</th><th>배출원</th><th>배출계수</th><th>단위</th><th>적용 연도</th><th>출처</th><th>상태</th><th>작업</th></tr></thead><tbody>{factors.map(row=><tr key={row.id}><td><span className={`scope-tag s${row.scope.slice(-1)}`}>{row.scope}</span></td><td>{row.category}</td><td><strong>{row.source}</strong></td><td className="mono"><strong>{formatNumber(row.value,row.value<10?5:1)}</strong></td><td>{row.factorUnit}</td><td>{row.year}</td><td>{row.authority}</td><td><span className={row.active?"active-label":"inactive-label"}>{row.active?"사용 중":"중지"}</span></td><td><button className="outline-small" onClick={()=>setFactorModal(row)}><Icon name="edit" size={14}/>수정</button></td></tr>)}</tbody></table></div></>}
    {tab==="organization"&&<OrganizationSettings showToast={showToast}/>} {tab==="criteria"&&<><CardHeader title="데이터 수집 기준" subtitle="입력 검증과 확정 데이터 처리 기준을 설정합니다."/><div className="settings-form"><label>기본 귀속연도<select value={criteria.defaultYear} onChange={e=>setCriteria({...criteria,defaultYear:e.target.value})}><option>2026</option><option>2027</option><option>2028</option></select></label><label>전월 대비 이상치 경고 기준<div className="input-unit"><input type="number" min="1" value={criteria.variance} onChange={e=>setCriteria({...criteria,variance:Number(e.target.value)})}/><span>%</span></div></label><Toggle label="제출 시 증빙 연결 필수" checked={criteria.evidenceRequired} onChange={v=>setCriteria({...criteria,evidenceRequired:v})}/><Toggle label="확정 자료 수정 잠금" checked={criteria.lockConfirmed} onChange={v=>setCriteria({...criteria,lockConfirmed:v})}/></div><SettingsFooter onSave={()=>showToast("수집 기준을 저장했습니다.")}/></>}
    {tab==="notifications"&&<><CardHeader title="알림 설정" subtitle="업무 상황별 알림 수신 여부를 설정합니다."/><div className="toggle-list"><Toggle label="수집 마감 3일 전 알림" description="미제출 담당자와 기획팀에 안내" checked={noticePrefs.deadline} onChange={v=>setNoticePrefs({...noticePrefs,deadline:v})}/><Toggle label="검토 대기 등록 알림" description="담당 부서가 제출하면 기획팀에 안내" checked={noticePrefs.review} onChange={v=>setNoticePrefs({...noticePrefs,review:v})}/><Toggle label="반려 및 보완 요청 알림" description="반려 사유와 재제출 기한 안내" checked={noticePrefs.rejected} onChange={v=>setNoticePrefs({...noticePrefs,rejected:v})}/><Toggle label="주간 수집 현황 요약" description="매주 월요일 관리자에게 요약" checked={noticePrefs.weekly} onChange={v=>setNoticePrefs({...noticePrefs,weekly:v})}/><div className="server-note"><Icon name="alert" size={17}/>설정값은 저장되지만 실제 메일·사내 알림 발송은 알림 서버 연결 후 적용됩니다.</div></div><SettingsFooter onSave={()=>showToast("알림 설정을 저장했습니다.")}/></>}
    {tab==="permissions"&&<PermissionSettings showToast={showToast}/>}</section></div>{factorModal&&<FactorForm factor={factorModal==="new"?null:factorModal} onClose={()=>setFactorModal(null)} onSave={saveFactor} onDelete={factorModal==="new"?undefined:()=>removeFactor(factorModal.id)}/>}</>;
}
function OrganizationSettings({showToast}:{showToast:(m:string)=>void}){const [selected,setSelected]=useState("세원정공");const [siteMap,setSiteMap]=useState<Record<string,string[]>>(()=>Object.fromEntries(Object.entries(sitesByCompany).map(([key,value])=>[key,[...value]])));const [adding,setAdding]=useState(false);const [newSite,setNewSite]=useState("");const addSite=()=>{const name=newSite.trim();if(!name)return;if(siteMap[selected].includes(name)){showToast("이미 등록된 사업장입니다.");return;}setSiteMap({...siteMap,[selected]:[...siteMap[selected],name]});setNewSite("");setAdding(false);showToast(`${selected}에 ${name}을(를) 추가했습니다.`);};return <><CardHeader title="조직·사업장" subtitle="활동자료를 수집할 법인과 사업장을 확인합니다."/><div className="organization-grid"><div className="org-list">{companies.map(c=><button key={c} className={selected===c?"active":""} onClick={()=>{setSelected(c);setAdding(false)}}><span className="company-initial">{c.slice(-1)}</span><div><strong>{c}</strong><small>{siteMap[c].length}개 사업장</small></div><Icon name="chevron" size={16}/></button>)}</div><div className="site-panel"><div><strong>{selected} 사업장</strong><button className="outline-small" onClick={()=>setAdding(!adding)}><Icon name={adding?"close":"plus"} size={14}/>{adding?"취소":"사업장 추가"}</button></div>{adding&&<div className="inline-add"><input placeholder="새 사업장명" value={newSite} onChange={e=>setNewSite(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSite()}/><button className="primary-button" onClick={addSite}>추가</button></div>}{siteMap[selected].map(site=><div className="site-row" key={site}><span><Icon name="building" size={17}/></span><div><strong>{site}</strong><small>사용 중 · 국내 사업장</small></div><span className="active-label">사용 중</span></div>)}</div></div><SettingsFooter onSave={()=>showToast("조직·사업장 설정을 저장했습니다.")}/></>}
function PermissionSettings({showToast}:{showToast:(m:string)=>void}){const [roles,setRoles]=useState([{name:"관리자",desc:"모든 법인 조회·검토·기준정보 관리",members:3,write:true,approve:true},{name:"법인 담당자",desc:"소속 법인 자료 입력·수정·제출",members:12,write:true,approve:false},{name:"조회자",desc:"확정 자료와 대시보드 조회",members:6,write:false,approve:false}]);return <><CardHeader title="권한 관리" subtitle="역할별 화면 접근과 작업 권한을 설계합니다."/><div className="permission-table">{roles.map((r,index)=><div key={r.name}><div><strong>{r.name}</strong><p>{r.desc}</p></div><span>{r.members}명</span><label><input type="checkbox" checked={r.write} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,write:e.target.checked}:x))}/>입력</label><label><input type="checkbox" checked={r.approve} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,approve:e.target.checked}:x))}/>확정</label></div>)}</div><div className="server-note"><Icon name="lock" size={17}/>현재는 권한 설계 화면입니다. 실제 사용자별 접근 제한은 사내 로그인·권한 서버 연결 후 적용됩니다.</div><SettingsFooter onSave={()=>showToast("권한 설계안을 저장했습니다.")}/></>}
function Toggle({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><div><strong>{label}</strong>{description&&<p>{description}</p>}</div><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span/></label>}
function SettingsFooter({onSave}:{onSave:()=>void}){return <div className="settings-footer"><span>변경 내용은 현재 브라우저에 저장됩니다.</span><button className="primary-button" onClick={onSave}>변경사항 저장</button></div>}
function FactorForm({factor,onClose,onSave,onDelete}:{factor:EmissionFactor|null;onClose:()=>void;onSave:(f:EmissionFactor)=>void;onDelete?:()=>void}){const [form,setForm]=useState<EmissionFactor>(factor??{id:"NEW-FACTOR",scope:"Scope 1",category:"",source:"",value:0,activityUnit:"L",factorUnit:"kgCO₂e/L",year:"2026",authority:"",active:true});const patch=(p:Partial<EmissionFactor>)=>setForm(c=>({...c,...p}));return <Overlay title={factor?"배출계수 수정":"배출계수 추가"} eyebrow="EMISSION FACTOR" description="여기서 저장한 계수만 활동자료 입력 화면에 자동 표시됩니다." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(form)}}><div className="form-section"><div className="form-grid"><label>Scope<select value={form.scope} onChange={e=>patch({scope:e.target.value as Scope})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label><label>활동자료 구분<input value={form.category} onChange={e=>patch({category:e.target.value})} required/></label><label>배출원<input value={form.source} onChange={e=>patch({source:e.target.value})} required/></label><label>활동자료 단위<input value={form.activityUnit} onChange={e=>patch({activityUnit:e.target.value,factorUnit:`kgCO₂e/${e.target.value}`})} required/></label><label>배출계수<input type="number" min="0" step="any" value={form.value||""} onChange={e=>patch({value:Number(e.target.value)})} required/></label><label>계수 단위<input value={form.factorUnit} onChange={e=>patch({factorUnit:e.target.value})} required/></label><label>적용 연도<input value={form.year} onChange={e=>patch({year:e.target.value})} required/></label><label>출처<input value={form.authority} onChange={e=>patch({authority:e.target.value})} required/></label><Toggle label="활동자료 입력 시 사용" checked={form.active} onChange={v=>patch({active:v})}/></div></div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>계수 저장</button></div></div></form></Overlay>}

function RecordModal({record,factors,onClose,onSave}:{record:ActivityRecord|null;factors:EmissionFactor[];onClose:()=>void;onSave:(r:ActivityRecord)=>void}){
  const fallback=factors.find(f=>f.scope==="Scope 2"&&f.active)??factors.find(f=>f.active)??initialFactors[0];
  const [form,setForm]=useState<ActivityRecord>(record??{id:0,company:"세원정공",site:"대구공장",period:"2026-07",scope:fallback.scope,category:fallback.category,source:fallback.source,usage:0,unit:fallback.activityUnit,factor:fallback.value,emissions:0,owner:"문경섭",department:"기획팀",status:"작성중",evidence:"",updatedAt:"방금 전"}); const [error,setError]=useState("");
  const available=factors.filter(f=>f.active&&f.scope===form.scope); const categories=[...new Set(available.map(f=>f.category))]; const sources=available.filter(f=>f.category===form.category); const selected=factors.find(f=>f.scope===form.scope&&f.category===form.category&&f.source===form.source)??null; const patch=(p:Partial<ActivityRecord>)=>setForm(c=>({...c,...p}));
  const applyFactor=(f:EmissionFactor)=>patch({category:f.category,source:f.source,unit:f.activityUnit,factor:f.value});
  const changeScope=(scope:Scope)=>{const first=factors.find(f=>f.active&&f.scope===scope); if(first)setForm(c=>({...c,scope,category:first.category,source:first.source,unit:first.activityUnit,factor:first.value}));};
  const submit=(e:FormEvent)=>{e.preventDefault();if(!form.usage){setError("사용량을 입력해 주세요.");return;}onSave({...form,emissions:Math.round(form.usage*form.factor/1000*100)/100,updatedAt:"방금 전"});};
  return <Overlay title={record?"활동자료 수정":"신규 활동자료 입력"} eyebrow="ACTIVITY DATA" description="Scope별 활동자료와 등록된 배출계수가 자동 연결됩니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>기본 정보</h3><div className="form-grid"><label>법인<select value={form.company} onChange={e=>{const company=e.target.value;patch({company,site:sitesByCompany[company][0]})}}>{companies.map(c=><option key={c}>{c}</option>)}</select></label><label>사업장<select value={form.site} onChange={e=>patch({site:e.target.value})}>{sitesByCompany[form.company].map(s=><option key={s}>{s}</option>)}</select></label><label>귀속월<input type="month" value={form.period} onChange={e=>patch({period:e.target.value})} required/></label><label>Scope<select value={form.scope} onChange={e=>changeScope(e.target.value as Scope)}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label></div></div>
    <div className="scope-context"><span className={`scope-tag s${form.scope.slice(-1)}`}>{form.scope}</span><strong>{form.scope==="Scope 1"?"직접 배출 활동자료":form.scope==="Scope 2"?"구매 에너지 활동자료":"기타 간접 배출 활동자료"}</strong><p>현재 Scope에 해당하는 활동자료만 아래 목록에 표시됩니다.</p></div>
    <div className="form-section"><h3><span>2</span>활동자료 및 산정</h3>{available.length?<div className="form-grid"><label>활동자료 구분<select value={form.category} onChange={e=>{const first=available.find(f=>f.category===e.target.value);if(first)applyFactor(first)}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>배출원<select value={form.source} onChange={e=>{const found=sources.find(f=>f.source===e.target.value);if(found)applyFactor(found)}}>{sources.map(f=><option key={f.id} value={f.source}>{f.source}</option>)}</select></label><label>사용량<div className="input-unit"><input type="number" min="0" step="any" value={form.usage||""} onChange={e=>patch({usage:Number(e.target.value)})} required/><span>{form.unit}</span></div></label><label>단위<input value={form.unit} readOnly className="readonly-input"/></label><label>배출계수<div className="locked-input"><input value={form.factor} readOnly/><Icon name="lock" size={15}/></div><small className="field-help">{selected?.year} · {selected?.authority} 기준 / 시스템 설정에서만 변경 가능</small></label><div className="calculated-field"><span>예상 배출량</span><strong>{formatNumber(form.usage*form.factor/1000,2)} <small>tCO₂e</small></strong><em>사용량 × 배출계수 ÷ 1,000</em></div></div>:<div className="empty-state"><Icon name="alert"/><strong>이 Scope에 사용 가능한 배출계수가 없습니다.</strong><p>시스템 설정 &gt; 배출계수에서 계수를 먼저 등록해 주세요.</p></div>}</div>
    <div className="form-section"><h3><span>3</span>증빙 및 담당자</h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setError("증빙파일은 20MB 이하만 선택할 수 있습니다.");e.target.value="";return;}setError("");patch({evidence:file.name})}}/><span className="upload-icon"><Icon name="upload"/></span>{form.evidence?<><strong>{form.evidence}</strong><small>현재 시연 버전은 파일명만 브라우저에 보관합니다.</small></>:<><strong>증빙자료를 끌어놓거나 클릭해 선택하세요.</strong><small>PDF, XLSX, JPG, PNG · 최대 20MB</small></>}</label><div className="form-grid two"><label>담당자<input value={form.owner} onChange={e=>patch({owner:e.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={e=>patch({department:e.target.value})} required/></label></div>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!available.length}><Icon name="check" size={17}/>{record?"수정사항 저장":"작성 중으로 저장"}</button></div></form></Overlay>;
}
