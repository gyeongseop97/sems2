#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "app" / "page.tsx"
STYLES = ROOT / "app" / "globals.css"
TESTS = ROOT / "tests" / "rendered-html.test.mjs"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise RuntimeError(f"Could not find patch marker: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        if replacement.strip() in text:
            return text
        raise RuntimeError(f"Could not find start marker: {label}")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"Could not find end marker: {label}")
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


page = PAGE.read_text(encoding="utf-8")

page = replace_once(
    page,
    '''type IndicatorStatus = "미작성" | "작성중" | "제출" | "반려" | "승인";
type Indicator = {''',
    '''type IndicatorStatus = "미작성" | "작성중" | "제출" | "반려" | "승인";
type MetricInputTemplate = "GENERAL" | "WASTE" | "TRAINING" | "WATER" | "AIR" | "ENERGY" | "HEADCOUNT" | "SAFETY";
type MetricDetailRow = {
  id: string;
  values: Record<string, string | number>;
};
type Indicator = {''',
    "metric input template types",
)

page = replace_once(
    page,
    '''  dueDate: string;
  active: boolean;
};

type MetricRequestStatus''',
    '''  dueDate: string;
  active: boolean;
  inputTemplate?: MetricInputTemplate;
};

type MetricRequestStatus''',
    "indicator input template property",
)

page = replace_once(
    page,
    '''  description: string;
  status: MetricSubmissionStatus;
  rejectionReason?: string;''',
    '''  description: string;
  status: MetricSubmissionStatus;
  detailRows?: MetricDetailRow[];
  rejectionReason?: string;''',
    "metric submission detail rows",
)

page = replace_once(
    page,
    '''type TargetStatus = "초안" | "승인" | "종료";
type AnnualReductionTarget''',
    '''type TargetStatus = "초안" | "승인" | "종료";
type TargetAllocationMode = "균등 배분" | "수동 입력";
type AnnualReductionTarget''',
    "target allocation mode",
)

page = replace_once(
    page,
    '''  targetEmissions: number;
  owner: string;
  status: TargetStatus;''',
    '''  targetEmissions: number;
  scope1BaselineEmissions?: number;
  scope2BaselineEmissions?: number;
  allocationMode?: TargetAllocationMode;
  owner: string;
  status: TargetStatus;''',
    "split scope baselines",
)

page = replace_once(
    page,
    '''  { id: "periods", label: "수집 기간", icon: "calendar" },
''',
    "",
    "remove separate collection-period navigation",
)

page = replace_once(
    page,
    '''  { id: "metric-collection", label: "ESG 정량데이터 수집", icon: "database" },''',
    '''  { id: "metric-collection", label: "ESG 데이터 수집·기간", icon: "database" },''',
    "rename merged metric collection navigation",
)

page = replace_once(
    page,
    '''  {label:"데이터 수집·검증",items:["periods","collection","review","quality","evidence"]},''',
    '''  {label:"데이터 수집·검증",items:["collection","review","quality","evidence"]},''',
    "remove periods from nav groups",
)

page = replace_once(
    page,
    '''  const activeView = routeForbidden ? "dashboard" : requestedView;''',
    '''  const activeView = routeForbidden ? "dashboard" : requestedView === "periods" ? "metric-collection" : requestedView;''',
    "redirect old periods route",
)

old_annual = '''function defaultAnnualTargets(baselineYear:number,targetYear:number,baselineEmissions:number,existing:AnnualReductionTarget[]=[],finalReductionRate=30){
  const duration=Math.max(1,targetYear-baselineYear);
  return Array.from({length:Math.max(0,targetYear-baselineYear)},(_,index)=>{
    const year=baselineYear+index+1;
    const found=existing.find(item=>item.year===year);
    if(found)return {year,projectedEmissions:Number(found.projectedEmissions)||0,targetReduction:Number(found.targetReduction)||0,targetEmissions:Number(found.targetEmissions)||0,reductionRate:Number(found.reductionRate)||0,expectedCost:Number(found.expectedCost)||0};
    const ratio=(index+1)/duration;
    const reductionRate=ratio*finalReductionRate;
    const targetEmissions=baselineEmissions*(1-reductionRate/100);
    return {year,projectedEmissions:baselineEmissions,targetReduction:baselineEmissions-targetEmissions,targetEmissions,reductionRate,expectedCost:0};
  });
}
function annualTargetsFor(target:ReductionTarget){
  return defaultAnnualTargets(target.baselineYear,target.targetYear,target.baselineEmissions,target.annualTargets??[],target.reductionRate);
}'''
new_annual = '''function defaultAnnualTargets(baselineYear:number,targetYear:number,baselineEmissions:number,existing:AnnualReductionTarget[]=[],finalReductionRate=30,allocationMode:TargetAllocationMode="균등 배분"){
  const duration=Math.max(1,targetYear-baselineYear);
  return Array.from({length:Math.max(0,targetYear-baselineYear)},(_,index)=>{
    const year=baselineYear+index+1;
    const found=existing.find(item=>item.year===year);
    const equalRate=((index+1)/duration)*finalReductionRate;
    const manualRate=Number(found?.reductionRate)||0;
    const reductionRate=Math.max(0,Math.min(99.9,allocationMode==="수동 입력"&&found?manualRate:equalRate));
    const targetEmissions=baselineEmissions*(1-reductionRate/100);
    return {
      year,
      projectedEmissions:Number(found?.projectedEmissions)||baselineEmissions,
      targetReduction:Math.max(0,baselineEmissions-targetEmissions),
      targetEmissions,
      reductionRate,
      expectedCost:Number(found?.expectedCost)||0,
    };
  });
}
function annualTargetsFor(target:ReductionTarget){
  return defaultAnnualTargets(target.baselineYear,target.targetYear,target.baselineEmissions,target.annualTargets??[],target.reductionRate,target.allocationMode??"균등 배분");
}'''
page = replace_once(page, old_annual, new_annual, "annual reduction allocation")

target_form = r'''function TargetForm({target,records,organizationNames,linkedPlans,onClose,onSave,onDelete}:{target:ReductionTarget|null;records:ActivityRecord[];organizationNames:string[];linkedPlans:number;onClose:()=>void;onSave:(target:ReductionTarget)=>void;onDelete?:()=>void}){
  const confirmedYears=[...new Set(records.filter(record=>record.status==="확정"&&record.active!==false).map(record=>Number(record.period.slice(0,4))))].sort((a,b)=>b-a);
  const firstYear=confirmedYears[0]??new Date().getFullYear();
  const scope1FromInventory=targetInventory(records,"그룹 전체",["Scope 1"],firstYear);
  const scope2FromInventory=targetInventory(records,"그룹 전체",["Scope 2"],firstYear);
  const [form,setForm]=useState<ReductionTarget>(()=>{
    const targetScope1=target?.scope1BaselineEmissions??targetInventory(records,target?.company??"그룹 전체",["Scope 1"],target?.baselineYear??firstYear);
    const inventoryScope2=targetInventory(records,target?.company??"그룹 전체",["Scope 2"],target?.baselineYear??firstYear);
    const targetScope2=target?.scope2BaselineEmissions??(inventoryScope2||Math.max((target?.baselineEmissions??0)-targetScope1,0));
    const initial=target??{
      id:"NEW-TARGET",
      name:"",
      company:"그룹 전체",
      scopes:["Scope 1","Scope 2"] as Scope[],
      baselineYear:firstYear,
      baselineEmissions:scope1FromInventory+scope2FromInventory,
      scope1BaselineEmissions:scope1FromInventory,
      scope2BaselineEmissions:scope2FromInventory,
      targetYear:firstYear+5,
      reductionRate:30,
      targetEmissions:(scope1FromInventory+scope2FromInventory)*.7,
      allocationMode:"균등 배분" as TargetAllocationMode,
      owner:"기획팀",
      status:"초안" as TargetStatus,
      description:"",
      updatedAt:"방금 전",
    };
    const scope1=initial.scope1BaselineEmissions??targetScope1;
    const scope2=initial.scope2BaselineEmissions??targetScope2;
    const baseline=scope1+scope2||initial.baselineEmissions;
    const allocationMode=initial.allocationMode??"균등 배분";
    return {
      ...initial,
      scopes:initial.scopes.filter(scope=>scope==="Scope 1"||scope==="Scope 2"),
      scope1BaselineEmissions:scope1,
      scope2BaselineEmissions:scope2,
      baselineEmissions:baseline,
      allocationMode,
      annualTargets:defaultAnnualTargets(initial.baselineYear,initial.targetYear,baseline,initial.annualTargets??[],initial.reductionRate,allocationMode),
    };
  });
  const [error,setError]=useState("");
  const patch=(next:Partial<ReductionTarget>)=>{
    setForm(current=>{
      const merged={...current,...next};
      const baseline=(merged.scope1BaselineEmissions??0)+(merged.scope2BaselineEmissions??0);
      const allocationMode=merged.allocationMode??"균등 배분";
      const rows=defaultAnnualTargets(
        merged.baselineYear,
        merged.targetYear,
        baseline,
        next.allocationMode==="균등 배분"?[]:next.annualTargets??current.annualTargets??[],
        merged.reductionRate,
        allocationMode,
      );
      const final=rows.at(-1);
      return {...merged,baselineEmissions:baseline,allocationMode,annualTargets:rows,targetEmissions:final?.targetEmissions??0};
    });
    setError("");
  };
  const toggleScope=(scope:Scope)=>{
    const scopes=form.scopes.includes(scope)?form.scopes.filter(item=>item!==scope):[...form.scopes,scope];
    patch({
      scopes,
      ...(scope==="Scope 1"&&!scopes.includes(scope)?{scope1BaselineEmissions:0}:{}),
      ...(scope==="Scope 2"&&!scopes.includes(scope)?{scope2BaselineEmissions:0}:{}),
    });
  };
  const loadInventory=()=>{
    const scope1=form.scopes.includes("Scope 1")?targetInventory(records,form.company,["Scope 1"],form.baselineYear):0;
    const scope2=form.scopes.includes("Scope 2")?targetInventory(records,form.company,["Scope 2"],form.baselineYear):0;
    if(scope1+scope2<=0){setError(`${form.baselineYear}년 확정 Scope 1·2 인벤토리 실적이 없습니다. 기준값을 직접 입력해 주세요.`);return;}
    patch({scope1BaselineEmissions:scope1,scope2BaselineEmissions:scope2});
  };
  const patchAnnualRate=(year:number,value:number)=>{
    const annualTargets=defaultAnnualTargets(form.baselineYear,form.targetYear,form.baselineEmissions,form.annualTargets??[],form.reductionRate,"수동 입력").map(row=>row.year===year?{...row,reductionRate:Math.max(0,Math.min(99.9,value))}:row);
    patch({annualTargets});
  };
  const patchExpectedCost=(year:number,value:number)=>{
    const annualTargets=defaultAnnualTargets(form.baselineYear,form.targetYear,form.baselineEmissions,form.annualTargets??[],form.reductionRate,form.allocationMode??"균등 배분").map(row=>row.year===year?{...row,expectedCost:value}:row);
    patch({annualTargets});
  };
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    const annualTargets=defaultAnnualTargets(form.baselineYear,form.targetYear,form.baselineEmissions,form.annualTargets??[],form.reductionRate,form.allocationMode??"균등 배분").sort((a,b)=>a.year-b.year);
    const final=annualTargets.at(-1);
    if(!form.scopes.length){setError("대상 Scope를 한 개 이상 선택해 주세요.");return;}
    if(form.baselineEmissions<=0){setError("Scope 1·2 기준연도 배출량을 입력해 주세요.");return;}
    if(form.targetYear<=form.baselineYear){setError("목표연도는 기준연도보다 뒤여야 합니다.");return;}
    if(form.reductionRate<=0||form.reductionRate>=100){setError("최종 감축률은 0% 초과 100% 미만으로 입력해 주세요.");return;}
    if(!final){setError("연도별 목표 경로를 확인해 주세요.");return;}
    if((form.allocationMode??"균등 배분")==="수동 입력"&&annualTargets.some((row,index)=>index>0&&row.reductionRate<annualTargets[index-1].reductionRate)){setError("수동 입력 감축률은 이전 연도보다 낮을 수 없습니다.");return;}
    onSave({...form,annualTargets,targetEmissions:final.targetEmissions,reductionRate:form.reductionRate});
  };
  const annualTargets=defaultAnnualTargets(form.baselineYear,form.targetYear,form.baselineEmissions,form.annualTargets??[],form.reductionRate,form.allocationMode??"균등 배분");
  const finalAnnual=annualTargets.at(-1);
  const totalExpectedCost=annualTargets.reduce((sum,row)=>sum+row.expectedCost,0);
  return <Overlay title={target?"감축목표 수정":"새 감축목표 설정"} eyebrow="REDUCTION TARGET" description="Scope 1·2 기준연도 배출량과 최종 감축률을 입력하면 연도별 목표 경로를 자동 계산합니다." onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>목표 범위</h3><div className="form-grid"><label className="full-span">목표명<input value={form.name} onChange={event=>patch({name:event.target.value})} placeholder="예: 그룹 Scope 1·2 2030 감축목표" required/></label><label>대상 조직<select value={form.company} onChange={event=>patch({company:event.target.value})}><option>그룹 전체</option>{organizationNames.map(company=><option key={company}>{company}</option>)}</select></label><label>목표 담당부서<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label></div><div className="check-group"><strong>대상 Scope</strong><div>{(["Scope 1","Scope 2"] as Scope[]).map(scope=><label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={()=>toggleScope(scope)}/>{scope}</label>)}</div></div></div>
    <div className="form-section"><h3><span>2</span>기준연도와 최종목표</h3><div className="form-grid target-baseline-grid"><label>기준연도<input type="number" min="1990" max="2050" value={form.baselineYear} onChange={event=>patch({baselineYear:Number(event.target.value)})} required/></label><label>목표연도<input type="number" min={form.baselineYear+1} max={2050} value={form.targetYear} onChange={event=>patch({targetYear:Number(event.target.value)})} required/></label><label>Scope 1 기준연도 배출량<div className="input-unit"><input type="number" min="0" step="0.1" value={form.scope1BaselineEmissions||""} disabled={!form.scopes.includes("Scope 1")} onChange={event=>patch({scope1BaselineEmissions:Number(event.target.value)})}/><span>tCO₂e</span></div></label><label>Scope 2 기준연도 배출량<div className="input-unit"><input type="number" min="0" step="0.1" value={form.scope2BaselineEmissions||""} disabled={!form.scopes.includes("Scope 2")} onChange={event=>patch({scope2BaselineEmissions:Number(event.target.value)})}/><span>tCO₂e</span></div></label><label>최종 감축률<div className="input-unit"><input type="number" min="0.1" max="99.9" step="0.1" value={form.reductionRate||""} onChange={event=>patch({reductionRate:Number(event.target.value)})} required/><span>%</span></div></label><div className="calculated-field"><span>기준연도 총배출량</span><strong>{formatNumber(form.baselineEmissions,1)} <small>tCO₂e</small></strong><em>Scope 1 + Scope 2 자동 합산</em></div><div className="calculated-field reduction"><span>최종 목표배출량</span><strong>{formatNumber(finalAnnual?.targetEmissions??0,1)} <small>tCO₂e</small></strong><em>{form.targetYear}년 · {formatNumber(form.reductionRate,1)}% 감축</em></div><div className="calculated-field"><span>예상 감축비용 합계</span><strong>{formatNumber(totalExpectedCost,0)} <small>원</small></strong><em>연도별 예상비용 합계</em></div></div><button type="button" className="outline-small baseline-load-button" onClick={loadInventory}><Icon name="refresh" size={14}/>Scope 1·2 확정 실적 불러오기</button></div>
    <div className="form-section"><h3><span>3</span>연도별 감축경로</h3><p className="form-section-guide">균등 배분은 최종 감축률까지 매년 같은 폭으로 배분하고, 수동 입력은 연도별 감축률을 직접 조정합니다.</p><div className="target-allocation-toggle">{(["균등 배분","수동 입력"] as TargetAllocationMode[]).map(mode=><button type="button" key={mode} className={(form.allocationMode??"균등 배분")===mode?"active":""} onClick={()=>patch({allocationMode:mode})}><Icon name={mode==="균등 배분"?"chart":"edit"} size={16}/><span><strong>{mode}</strong><small>{mode==="균등 배분"?"최종 감축률까지 자동 계산":"연도별 감축률 직접 입력"}</small></span></button>)}</div><div className="annual-input-scroll"><table className="annual-input-table"><thead><tr><th>연도</th><th>연도별 감축률</th><th>목표 감축량</th><th>목표 배출량</th><th>예상비용</th></tr></thead><tbody>{annualTargets.map(row=><tr key={row.year}><td><strong>{row.year}</strong></td><td><div className="input-unit compact"><input aria-label={`${row.year}년 감축률`} type="number" min="0" max="99.9" step="0.1" value={formatNumber(row.reductionRate,1)} readOnly={(form.allocationMode??"균등 배분")==="균등 배분"} onChange={event=>patchAnnualRate(row.year,Number(event.target.value))}/><span>%</span></div></td><td><strong>{formatNumber(row.targetReduction,1)}</strong><span>tCO₂e</span></td><td><strong>{formatNumber(row.targetEmissions,1)}</strong><span>tCO₂e</span></td><td><input aria-label={`${row.year}년 예상비용`} type="number" min="0" step="10000" value={row.expectedCost||""} onChange={event=>patchExpectedCost(row.year,Number(event.target.value))}/><span>원</span></td></tr>)}</tbody></table></div></div>
    <div className="form-section"><h3><span>4</span>운영 근거</h3><label className="textarea-label">목표 설명·산정 근거<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder="목표 경계, 적용 기준, 제외 범위와 감축계획 시트의 파일명·버전을 적어 주세요." required/></label><div className="target-form-note"><Icon name="alert" size={16}/><span>{form.status==="승인"?"승인된 목표 또는 연도별 수치를 변경하면 초안으로 전환되어 변경 이력에 남습니다.":"저장 후 목표 목록에서 승인해야 공식 이행목표로 집계됩니다."}</span></div>{linkedPlans>0&&<div className="target-form-note linked"><Icon name="list" size={16}/><span>이 목표에 {linkedPlans}개의 이행계획이 연결되어 있습니다. 목표 범위를 바꾸면 과제 범위도 함께 확인해 주세요.</span></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>목표 저장</button></div></div>
  </form></Overlay>;
}'''
page = replace_between(page, "function TargetForm(", "function PlanForm(", target_form, "target form")

indicator_form = r'''function IndicatorForm({item,onClose,onSave,onDelete}:{item:Indicator|null;onClose:()=>void;onSave:(item:Indicator)=>void;onDelete?:()=>void}){
  const initial=item??{id:0,code:"",name:"",category:"환경",unit:"",cycle:"월",aggregation:"합계" as const,owner:"",reviewer:"",progress:0,status:"미작성" as IndicatorStatus,definition:"",boundary:"",formula:"",dataSource:"",evidenceExample:"",frameworks:[],dueDate:"",active:true,inputTemplate:"GENERAL" as MetricInputTemplate};
  const [form,setForm]=useState<Indicator>({...initial,inputTemplate:initial.inputTemplate??inferMetricInputTemplate(initial)});
  const patch=(value:Partial<Indicator>)=>setForm(current=>({...current,...value}));
  return <Overlay title={item?"ESG 지표 정의서 수정":"ESG 지표 정의서 등록"} eyebrow="METRIC MASTER" description="담당자가 바뀌어도 동일한 기준으로 수집·검토할 수 있도록 정의와 운영 규칙, 지표별 입력 양식을 등록합니다." onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSave(form)}}>
    <div className="form-section"><h3><span>1</span>지표 기본정보</h3><div className="form-grid"><label>지표 코드<input value={form.code} onChange={event=>patch({code:event.target.value.toUpperCase()})} required/></label><label>구분<select value={form.category} onChange={event=>patch({category:event.target.value as Indicator["category"]})}><option>환경</option><option>사회</option><option>지배구조</option></select></label><label className="full-span">지표명<input value={form.name} onChange={event=>patch({name:event.target.value})} required/></label><label className="full-span textarea-label">지표 정의<textarea value={form.definition} onChange={event=>patch({definition:event.target.value})} placeholder="무엇을 측정하는 지표인지 명확히 적어 주세요." required/></label><label className="full-span textarea-label">포함·제외 범위<textarea value={form.boundary} onChange={event=>patch({boundary:event.target.value})} placeholder="포함 조직·사업장·대상과 제외 조건을 적어 주세요." required/></label><label>단위<input value={form.unit} onChange={event=>patch({unit:event.target.value})} required/></label><label>수집 주기<select value={form.cycle} onChange={event=>patch({cycle:event.target.value})}><option>월</option><option>분기</option><option>반기</option><option>연</option><option>수시</option></select></label><label>수집 양식<select value={form.inputTemplate??"GENERAL"} onChange={event=>patch({inputTemplate:event.target.value as MetricInputTemplate})}>{Object.entries(METRIC_TEMPLATE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small className="field-help">지표 특성에 맞춰 상세 입력 항목과 자동 집계 방식을 선택합니다.</small></label><label>집계 방식<select value={form.aggregation??"합계"} onChange={event=>patch({aggregation:event.target.value as Indicator["aggregation"]})}><option>합계</option><option>평균</option><option>최종값</option></select></label><label className="full-span">산식<input value={form.formula} onChange={event=>patch({formula:event.target.value})} placeholder="예: Scope 1 + Scope 2 배출량" required/></label><label className="full-span">데이터 원천<input value={form.dataSource} onChange={event=>patch({dataSource:event.target.value})} placeholder="예: 전기요금서, SAP 구매내역, 안전보건 시스템" required/></label></div></div>
    <div className="form-section"><h3><span>2</span>담당·승인·제출</h3><div className="form-grid"><label>담당 부서·담당자<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>승인 부서·승인자<input value={form.reviewer} onChange={event=>patch({reviewer:event.target.value})} required/></label><label>제출 상태<select value={form.status} onChange={event=>patch({status:event.target.value as IndicatorStatus})}><option>미작성</option><option>작성중</option><option>제출</option><option>반려</option><option>승인</option></select></label><label>마감일<input type="date" value={form.dueDate} onChange={event=>patch({dueDate:event.target.value})}/></label><label>수집률 (%)<input type="number" min="0" max="100" value={form.progress} onChange={event=>patch({progress:Number(event.target.value)})}/></label><Toggle label="사용 중인 지표" checked={form.active} onChange={value=>patch({active:value})}/></div></div>
    <div className="form-section"><h3><span>3</span>증빙·평가 매핑</h3><div className="form-grid"><label className="full-span">필수 증빙 예시<input value={form.evidenceExample} onChange={event=>patch({evidenceExample:event.target.value})} placeholder="예: 월별 전기요금 고지서, 계량기 검침표"/></label><label className="full-span">연결 평가·공시기준<input value={form.frameworks.join(", ")} onChange={event=>patch({frameworks:event.target.value.split(",").map(value=>value.trim()).filter(Boolean)})} placeholder="예: CDP C6, EcoVadis 환경성과, GRI 305-1"/></label></div></div>
    <div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>정의서 저장</button></div></div>
  </form></Overlay>;
}'''
page = replace_between(page, "function IndicatorForm(", "const standardMetricIndicators", indicator_form, "indicator form")

metric_block = r'''type MetricTemplateField = {
  key:string;
  label:string;
  type:"text"|"number"|"select";
  options?:string[];
  aggregate?:boolean;
  readOnly?:boolean;
  placeholder?:string;
};
const METRIC_TEMPLATE_LABELS:Record<MetricInputTemplate,string>={
  GENERAL:"일반 수치",
  WASTE:"폐기물",
  TRAINING:"법정 의무교육",
  WATER:"용수",
  AIR:"대기오염",
  ENERGY:"에너지",
  HEADCOUNT:"인원",
  SAFETY:"안전",
};
const METRIC_TEMPLATE_FIELDS:Record<MetricInputTemplate,MetricTemplateField[]>={
  GENERAL:[],
  WASTE:[
    {key:"wasteClass",label:"폐기물 구분",type:"select",options:["일반폐기물","지정폐기물"]},
    {key:"wasteType",label:"폐기물 종류",type:"text",placeholder:"예: 폐합성수지, 폐유"},
    {key:"treatmentMethod",label:"처리방법",type:"select",options:["재활용","소각","매립","중간처리","기타"]},
    {key:"amount",label:"처리량",type:"number",aggregate:true},
  ],
  TRAINING:[
    {key:"educationType",label:"교육 종류",type:"select",options:["산업안전보건교육","성희롱 예방교육","개인정보 보호교육","장애인 인식개선교육","퇴직연금교육","직장 내 괴롭힘 예방교육","기타"]},
    {key:"courseName",label:"과정명",type:"text",placeholder:"교육 과정 또는 차수"},
    {key:"completionCount",label:"이수인원",type:"number"},
    {key:"hoursPerPerson",label:"1인당 교육시간",type:"number"},
    {key:"totalHours",label:"총 교육시간",type:"number",aggregate:true,readOnly:true},
  ],
  WATER:[
    {key:"waterType",label:"용수 구분",type:"select",options:["상수도","공업용수","지하수","재이용수","기타"]},
    {key:"source",label:"공급원·계량기",type:"text"},
    {key:"amount",label:"사용량",type:"number",aggregate:true},
  ],
  AIR:[
    {key:"pollutant",label:"오염물질",type:"select",options:["먼지","SOx","NOx","VOC","기타"]},
    {key:"facility",label:"배출시설",type:"text"},
    {key:"amount",label:"배출량",type:"number",aggregate:true},
  ],
  ENERGY:[
    {key:"energyType",label:"에너지원",type:"select",options:["전력","LNG","LPG","경유","휘발유","등유","스팀","재생에너지","기타"]},
    {key:"source",label:"사용처·계량기",type:"text"},
    {key:"amount",label:"사용량",type:"number",aggregate:true},
  ],
  HEADCOUNT:[
    {key:"employmentType",label:"고용 형태",type:"select",options:["관리직","생산직","정규직","비정규직","파견·도급","기타"]},
    {key:"gender",label:"성별",type:"select",options:["전체","남성","여성","기타·미분류"]},
    {key:"amount",label:"인원",type:"number",aggregate:true},
  ],
  SAFETY:[
    {key:"safetyType",label:"안전 지표",type:"select",options:["산업재해","아차사고","안전교육","위험성평가","개선조치","기타"]},
    {key:"detail",label:"유형·내용",type:"text"},
    {key:"amount",label:"건수·인원",type:"number",aggregate:true},
  ],
};
function inferMetricInputTemplate(indicator:Pick<Indicator,"code"|"name">):MetricInputTemplate{
  const key=`${indicator.code} ${indicator.name}`.toUpperCase();
  if(key.includes("WASTE")||key.includes("폐기물"))return "WASTE";
  if(key.includes("TRAIN")||key.includes("교육"))return "TRAINING";
  if(key.includes("WATER")||key.includes("용수")||key.includes("취수"))return "WATER";
  if(key.includes("AIR")||key.includes("대기오염"))return "AIR";
  if(key.includes("ENERGY")||key.includes("에너지")||key.includes("전력"))return "ENERGY";
  if(key.includes("HEAD")||key.includes("인원")||key.includes("임직원 수"))return "HEADCOUNT";
  if(key.includes("SAFETY")||key.includes("재해")||key.includes("안전"))return "SAFETY";
  return "GENERAL";
}
function metricTemplateOf(indicator:Indicator):MetricInputTemplate{
  return indicator.inputTemplate??inferMetricInputTemplate(indicator);
}
function createMetricDetailRow(template:MetricInputTemplate):MetricDetailRow{
  const values:Record<string,string|number>={};
  METRIC_TEMPLATE_FIELDS[template].forEach(field=>{values[field.key]=field.type==="number"?0:field.options?.[0]??"";});
  return {id:`MDR-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,values};
}
function calculateMetricDetailTotal(template:MetricInputTemplate,rows:MetricDetailRow[]):number{
  const aggregateKey=METRIC_TEMPLATE_FIELDS[template].find(field=>field.aggregate)?.key;
  if(!aggregateKey)return 0;
  return rows.reduce((sum,row)=>sum+(Number(row.values[aggregateKey])||0),0);
}

function MetricCollection({requests,submissions,indicators,organizations,canWrite,canManage,currentOrganization,defaultOwner,defaultDepartment,onRequestsChange,onSubmissionsChange,onIndicatorsChange,addAudit,showToast}:{requests:MetricRequest[];submissions:MetricSubmission[];indicators:Indicator[];organizations:Record<string,string[]>;canWrite:boolean;canManage:boolean;currentOrganization:string;defaultOwner:string;defaultDepartment:string;onRequestsChange:(items:MetricRequest[])=>void;onSubmissionsChange:(items:MetricSubmission[])=>void;onIndicatorsChange:(items:Indicator[])=>void;addAudit:(action:string,target:string,detail:string,actor?:string)=>void;showToast:(message:string)=>void}){
  const [workspaceTab,setWorkspaceTab]=useState<"collection"|"periods">("collection");
  const [selectedId,setSelectedId]=useState(requests.find(request=>request.status==="수집중")?.id??requests[0]?.id??"");
  const [requestModal,setRequestModal]=useState<MetricRequest|null|"new">(null);
  const [submissionModal,setSubmissionModal]=useState<{request:MetricRequest;indicator:Indicator;company:string;submission?:MetricSubmission}|null>(null);
  const selected=requests.find(request=>request.id===selectedId)??requests[0];
  const visibleCompanies=selected?.companies.filter(company=>canManage||!currentOrganization||company===currentOrganization)??[];
  const expectedRows=selected?visibleCompanies.flatMap(company=>selected.indicatorIds.map(indicatorId=>({company,indicator:indicators.find(indicator=>indicator.id===indicatorId),submission:submissions.find(item=>item.requestId===selected.id&&item.company===company&&item.indicatorId===indicatorId)}))).filter(row=>row.indicator):[];
  const selectedSubmissions=selected?submissions.filter(item=>item.requestId===selected.id):[];
  const completion=expectedRows.length?Math.round(expectedRows.filter(row=>row.submission?.status==="확정").length/expectedRows.length*100):0;
  const pending=selectedSubmissions.filter(item=>item.status==="검토대기").length;
  const activeCount=requests.filter(request=>request.status==="수집중"||request.status==="검토중").length;
  useEffect(()=>{if(selected&&!selectedId)setSelectedId(selected.id);},[selected,selectedId]);
  const saveRequest=(request:MetricRequest)=>{
    const exists=requests.some(item=>item.id===request.id);
    const saved={...request,id:exists?request.id:`MR-${Date.now()}`,updatedAt:nowLabel()};
    onRequestsChange(exists?requests.map(item=>item.id===saved.id?saved:item):[saved,...requests]);
    setSelectedId(saved.id);setRequestModal(null);setWorkspaceTab("collection");
    addAudit(exists?"정량데이터 수집 요청 수정":"정량데이터 수집 요청 생성",saved.title,`${saved.companies.length}개 법인, ${saved.indicatorIds.length}개 지표 · ${saved.periodFrom}~${saved.periodTo}`);
    showToast(exists?"수집 기간과 요청 설정을 수정했습니다.":"새 수집 기간과 요청을 개설했습니다.");
  };
  const deleteRequest=(request:MetricRequest)=>{
    if(!window.confirm("이 수집 요청과 연결된 제출 데이터를 모두 삭제하시겠습니까?"))return;
    onRequestsChange(requests.filter(item=>item.id!==request.id));onSubmissionsChange(submissions.filter(item=>item.requestId!==request.id));setRequestModal(null);setSelectedId("");
    addAudit("정량데이터 수집 요청 삭제",request.title,"수집 요청과 연결 제출값을 삭제했습니다.");showToast("수집 요청을 삭제했습니다.");
  };
  const addTemplates=()=>{
    const existingCodes=new Set(indicators.map(item=>item.code));
    const rows=standardMetricIndicators.filter(item=>!existingCodes.has(item.code)).map((item,index)=>({...item,id:Date.now()+index,inputTemplate:inferMetricInputTemplate(item)}));
    if(!rows.length){showToast("표준 환경·사회 정량지표가 이미 등록되어 있습니다.");return;}
    onIndicatorsChange([...indicators,...rows]);addAudit("표준 ESG 지표 추가","ESG 지표 정의서",`${rows.length}개 표준 지표와 맞춤 수집 양식을 추가했습니다.`);showToast(`${rows.length}개 표준 지표와 맞춤 양식을 추가했습니다.`);
  };
  const saveSubmission=(submission:MetricSubmission)=>{
    const exists=submissions.some(item=>item.id===submission.id);
    const saved={...submission,id:exists?submission.id:Date.now(),updatedAt:nowLabel()};
    onSubmissionsChange(exists?submissions.map(item=>item.id===saved.id?saved:item):[saved,...submissions]);setSubmissionModal(null);
    addAudit(exists?"정량데이터 수정":"정량데이터 입력",`${saved.company} · ${indicators.find(item=>item.id===saved.indicatorId)?.name??"ESG 지표"}`,`${saved.period} 값 ${formatNumber(saved.value,2)} ${saved.unit}을 ${saved.status} 상태로 저장했습니다.`);
    showToast(saved.status==="검토대기"?"기획실 검토 대기로 제출했습니다.":"정량데이터를 저장했습니다.");
  };
  const changeStatus=(submission:MetricSubmission,status:MetricSubmissionStatus)=>{
    let rejectionReason=submission.rejectionReason;
    if(status==="반려"){const reason=window.prompt("보완이 필요한 내용을 입력해 주세요.",submission.rejectionReason??"");if(reason===null)return;rejectionReason=reason.trim();}
    onSubmissionsChange(submissions.map(item=>item.id===submission.id?{...item,status,rejectionReason,updatedAt:nowLabel()}:item));
    addAudit(status==="확정"?"정량데이터 확정":"정량데이터 보완 요청",`${submission.company} · ${indicators.find(item=>item.id===submission.indicatorId)?.name??"ESG 지표"}`,status==="확정"?"제출값과 증빙을 검토해 확정했습니다.":`보완 요청: ${rejectionReason}`);
    showToast(status==="확정"?"정량데이터를 확정했습니다.":"입력 담당자에게 보완을 요청했습니다.");
  };
  const exportRows=()=>{
    if(!selected)return;
    downloadCsv("SEMS_ESG_metric_collection.csv",["수집요청","법인","사업장","기간","지표코드","지표명","수집양식","상세행","값","단위","담당자","부서","증빙","상태","설명"],expectedRows.map(row=>[selected.title,row.company,row.submission?.site??"",row.submission?.period??selected.periodTo,row.indicator?.code??"",row.indicator?.name??"",METRIC_TEMPLATE_LABELS[metricTemplateOf(row.indicator!)],row.submission?.detailRows?.length??0,row.submission?.value??"",row.indicator?.unit??"",row.submission?.owner??"",row.submission?.department??"",row.submission?.evidence??"",row.submission?.status??"미입력",row.submission?.description??""]));
    showToast("현재 수집 현황을 내려받았습니다.");
  };
  return <><PageHeader eyebrow="ESG DATA COLLECTION" title="ESG 정량데이터 수집·기간 설정" description="수집 기간과 대상 법인·지표를 한 화면에서 설정하고, 폐기물·법정 의무교육 등 지표 특성에 맞는 양식으로 상세 데이터를 수집합니다.">{canManage&&<button className="secondary-button" onClick={addTemplates}><Icon name="list" size={17}/>표준 지표·양식 추가</button>}{selected&&workspaceTab==="collection"&&<button className="secondary-button" onClick={exportRows}><Icon name="download" size={17}/>수집현황 내보내기</button>}{canManage&&<button className="primary-button" onClick={()=>setRequestModal("new")} disabled={!indicators.length}><Icon name="plus" size={17}/>수집 기간·요청 추가</button>}</PageHeader>
    <div className="metric-workspace-tabs"><button className={workspaceTab==="collection"?"active":""} onClick={()=>setWorkspaceTab("collection")}><Icon name="database" size={17}/><span><strong>수집 현황</strong><small>법인별 입력·검토·확정</small></span></button><button className={workspaceTab==="periods"?"active":""} onClick={()=>setWorkspaceTab("periods")}><Icon name="calendar" size={17}/><span><strong>기간·요청 설정</strong><small>수집 범위와 마감 관리</small></span></button></div>
    {workspaceTab==="periods"?<section className="card metric-period-card"><CardHeader title="수집 기간·요청" subtitle="별도 수집 기간 메뉴 없이 정량데이터 요청과 일정을 함께 관리합니다." action={canManage?<button className="outline-small" onClick={()=>setRequestModal("new")}><Icon name="plus" size={14}/>추가</button>:undefined}/><div className="table-scroll"><table className="data-table metric-period-table"><thead><tr><th>수집 요청</th><th>대상 기간</th><th>제출 마감</th><th>대상 범위</th><th>진행 상태</th><th>수정</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}><td><strong>{request.title}</strong><span>{request.description||"별도 안내 없음"}</span></td><td><strong>{request.periodFrom} ~ {request.periodTo}</strong><span>{request.indicatorIds.length}개 지표</span></td><td>{request.dueDate}</td><td><strong>{request.companies.length}개 법인</strong><span>{request.companies.slice(0,2).join(", ")}{request.companies.length>2?` 외 ${request.companies.length-2}개`:""}</span></td><td><StatusBadge status={request.status}/></td><td>{canManage&&<button className="outline-small" onClick={()=>setRequestModal(request)}><Icon name="settings" size={14}/>설정</button>}</td></tr>)}</tbody></table>{!requests.length&&<div className="empty-state"><Icon name="calendar"/><strong>등록된 수집 기간이 없습니다.</strong><p>기간, 대상 법인과 지표를 묶어 첫 수집 요청을 만들어 주세요.</p></div>}</div></section>:<>
      <section className="metric-summary"><SummaryTile label="진행 중 요청" value={activeCount} suffix="건" icon="calendar" tone="green"/><SummaryTile label="등록 지표" value={indicators.filter(item=>item.active).length} suffix="개" icon="list"/><SummaryTile label="검토 대기" value={submissions.filter(item=>item.status==="검토대기").length} suffix="건" icon="clock" tone={submissions.some(item=>item.status==="검토대기")?"amber":"green"}/><SummaryTile label="확정 데이터" value={submissions.filter(item=>item.status==="확정").length} suffix="건" icon="check" tone="green"/></section>
      {!requests.length?<section className="card metric-empty"><div className="empty-state"><Icon name="database"/><strong>개설된 ESG 정량데이터 수집 요청이 없습니다.</strong><p>{indicators.length?"대상 법인과 지표, 기간을 선택해 첫 수집 요청을 개설해 주세요.":"먼저 표준 지표를 추가하거나 ESG 지표 관리에서 필요한 지표를 등록해 주세요."}</p>{canManage&&<div className="empty-actions"><button className="secondary-button" onClick={addTemplates}><Icon name="list" size={16}/>표준 지표·양식 추가</button><button className="primary-button" onClick={()=>setRequestModal("new")} disabled={!indicators.length}><Icon name="plus" size={16}/>수집 요청 만들기</button></div>}</div></section>:<section className="metric-workspace"><aside className="card metric-request-list"><CardHeader title="수집 요청" subtitle="진행할 요청을 선택하세요." action={canManage?<button className="outline-small" onClick={()=>setRequestModal("new")}><Icon name="plus" size={14}/>추가</button>:undefined}/><div>{requests.map(request=>{const count=submissions.filter(item=>item.requestId===request.id&&item.status==="확정").length;const total=request.companies.length*request.indicatorIds.length;return <button key={request.id} className={request.id===selected?.id?"active":""} onClick={()=>setSelectedId(request.id)}><div><StatusBadge status={request.status}/><small>{request.dueDate} 마감</small></div><strong>{request.title}</strong><p>{request.companies.length}개 법인 · {request.indicatorIds.length}개 지표</p><span><i style={{width:`${total?Math.round(count/total*100):0}%`}}/></span></button>})}</div></aside>{selected&&<article className="card metric-detail"><div className="metric-detail-head"><div><div className="report-meta-line"><StatusBadge status={selected.status}/><em>{selected.periodFrom} ~ {selected.periodTo}</em><em>{selected.dueDate} 마감</em></div><h2>{selected.title}</h2><p>{selected.description||"별도 요청사항이 없습니다."}</p></div>{canManage&&<button className="secondary-button compact" onClick={()=>setRequestModal(selected)}><Icon name="settings" size={15}/>기간·요청 설정</button>}</div><div className="metric-progress-panel"><div><span>확정 진행률</span><strong>{completion}%</strong><div><i style={{width:`${completion}%`}}/></div></div><div><span>대상 법인</span><strong>{selected.companies.length}<small>개</small></strong></div><div><span>요청 지표</span><strong>{selected.indicatorIds.length}<small>개</small></strong></div><div><span>검토 대기</span><strong>{pending}<small>건</small></strong></div></div><div className="table-scroll"><table className="data-table metric-collection-table"><thead><tr><th>법인</th><th>요청 지표·양식</th><th>입력 기간</th><th className="align-right">제출값</th><th>담당 / 증빙</th><th>상태</th><th>작업</th></tr></thead><tbody>{expectedRows.map(row=>{const submission=row.submission;const indicator=row.indicator!;const template=metricTemplateOf(indicator);const canEdit=canWrite&&(canManage||!currentOrganization||row.company===currentOrganization)&&selected.status==="수집중"&&submission?.status!=="확정";return <tr key={`${row.company}-${indicator.id}`}><td><strong>{row.company}</strong><span>{submission?.site||"사업장 미입력"}</span></td><td><strong>{indicator.name}</strong><span>{indicator.code} · {indicator.cycle} 수집</span><em className={`metric-template-badge ${template.toLowerCase()}`}>{METRIC_TEMPLATE_LABELS[template]}</em></td><td>{submission?.period||selected.periodTo}</td><td className="align-right">{submission?<><strong>{formatNumber(submission.value,2)}</strong><span>{submission.unit}{submission.detailRows?.length?` · ${submission.detailRows.length}개 상세행`:""}</span></>:<span className="missing-value">미입력</span>}</td><td><strong>{submission?.owner||"담당자 미지정"}</strong><span>{submission?.evidence||"증빙 미연결"}</span></td><td>{submission?<><StatusBadge status={submission.status}/>{submission.rejectionReason&&<span className="rejection-inline">{submission.rejectionReason}</span>}</>:<StatusBadge status="미입력"/>}</td><td><div className="metric-row-actions">{canEdit&&<button className="outline-small" onClick={()=>setSubmissionModal({request:selected,indicator,company:row.company,submission})}><Icon name={submission?"edit":"plus"} size={14}/>{submission?"수정":"입력"}</button>}{canManage&&submission?.status==="검토대기"&&<><button className="approve-small" onClick={()=>changeStatus(submission,"확정")}>확정</button><button className="reject-small" onClick={()=>changeStatus(submission,"반려")}>반려</button></>}</div></td></tr>})}</tbody></table>{!expectedRows.length&&<div className="empty-state"><Icon name="list"/><strong>현재 계정에 배정된 수집 항목이 없습니다.</strong></div>}</div></article>}</section>}
    </>}
    {requestModal&&<MetricRequestForm item={requestModal==="new"?null:requestModal} indicators={indicators.filter(item=>item.active)} organizationNames={Object.keys(organizations)} onClose={()=>setRequestModal(null)} onSave={saveRequest} onDelete={requestModal==="new"?undefined:()=>deleteRequest(requestModal)}/>} 
    {submissionModal&&<MetricSubmissionForm context={submissionModal} organizations={organizations} defaultOwner={defaultOwner} defaultDepartment={defaultDepartment} canManage={canManage} onClose={()=>setSubmissionModal(null)} onSave={saveSubmission}/>} 
  </>;
}

function MetricRequestForm({item,indicators,organizationNames,onClose,onSave,onDelete}:{item:MetricRequest|null;indicators:Indicator[];organizationNames:string[];onClose:()=>void;onSave:(request:MetricRequest)=>void;onDelete?:()=>void}){
  const month=new Date().toISOString().slice(0,7);const due=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState<MetricRequest>(item??{id:"",title:"",periodFrom:month,periodTo:month,dueDate:due,companies:[...organizationNames],indicatorIds:[],description:"",status:"예정",updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const patch=(value:Partial<MetricRequest>)=>{setForm(current=>({...current,...value}));setError("");};
  const toggleCompany=(company:string)=>patch({companies:form.companies.includes(company)?form.companies.filter(item=>item!==company):[...form.companies,company]});
  const toggleIndicator=(id:number)=>patch({indicatorIds:form.indicatorIds.includes(id)?form.indicatorIds.filter(item=>item!==id):[...form.indicatorIds,id]});
  const submit=(event:FormEvent)=>{event.preventDefault();if(!form.companies.length){setError("대상 법인을 한 곳 이상 선택해 주세요.");return;}if(!form.indicatorIds.length){setError("요청할 ESG 지표를 한 개 이상 선택해 주세요.");return;}if(form.periodFrom>form.periodTo){setError("수집 시작기간은 종료기간보다 늦을 수 없습니다.");return;}onSave(form);};
  return <Overlay title={item?"수집 기간·요청 수정":"새 수집 기간·요청"} eyebrow="METRIC REQUEST" description="정량데이터의 대상 법인, 지표, 수집 기간과 제출 마감일을 한 번에 지정합니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>기간·요청 기본정보</h3><div className="form-grid"><label className="full-span">요청명<input value={form.title} onChange={event=>patch({title:event.target.value})} placeholder="예: 2026년 상반기 환경·사회 정량데이터 수집" required/></label><label>시작기간<input type="month" value={form.periodFrom} onChange={event=>patch({periodFrom:event.target.value})} required/></label><label>종료기간<input type="month" value={form.periodTo} onChange={event=>patch({periodTo:event.target.value})} required/></label><label>제출 마감일<input type="date" value={form.dueDate} onChange={event=>patch({dueDate:event.target.value})} required/></label><label>진행 상태<select value={form.status} onChange={event=>patch({status:event.target.value as MetricRequestStatus})}><option>예정</option><option>수집중</option><option>검토중</option><option>마감</option></select></label><label className="full-span textarea-label">요청 안내<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder="산정기준, 포함 범위, 증빙자료 기준 등을 적어 주세요."/></label></div></div><div className="form-section"><h3><span>2</span>대상 법인</h3><div className="selection-grid">{organizationNames.map(company=><label key={company} className={form.companies.includes(company)?"selected":""}><input type="checkbox" checked={form.companies.includes(company)} onChange={()=>toggleCompany(company)}/><span><strong>{company}</strong><small>정량데이터 입력 요청</small></span></label>)}</div></div><div className="form-section"><h3><span>3</span>요청 지표와 맞춤 양식</h3><div className="metric-picker">{indicators.map(indicator=>{const template=metricTemplateOf(indicator);return <label key={indicator.id} className={form.indicatorIds.includes(indicator.id)?"selected":""}><input type="checkbox" checked={form.indicatorIds.includes(indicator.id)} onChange={()=>toggleIndicator(indicator.id)}/><span className={`pillar-tag ${indicator.category==="환경"?"e":indicator.category==="사회"?"s":"g"}`}>{indicator.category}</span><div><strong>{indicator.name}</strong><small>{indicator.code} · {indicator.unit} · {METRIC_TEMPLATE_LABELS[template]}</small></div></label>})}</div>{!indicators.length&&<div className="empty-state compact"><strong>사용 중인 ESG 지표가 없습니다.</strong></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>요청 삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>기간·요청 저장</button></div></div></form></Overlay>;
}

function MetricSubmissionForm({context,organizations,defaultOwner,defaultDepartment,canManage,onClose,onSave}:{context:{request:MetricRequest;indicator:Indicator;company:string;submission?:MetricSubmission};organizations:Record<string,string[]>;defaultOwner:string;defaultDepartment:string;canManage:boolean;onClose:()=>void;onSave:(submission:MetricSubmission)=>void}){
  const existing=context.submission;
  const template=metricTemplateOf(context.indicator);
  const [form,setForm]=useState<MetricSubmission>(existing??{id:0,requestId:context.request.id,indicatorId:context.indicator.id,company:context.company,site:organizations[context.company]?.[0]??"",period:context.request.periodTo,value:0,unit:context.indicator.unit,owner:defaultOwner,department:defaultDepartment,evidence:"",description:"",status:"작성중",detailRows:template==="GENERAL"?undefined:[createMetricDetailRow(template)],updatedAt:"방금 전"});
  const [rows,setRows]=useState<MetricDetailRow[]>(existing?.detailRows?.length?existing.detailRows:template==="GENERAL"?[]:[createMetricDetailRow(template)]);
  const [error,setError]=useState("");
  const patch=(value:Partial<MetricSubmission>)=>{setForm(current=>({...current,...value}));setError("");};
  const syncRows=(nextRows:MetricDetailRow[])=>{setRows(nextRows);setForm(current=>({...current,detailRows:nextRows,value:calculateMetricDetailTotal(template,nextRows)}));setError("");};
  const updateRow=(rowId:string,key:string,value:string|number)=>{
    const nextRows=rows.map(row=>{
      if(row.id!==rowId)return row;
      const values={...row.values,[key]:value};
      if(template==="TRAINING"){values.totalHours=(Number(values.completionCount)||0)*(Number(values.hoursPerPerson)||0);}
      return {...row,values};
    });
    syncRows(nextRows);
  };
  const addRow=()=>syncRows([...rows,createMetricDetailRow(template)]);
  const removeRow=(rowId:string)=>syncRows(rows.length===1?[createMetricDetailRow(template)]:rows.filter(row=>row.id!==rowId));
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(form.value<0){setError("제출값은 0 이상이어야 합니다.");return;}
    if(form.period<context.request.periodFrom||form.period>context.request.periodTo){setError("입력 기간이 요청 대상 기간을 벗어났습니다.");return;}
    if(template!=="GENERAL"&&!rows.length){setError("상세 입력행을 한 개 이상 등록해 주세요.");return;}
    onSave({...form,detailRows:template==="GENERAL"?undefined:rows,value:template==="GENERAL"?form.value:calculateMetricDetailTotal(template,rows)});
  };
  const fields=METRIC_TEMPLATE_FIELDS[template];
  return <Overlay title={`${context.indicator.name} 입력`} eyebrow="METRIC SUBMISSION" description={`${context.company} · ${context.request.periodFrom}~${context.request.periodTo} · ${METRIC_TEMPLATE_LABELS[template]} 양식`} onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>지표와 대상</h3><div className="form-grid"><label>법인<input value={form.company} readOnly/></label><label>사업장<select value={form.site} onChange={event=>patch({site:event.target.value})}>{(organizations[form.company]??[]).map(site=><option key={site}>{site}</option>)}</select></label><label>지표명<input value={context.indicator.name} readOnly/></label><label>입력 기간<input type="month" min={context.request.periodFrom} max={context.request.periodTo} value={form.period} onChange={event=>patch({period:event.target.value})} required/></label></div></div>
    <div className="form-section"><h3><span>2</span>{template==="GENERAL"?"값 입력":`${METRIC_TEMPLATE_LABELS[template]} 상세 입력`}</h3>{template==="GENERAL"?<div className="form-grid"><label>제출값<div className="input-unit"><input type="number" min="0" step="any" value={form.value||""} onChange={event=>patch({value:Number(event.target.value)})} required/><span>{form.unit}</span></div></label><label>저장 상태<select value={form.status} onChange={event=>patch({status:event.target.value as MetricSubmissionStatus})}><option>작성중</option><option>검토대기</option>{canManage&&<option>확정</option>}</select></label></div>:<div className="metric-detail-editor"><div className="metric-detail-editor-head"><div><span className={`metric-template-badge ${template.toLowerCase()}`}>{METRIC_TEMPLATE_LABELS[template]}</span><p>상세행을 추가하면 {fields.find(field=>field.aggregate)?.label??"값"}이 자동 합산됩니다.</p></div><button type="button" className="outline-small" onClick={addRow}><Icon name="plus" size={14}/>행 추가</button></div><div className="metric-detail-rows">{rows.map((row,index)=><div className="metric-detail-row" key={row.id}><span className="metric-row-number">{index+1}</span><div className="metric-detail-fields" style={{gridTemplateColumns:`repeat(${Math.min(fields.length,5)}, minmax(130px, 1fr))`}}>{fields.map(field=><label key={field.key}><span>{field.label}</span>{field.type==="select"?<select value={String(row.values[field.key]??field.options?.[0]??"")} onChange={event=>updateRow(row.id,field.key,event.target.value)}>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:<input type={field.type} min={field.type==="number"?"0":undefined} step={field.type==="number"?"any":undefined} value={row.values[field.key]??""} readOnly={field.readOnly} placeholder={field.placeholder} onChange={event=>updateRow(row.id,field.key,field.type==="number"?Number(event.target.value):event.target.value)}/>}</label>)}</div><button type="button" className="metric-row-remove" onClick={()=>removeRow(row.id)} aria-label={`${index+1}번 상세행 삭제`}><Icon name="trash" size={15}/></button></div>)}</div><div className="metric-detail-total"><span>자동 집계 제출값</span><strong>{formatNumber(calculateMetricDetailTotal(template,rows),2)} <small>{form.unit}</small></strong><em>{rows.length}개 상세행 합계</em></div></div>}<div className="form-grid metric-submission-meta"><label>저장 상태<select value={form.status} onChange={event=>patch({status:event.target.value as MetricSubmissionStatus})}><option>작성중</option><option>검토대기</option>{canManage&&<option>확정</option>}</select></label><label>담당자<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={event=>patch({department:event.target.value})} required/></label><label className="full-span textarea-label">산정 기준·변동 사유<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder={context.indicator.formula||"산정 기준과 특이사항을 적어 주세요."}/></label></div></div>
    <div className="form-section"><h3><span>3</span>증빙자료</h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setError("증빙파일은 20MB 이하만 선택할 수 있습니다.");event.target.value="";return;}patch({evidence:file.name})}}/><span className="upload-icon"><Icon name="upload"/></span>{form.evidence?<><strong>{form.evidence}</strong><small>원본 파일명과 연결정보가 저장됩니다.</small></>:<><strong>증빙자료를 선택하세요.</strong><small>{context.indicator.evidenceExample||"PDF, XLSX, CSV, JPG, PNG · 최대 20MB"}</small></>}</label>{form.rejectionReason&&<div className="rejection-note"><Icon name="alert" size={16}/><div><strong>이전 보완 요청</strong><p>{form.rejectionReason}</p></div></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>{form.status==="검토대기"?"검토 제출":"저장"}</button></div>
  </form></Overlay>;
}'''
page = replace_between(page, "function MetricCollection(", "function createPageTitleBlock(", metric_block, "metric collection and custom forms")

PAGE.write_text(page, encoding="utf-8")

styles = STYLES.read_text(encoding="utf-8")
css_marker = "/* sites-latest-sync: merged metric periods and custom forms */"
css = r'''
/* sites-latest-sync: merged metric periods and custom forms */
.metric-workspace-tabs {
  display: flex;
  gap: 10px;
  margin: 0 0 18px;
}
.metric-workspace-tabs > button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
  padding: 13px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  color: var(--text-subtle);
  text-align: left;
  cursor: pointer;
}
.metric-workspace-tabs > button.active {
  border-color: #1f7a5d;
  box-shadow: 0 8px 24px rgba(31, 122, 93, .12);
  color: #135f48;
}
.metric-workspace-tabs span { display: grid; gap: 2px; }
.metric-workspace-tabs strong { font-size: 14px; }
.metric-workspace-tabs small { font-size: 12px; color: var(--text-muted); }
.metric-period-card { padding: 0; overflow: hidden; }
.metric-period-card > .card-header { padding: 22px 24px 12px; }
.metric-period-table td > span,
.metric-period-table td > strong { display: block; }
.metric-template-badge {
  display: inline-flex;
  width: fit-content;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #edf7f3;
  color: #166448;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}
.metric-template-badge.waste { background: #f5f1e8; color: #755318; }
.metric-template-badge.training { background: #eef2fb; color: #385d9d; }
.metric-template-badge.water { background: #eaf7fb; color: #206b82; }
.metric-template-badge.air { background: #f0f2f4; color: #58636d; }
.metric-template-badge.energy { background: #fff4df; color: #8b5a00; }
.metric-template-badge.headcount { background: #f4eefb; color: #6a3d91; }
.metric-template-badge.safety { background: #fff0ef; color: #9a3e36; }
.metric-detail-editor {
  display: grid;
  gap: 14px;
}
.metric-detail-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.metric-detail-editor-head p { margin: 6px 0 0; color: var(--text-muted); font-size: 13px; }
.metric-detail-rows { display: grid; gap: 10px; }
.metric-detail-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 34px;
  align-items: end;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fbfcfc;
}
.metric-row-number {
  display: grid;
  place-items: center;
  width: 28px;
  height: 36px;
  border-radius: 9px;
  background: #e8efec;
  color: #31594d;
  font-size: 12px;
  font-weight: 800;
}
.metric-detail-fields {
  display: grid;
  gap: 10px;
}
.metric-detail-fields label { display: grid; gap: 6px; min-width: 0; }
.metric-detail-fields label > span { color: var(--text-muted); font-size: 12px; font-weight: 700; }
.metric-detail-fields input,
.metric-detail-fields select { width: 100%; min-width: 0; }
.metric-detail-fields input[readonly] { background: #eef3f1; color: #31594d; font-weight: 800; }
.metric-row-remove {
  display: grid;
  place-items: center;
  width: 34px;
  height: 36px;
  border: 1px solid #edcdca;
  border-radius: 9px;
  background: #fff;
  color: #a34d45;
  cursor: pointer;
}
.metric-detail-total {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px 18px;
  padding: 15px 18px;
  border-radius: 14px;
  background: #edf7f3;
}
.metric-detail-total span { color: #41675b; font-size: 13px; font-weight: 700; }
.metric-detail-total strong { grid-row: span 2; font-size: 22px; color: #135f48; }
.metric-detail-total strong small { font-size: 12px; }
.metric-detail-total em { color: #6c817a; font-size: 12px; font-style: normal; }
.metric-submission-meta { margin-top: 18px; }
.target-baseline-grid .calculated-field { min-height: 102px; }
.target-allocation-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0 16px;
}
.target-allocation-toggle button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  color: var(--text-subtle);
  text-align: left;
  cursor: pointer;
}
.target-allocation-toggle button.active {
  border-color: #1f7a5d;
  background: #edf7f3;
  color: #135f48;
}
.target-allocation-toggle span { display: grid; gap: 3px; }
.target-allocation-toggle strong { font-size: 14px; }
.target-allocation-toggle small { color: var(--text-muted); font-size: 12px; }
.input-unit.compact input[readonly] { background: #eef3f1; font-weight: 800; }
@media (max-width: 960px) {
  .metric-workspace-tabs,
  .target-allocation-toggle { grid-template-columns: 1fr; flex-direction: column; }
  .metric-workspace-tabs > button { width: 100%; min-width: 0; }
  .metric-detail-fields { grid-template-columns: 1fr !important; }
}
'''
if css_marker not in styles:
    STYLES.write_text(styles.rstrip() + "\n\n" + css.strip() + "\n", encoding="utf-8")

tests = TESTS.read_text(encoding="utf-8")
anchor = '''  assert.match(page, /ESG 정량데이터 수집/);
'''
extra = '''  assert.match(page, /ESG 정량데이터 수집·기간 설정/);
  assert.match(page, /폐기물 구분/);
  assert.match(page, /법정 의무교육/);
  assert.match(page, /지표 특성에 맞는 양식/);
  assert.match(page, /Scope 1·2 기준연도 배출량/);
  assert.match(page, /균등 배분/);
  assert.match(page, /수동 입력/);
'''
if extra.strip() not in tests:
    tests = replace_once(tests, anchor, anchor + extra, "tests for latest Sites workflow")
style_anchor = '''  assert.match(styles, /\\.plan-status-preview p \\{ font-size: 13px;/);
'''
style_extra = '''  assert.match(styles, /\\.metric-workspace-tabs \\{/);
  assert.match(styles, /\\.metric-detail-editor \\{/);
  assert.match(styles, /\\.target-allocation-toggle \\{/);
'''
if style_extra.strip() not in tests:
    tests = replace_once(tests, style_anchor, style_extra + style_anchor, "style tests for latest Sites workflow")
TESTS.write_text(tests, encoding="utf-8")

print("Applied Sites latest synchronization patches.")
