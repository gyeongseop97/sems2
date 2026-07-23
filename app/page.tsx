"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type View = "dashboard" | "collection" | "inventory" | "evidence" | "indicators" | "settings";
type RecordStatus = "작성중" | "검토대기" | "반려" | "확정";

type ActivityRecord = {
  id: number;
  company: string;
  site: string;
  period: string;
  scope: "Scope 1" | "Scope 2" | "Scope 3";
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

const navItems: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "대시보드", icon: "dashboard" },
  { id: "collection", label: "데이터 수집", icon: "database" },
  { id: "inventory", label: "온실가스 인벤토리", icon: "leaf" },
  { id: "evidence", label: "증빙자료", icon: "file" },
  { id: "indicators", label: "ESG 지표 관리", icon: "list" },
];

const initialRecords: ActivityRecord[] = [
  { id: 1, company: "세원정공", site: "대구공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "한국전력", usage: 1248500, unit: "kWh", factor: 0.45941, emissions: 573.56, owner: "김민수", department: "시설팀", status: "확정", evidence: "2026_06_electricity.pdf", updatedAt: "07.18 14:20" },
  { id: 2, company: "세원정공", site: "대구공장", period: "2026-06", scope: "Scope 1", category: "고정연소", source: "LNG", usage: 84200, unit: "Nm³", factor: 2.176, emissions: 183.22, owner: "김민수", department: "시설팀", status: "검토대기", evidence: "lng_202606.xlsx", updatedAt: "07.19 10:12" },
  { id: 3, company: "세원테크", site: "경산공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "한국전력", usage: 764800, unit: "kWh", factor: 0.45941, emissions: 351.36, owner: "이서연", department: "생산관리팀", status: "검토대기", evidence: "전기요금_6월.pdf", updatedAt: "07.20 09:41" },
  { id: 4, company: "세원E&I", site: "영천공장", period: "2026-06", scope: "Scope 1", category: "이동연소", source: "경유", usage: 4280, unit: "L", factor: 2.582, emissions: 11.05, owner: "박지훈", department: "총무팀", status: "작성중", evidence: "", updatedAt: "07.20 16:05" },
  { id: 5, company: "세원물산", site: "대구공장", period: "2026-06", scope: "Scope 3", category: "임직원 통근", source: "자가용·대중교통", usage: 384200, unit: "km", factor: 0.121, emissions: 46.49, owner: "최유진", department: "인사팀", status: "반려", evidence: "통근설문_집계.xlsx", updatedAt: "07.21 11:32" },
  { id: 6, company: "세원정공", site: "대구공장", period: "2026-05", scope: "Scope 2", category: "구매 전력", source: "한국전력", usage: 1194200, unit: "kWh", factor: 0.45941, emissions: 548.57, owner: "김민수", department: "시설팀", status: "확정", evidence: "2026_05_electricity.pdf", updatedAt: "06.17 15:10" },
  { id: 7, company: "세원테크", site: "경산공장", period: "2026-06", scope: "Scope 1", category: "비산배출", source: "냉매 R-410A", usage: 18.5, unit: "kg", factor: 2088, emissions: 38.63, owner: "윤태호", department: "설비보전팀", status: "확정", evidence: "냉매충전_점검표.pdf", updatedAt: "07.18 08:52" },
  { id: 8, company: "세원E&I", site: "영천공장", period: "2026-06", scope: "Scope 2", category: "구매 전력", source: "한국전력", usage: 496300, unit: "kWh", factor: 0.45941, emissions: 228.01, owner: "정예린", department: "생산관리팀", status: "작성중", evidence: "", updatedAt: "07.22 13:11" },
];

const evidenceItems = [
  { title: "전력 사용량 및 요금 고지서", category: "온실가스·에너지", period: "월", owner: "시설팀", received: 10, total: 12, due: "7월 25일", status: "수집중" },
  { title: "연료 구매 및 사용 내역", category: "온실가스·에너지", period: "월", owner: "총무팀", received: 8, total: 8, due: "7월 25일", status: "완료" },
  { title: "폐기물 처리 실적 및 인계서", category: "환경", period: "분기", owner: "환경안전팀", received: 5, total: 8, due: "7월 31일", status: "수집중" },
  { title: "안전보건 교육 실시 결과", category: "사회", period: "분기", owner: "안전보건팀", received: 7, total: 8, due: "7월 31일", status: "수집중" },
  { title: "협력사 ESG 평가 결과", category: "공급망", period: "반기", owner: "구매팀", received: 8, total: 8, due: "7월 15일", status: "완료" },
];

const indicatorRows = [
  { code: "E-01", name: "온실가스 배출량 (Scope 1·2)", category: "환경", unit: "tCO₂e", cycle: "월", owner: "시설팀", progress: 92 },
  { code: "E-02", name: "에너지 사용량", category: "환경", unit: "MWh", cycle: "월", owner: "시설팀", progress: 92 },
  { code: "E-04", name: "폐기물 발생 및 재활용량", category: "환경", unit: "ton", cycle: "월", owner: "환경안전팀", progress: 75 },
  { code: "S-03", name: "산업재해 및 근로손실률", category: "사회", unit: "건 / %", cycle: "월", owner: "안전보건팀", progress: 100 },
  { code: "S-07", name: "교육훈련 시간", category: "사회", unit: "시간", cycle: "분기", owner: "인사팀", progress: 88 },
  { code: "G-02", name: "윤리·준법 교육 이수율", category: "지배구조", unit: "%", cycle: "분기", owner: "기획팀", progress: 100 },
];

const factors = [
  { source: "전력", value: "0.45941", unit: "kgCO₂e/kWh", year: "2025", authority: "환경부" },
  { source: "LNG", value: "2.17600", unit: "kgCO₂e/Nm³", year: "2025", authority: "환경부" },
  { source: "휘발유", value: "2.17900", unit: "kgCO₂e/L", year: "2025", authority: "환경부" },
  { source: "경유", value: "2.58200", unit: "kgCO₂e/L", year: "2025", authority: "환경부" },
  { source: "냉매 R-410A", value: "2,088.0", unit: "kgCO₂e/kg", year: "AR5", authority: "IPCC" },
];

type IconName = "dashboard" | "database" | "leaf" | "file" | "list" | "settings" | "bell" | "search" | "plus" | "download" | "menu" | "close" | "chevron" | "check" | "clock" | "alert" | "building" | "upload" | "calendar" | "more" | "arrow" | "target" | "bolt" | "droplet" | "trash";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C14.4 3 20 4 20 4s1 5.6-2.1 10.2A7 7 0 0 1 11 20Z"/><path d="M4 21c2.2-5.8 6-9.6 12-12"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.61.53 1.12 1.1 1.37.18.08.37.12.55.12H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    building: <><path d="M3 21h18M6 21V5l6-3 6 3v16M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    bolt: <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/>,
    droplet: <path d="M12 2s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z"/>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function StatusBadge({ status }: { status: RecordStatus | string }) {
  const key = status === "확정" || status === "완료" ? "done" : status === "검토대기" || status === "수집중" ? "pending" : status === "반려" ? "rejected" : "draft";
  return <span className={`status-badge ${key}`}><span className="status-dot" />{status}</span>;
}

function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{children && <div className="page-actions">{children}</div>}</div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [records, setRecords] = useState<ActivityRecord[]>(initialRecords);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRecord | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("sems2-records");
    if (saved) {
      const timer = window.setTimeout(() => {
        try { setRecords(JSON.parse(saved)); } catch { /* keep demo data */ }
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (mobileMenu) document.body.classList.add("menu-open");
    else document.body.classList.remove("menu-open");
    return () => document.body.classList.remove("menu-open");
  }, [mobileMenu]);

  const persist = (next: ActivityRecord[]) => {
    setRecords(next);
    window.localStorage.setItem("sems2-records", JSON.stringify(next));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const navigate = (view: View) => {
    setActiveView(view);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openForm = (record?: ActivityRecord) => {
    setEditing(record ?? null);
    setModalOpen(true);
  };

  const saveRecord = (record: ActivityRecord) => {
    const exists = record.id !== 0 && records.some((item) => item.id === record.id);
    const savedRecord = exists ? record : { ...record, id: Math.max(0, ...records.map(item => item.id)) + 1 };
    persist(exists ? records.map((item) => item.id === record.id ? savedRecord : item) : [savedRecord, ...records]);
    setModalOpen(false);
    setEditing(null);
    showToast(exists ? "입력 자료를 수정했습니다." : "새 활동자료를 저장했습니다.");
  };

  const totals = useMemo(() => records.filter(r => r.period.startsWith("2026")).reduce((sum, r) => sum + r.emissions, 0), [records]);
  const confirmed = records.filter(r => r.status === "확정").length;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span>S</span></div>
          <div><strong>SEMS</strong><small>Sewon ESG Management</small></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기"><Icon name="close" /></button>
        </div>
        <nav className="main-nav" aria-label="주 메뉴">
          <span className="nav-group-label">OVERVIEW</span>
          {navItems.slice(0, 1).map(item => <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => navigate(item.id)} />)}
          <span className="nav-group-label">ESG MANAGEMENT</span>
          {navItems.slice(1).map(item => <NavButton key={item.id} item={item} active={activeView === item.id} onClick={() => navigate(item.id)} count={item.id === "collection" ? records.filter(r => r.status === "검토대기").length : undefined} />)}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-button ${activeView === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Icon name="settings" /><span>시스템 설정</span></button>
          <div className="help-card"><div className="help-icon">?</div><strong>도움이 필요하신가요?</strong><p>입력 기준과 시스템 사용법을 확인하세요.</p><button>사용 가이드 <Icon name="arrow" size={14} /></button></div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" />}

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Icon name="menu" /></button>
          <div className="breadcrumb"><span>SEMS</span><Icon name="chevron" size={14} /><strong>{navItems.find(n => n.id === activeView)?.label ?? "시스템 설정"}</strong></div>
          <div className="topbar-actions">
            <div className="demo-label"><span /> 데모 데이터</div>
            <button className="icon-button notification-button" onClick={() => setNotifications(!notifications)} aria-label="알림"><Icon name="bell" /><span className="notification-dot" /></button>
            <div className="profile"><div className="avatar">문</div><div><strong>문경섭</strong><span>기획팀 · 관리자</span></div><Icon name="chevron" size={15} /></div>
          </div>
          {notifications && <NotificationPanel close={() => setNotifications(false)} />}
        </header>

        <main className="content">
          {activeView === "dashboard" && <Dashboard records={records} total={totals} confirmed={confirmed} onNavigate={navigate} onNew={() => openForm()} />}
          {activeView === "collection" && <Collection records={records} onNew={() => openForm()} onEdit={openForm} showToast={showToast} persist={persist} />}
          {activeView === "inventory" && <Inventory records={records} total={totals} />}
          {activeView === "evidence" && <Evidence showToast={showToast} />}
          {activeView === "indicators" && <Indicators showToast={showToast} />}
          {activeView === "settings" && <Settings showToast={showToast} />}
        </main>
      </div>

      {modalOpen && <RecordModal record={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveRecord} />}
      {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
    </div>
  );
}

function NavButton({ item, active, onClick, count }: { item: { id: View; label: string; icon: IconName }; active: boolean; onClick: () => void; count?: number }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon name={item.icon} /><span>{item.label}</span>{count ? <em>{count}</em> : null}</button>;
}

function NotificationPanel({ close }: { close: () => void }) {
  return <div className="notification-panel"><div className="panel-title"><strong>알림</strong><button onClick={close}><Icon name="close" size={16} /></button></div><div className="notification-item unread"><span className="notification-icon warning"><Icon name="clock" size={17} /></span><div><strong>검토 대기 자료 2건</strong><p>6월 온실가스 활동자료가 검토를 기다리고 있습니다.</p><small>12분 전</small></div></div><div className="notification-item"><span className="notification-icon success"><Icon name="check" size={17} /></span><div><strong>세원테크 자료 제출 완료</strong><p>6월 구매전력 자료가 제출되었습니다.</p><small>어제</small></div></div><button className="all-notifications">모든 알림 보기</button></div>;
}

function Dashboard({ records, total, confirmed, onNavigate, onNew }: { records: ActivityRecord[]; total: number; confirmed: number; onNavigate: (view: View) => void; onNew: () => void }) {
  const pending = records.filter(r => r.status === "검토대기");
  const scope1 = records.filter(r => r.scope === "Scope 1").reduce((s, r) => s + r.emissions, 0);
  const scope2 = records.filter(r => r.scope === "Scope 2").reduce((s, r) => s + r.emissions, 0);
  const scope3 = records.filter(r => r.scope === "Scope 3").reduce((s, r) => s + r.emissions, 0);
  const completion = Math.round((confirmed / records.length) * 100);
  const chartData = [
    { month: "1월", s1: 26, s2: 62, s3: 10 }, { month: "2월", s1: 29, s2: 57, s3: 12 }, { month: "3월", s1: 34, s2: 70, s3: 13 },
    { month: "4월", s1: 31, s2: 66, s3: 14 }, { month: "5월", s1: 35, s2: 75, s3: 15 }, { month: "6월", s1: 38, s2: 81, s3: 17 },
  ];
  return <>
    <PageHeader eyebrow="2026 ESG PERFORMANCE" title="ESG 통합 대시보드" description="세원그룹의 ESG 데이터 수집 현황과 주요 성과를 한눈에 확인합니다.">
      <button className="secondary-button"><Icon name="calendar" size={17} />2026년</button><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />자료 입력</button>
    </PageHeader>

    <section className="notice-banner"><div className="notice-icon"><Icon name="alert" /></div><div><strong>6월 데이터 수집 마감까지 2일 남았습니다.</strong><p>미제출 4건, 검토 대기 2건이 있습니다. 담당 부서의 제출 현황을 확인해 주세요.</p></div><button onClick={() => onNavigate("collection")}>수집 현황 보기 <Icon name="arrow" size={16} /></button></section>

    <section className="kpi-grid">
      <KpiCard label="온실가스 배출량" value={formatNumber(total, 1)} unit="tCO₂e" trend="전년 동기 대비 4.8% 감소" trendType="good" icon="leaf" tone="green" />
      <KpiCard label="데이터 수집률" value={String(completion)} unit="%" trend={`${confirmed}/${records.length}개 항목 확정`} trendType="neutral" icon="database" tone="blue" progress={completion} />
      <KpiCard label="에너지 사용량" value="6,842" unit="MWh" trend="전년 동기 대비 2.1% 감소" trendType="good" icon="bolt" tone="amber" />
      <KpiCard label="증빙 연결률" value="94.2" unit="%" trend="미연결 증빙 3건" trendType="warn" icon="file" tone="violet" progress={94.2} />
    </section>

    <section className="dashboard-grid">
      <article className="card emissions-chart-card">
        <CardHeader title="월별 온실가스 배출 추이" subtitle="Scope 1·2·3 합산 배출량" action="단위: tCO₂e" />
        <div className="chart-legend"><span><i className="scope1" />Scope 1</span><span><i className="scope2" />Scope 2</span><span><i className="scope3" />Scope 3</span></div>
        <div className="bar-chart"><div className="axis-labels"><span>1,200</span><span>900</span><span>600</span><span>300</span><span>0</span></div><div className="grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{chartData.map((item, index) => <div className="bar-group" key={item.month}><div className="bar-stack"><span className="scope3" style={{ height: item.s3 }} /><span className="scope2" style={{ height: item.s2 }} /><span className="scope1" style={{ height: item.s1 }} />{index === chartData.length - 1 && <b>1,126</b>}</div><small>{item.month}</small></div>)}</div></div>
      </article>

      <article className="card scope-card">
        <CardHeader title="Scope별 배출 구성" subtitle="2026년 누적 기준" />
        <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#156b55 0 18%, #42a585 18% 83%, #a6d7c7 83% 100%)` }}><div><strong>{formatNumber(total / 1000, 1)}K</strong><span>tCO₂e</span></div></div></div>
        <div className="scope-breakdown"><ScopeRow label="Scope 1" value={scope1} color="dark" percent={18} /><ScopeRow label="Scope 2" value={scope2} color="mid" percent={65} /><ScopeRow label="Scope 3" value={scope3} color="light" percent={17} /></div>
      </article>

      <article className="card collection-card">
        <CardHeader title="법인별 수집 현황" subtitle="2026년 6월 마감 현황" action={<button onClick={() => onNavigate("collection")}>전체보기 <Icon name="arrow" size={14} /></button>} />
        <div className="company-progress"><ProgressRow label="세원정공" value={96} detail="24 / 25" /><ProgressRow label="세원물산" value={84} detail="21 / 25" /><ProgressRow label="세원테크" value={92} detail="23 / 25" /><ProgressRow label="세원E&I" value={80} detail="20 / 25" /></div>
      </article>

      <article className="card review-card">
        <CardHeader title="검토 대기 자료" subtitle={`${pending.length}건의 자료가 확인을 기다리고 있습니다.`} action={<button onClick={() => onNavigate("collection")}>전체보기 <Icon name="arrow" size={14} /></button>} />
        <div className="review-list">{pending.map(record => <button className="review-item" key={record.id} onClick={() => onNavigate("collection")}><div className={`source-icon ${record.scope === "Scope 1" ? "green" : "blue"}`}><Icon name={record.scope === "Scope 1" ? "droplet" : "bolt"} size={18} /></div><div><strong>{record.category} · {record.source}</strong><span>{record.company} / {record.site}</span></div><em>{formatNumber(record.emissions, 1)} t</em><Icon name="chevron" size={16} /></button>)}</div>
      </article>
    </section>
  </>;
}

function KpiCard({ label, value, unit, trend, trendType, icon, tone, progress }: { label: string; value: string; unit: string; trend: string; trendType: string; icon: IconName; tone: string; progress?: number }) {
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon} /></div><div className="kpi-label">{label}</div><div className="kpi-value"><strong>{value}</strong><span>{unit}</span></div>{progress !== undefined && <div className="mini-progress"><span style={{ width: `${progress}%` }} /></div>}<div className={`kpi-trend ${trendType}`}>{trendType === "good" && "↓"}{trendType === "warn" && "!"} {trend}</div></article>;
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <div className="card-action">{action}</div>}</div>;
}

function ScopeRow({ label, value, color, percent }: { label: string; value: number; color: string; percent: number }) {
  return <div className="scope-row"><span><i className={color} />{label}</span><strong>{formatNumber(value, 1)}<small> t</small></strong><em>{percent}%</em></div>;
}

function ProgressRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="progress-row"><div><strong>{label}</strong><span>{detail}개 항목</span><em>{value}%</em></div><div className="progress-track"><span style={{ width: `${value}%` }} /></div></div>;
}

function Collection({ records, onNew, onEdit, showToast, persist }: { records: ActivityRecord[]; onNew: () => void; onEdit: (record: ActivityRecord) => void; showToast: (message: string) => void; persist: (records: ActivityRecord[]) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("전체");
  const [company, setCompany] = useState("전체 법인");
  const filtered = records.filter(r => (status === "전체" || r.status === status) && (company === "전체 법인" || r.company === company) && `${r.company} ${r.site} ${r.category} ${r.source} ${r.owner}`.toLowerCase().includes(search.toLowerCase()));

  const exportCsv = () => {
    const header = ["법인", "사업장", "귀속월", "Scope", "구분", "배출원", "사용량", "단위", "배출량(tCO2e)", "담당자", "상태"];
    const rows = filtered.map(r => [r.company, r.site, r.period, r.scope, r.category, r.source, r.usage, r.unit, r.emissions, r.owner, r.status]);
    const blob = new Blob(["\ufeff" + [header, ...rows].map(row => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "sems2_activity_data.csv"; a.click(); URL.revokeObjectURL(url); showToast("현재 조회 결과를 내려받았습니다.");
  };

  const updateStatus = (id: number, nextStatus: RecordStatus) => {
    persist(records.map(r => r.id === id ? { ...r, status: nextStatus, updatedAt: "방금 전" } : r));
    showToast(nextStatus === "확정" ? "자료를 검토·확정했습니다." : "자료를 제출했습니다.");
  };

  return <>
    <PageHeader eyebrow="DATA COLLECTION" title="ESG 데이터 수집" description="법인·사업장별 활동자료를 입력하고 증빙과 검토 상태를 관리합니다."><button className="secondary-button" onClick={exportCsv}><Icon name="download" size={17} />Excel 내보내기</button><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />신규 자료 입력</button></PageHeader>
    <section className="collection-summary"><SummaryTile label="전체 항목" value={records.length} suffix="건" icon="database" /><SummaryTile label="검토 대기" value={records.filter(r => r.status === "검토대기").length} suffix="건" icon="clock" tone="amber" /><SummaryTile label="반려" value={records.filter(r => r.status === "반려").length} suffix="건" icon="alert" tone="red" /><SummaryTile label="확정 완료" value={records.filter(r => r.status === "확정").length} suffix="건" icon="check" tone="green" /></section>
    <section className="card data-card">
      <div className="data-toolbar"><div className="status-tabs">{["전체", "작성중", "검토대기", "반려", "확정"].map(item => <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{item}{item !== "전체" && <span>{records.filter(r => r.status === item).length}</span>}</button>)}</div><div className="filter-actions"><div className="search-box"><Icon name="search" size={17} /><input placeholder="배출원, 담당자 검색" value={search} onChange={e => setSearch(e.target.value)} /></div><select value={company} onChange={e => setCompany(e.target.value)}><option>전체 법인</option><option>세원정공</option><option>세원물산</option><option>세원테크</option><option>세원E&I</option></select></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>귀속월</th><th>법인 / 사업장</th><th>Scope</th><th>구분 / 배출원</th><th className="align-right">사용량</th><th className="align-right">배출량</th><th>증빙</th><th>담당자</th><th>상태</th><th /></tr></thead><tbody>{filtered.map(record => <tr key={record.id} onClick={() => onEdit(record)}><td className="mono">{record.period}</td><td><strong>{record.company}</strong><span>{record.site}</span></td><td><span className={`scope-tag s${record.scope.slice(-1)}`}>{record.scope}</span></td><td><strong>{record.category}</strong><span>{record.source}</span></td><td className="align-right"><strong>{formatNumber(record.usage, record.usage < 100 ? 1 : 0)}</strong><span>{record.unit}</span></td><td className="align-right"><strong>{formatNumber(record.emissions, 2)}</strong><span>tCO₂e</span></td><td>{record.evidence ? <span className="file-linked"><Icon name="file" size={15} />연결</span> : <span className="file-missing">미연결</span>}</td><td><strong>{record.owner}</strong><span>{record.department}</span></td><td><StatusBadge status={record.status} /></td><td><div className="row-actions" onClick={e => e.stopPropagation()}>{record.status === "작성중" && <button onClick={() => updateStatus(record.id, "검토대기")}>제출</button>}{record.status === "검토대기" && <button className="confirm" onClick={() => updateStatus(record.id, "확정")}>확정</button>}<button className="more-button" onClick={() => onEdit(record)}><Icon name="more" size={17} /></button></div></td></tr>)}</tbody></table></div>
      <div className="table-footer"><span>총 {filtered.length}건</span><div className="pagination"><button disabled>‹</button><button className="active">1</button><button disabled>›</button></div></div>
    </section>
  </>;
}

function SummaryTile({ label, value, suffix, icon, tone = "blue" }: { label: string; value: number; suffix: string; icon: IconName; tone?: string }) {
  return <div className="summary-tile"><div className={`summary-icon ${tone}`}><Icon name={icon} size={19} /></div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>;
}

function Inventory({ records, total }: { records: ActivityRecord[]; total: number }) {
  const byCompany = ["세원정공", "세원물산", "세원테크", "세원E&I"].map(name => ({ name, value: records.filter(r => r.company === name).reduce((s, r) => s + r.emissions, 0) }));
  const max = Math.max(...byCompany.map(x => x.value));
  return <>
    <PageHeader eyebrow="GHG INVENTORY" title="온실가스 인벤토리" description="활동자료와 배출계수를 연결해 Scope별 배출량을 산정하고 추적합니다."><button className="secondary-button"><Icon name="download" size={17} />산정 내역 다운로드</button></PageHeader>
    <section className="inventory-hero"><div><span>2026년 누적 온실가스 배출량</span><div className="inventory-total"><strong>{formatNumber(total, 1)}</strong><em>tCO₂e</em></div><p><b>↓ 4.8%</b> 전년 동기 2,074.6 tCO₂e</p></div><div className="target-block"><div className="target-copy"><span>2030 감축목표 진행률</span><strong>32.1%</strong></div><div className="target-track"><span style={{ width: "32.1%" }} /><i style={{ left: "72%" }} /></div><div className="target-labels"><span>기준연도 2023</span><span>2030 목표 -15%</span></div></div></section>
    <section className="inventory-grid"><article className="card"><CardHeader title="Scope별 인벤토리" subtitle="확정 및 검토 중 자료 포함" /><div className="inventory-scope-list"><InventoryScope number="01" label="Scope 1" desc="고정연소 · 이동연소 · 비산배출" value={records.filter(r => r.scope === "Scope 1").reduce((s,r) => s+r.emissions, 0)} color="dark" /><InventoryScope number="02" label="Scope 2" desc="구매 전력 · 구매 열·스팀" value={records.filter(r => r.scope === "Scope 2").reduce((s,r) => s+r.emissions, 0)} color="mid" /><InventoryScope number="03" label="Scope 3" desc="공급망 · 통근 · 출장 · 폐기물" value={records.filter(r => r.scope === "Scope 3").reduce((s,r) => s+r.emissions, 0)} color="light" /></div></article><article className="card"><CardHeader title="법인별 배출량" subtitle="2026년 누적 기준" action="단위: tCO₂e" /><div className="horizontal-bars">{byCompany.map(item => <div key={item.name}><div><strong>{item.name}</strong><span>{formatNumber(item.value, 1)}</span></div><p><span style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} /></p></div>)}</div></article></section>
    <section className="card formula-card"><CardHeader title="배출량 산정 구조" subtitle="원천자료부터 확정 데이터까지의 연결 관계" /><div className="formula-flow"><div><span className="flow-number">1</span><strong>활동자료</strong><small>전력·연료·냉매 사용량</small></div><Icon name="arrow" /><div><span className="flow-number">2</span><strong>배출계수</strong><small>연도·배출원별 자동 적용</small></div><Icon name="arrow" /><div><span className="flow-number">3</span><strong>배출량 산정</strong><small>사용량 × 계수 ÷ 1,000</small></div><Icon name="arrow" /><div className="highlight"><span className="flow-number">4</span><strong>검토·확정</strong><small>증빙 연결 및 이력 보관</small></div></div></section>
  </>;
}

function InventoryScope({ number, label, desc, value, color }: { number: string; label: string; desc: string; value: number; color: string }) {
  return <div className="inventory-scope"><span className={`scope-number ${color}`}>{number}</span><div><strong>{label}</strong><p>{desc}</p></div><em>{formatNumber(value, 1)}<small> tCO₂e</small></em><Icon name="chevron" size={17} /></div>;
}

function Evidence({ showToast }: { showToast: (message: string) => void }) {
  return <>
    <PageHeader eyebrow="EVIDENCE MANAGEMENT" title="ESG 증빙자료" description="ESG 평가와 공시에 필요한 증빙을 주기별로 요청하고 수집 현황을 관리합니다."><button className="secondary-button"><Icon name="download" size={17} />목록 내보내기</button><button className="primary-button" onClick={() => showToast("증빙 요청을 발송했습니다. (데모)")}><Icon name="upload" size={17} />증빙 요청</button></PageHeader>
    <section className="evidence-overview"><div className="evidence-score"><div className="radial-score"><strong>87</strong><span>%</span></div><div><span>7월 증빙 수집률</span><strong>58 / 67건 수집 완료</strong><p>마감까지 8일 남았습니다.</p></div></div><div className="evidence-stats"><div><span>정상 수집</span><strong>58</strong></div><div><span>미제출</span><strong>7</strong></div><div><span>보완 요청</span><strong>2</strong></div><div><span>마감 초과</span><strong className="danger">0</strong></div></div></section>
    <section className="card evidence-card"><div className="data-toolbar"><div className="status-tabs"><button className="active">전체 <span>5</span></button><button>수집중 <span>3</span></button><button>완료 <span>2</span></button></div><div className="search-box"><Icon name="search" size={17} /><input placeholder="증빙자료 검색" /></div></div><div className="evidence-list">{evidenceItems.map((item, index) => <div className="evidence-row" key={item.title}><div className={`doc-icon c${index % 3}`}><Icon name="file" /></div><div className="evidence-main"><div><span className="category-label">{item.category}</span><strong>{item.title}</strong></div><p><span>수집 주기 <b>{item.period}</b></span><span>담당 <b>{item.owner}</b></span><span>마감 <b>{item.due}</b></span></p></div><div className="evidence-progress"><div><strong>{item.received}</strong> / {item.total}건 <em>{Math.round(item.received/item.total*100)}%</em></div><div className="progress-track"><span style={{ width: `${item.received/item.total*100}%` }} /></div></div><StatusBadge status={item.status} /><button className="more-button"><Icon name="more" /></button></div>)}</div></section>
  </>;
}

function Indicators({ showToast }: { showToast: (message: string) => void }) {
  return <>
    <PageHeader eyebrow="ESG METRICS" title="ESG 지표 관리" description="평가·공시에서 공통 활용할 ESG 정량지표와 담당 체계를 관리합니다."><button className="primary-button" onClick={() => showToast("새 지표 등록 화면은 다음 버전에 연결됩니다.")}><Icon name="plus" size={17} />지표 등록</button></PageHeader>
    <section className="pillar-grid"><PillarCard code="E" title="환경" count={18} color="green" progress={89} /><PillarCard code="S" title="사회" count={24} color="blue" progress={94} /><PillarCard code="G" title="지배구조" count={12} color="violet" progress={100} /></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs"><button className="active">전체 <span>54</span></button><button>환경 <span>18</span></button><button>사회 <span>24</span></button><button>지배구조 <span>12</span></button></div><div className="search-box"><Icon name="search" size={17} /><input placeholder="지표명 또는 코드 검색" /></div></div><div className="table-scroll"><table className="data-table indicator-table"><thead><tr><th>지표 코드</th><th>구분</th><th>지표명</th><th>단위</th><th>수집 주기</th><th>담당 부서</th><th>수집률</th><th /></tr></thead><tbody>{indicatorRows.map(row => <tr key={row.code}><td><strong className="indicator-code">{row.code}</strong></td><td><span className={`pillar-tag ${row.category === "환경" ? "e" : row.category === "사회" ? "s" : "g"}`}>{row.category}</span></td><td><strong>{row.name}</strong></td><td>{row.unit}</td><td>{row.cycle}</td><td>{row.owner}</td><td><div className="inline-progress"><span><i style={{ width: `${row.progress}%` }} /></span><strong>{row.progress}%</strong></div></td><td><button className="more-button"><Icon name="more" /></button></td></tr>)}</tbody></table></div></section>
  </>;
}

function PillarCard({ code, title, count, color, progress }: { code: string; title: string; count: number; color: string; progress: number }) {
  return <article className={`pillar-card ${color}`}><div className="pillar-letter">{code}</div><div><span>{title} 지표</span><strong>{count}<small>개 지표</small></strong><p>이번 수집률 <b>{progress}%</b></p></div><div className="pillar-progress" style={{ background: `conic-gradient(currentColor ${progress}%, #edf1f0 0)` }}><span /></div></article>;
}

function Settings({ showToast }: { showToast: (message: string) => void }) {
  return <>
    <PageHeader eyebrow="SYSTEM SETTINGS" title="시스템 설정" description="조직, 산정 기준, 알림 등 SEMS 운영에 필요한 기준정보를 관리합니다." />
    <div className="settings-layout"><aside className="settings-nav"><button className="active"><Icon name="building" size={18} />조직·사업장</button><button><Icon name="leaf" size={18} />배출계수</button><button><Icon name="list" size={18} />수집 기준</button><button><Icon name="bell" size={18} />알림 설정</button><button><Icon name="settings" size={18} />권한 관리</button></aside><section className="card settings-content"><CardHeader title="배출계수 관리" subtitle="온실가스 배출량 산정에 적용되는 기준 계수입니다." action={<button className="outline-small" onClick={() => showToast("배출계수 추가 기능은 다음 버전에 연결됩니다.")}><Icon name="plus" size={15} />계수 추가</button>} /><div className="factor-notice"><Icon name="alert" size={18} /><p><strong>적용 연도별 배출계수를 확인하세요.</strong><br/>확정된 활동자료의 계수를 변경해도 기존 산정값은 자동 변경되지 않습니다.</p></div><div className="table-scroll"><table className="data-table factor-table"><thead><tr><th>배출원</th><th>배출계수</th><th>단위</th><th>적용 연도</th><th>출처</th><th>상태</th><th /></tr></thead><tbody>{factors.map(row => <tr key={row.source}><td><strong>{row.source}</strong></td><td className="mono"><strong>{row.value}</strong></td><td>{row.unit}</td><td>{row.year}</td><td>{row.authority}</td><td><span className="active-label">사용 중</span></td><td><button className="more-button"><Icon name="more" /></button></td></tr>)}</tbody></table></div><div className="settings-footer"><span>최근 수정: 2026.01.02 · 기획팀</span><button className="primary-button" onClick={() => showToast("설정을 저장했습니다.")}>변경사항 저장</button></div></section></div>
  </>;
}

function RecordModal({ record, onClose, onSave }: { record: ActivityRecord | null; onClose: () => void; onSave: (record: ActivityRecord) => void }) {
  const [form, setForm] = useState<ActivityRecord>(record ?? { id: 0, company: "세원정공", site: "대구공장", period: "2026-07", scope: "Scope 2", category: "구매 전력", source: "한국전력", usage: 0, unit: "kWh", factor: 0.45941, emissions: 0, owner: "문경섭", department: "기획팀", status: "작성중", evidence: "", updatedAt: "방금 전" });
  const update = (patch: Partial<ActivityRecord>) => setForm(current => ({ ...current, ...patch }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.usage) return; onSave({ ...form, emissions: Math.round((form.usage * form.factor / 1000) * 100) / 100, updatedAt: "방금 전" }); };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="record-modal" role="dialog" aria-modal="true" aria-labelledby="record-title"><div className="modal-header"><div><span>ACTIVITY DATA</span><h2 id="record-title">{record ? "활동자료 수정" : "신규 활동자료 입력"}</h2><p>원천 사용량과 증빙을 등록하면 배출량이 자동 산정됩니다.</p></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div><form onSubmit={submit}><div className="form-section"><h3><span>1</span>기본 정보</h3><div className="form-grid"><label>법인<select value={form.company} onChange={e => update({ company: e.target.value })}><option>세원정공</option><option>세원물산</option><option>세원테크</option><option>세원E&I</option></select></label><label>사업장<select value={form.site} onChange={e => update({ site: e.target.value })}><option>대구공장</option><option>경산공장</option><option>영천공장</option></select></label><label>귀속월<input type="month" value={form.period} onChange={e => update({ period: e.target.value })} required /></label><label>Scope<select value={form.scope} onChange={e => update({ scope: e.target.value as ActivityRecord["scope"] })}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label></div></div><div className="form-section"><h3><span>2</span>활동자료 및 산정</h3><div className="form-grid"><label>활동자료 구분<select value={form.category} onChange={e => update({ category: e.target.value })}><option>구매 전력</option><option>고정연소</option><option>이동연소</option><option>비산배출</option><option>임직원 통근</option></select></label><label>배출원<input value={form.source} onChange={e => update({ source: e.target.value })} required /></label><label>사용량<div className="input-unit"><input type="number" min="0" step="any" value={form.usage || ""} onChange={e => update({ usage: Number(e.target.value) })} required /><span>{form.unit}</span></div></label><label>단위<select value={form.unit} onChange={e => update({ unit: e.target.value })}><option>kWh</option><option>Nm³</option><option>L</option><option>kg</option><option>km</option></select></label><label>배출계수<input type="number" step="any" value={form.factor} onChange={e => update({ factor: Number(e.target.value) })} /></label><div className="calculated-field"><span>예상 배출량</span><strong>{formatNumber(form.usage * form.factor / 1000, 2)} <small>tCO₂e</small></strong><em>사용량 × 배출계수 ÷ 1,000</em></div></div></div><div className="form-section"><h3><span>3</span>증빙 및 담당자</h3><label className="upload-zone"><input type="file" onChange={e => update({ evidence: e.target.files?.[0]?.name ?? "" })} /><span className="upload-icon"><Icon name="upload" /></span>{form.evidence ? <><strong>{form.evidence}</strong><small>다른 파일을 선택하려면 클릭하세요.</small></> : <><strong>증빙자료를 끌어놓거나 클릭해 선택하세요.</strong><small>PDF, XLSX, JPG · 최대 20MB</small></>}</label><div className="form-grid two"><label>담당자<input value={form.owner} onChange={e => update({ owner: e.target.value })} /></label><label>담당 부서<input value={form.department} onChange={e => update({ department: e.target.value })} /></label></div></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={17} />{record ? "수정사항 저장" : "작성 중으로 저장"}</button></div></form></div></div>;
}
