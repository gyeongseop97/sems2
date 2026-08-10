"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, CSSProperties, DragEvent as ReactDragEvent, FormEvent, PointerEvent as ReactPointerEvent, ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSemsAuth, WORKSPACE_CHANGE_EVENT } from "@/components/auth-context";
import {
  COMPLILAW_DISCLOSURE_MAPPINGS,
  COMPLILAW_DISCLOSURE_STANDARDS,
  COMPLILAW_MASTER_COUNTS,
  COMPLILAW_QUANTITATIVE_INDICATORS,
  COMPLILAW_REGULATIONS,
  COMPLILAW_SCOPE12_FORMULAS,
  COMPLILAW_SCOPE12_INDICATORS,
  COMPLILAW_SCOPE3_FACTORS,
  COMPLILAW_SCOPE3_FIELDS,
  COMPLILAW_SCOPE3_FORMULAS,
  mergeMasterRows,
} from "@/lib/complilaw-master-data";
import {
  buildGHGCoverage,
  buildMetricCoverage,
  countCoverage,
  coverageDisplayStatus,
  monthsForYear,
} from "@/lib/collection-coverage";
import type { CoverageItem, CoverageStatus } from "@/lib/collection-coverage";
import {
  buildGHGCollectionTasks,
  buildMetricCollectionTasks,
  classifyCollectionTasks,
  collectionTaskKey,
  countTasksByCycle,
  parseCollectionTaskKey,
} from "@/lib/collection-task-expansion";
import type { CollectionCycle, CollectionTask } from "@/lib/collection-task-expansion";
import { DEFAULT_EMISSION_FACTORS, mergeDefaultEmissionFactors, SCOPE3_CATEGORIES, SCOPE_GUIDANCE } from "@/lib/emission-factor-library";
import { GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS, GRI_WORKBOOK_INDICATORS, GRI_WORKBOOK_INDICATOR_ALIASES, GRI_WORKBOOK_INDICATOR_COUNTS } from "@/lib/gri-workbook-indicators";
import type { GriWorkbookDetailSeed } from "@/lib/gri-workbook-indicators";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type View = "dashboard" | "collection" | "collection-request" | "review" | "quality" | "inventory" | "targets" | "scope3" | "evidence" | "indicators" | "metric-collection" | "reports" | "reference" | "audit" | "settings";
type Scope = "Scope 1" | "Scope 2" | "Scope 3";
type RecordStatus = "작성중" | "검토대기" | "반려" | "확정";
type EvidenceStatus = "검토중" | "승인" | "보완 요청" | "만료";
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
  taskKeys?: string[];
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
  factorType?: "공식계수" | "공급자계수" | "참고계수";
  method?: string;
  reference?: string;
  referenceUrl?: string;
  notes?: string;
  indicatorKind?: "열량계수" | "지구온난화지수" | "산화계수" | "배출계수";
  detailCategory?: string;
  country?: string;
  validFrom?: string;
  validTo?: string;
};

type EvidenceItem = {
  id: number;
  title: string;
  category: string;
  documentType: string;
  organization: string;
  owner: string;
  issuer: string;
  issuedDate: string;
  expiresAt: string;
  securityLevel: "일반" | "사내한" | "기밀";
  linkedIndicators: string[];
  linkedFrameworks: string[];
  version: string;
  fileName: string;
  storagePath: string;
  notes: string;
  status: EvidenceStatus;
  updatedAt: string;
};

type IndicatorStatus = "미작성" | "작성중" | "제출" | "반려" | "승인";
type MetricInputTemplate = "GENERAL" | "BREAKDOWN" | "FIXED" | "WASTE" | "TRAINING" | "WATER" | "AIR" | "ENERGY" | "HEADCOUNT" | "SAFETY";
type MetricDetailRow = {
  id: string;
  values: Record<string, string | number>;
};
type Indicator = {
  id: number;
  code: string;
  name: string;
  category: "환경" | "사회" | "지배구조";
  unit: string;
  cycle: string;
  aggregation?: "합계" | "평균" | "최종값";
  owner: string;
  reviewer: string;
  progress: number;
  status: IndicatorStatus;
  definition: string;
  boundary: string;
  formula: string;
  dataSource: string;
  evidenceExample: string;
  frameworks: string[];
  dueDate: string;
  active: boolean;
  inputTemplate?: MetricInputTemplate;
  detailItems?: GriWorkbookDetailSeed[];
};

type MetricRequestStatus = "예정" | "수집중" | "검토중" | "마감";
type MetricSubmissionStatus = "작성중" | "검토대기" | "반려" | "확정";
type MetricRequest = {
  id: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  dueDate: string;
  companies: string[];
  indicatorIds: number[];
  description: string;
  status: MetricRequestStatus;
  updatedAt: string;
  taskKeys?: string[];
};
type MetricSubmission = {
  id: number;
  requestId: string;
  indicatorId: number;
  company: string;
  site: string;
  period: string;
  value: number;
  unit: string;
  owner: string;
  department: string;
  evidence: string;
  description: string;
  status: MetricSubmissionStatus;
  detailRows?: MetricDetailRow[];
  employeeCount?: number;
  rejectionReason?: string;
  updatedAt: string;
};

type ReportStatus = "초안" | "검토중" | "발행완료";
type ReportSection = "보고서 개요" | "환경" | "사회" | "지배구조" | "부록";
type ReportDataSource = "온실가스 배출량" | "감축목표" | "ESG 지표" | `ESG:${number}`;
type ReportOrientation = "landscape" | "portrait";
type ReportHeadingStyle = "major" | "middle" | "minor" | "table";
const REPORT_HEADING_SIZES:Record<ReportHeadingStyle,number>={major:20,middle:12,minor:11,table:10};
const REPORT_BODY_SIZE=10;
const REPORT_TABLE_SIZE=8;
const REPORT_CAPTION_SIZE=7;
type ReportBlockType = "title" | "text" | "image" | "data" | "chart" | "file" | "line" | "callout" | "divider";
type ReportBlock = {
  id: string;
  type: ReportBlockType;
  title: string;
  body: string;
  dataSource?: ReportDataSource;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  imageData?: string;
  imageName?: string;
  imageFit?: "cover" | "contain";
  fileName?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  color?: string;
  backgroundColor?: string;
  border?: boolean;
  chartType?: "bar" | "line";
  dataYears?: number[];
  headingStyle?: ReportHeadingStyle;
  pageTitle?: boolean;
};
type ReportPage = {
  id: string;
  title: string;
  section: ReportSection;
  blocks: ReportBlock[];
};
type SustainabilityReport = {
  id: string;
  title: string;
  year: number;
  organization: string;
  reportingPeriod: string;
  status: ReportStatus;
  primaryColor: string;
  accentColor: string;
  fontFamily: "Noto Sans KR" | "Pretendard" | "serif";
  orientation?: ReportOrientation;
  frameworks: string[];
  pages: ReportPage[];
  updatedAt: string;
  publishedAt?: string;
};

type TargetStatus = "초안" | "승인" | "종료";
type TargetAllocationMode = "균등 배분" | "수동 입력";
type AnnualReductionTarget = {
  year: number;
  projectedEmissions: number;
  targetReduction: number;
  targetEmissions: number;
  reductionRate: number;
  expectedCost: number;
};
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
  scope1BaselineEmissions?: number;
  scope2BaselineEmissions?: number;
  allocationMode?: TargetAllocationMode;
  owner: string;
  status: TargetStatus;
  description: string;
  annualTargets?: AnnualReductionTarget[];
  approvedAt?: string;
  updatedAt: string;
};

type PlanStatus = "계획" | "진행중" | "완료" | "지연";
type PlanType = "내부 감축" | "외부 감축" | "비정량 과제";
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
  planType?: PlanType;
  applicationYear?: number;
  expectedReduction: number;
  actualReduction: number;
  investmentCost?: number;
  annualSavings?: number;
  budget?: number;
  progress: number;
  status: PlanStatus;
  verification: string;
  description: string;
  updatedAt: string;
};

type CalculationFormula = {
  id:string;
  code:string;
  name:string;
  scope:Scope;
  expression:string;
  activityUnit:string;
  outputUnit:string;
  factorId:string;
  description:string;
  active:boolean;
  updatedAt:string;
  categoryCode?:string;
  resultLabel?:string;
  variableKeys?:string[];
};
type ActivityMaster = {
  id:string;
  code:string;
  name:string;
  group:string;
  scope:Scope;
  unit:string;
  density?:number;
  densityUnit?:string;
  description:string;
  active:boolean;
  updatedAt:string;
  materialType?:"연료"|"온실가스"|"기타";
  casNumber?:string;
};
type AssetUnit = {
  id:string;
  code?:string;
  company:string;
  site:string;
  name:string;
  type:"사업장"|"기능위치"|"배출시설"|"계측기";
  parentId:string;
  scope:Scope;
  formulaId:string;
  address:string;
  description:string;
  active:boolean;
  updatedAt:string;
  classification?:"건물"|"자동차 및 이동수단"|"설비 및 기계"|"기타";
  activityType?:"고정연소"|"이동연소"|"공정배출"|"탈루배출"|"전력"|"재생에너지"|"기타배출";
  country?:string;
  latitude?:string;
  longitude?:string;
  department?:string;
  owner?:string;
  position?:string;
  phone?:string;
  email?:string;
};
type Scope3FieldDefinition = {
  id:string;
  categoryCode:string;
  fieldKey:string;
  nameKr:string;
  nameEn:string;
  inputType:"TEXT"|"NUMBER"|"SELECT"|"DATE"|"UNIT_CODE"|"FILE";
  dataType:"STRING"|"NUMBER"|"DATE";
  unitGroup:string;
  required:boolean;
  sortOrder:number;
  active:boolean;
};
type DisclosureStandardItem = {
  id:string;
  code:string;
  title:string;
  level:number;
  parentCode:string;
  contents:string;
  risk:"낮음"|"보통"|"높음";
  active:boolean;
};
type DisclosureStandard = {
  id:string;
  code:string;
  title:string;
  category:"공시"|"산정"|"평가"|"법정";
  version:string;
  description:string;
  active:boolean;
  items:DisclosureStandardItem[];
  history:{date:string;contents:string}[];
  updatedAt:string;
  sourceItemCount?:number;
  sourceClassification?:string;
};
type ComplianceRegulation = {
  id:string;
  title:string;
  category:string;
  jurisdiction:string;
  contents:string;
  applicability:string;
  owner:string;
  reviewCycleMonths:number;
  lastReviewDate:string;
  nextReviewDate:string;
  status:"검토 필요"|"적용"|"미적용"|"개정 검토";
  tags:string[];
  linkedStandardIds:string[];
  linkedIndicatorCodes:string[];
  evidence:string;
  active:boolean;
  updatedAt:string;
  version?:string;
  sourceItemCount?:number;
  sourceUsedItemCount?:number;
  sourceReviewCount?:string;
};

type SupplierMaster = {
  id:string;
  code:string;
  name:string;
  region:"국내"|"해외";
  category:"제조사-일반"|"제조사-특수"|"운송사"|"물류사"|"원자재사"|"기타";
  tier:"tier1"|"tier2"|"tier3"|"tier4"|"해당없음";
  country:string;
  email:string;
  owner:string;
  active:boolean;
  updatedAt:string;
};

type ProductMaterialMaster = {
  id:string;
  code:string;
  name:string;
  type:"완제품"|"반제품"|"원자재"|"반자재"|"상품";
  supplierId:string;
  unit:string;
  description:string;
  active:boolean;
  updatedAt:string;
};

type TransportRoute = {
  id:string;
  code:string;
  name:string;
  mode:"도로"|"철도"|"해상"|"항공";
  vehicle:string;
  origin:string;
  destination:string;
  distance:number;
  distanceUnit:"km"|"mile";
  calculationType:"자동계산"|"직접입력";
  description:string;
  active:boolean;
  updatedAt:string;
};

type DisclosureMapping = {
  id:string;
  indicatorCode:string;
  standardId:string;
  standardItemCode:string;
  regulationIds:string[];
  evidenceRequired:boolean;
  owner:string;
  status:"미연결"|"연결완료"|"검토 필요";
  updatedAt:string;
};

type Scope3RequestStatus = "대기중"|"진행중"|"입력완료"|"검토완료"|"재요청"|"요청취소";
type Scope3DataRequest = {
  id:string;
  title:string;
  year:number;
  categoryCode:string;
  organizationScope:string[];
  formulaId:string;
  dueDate:string;
  targetType:"협력사"|"업무담당자";
  targetIds:string[];
  reminder:boolean;
  cbam:boolean;
  status:Scope3RequestStatus;
  submittedCount:number;
  reviewedCount:number;
  updatedAt:string;
};

type DiagnosticTemplate = {
  id:string;
  title:string;
  description:string;
  totalScore:number;
  gradeScheme:"5단계"|"7단계"|"사용자 지정";
  questionCount:number;
  active:boolean;
  updatedAt:string;
};

type SupplyChainAssessment = {
  id:string;
  title:string;
  year:number;
  periodFrom:string;
  periodTo:string;
  templateId:string;
  supplierIds:string[];
  reminder:boolean;
  completedCount:number;
  status:"예정"|"진행"|"완료";
  updatedAt:string;
};

const DEFAULT_CALCULATION_FORMULAS:CalculationFormula[]=mergeMasterRows<CalculationFormula>([
  {id:"FORM-S1-FUEL",code:"S1-FUEL",name:"연료 연소 배출량",scope:"Scope 1",expression:"활동량 × 순발열량 × 배출계수 × 산화율",activityUnit:"연료 사용단위",outputUnit:"tCO₂e",factorId:"",description:"고정연소·이동연소 연료 사용량 산정",active:true,updatedAt:"기본 제공"},
  {id:"FORM-S1-REF",code:"S1-REFRIGERANT",name:"냉매 누출 배출량",scope:"Scope 1",expression:"냉매 충전·보충량 × 냉매별 GWP",activityUnit:"kg",outputUnit:"tCO₂e",factorId:"",description:"냉동·공조설비 냉매 보충량 기준",active:true,updatedAt:"기본 제공"},
  {id:"FORM-S2-ELEC",code:"S2-ELECTRICITY",name:"구매전력 배출량",scope:"Scope 2",expression:"전력 사용량 × 전력 배출계수",activityUnit:"kWh",outputUnit:"tCO₂e",factorId:"EF-S2-ELECTRICITY-2023",description:"지역기반 또는 시장기반 계수 연결",active:true,updatedAt:"기본 제공"},
  {id:"FORM-S3-SPEND",code:"S3-SPEND",name:"Scope 3 지출기반 산정",scope:"Scope 3",expression:"구매금액 × 품목별 지출기반 배출계수",activityUnit:"KRW",outputUnit:"tCO₂e",factorId:"",description:"활동자료가 부족한 범주의 1차 추정",active:true,updatedAt:"기본 제공"},
  {id:"FORM-S3-DIST",code:"S3-DISTANCE",name:"운송거리 기반 산정",scope:"Scope 3",expression:"화물중량 × 운송거리 × 운송수단별 배출계수",activityUnit:"ton·km",outputUnit:"tCO₂e",factorId:"",description:"상·하류 운송 및 물류 산정",active:true,updatedAt:"기본 제공"},
], [...COMPLILAW_SCOPE12_FORMULAS, ...COMPLILAW_SCOPE3_FORMULAS] as CalculationFormula[]);

const DEFAULT_ACTIVITY_MASTERS:ActivityMaster[]=[
  {id:"ACT-ELECTRICITY",code:"ELECTRICITY",name:"구매전력",group:"에너지",scope:"Scope 2",unit:"kWh",description:"전력 요금고지서 또는 계측기 사용량",active:true,updatedAt:"기본 제공"},
  {id:"ACT-LNG",code:"LNG",name:"도시가스(LNG)",group:"연료",scope:"Scope 1",unit:"Nm³",description:"도시가스 요금고지서 사용량",active:true,updatedAt:"기본 제공"},
  {id:"ACT-DIESEL",code:"DIESEL",name:"경유",group:"연료",scope:"Scope 1",unit:"L",description:"차량·비상발전기 등 이동·고정연소",active:true,updatedAt:"기본 제공"},
  {id:"ACT-GASOLINE",code:"GASOLINE",name:"휘발유",group:"연료",scope:"Scope 1",unit:"L",description:"법인차량 등 이동연소",active:true,updatedAt:"기본 제공"},
  {id:"ACT-REFRIGERANT",code:"REFRIGERANT",name:"냉매",group:"공정·탈루",scope:"Scope 1",unit:"kg",description:"설비별 냉매 종류와 충전·보충량",active:true,updatedAt:"기본 제공"},
];

type Scope3FieldBlueprint={fieldKey:string;nameKr:string;nameEn:string;inputType:Scope3FieldDefinition["inputType"];dataType:Scope3FieldDefinition["dataType"];unitGroup:string;required:boolean};
const DEFAULT_SCOPE3_FIELD_BLUEPRINTS:Record<string,Scope3FieldBlueprint[]>={
  "Cat.1":[
    {fieldKey:"supplier_name",nameKr:"공급사명",nameEn:"Supplier",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"material_code",nameKr:"자재코드",nameEn:"Material code",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"material_name",nameKr:"자재·서비스명",nameEn:"Material or service",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"quantity",nameKr:"구매수량",nameEn:"Purchased quantity",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ACTIVITY",required:true},
    {fieldKey:"unit_code",nameKr:"수량단위",nameEn:"Unit",inputType:"UNIT_CODE",dataType:"STRING",unitGroup:"ACTIVITY",required:true},
    {fieldKey:"purchase_amount",nameKr:"구매금액",nameEn:"Purchase amount",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"CURRENCY",required:false},
    {fieldKey:"supplier_factor",nameKr:"공급자 배출계수",nameEn:"Supplier emission factor",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"EMISSION_FACTOR",required:false},
  ],
  "Cat.2":[
    {fieldKey:"capital_asset",nameKr:"자본재명",nameEn:"Capital good",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"supplier_name",nameKr:"공급사명",nameEn:"Supplier",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"quantity",nameKr:"도입수량",nameEn:"Quantity",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ACTIVITY",required:true},
    {fieldKey:"purchase_amount",nameKr:"취득금액",nameEn:"Acquisition cost",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"CURRENCY",required:true},
    {fieldKey:"factor_value",nameKr:"자본재 배출계수",nameEn:"Emission factor",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"EMISSION_FACTOR",required:false},
  ],
  "Cat.3":[
    {fieldKey:"energy_type",nameKr:"연료·에너지 유형",nameEn:"Energy type",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"activity_value",nameKr:"사용량",nameEn:"Consumption",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ENERGY",required:true},
    {fieldKey:"unit_code",nameKr:"단위",nameEn:"Unit",inputType:"UNIT_CODE",dataType:"STRING",unitGroup:"ENERGY",required:true},
    {fieldKey:"wtt_factor",nameKr:"상류 배출계수",nameEn:"Well-to-tank factor",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"EMISSION_FACTOR",required:false},
  ],
  "Cat.4":[
    {fieldKey:"origin",nameKr:"출발지",nameEn:"Origin",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"destination",nameKr:"도착지",nameEn:"Destination",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"transport_mode",nameKr:"운송방식",nameEn:"Transport mode",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"cargo_weight",nameKr:"화물중량",nameEn:"Cargo weight",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"MASS",required:true},
    {fieldKey:"distance",nameKr:"이동거리",nameEn:"Distance",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"DISTANCE",required:true},
  ],
  "Cat.5":[
    {fieldKey:"waste_type",nameKr:"폐기물 종류",nameEn:"Waste type",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"treatment_method",nameKr:"처리방법",nameEn:"Treatment method",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"waste_amount",nameKr:"폐기물 발생량",nameEn:"Waste amount",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"MASS",required:true},
    {fieldKey:"contractor",nameKr:"위탁처리업체",nameEn:"Waste contractor",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:false},
  ],
  "Cat.6":[
    {fieldKey:"trip_purpose",nameKr:"출장 목적",nameEn:"Trip purpose",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"transport_mode",nameKr:"이동수단",nameEn:"Transport mode",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"distance",nameKr:"왕복 이동거리",nameEn:"Round-trip distance",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"DISTANCE",required:true},
    {fieldKey:"travelers",nameKr:"출장인원",nameEn:"Travelers",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"PEOPLE",required:true},
    {fieldKey:"nights",nameKr:"숙박일수",nameEn:"Hotel nights",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"DAYS",required:false},
  ],
  "Cat.7":[
    {fieldKey:"commute_mode",nameKr:"통근수단",nameEn:"Commute mode",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"employees",nameKr:"대상 임직원수",nameEn:"Employees",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"PEOPLE",required:true},
    {fieldKey:"one_way_distance",nameKr:"편도거리",nameEn:"One-way distance",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"DISTANCE",required:true},
    {fieldKey:"work_days",nameKr:"연간 출근일수",nameEn:"Work days",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"DAYS",required:true},
  ],
  "Cat.8":[
    {fieldKey:"leased_asset",nameKr:"임차자산명",nameEn:"Leased asset",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"energy_type",nameKr:"에너지 유형",nameEn:"Energy type",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"activity_value",nameKr:"사용량",nameEn:"Consumption",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ENERGY",required:true},
    {fieldKey:"lease_share",nameKr:"당사 사용비율",nameEn:"Lease share",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"PERCENT",required:false},
  ],
  "Cat.9":[
    {fieldKey:"destination",nameKr:"납품처",nameEn:"Destination",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"transport_mode",nameKr:"운송방식",nameEn:"Transport mode",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"cargo_weight",nameKr:"제품중량",nameEn:"Product weight",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"MASS",required:true},
    {fieldKey:"distance",nameKr:"이동거리",nameEn:"Distance",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"DISTANCE",required:true},
  ],
  "Cat.10":[
    {fieldKey:"product_name",nameKr:"판매제품명",nameEn:"Sold product",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"processing_type",nameKr:"가공유형",nameEn:"Processing type",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"sales_quantity",nameKr:"판매수량",nameEn:"Sales quantity",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ACTIVITY",required:true},
    {fieldKey:"processing_energy",nameKr:"단위당 가공에너지",nameEn:"Processing energy",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ENERGY",required:true},
  ],
  "Cat.11":[
    {fieldKey:"product_name",nameKr:"판매제품명",nameEn:"Sold product",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"sales_quantity",nameKr:"판매수량",nameEn:"Sales quantity",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ACTIVITY",required:true},
    {fieldKey:"lifetime",nameKr:"제품 기대수명",nameEn:"Expected lifetime",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"YEARS",required:true},
    {fieldKey:"use_energy",nameKr:"연간 사용에너지",nameEn:"Annual use energy",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ENERGY",required:true},
  ],
  "Cat.12":[
    {fieldKey:"product_name",nameKr:"판매제품명",nameEn:"Sold product",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"product_weight",nameKr:"제품중량",nameEn:"Product weight",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"MASS",required:true},
    {fieldKey:"material_type",nameKr:"주요 재질",nameEn:"Material type",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"disposal_method",nameKr:"폐기방법",nameEn:"Disposal method",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"recycling_rate",nameKr:"재활용률",nameEn:"Recycling rate",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"PERCENT",required:false},
  ],
  "Cat.13":[
    {fieldKey:"leased_asset",nameKr:"임대자산명",nameEn:"Leased asset",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"leased_area",nameKr:"임대면적",nameEn:"Leased area",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"AREA",required:true},
    {fieldKey:"energy_type",nameKr:"에너지 유형",nameEn:"Energy type",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"activity_value",nameKr:"사용량",nameEn:"Consumption",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ENERGY",required:true},
  ],
  "Cat.14":[
    {fieldKey:"franchise_name",nameKr:"가맹점명",nameEn:"Franchise",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"store_area",nameKr:"매장면적",nameEn:"Store area",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"AREA",required:true},
    {fieldKey:"energy_type",nameKr:"에너지 유형",nameEn:"Energy type",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"activity_value",nameKr:"사용량",nameEn:"Consumption",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"ENERGY",required:true},
  ],
  "Cat.15":[
    {fieldKey:"investee",nameKr:"피투자회사·자산",nameEn:"Investee or asset",inputType:"TEXT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"asset_class",nameKr:"투자유형",nameEn:"Asset class",inputType:"SELECT",dataType:"STRING",unitGroup:"",required:true},
    {fieldKey:"investment_amount",nameKr:"투자금액",nameEn:"Investment amount",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"CURRENCY",required:true},
    {fieldKey:"ownership_share",nameKr:"지분율",nameEn:"Ownership share",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"PERCENT",required:true},
    {fieldKey:"investee_emissions",nameKr:"피투자회사 배출량",nameEn:"Investee emissions",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"EMISSIONS",required:true},
  ],
};

const DEFAULT_MASTER_FACTORS = mergeMasterRows<EmissionFactor>(
  DEFAULT_EMISSION_FACTORS as EmissionFactor[],
  [...COMPLILAW_SCOPE12_INDICATORS, ...COMPLILAW_SCOPE3_FACTORS] as EmissionFactor[],
);
const DEFAULT_MASTER_SCOPE3_FIELDS = COMPLILAW_SCOPE3_FIELDS as Scope3FieldDefinition[];
const DEFAULT_MASTER_STANDARDS = COMPLILAW_DISCLOSURE_STANDARDS as DisclosureStandard[];
const DEFAULT_MASTER_REGULATIONS = COMPLILAW_REGULATIONS as ComplianceRegulation[];
const DEFAULT_MASTER_MAPPINGS = COMPLILAW_DISCLOSURE_MAPPINGS as DisclosureMapping[];
const DEFAULT_MASTER_INDICATORS:Indicator[] = [
  ...COMPLILAW_QUANTITATIVE_INDICATORS.map((item) => ({
    id:item.id,
    code:item.code,
    name:item.name,
    category:item.category,
    unit:item.unit,
    cycle:item.cycle,
    aggregation:"합계" as const,
    owner:item.owner,
    reviewer:"ESG 담당자",
    progress:item.progress,
    status:"미작성" as const,
    definition:`Complilaw 정량 데이터 항목 관리에서 동기화한 ${item.name}`,
    boundary:"연결된 조직·사업장과 보고기간",
    formula:item.code.startsWith("ENV-GHG-")?"확정된 인벤토리 배출량 자동 집계":"담당 부서 제출값 집계",
    dataSource:item.source??"Complilaw 기준정보",
    evidenceExample:"원천자료, 집계표, 승인 문서",
    frameworks:DEFAULT_MASTER_MAPPINGS.filter(mapping=>mapping.indicatorCode===item.code).map(mapping=>DEFAULT_MASTER_STANDARDS.find(standard=>standard.id===mapping.standardId)?.code??"").filter(Boolean),
    dueDate:"",
    active:item.active!==false,
  })),
  ...GRI_WORKBOOK_INDICATORS.map((item) => ({
    ...item,
    inputTemplate:item.inputTemplate,
    progress:0,
    status:"미작성" as const,
  })),
];

const navItems: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "대시보드", icon: "dashboard" },
  { id: "collection", label: "데이터 입력", icon: "database" },
  { id: "collection-request", label: "수집 요청", icon: "calendar" },
  { id: "review", label: "데이터 검토·승인", icon: "check" },
  { id: "quality", label: "온실가스 데이터 품질", icon: "alert" },
  { id: "inventory", label: "온실가스 인벤토리", icon: "leaf" },
  { id: "targets", label: "감축목표·이행계획", icon: "target" },
  { id: "scope3", label: "Scope 3·공급망", icon: "building" },
  { id: "evidence", label: "증빙자료", icon: "file" },
  { id: "indicators", label: "ESG 지표 관리", icon: "list" },
  { id: "metric-collection", label: "데이터 입력", icon: "database" },
  { id: "reports", label: "지속가능경영보고서", icon: "edit" },
  { id: "reference", label: "기준정보·규제 관리", icon: "settings" },
  { id: "audit", label: "변경 이력", icon: "clock" },
];

const NAV_GROUPS:{label:string;items:View[]}[]=[
  {label:"현황",items:["dashboard"]},
  {label:"온실가스 관리",items:["inventory","quality","targets"]},
  {label:"ESG 데이터·공시",items:["collection-request","metric-collection","review","evidence","reports"]},
  {label:"공급망 관리",items:["scope3"]},
  {label:"기준·운영관리",items:["indicators","reference","audit"]},
];

const VIEW_PATHS: Record<View, string> = {
  dashboard: "/",
  collection: "/data-collection",
  "collection-request": "/collection-request",
  review: "/review",
  quality: "/data-quality",
  inventory: "/inventory",
  targets: "/reduction-targets",
  scope3: "/scope3-supply-chain",
  evidence: "/evidence",
  indicators: "/indicators",
  "metric-collection": "/metric-collection",
  reports: "/reports",
  reference: "/reference-data",
  audit: "/audit",
  settings: "/settings",
};

function viewFromPathname(pathname: string) {
  const normalized = pathname
    .replace(/^\/sems2(?=\/|$)/, "")
    .replace(/\/+$/, "") || "/";
  if (normalized === "/collection-periods") return "collection-request";
  if (normalized === "/data-collection") return "metric-collection";
  return (Object.entries(VIEW_PATHS).find(([, path]) => path === normalized)?.[0] as View | undefined) ?? "dashboard";
}

/*
 * Previous UI demo fixtures are intentionally disabled.
 * Production workspaces start empty and are populated only from Supabase.
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
*/

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
function collectionPeriodLabel(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if (fromYear === toYear && fromMonth === toMonth) return `${fromYear}년 ${fromMonth}월`;
  if (fromYear === toYear && fromMonth === 1 && toMonth === 6) return `${fromYear}년 상반기`;
  if (fromYear === toYear && fromMonth === 7 && toMonth === 12) return `${fromYear}년 하반기`;
  if (fromYear === toYear) return `${fromYear}년 ${fromMonth}~${toMonth}월`;
  return `${fromYear}년 ${fromMonth}월~${toYear}년 ${toMonth}월`;
}
function ghgRequestTitle(from: string, to: string, scopes: Scope[]) {
  const scopeLabel = scopes.length ? scopes.map(scope => scope.replace("Scope ", "")).join("·") : "1·2";
  return `${collectionPeriodLabel(from, to)} Scope ${scopeLabel} 온실가스 데이터 수집`;
}
function metricRequestTitle(from: string, to: string, indicatorIds: number[], indicators: Indicator[]) {
  const categories = [...new Set(indicatorIds.map(id => indicators.find(indicator => indicator.id === id)?.category).filter(Boolean))];
  const content = categories.length ? categories.join("·") : "ESG";
  return `${collectionPeriodLabel(from, to)} ${content} 정량데이터 수집`;
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
  const key = ["확정","완료","승인"].includes(status) ? "done" : ["검토대기","수집중","진행중","검토중","제출","확인 필요"].includes(status) ? "pending" : ["반려","보완 요청","지연","오류","만료"].includes(status) ? "rejected" : "draft";
  return <span className={`status-badge ${key}`}><span className="status-dot" />{status}</span>;
}

function CollectionTaskPreview<TTarget extends string | number>({
  tasks,
  availableCount,
  retainedCount,
  existingCount,
  confirmedCount,
  preservedCount = 0,
}: {
  tasks: CollectionTask<TTarget>[];
  availableCount: number;
  retainedCount: number;
  existingCount: number;
  confirmedCount: number;
  preservedCount?: number;
}) {
  const cycleCounts = countTasksByCycle(tasks);
  const newCount = Math.max(0, availableCount - retainedCount);
  return <div className="collection-task-preview" aria-live="polite">
    <div className="collection-task-preview-title"><span><Icon name="list" size={17}/></span><div><strong>세부 수집 항목 자동 전개</strong><p>선택한 기간을 수집 주기에 맞춰 실제 입력 작업으로 나눕니다.</p></div></div>
    <div className="collection-task-cycle-counts">{(Object.entries(cycleCounts) as [CollectionCycle,number][]).filter(([,count])=>count>0).map(([cycle,count])=><span key={cycle}><strong>{cycle}</strong>{count}건</span>)}</div>
    <div className="collection-task-result">
      <div><span>생성 후보</span><strong>{tasks.length}<small>건</small></strong></div>
      <div className="new"><span>신규 생성</span><strong>{newCount}<small>건</small></strong></div>
      {retainedCount>0&&<div><span>현재 요청 유지</span><strong>{retainedCount}<small>건</small></strong></div>}
      <div className="duplicate"><span>기존 요청 제외</span><strong>{existingCount}<small>건</small></strong></div>
      <div className="confirmed"><span>확정 완료 제외</span><strong>{confirmedCount}<small>건</small></strong></div>
    </div>
    {preservedCount>0&&<p className="collection-task-preserved"><Icon name="lock" size={14}/>이미 입력된 {preservedCount}건은 범위를 바꿔도 현재 요청에 유지됩니다.</p>}
    {!availableCount&&<p className="collection-task-empty"><Icon name="alert" size={14}/>새로 만들거나 유지할 수집 항목이 없습니다. 기간·법인·항목을 다시 선택해 주세요.</p>}
  </div>;
}

function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{children && <div className="page-actions">{children}</div>}</div>;
}

function Overlay({ title, eyebrow, description, onClose, children, size = "normal" }: { title: string; eyebrow: string; description?: string; onClose: () => void; children: ReactNode; size?: "normal" | "small" }) {
  useEffect(() => { const close = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", close); document.body.classList.add("menu-open"); return () => { window.removeEventListener("keydown", close); document.body.classList.remove("menu-open"); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className={`record-modal ${size === "small" ? "small-modal" : ""}`} role="dialog" aria-modal="true"><div className="modal-header"><div><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="close" /></button></div>{children}</div></div>;
}

export default function Home() {
  const { profile, syncStatus, canWrite, canReview, canManage, isAdmin } = useSemsAuth();
  const pathname = usePathname();
  const router = useRouter();
  const requestedView = viewFromPathname(pathname);
  const routeForbidden = (["review","collection-request"].includes(requestedView) && !canManage) || (requestedView === "settings" && !canManage);
  const activeView = routeForbidden ? "dashboard" : requestedView;
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [factors, setFactors] = useState<EmissionFactor[]>(DEFAULT_MASTER_FACTORS);
  const [formulas, setFormulas] = useState<CalculationFormula[]>(DEFAULT_CALCULATION_FORMULAS);
  const [activityMasters, setActivityMasters] = useState<ActivityMaster[]>(DEFAULT_ACTIVITY_MASTERS);
  const [assetUnits, setAssetUnits] = useState<AssetUnit[]>([]);
  const [scope3Fields, setScope3Fields] = useState<Scope3FieldDefinition[]>(DEFAULT_MASTER_SCOPE3_FIELDS);
  const [disclosureStandards, setDisclosureStandards] = useState<DisclosureStandard[]>(DEFAULT_MASTER_STANDARDS);
  const [regulations, setRegulations] = useState<ComplianceRegulation[]>(DEFAULT_MASTER_REGULATIONS);
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [productMaterials, setProductMaterials] = useState<ProductMaterialMaster[]>([]);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [disclosureMappings, setDisclosureMappings] = useState<DisclosureMapping[]>(DEFAULT_MASTER_MAPPINGS);
  const [scope3Requests, setScope3Requests] = useState<Scope3DataRequest[]>([]);
  const [diagnosticTemplates, setDiagnosticTemplates] = useState<DiagnosticTemplate[]>([]);
  const [supplyChainAssessments, setSupplyChainAssessments] = useState<SupplyChainAssessment[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(normalizeMetricIndicators(DEFAULT_MASTER_INDICATORS));
  const [metricRequests, setMetricRequests] = useState<MetricRequest[]>([]);
  const [metricSubmissions, setMetricSubmissions] = useState<MetricSubmission[]>([]);
  const [reports, setReports] = useState<SustainabilityReport[]>([]);
  const [targets, setTargets] = useState<ReductionTarget[]>([]);
  const [plans, setPlans] = useState<ReductionPlan[]>([]);
  const [periods, setPeriods] = useState<CollectionPeriod[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [criteria, setCriteria] = useState<CollectionCriteria>({ variance: 10, evidenceRequired: true, lockConfirmed: true, defaultYear: "2026" });
  const [noticePrefs, setNoticePrefs] = useState<NotificationPrefs>({ deadline: true, review: true, rejected: true, weekly: false });
  const [organizations, setOrganizations] = useState<Record<string,string[]>>({});
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const activeNavGroup = NAV_GROUPS.find(group => group.items.includes(activeView))?.label ?? NAV_GROUPS[0].label;
  const [openNavGroups, setOpenNavGroups] = useState<string[]>([activeNavGroup]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [collectionKind, setCollectionKind] = useState<"ghg"|"esg">("ghg");
  const [collectionRequestView, setCollectionRequestView] = useState<"requests"|"coverage">("requests");
  const [reviewKind, setReviewKind] = useState<"ghg"|"esg">("ghg");
  const [editing, setEditing] = useState<ActivityRecord | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedPeriods = localStorage.getItem("sems2-periods"); if (savedPeriods) setPeriods(JSON.parse(savedPeriods));
        const savedRecords = localStorage.getItem("sems2-records"); if (savedRecords) setRecords((JSON.parse(savedRecords) as ActivityRecord[]).map(r => ({ ...r, collectionId: r.collectionId ?? (r.period === "2026-05" ? "CP-2026-06" : "CP-2026-07"), active: r.active ?? true, source: r.source === "한국전력" ? "전력" : r.source, category: r.category === "임직원 통근" ? "Cat.7 임직원 통근" : r.category })));
        const savedFactors = localStorage.getItem("sems2-factors"); if (savedFactors) { const parsed = JSON.parse(savedFactors) as EmissionFactor[]; setFactors(mergeMasterRows(parsed.length ? parsed : DEFAULT_MASTER_FACTORS, DEFAULT_MASTER_FACTORS)); }
        const savedFormulas = localStorage.getItem("sems2-formulas"); if (savedFormulas) { const parsed = JSON.parse(savedFormulas) as CalculationFormula[]; setFormulas(mergeMasterRows(parsed.length ? parsed : DEFAULT_CALCULATION_FORMULAS, DEFAULT_CALCULATION_FORMULAS)); }
        const savedActivityMasters = localStorage.getItem("sems2-activity-masters"); if (savedActivityMasters) { const parsed = JSON.parse(savedActivityMasters) as ActivityMaster[]; setActivityMasters(parsed.length ? parsed : DEFAULT_ACTIVITY_MASTERS); }
        const savedAssetUnits = localStorage.getItem("sems2-asset-units"); if (savedAssetUnits) setAssetUnits(JSON.parse(savedAssetUnits));
        const savedScope3Fields = localStorage.getItem("sems2-scope3-fields"); if (savedScope3Fields) setScope3Fields(mergeMasterRows(JSON.parse(savedScope3Fields),DEFAULT_MASTER_SCOPE3_FIELDS));
        const savedDisclosureStandards = localStorage.getItem("sems2-disclosure-standards"); if (savedDisclosureStandards) setDisclosureStandards(mergeMasterRows(JSON.parse(savedDisclosureStandards),DEFAULT_MASTER_STANDARDS));
        const savedRegulations = localStorage.getItem("sems2-regulations"); if (savedRegulations) setRegulations(mergeMasterRows(JSON.parse(savedRegulations),DEFAULT_MASTER_REGULATIONS));
        const savedSuppliers = localStorage.getItem("sems2-suppliers"); if (savedSuppliers) setSuppliers(JSON.parse(savedSuppliers));
        const savedProductMaterials = localStorage.getItem("sems2-product-materials"); if (savedProductMaterials) setProductMaterials(JSON.parse(savedProductMaterials));
        const savedTransportRoutes = localStorage.getItem("sems2-transport-routes"); if (savedTransportRoutes) setTransportRoutes(JSON.parse(savedTransportRoutes));
        const savedDisclosureMappings = localStorage.getItem("sems2-disclosure-mappings"); if (savedDisclosureMappings) setDisclosureMappings(mergeMasterRows(JSON.parse(savedDisclosureMappings),DEFAULT_MASTER_MAPPINGS));
        const savedScope3Requests = localStorage.getItem("sems2-scope3-requests"); if (savedScope3Requests) setScope3Requests(JSON.parse(savedScope3Requests));
        const savedDiagnosticTemplates = localStorage.getItem("sems2-diagnostic-templates"); if (savedDiagnosticTemplates) setDiagnosticTemplates(JSON.parse(savedDiagnosticTemplates));
        const savedSupplyChainAssessments = localStorage.getItem("sems2-supply-chain-assessments"); if (savedSupplyChainAssessments) setSupplyChainAssessments(JSON.parse(savedSupplyChainAssessments));
        const savedEvidence = localStorage.getItem("sems2-evidence"); if (savedEvidence) setEvidence(JSON.parse(savedEvidence));
        const savedIndicators = localStorage.getItem("sems2-indicators");
        const rawIndicators = savedIndicators ? mergeMasterRows(JSON.parse(savedIndicators),DEFAULT_MASTER_INDICATORS) : DEFAULT_MASTER_INDICATORS;
        const normalizedIndicators = normalizeMetricIndicators(rawIndicators);
        const indicatorIdMap = createMetricIndicatorIdMap(rawIndicators,normalizedIndicators);
        setIndicators(normalizedIndicators);
        const savedMetricRequests = localStorage.getItem("sems2-metric-requests"); if (savedMetricRequests) setMetricRequests(normalizeMetricRequests(JSON.parse(savedMetricRequests) as MetricRequest[],indicatorIdMap));
        const savedMetricSubmissions = localStorage.getItem("sems2-metric-submissions"); if (savedMetricSubmissions) setMetricSubmissions(normalizeMetricSubmissions(JSON.parse(savedMetricSubmissions) as MetricSubmission[],indicatorIdMap,normalizedIndicators));
        const savedReports = localStorage.getItem("sems2-reports"); if (savedReports) setReports(normalizeReportDefaults(JSON.parse(savedReports) as SustainabilityReport[],indicatorIdMap));
        const savedTargets = localStorage.getItem("sems2-targets"); if (savedTargets) setTargets(JSON.parse(savedTargets));
        const savedPlans = localStorage.getItem("sems2-reduction-plans"); if (savedPlans) setPlans(JSON.parse(savedPlans));
        const savedAudit = localStorage.getItem("sems2-audit"); if (savedAudit) setAudit(JSON.parse(savedAudit));
        const savedCriteria = localStorage.getItem("sems2-criteria"); if (savedCriteria) setCriteria(JSON.parse(savedCriteria));
        const savedNotices = localStorage.getItem("sems2-notice-prefs"); if (savedNotices) setNoticePrefs(JSON.parse(savedNotices));
        const savedOrganizations = localStorage.getItem("sems2-organizations"); if (savedOrganizations) setOrganizations(JSON.parse(savedOrganizations));
      } catch { /* 손상된 캐시는 로그인 시 불러온 서버 값으로 대체됩니다. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!hydrated || !canWrite) return;
    const payload: Record<string, unknown> = {
      "sems2-periods": periods,
      "sems2-records": records,
      "sems2-factors": factors,
      "sems2-formulas": formulas,
      "sems2-activity-masters": activityMasters,
      "sems2-asset-units": assetUnits,
      "sems2-scope3-fields": scope3Fields,
      "sems2-disclosure-standards": disclosureStandards,
      "sems2-regulations": regulations,
      "sems2-suppliers": suppliers,
      "sems2-product-materials": productMaterials,
      "sems2-transport-routes": transportRoutes,
      "sems2-disclosure-mappings": disclosureMappings,
      "sems2-scope3-requests": scope3Requests,
      "sems2-diagnostic-templates": diagnosticTemplates,
      "sems2-supply-chain-assessments": supplyChainAssessments,
      "sems2-evidence": evidence,
      "sems2-indicators": indicators,
      "sems2-metric-requests": metricRequests,
      "sems2-metric-submissions": metricSubmissions,
      "sems2-reports": reports,
      "sems2-targets": targets,
      "sems2-reduction-plans": plans,
      "sems2-audit": audit,
      "sems2-criteria": criteria,
      "sems2-notice-prefs": noticePrefs,
      "sems2-organizations": organizations,
    };
    for (const [key, value] of Object.entries(payload)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
    window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT));
  }, [periods, records, factors, formulas, activityMasters, assetUnits, scope3Fields, disclosureStandards, regulations, suppliers, productMaterials, transportRoutes, disclosureMappings, scope3Requests, diagnosticTemplates, supplyChainAssessments, evidence, indicators, metricRequests, metricSubmissions, reports, targets, plans, audit, criteria, noticePrefs, organizations, hydrated, canWrite]);
  useEffect(() => { document.body.classList.toggle("menu-open", mobileMenu || modalOpen || bulkOpen || guideOpen); return () => document.body.classList.remove("menu-open"); }, [mobileMenu, modalOpen, bulkOpen, guideOpen]);
  useEffect(() => {
    if (routeForbidden) router.replace(VIEW_PATHS.dashboard);
  }, [routeForbidden, router]);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const addAudit = (action: string, target: string, detail: string, actor = profile.display_name || profile.email || "사용자") => {
    setAudit(current => [{ id: Date.now(), at: nowLabel(), actor, action, target, detail }, ...current].slice(0, 500));
  };
  const navigate = (view: View) => {
    if (view === "review" && !canReview) { showToast("검토·승인은 관리자 권한이 필요합니다."); return; }
    if (view === "settings" && !canManage) { showToast("시스템 설정은 관리자 권한이 필요합니다."); return; }
    setMobileMenu(false);
    setProfileOpen(false);
    const targetGroup=NAV_GROUPS.find(group=>group.items.includes(view))?.label;
    if(targetGroup)setOpenNavGroups(current=>current.includes(targetGroup)?current:[...current,targetGroup]);
    if (pathname !== VIEW_PATHS[view]) router.push(VIEW_PATHS[view]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openForm = (record?: ActivityRecord) => {
    if (!canWrite) { showToast("조회자는 자료를 등록하거나 수정할 수 없습니다."); return; }
    if (record?.status === "검토대기") { showToast("검토 대기 자료는 검토·승인 메뉴에서 처리해 주세요."); return; }
    if (record?.locked || periods.find(period => period.id === record?.collectionId)?.status === "잠금") {
      showToast("잠금된 자료는 수정할 수 없습니다. 수집 기간을 다시 열어야 합니다.");
      return;
    }
    setEditing(record ?? null); setModalOpen(true);
  };
  const saveRecord = (record: ActivityRecord) => {
    if (!canWrite) { showToast("조회자는 자료를 저장할 수 없습니다."); return; }
    const exists = record.id !== 0 && records.some(item => item.id === record.id);
    const duplicate = records.some(item => item.id !== record.id && item.collectionId === record.collectionId && item.company === record.company && item.site === record.site && item.period === record.period && item.scope === record.scope && item.category === record.category && item.source === record.source);
    if (duplicate) { showToast("같은 수집기간·사업장·귀속월·활동자료가 이미 등록되어 있습니다."); return; }
    const saved = exists ? record : { ...record, id: Date.now(), createdAt: nowLabel(), active: true };
    setRecords(exists ? records.map(item => item.id === saved.id ? saved : item) : [saved, ...records]);
    addAudit(exists ? "자료 수정" : "자료 등록", `${saved.company} · ${saved.source}`, `${saved.period} ${saved.scope} 활동자료 ${formatNumber(saved.usage, saved.usage < 100 ? 1 : 0)} ${saved.unit}`);
    setModalOpen(false); setEditing(null); showToast(exists ? "입력 자료를 수정했습니다." : "새 활동자료를 저장했습니다.");
  };
  const updateRecords = (next: ActivityRecord[], auditInfo?: { action: string; target: string; detail: string }) => { if(!canWrite){showToast("조회자는 자료를 변경할 수 없습니다.");return;} setRecords(next); if (auditInfo) addAudit(auditInfo.action, auditInfo.target, auditInfo.detail); };
  const importRecords = (rows: ActivityRecord[]) => {
    if(!canWrite){showToast("조회자는 자료를 등록할 수 없습니다.");return;}
    setRecords(current => [...rows, ...current]);
    addAudit("Excel 일괄등록", `${rows.length}건`, `${rows.length}건의 활동자료를 검증 후 일괄 등록했습니다.`);
    setBulkOpen(false); showToast(`${rows.length}건을 일괄 등록했습니다.`);
  };
  const exportBackup = () => {
    const payload = { version: 8, exportedAt: new Date().toISOString(), periods, records, factors, formulas, activityMasters, assetUnits, scope3Fields, disclosureStandards, regulations, suppliers, productMaterials, transportRoutes, disclosureMappings, scope3Requests, diagnosticTemplates, supplyChainAssessments, evidence, indicators, metricRequests, metricSubmissions, reports, targets, plans, audit, criteria, noticePrefs, organizations };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `SEMS_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    showToast("전체 운영 데이터를 백업했습니다.");
  };
  const restoreBackup = (payload: Record<string, unknown>) => {
    if(!canManage){showToast("백업 복원은 관리자만 실행할 수 있습니다.");return;}
    if (!Array.isArray(payload.periods) || !Array.isArray(payload.records) || !Array.isArray(payload.factors)) { showToast("SEMS 백업 파일 형식이 아닙니다."); return; }
    const restoredIndicatorSource=Array.isArray(payload.indicators)?mergeMasterRows(payload.indicators as Indicator[],DEFAULT_MASTER_INDICATORS):DEFAULT_MASTER_INDICATORS;
    const restoredIndicators=normalizeMetricIndicators(restoredIndicatorSource);
    const restoredIndicatorIdMap=createMetricIndicatorIdMap(restoredIndicatorSource,restoredIndicators);
    setPeriods(payload.periods as CollectionPeriod[]); setRecords(payload.records as ActivityRecord[]); setFactors(mergeMasterRows(payload.factors as EmissionFactor[],DEFAULT_MASTER_FACTORS));
    if (Array.isArray(payload.formulas)) setFormulas(mergeMasterRows(payload.formulas as CalculationFormula[],DEFAULT_CALCULATION_FORMULAS)); if (Array.isArray(payload.activityMasters)) setActivityMasters(payload.activityMasters as ActivityMaster[]);
    if (Array.isArray(payload.assetUnits)) setAssetUnits(payload.assetUnits as AssetUnit[]); if (Array.isArray(payload.scope3Fields)) setScope3Fields(mergeMasterRows(payload.scope3Fields as Scope3FieldDefinition[],DEFAULT_MASTER_SCOPE3_FIELDS));
    if (Array.isArray(payload.disclosureStandards)) setDisclosureStandards(mergeMasterRows(payload.disclosureStandards as DisclosureStandard[],DEFAULT_MASTER_STANDARDS)); if (Array.isArray(payload.regulations)) setRegulations(mergeMasterRows(payload.regulations as ComplianceRegulation[],DEFAULT_MASTER_REGULATIONS));
    if (Array.isArray(payload.suppliers)) setSuppliers(payload.suppliers as SupplierMaster[]); if (Array.isArray(payload.productMaterials)) setProductMaterials(payload.productMaterials as ProductMaterialMaster[]);
    if (Array.isArray(payload.transportRoutes)) setTransportRoutes(payload.transportRoutes as TransportRoute[]); if (Array.isArray(payload.disclosureMappings)) setDisclosureMappings(mergeMasterRows(payload.disclosureMappings as DisclosureMapping[],DEFAULT_MASTER_MAPPINGS));
    if (Array.isArray(payload.scope3Requests)) setScope3Requests(payload.scope3Requests as Scope3DataRequest[]); if (Array.isArray(payload.diagnosticTemplates)) setDiagnosticTemplates(payload.diagnosticTemplates as DiagnosticTemplate[]);
    if (Array.isArray(payload.supplyChainAssessments)) setSupplyChainAssessments(payload.supplyChainAssessments as SupplyChainAssessment[]);
    if (Array.isArray(payload.evidence)) setEvidence(payload.evidence as EvidenceItem[]); setIndicators(restoredIndicators); if (Array.isArray(payload.audit)) setAudit(payload.audit as AuditEvent[]);
    if (Array.isArray(payload.metricRequests)) setMetricRequests(normalizeMetricRequests(payload.metricRequests as MetricRequest[],restoredIndicatorIdMap)); if (Array.isArray(payload.metricSubmissions)) setMetricSubmissions(normalizeMetricSubmissions(payload.metricSubmissions as MetricSubmission[],restoredIndicatorIdMap,restoredIndicators));
    if (Array.isArray(payload.reports)) setReports(normalizeReportDefaults(payload.reports as SustainabilityReport[],restoredIndicatorIdMap));
    if (Array.isArray(payload.targets)) setTargets(payload.targets as ReductionTarget[]); if (Array.isArray(payload.plans)) setPlans(payload.plans as ReductionPlan[]);
    if (payload.criteria) setCriteria(payload.criteria as CollectionCriteria); if (payload.noticePrefs) setNoticePrefs(payload.noticePrefs as NotificationPrefs);
    if (payload.organizations) setOrganizations(payload.organizations as Record<string,string[]>);
    addAudit("데이터 복원", "전체 운영 데이터", "백업 파일에서 기간·활동자료·기준정보를 복원했습니다."); showToast("백업 데이터를 복원했습니다.");
  };

  const roleLabel = { admin: "시스템 관리자", manager: "기획실 관리자", editor: "자료 입력자", viewer: "조회자" }[profile.role];
  const syncLabel = syncStatus === "saving" ? "서버 저장 중" : syncStatus === "error" ? "서버 저장 확인 필요" : canWrite ? "서버 저장 완료" : "서버 조회 전용";
  const allowedNavItems = navItems.filter(item => (!["review","collection-request"].includes(item.id) || canManage) && (item.id !== "quality" || canReview));
  const organizationNames = Object.keys(organizations);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span>S</span></div><div><strong>SEMS</strong><small>Sewon ESG Management</small></div><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기"><Icon name="close" /></button></div>
      <nav className="main-nav" aria-label="주 메뉴">{NAV_GROUPS.map(group=>{const open=openNavGroups.includes(group.label);return <div className={`nav-section ${open?"open":"collapsed"}`} key={group.label}><button type="button" className="nav-group-toggle" aria-expanded={open} onClick={()=>setOpenNavGroups(current=>open?current.filter(label=>label!==group.label):[...current,group.label])}><span>{group.label}</span><Icon name="chevron" size={13}/></button><div className="nav-group-items" aria-hidden={!open}><div className="nav-group-items-inner">{group.items.map(id=>allowedNavItems.find(item=>item.id===id)).filter((item):item is (typeof navItems)[number]=>Boolean(item)).map(item=><NavButton key={item.id} item={item} active={activeView===item.id} onClick={()=>navigate(item.id)} count={item.id==="review"?records.filter(r=>r.status==="검토대기").length+metricSubmissions.filter(item=>item.status==="검토대기").length:item.id==="scope3"?scope3Requests.filter(request=>["대기중","진행중","재요청"].includes(request.status)).length:undefined}/>)}</div></div></div>})}</nav>
      <div className="sidebar-bottom">{canManage&&<NavButton item={{ id:"settings", label:"시스템 설정", icon:"settings" }} active={activeView==="settings"} onClick={()=>navigate("settings")}/>}<div className="help-card"><div className="help-icon">?</div><strong>도움이 필요하신가요?</strong><p>입력 기준과 실제 사용 순서를 확인하세요.</p><button onClick={() => { setGuideOpen(true); setMobileMenu(false); }}>사용 가이드 <Icon name="arrow" size={14} /></button></div></div>
    </aside>
    {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" />}
    <div className="workspace">
      <header className="topbar"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Icon name="menu" /></button><div className="breadcrumb"><span>SEMS</span><Icon name="chevron" size={14} /><strong>{navItems.find(n => n.id === activeView)?.label ?? "시스템 설정"}</strong></div><div className="topbar-actions"><div className={`sync-label operating ${syncStatus}`}><span /> {syncLabel}</div><button className="icon-button notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label="알림"><Icon name="bell" />{!notificationsRead && <span className="notification-dot" />}</button><button className="profile profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><div className="avatar">{(profile.display_name || profile.email || "S").slice(0,1)}</div><div><strong>{profile.display_name || profile.email}</strong><span>{profile.department || profile.organization?.name || "소속 미지정"} · {roleLabel}</span></div><Icon name="chevron" size={15} /></button></div>
        {notificationsOpen && <NotificationPanel periods={periods} records={records} targets={targets} plans={plans} onClose={() => setNotificationsOpen(false)} onRead={() => { setNotificationsRead(true); setNotificationsOpen(false); showToast("모든 알림을 확인했습니다."); }} />}
        {profileOpen && <ProfilePanel profileName={profile.display_name || profile.email || "사용자"} detail={`${profile.department || profile.organization?.name || "소속 미지정"} · ${roleLabel}`} canManage={canManage} isAdmin={isAdmin} onSettings={() => navigate("settings")} onBackup={exportBackup} />}
      </header>
      <main className="content">
        {activeView === "dashboard" && <Dashboard records={records} periods={periods} targets={targets} plans={plans} organizationNames={organizationNames} onNavigate={navigate} onNew={() => openForm()} />}
        {activeView === "collection" && <Collection records={records} periods={periods} criteria={criteria} organizationNames={organizationNames} onNew={() => openForm()} onBulk={() => setBulkOpen(true)} onEdit={openForm} onChange={updateRecords} showToast={showToast} />}
        {activeView === "review" && <><CollectionKindHeader kind={reviewKind} onChange={setReviewKind} description="온실가스와 기타 ESG 제출자료를 검토하고 승인·반려합니다." />{reviewKind==="ghg"?<Review records={records} periods={periods} criteria={criteria} onChange={updateRecords} showToast={showToast} />:<MetricCollection mode="review" requests={metricRequests} submissions={metricSubmissions} indicators={indicators} organizations={organizations} canWrite={canWrite} canManage={canManage} currentOrganization={profile.organization?.name??""} defaultOwner={profile.display_name||profile.email||""} defaultDepartment={profile.department||""} onRequestsChange={setMetricRequests} onSubmissionsChange={setMetricSubmissions} onIndicatorsChange={setIndicators} addAudit={addAudit} showToast={showToast} />}</>}
        {activeView === "quality" && <DataQuality records={records} periods={periods} criteria={criteria} onNavigate={navigate} />}
        {activeView === "inventory" && <Inventory records={records} targets={targets} organizationNames={organizationNames} onNavigate={navigate} showToast={showToast} />}
        {activeView === "targets" && <TargetsAndPlans targets={targets} plans={plans} records={records} organizations={organizations} onTargetsChange={items=>{if(!canManage){showToast("감축목표 관리는 관리자 권한이 필요합니다.");return;}setTargets(items);}} onPlansChange={items=>{if(!canManage){showToast("감축계획 관리는 관리자 권한이 필요합니다.");return;}setPlans(items);}} addAudit={addAudit} showToast={showToast} />}
        {activeView === "scope3" && <Scope3SupplyChain requests={scope3Requests} suppliers={suppliers} formulas={formulas} fields={scope3Fields} templates={diagnosticTemplates} assessments={supplyChainAssessments} organizations={organizations} canManage={canManage} onRequestsChange={setScope3Requests} onTemplatesChange={setDiagnosticTemplates} onAssessmentsChange={setSupplyChainAssessments} addAudit={addAudit} showToast={showToast} />}
        {activeView === "evidence" && <Evidence items={evidence} onChange={setEvidence} showToast={showToast} />}
        {activeView === "indicators" && <Indicators items={indicators} onChange={setIndicators} showToast={showToast} />}
        {activeView === "collection-request" && <><CollectionKindHeader kind={collectionKind} onChange={setCollectionKind} description="관리자가 수집 범위와 기간을 설정합니다." /><div className="collection-task-filter" role="tablist" aria-label="수집 요청 화면"><button role="tab" aria-selected={collectionRequestView==="requests"} className={collectionRequestView==="requests"?"active":""} onClick={()=>setCollectionRequestView("requests")}><Icon name="calendar" size={15}/>수집 요청</button><button role="tab" aria-selected={collectionRequestView==="coverage"} className={collectionRequestView==="coverage"?"active":""} onClick={()=>setCollectionRequestView("coverage")}><Icon name="dashboard" size={15}/>수집 커버리지</button></div>{collectionRequestView==="coverage"?<CollectionCoverage kind={collectionKind} periods={periods} records={records} metricRequests={metricRequests} metricSubmissions={metricSubmissions} indicators={indicators} organizationNames={organizationNames}/>:collectionKind==="ghg"?<Periods periods={periods} records={records} organizationNames={organizationNames} onChange={setPeriods} addAudit={addAudit} showToast={showToast}/>:<MetricCollection mode="request" requests={metricRequests} submissions={metricSubmissions} indicators={indicators} organizations={organizations} canWrite={canWrite} canManage={canManage} currentOrganization={profile.organization?.name??""} defaultOwner={profile.display_name||profile.email||""} defaultDepartment={profile.department||""} onRequestsChange={setMetricRequests} onSubmissionsChange={setMetricSubmissions} onIndicatorsChange={setIndicators} addAudit={addAudit} showToast={showToast} />}</>}
        {activeView === "metric-collection" && <><CollectionKindHeader kind={collectionKind} onChange={setCollectionKind} description="배정된 온실가스와 기타 ESG 데이터를 입력하고 제출합니다." />{collectionKind==="ghg"?<Collection records={records} periods={periods} criteria={criteria} organizationNames={organizationNames} onNew={() => openForm()} onBulk={() => setBulkOpen(true)} onEdit={openForm} onChange={updateRecords} showToast={showToast} />:<MetricCollection mode="input" requests={metricRequests} submissions={metricSubmissions} indicators={indicators} organizations={organizations} canWrite={canWrite} canManage={canManage} currentOrganization={profile.organization?.name??""} defaultOwner={profile.display_name||profile.email||""} defaultDepartment={profile.department||""} onRequestsChange={setMetricRequests} onSubmissionsChange={setMetricSubmissions} onIndicatorsChange={setIndicators} addAudit={addAudit} showToast={showToast} />}</>}
        {activeView === "reports" && <ReportBuilder reports={reports} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators} standards={disclosureStandards} organizationNames={organizationNames} canManage={canManage} onChange={setReports} addAudit={addAudit} showToast={showToast} />}
        {activeView === "reference" && <ReferenceManagement factors={factors} formulas={formulas} activityMasters={activityMasters} assetUnits={assetUnits} scope3Fields={scope3Fields} standards={disclosureStandards} regulations={regulations} suppliers={suppliers} productMaterials={productMaterials} transportRoutes={transportRoutes} disclosureMappings={disclosureMappings} indicators={indicators} organizations={organizations} canManage={canManage} onFactorsChange={setFactors} onFormulasChange={setFormulas} onActivityMastersChange={setActivityMasters} onAssetUnitsChange={setAssetUnits} onScope3FieldsChange={setScope3Fields} onStandardsChange={setDisclosureStandards} onRegulationsChange={setRegulations} onSuppliersChange={setSuppliers} onProductMaterialsChange={setProductMaterials} onTransportRoutesChange={setTransportRoutes} onDisclosureMappingsChange={setDisclosureMappings} addAudit={addAudit} showToast={showToast} />}
        {activeView === "audit" && <AuditLog items={audit} showToast={showToast} />}
        {activeView === "settings" && <Settings factors={factors} onFactorsChange={setFactors} criteria={criteria} onCriteriaChange={setCriteria} noticePrefs={noticePrefs} onNoticePrefsChange={setNoticePrefs} organizations={organizations} onOrganizationsChange={setOrganizations} onExport={exportBackup} onRestore={restoreBackup} showToast={showToast} />}
      </main>
    </div>
    {modalOpen && <RecordModal record={editing} records={records} periods={periods} factors={factors} criteria={criteria} organizations={organizations} defaultOwner={profile.display_name || profile.email || ""} defaultDepartment={profile.department || ""} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveRecord} />}
    {bulkOpen && <BulkImport records={records} periods={periods} factors={factors} organizations={organizations} onClose={() => setBulkOpen(false)} onImport={importRecords} />}
    {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
  </div>;
}

function NavButton({ item, active, onClick, count }: { item: { id: View; label: string; icon: IconName }; active: boolean; onClick: () => void; count?: number }) {
  return <Link className={`nav-button ${active ? "active" : ""}`} href={VIEW_PATHS[item.id]} aria-current={active?"page":undefined} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onClick();}}><Icon name={item.icon}/><span>{item.label}</span>{count?<em>{count}</em>:null}</Link>;
}

function CollectionKindHeader({kind,onChange,description}:{kind:"ghg"|"esg";onChange:(kind:"ghg"|"esg")=>void;description:string}) {
  return <section className="collection-hub"><div><span>데이터 구분</span><strong>{description}</strong></div><div className="collection-kind-filter" role="group" aria-label="데이터 구분 필터"><button className={kind==="ghg"?"active":""} onClick={()=>onChange("ghg")}><Icon name="leaf" size={16}/><span>온실가스</span><small>Scope 1·2·3</small></button><button className={kind==="esg"?"active":""} onClick={()=>onChange("esg")}><Icon name="list" size={16}/><span>기타 ESG</span><small>환경·사회·지배구조</small></button></div></section>;
}

const COVERAGE_STATUSES: readonly (CoverageStatus | "기한초과")[] = ["미요청", "미입력", "작성중", "검토대기", "반려", "확정", "기한초과"];
type CoverageFilter = "전체" | CoverageStatus | "기한초과";

function coverageTone(status: string) {
  return {
    미요청: "unrequested",
    미입력: "missing",
    작성중: "draft",
    검토대기: "pending",
    반려: "rejected",
    확정: "confirmed",
    기한초과: "overdue",
  }[status] ?? "missing";
}

function groupCoverageByCell(items: CoverageItem<string | number>[]) {
  const grouped = new Map<string, CoverageItem<string | number>[]>();
  items.forEach(item => {
    const key = `${item.month}|${item.company}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });
  return grouped;
}

function CollectionCoverage({
  kind,
  periods,
  records,
  metricRequests,
  metricSubmissions,
  indicators,
  organizationNames,
}: {
  kind: "ghg" | "esg";
  periods: CollectionPeriod[];
  records: ActivityRecord[];
  metricRequests: MetricRequest[];
  metricSubmissions: MetricSubmission[];
  indicators: Indicator[];
  organizationNames: string[];
}) {
  const currentYear = String(new Date().getFullYear());
  const availableYears = useMemo(() => [...new Set([
    currentYear,
    ...periods.flatMap(period => [period.dataFrom.slice(0, 4), period.dataTo.slice(0, 4)]),
    ...metricRequests.flatMap(request => [request.periodFrom.slice(0, 4), request.periodTo.slice(0, 4)]),
  ].filter(Boolean))].sort((a, b) => b.localeCompare(a)), [currentYear, metricRequests, periods]);
  const [requestedYear, setRequestedYear] = useState(currentYear);
  const [requestedTarget, setRequestedTarget] = useState("all");
  const [requestedStatus, setRequestedStatus] = useState<CoverageFilter>("전체");
  const year = availableYears.includes(requestedYear) ? requestedYear : availableYears[0] ?? currentYear;
  const companies = useMemo(() => [...new Set([
    ...organizationNames,
    ...periods.flatMap(period => period.companies),
    ...metricRequests.flatMap(request => request.companies),
  ])].sort((a, b) => a.localeCompare(b, "ko")), [metricRequests, organizationNames, periods]);
  const targetOptions = useMemo(() => kind === "ghg"
    ? (["Scope 1", "Scope 2", "Scope 3"] as Scope[]).map(scope => ({ id: scope, label: scope, cycle: "월" }))
    : indicators.filter(indicator => indicator.active).map(indicator => ({ id: String(indicator.id), label: `${indicator.code} · ${indicator.name}`, cycle: indicator.cycle })), [indicators, kind]);
  const target = requestedTarget === "all" || targetOptions.some(option => option.id === requestedTarget) ? requestedTarget : "all";
  const today = new Date().toISOString().slice(0, 10);
  const coverageItems: CoverageItem<string | number>[] = useMemo(() => kind === "ghg"
    ? buildGHGCoverage({
      year,
      companies,
      targetIds: targetOptions.map(option => option.id as Scope),
      requests: periods.map(period => ({
        id: period.id,
        periodFrom: period.dataFrom,
        periodTo: period.dataTo,
        dueDate: period.dueDate,
        companies: period.companies,
        targetIds: period.scopes,
        taskKeys: period.taskKeys,
      })),
      records: records.map(record => ({
        requestId: record.collectionId,
        company: record.company,
        month: record.period,
        targetId: record.scope,
        status: record.status,
        active: record.active,
      })),
      today,
    })
    : buildMetricCoverage({
      year,
      companies,
      targetIds: targetOptions.map(option => Number(option.id)),
      targetCycles: Object.fromEntries(targetOptions.map(option => [Number(option.id), option.cycle])),
      requests: metricRequests.map(request => ({
        id: request.id,
        periodFrom: request.periodFrom,
        periodTo: request.periodTo,
        dueDate: request.dueDate,
        companies: request.companies,
        targetIds: request.indicatorIds,
        taskKeys: request.taskKeys,
      })),
      submissions: metricSubmissions.map(submission => ({
        requestId: submission.requestId,
        company: submission.company,
        month: submission.period,
        targetId: submission.indicatorId,
        status: submission.status,
      })),
      today,
    }), [companies, kind, metricRequests, metricSubmissions, periods, records, targetOptions, today, year]);
  const targetItems = useMemo(() => target === "all" ? coverageItems : coverageItems.filter(item => String(item.targetId) === target), [coverageItems, target]);
  const counts = countCoverage(targetItems);
  const filteredItems = useMemo(() => requestedStatus === "전체"
    ? targetItems
    : requestedStatus === "기한초과"
      ? targetItems.filter(item => item.overdue)
      : targetItems.filter(item => item.status === requestedStatus), [requestedStatus, targetItems]);
  const targetLabels = useMemo(() => new Map(targetOptions.map(option => [option.id, option.label])), [targetOptions]);
  const targetItemsByCell = useMemo(() => groupCoverageByCell(targetItems), [targetItems]);
  const filteredItemsByCell = useMemo(() => groupCoverageByCell(filteredItems), [filteredItems]);
  const targetLabel = (targetId: string | number) => targetLabels.get(String(targetId)) ?? String(targetId);

  return <><PageHeader eyebrow="COLLECTION COVERAGE" title="수집 커버리지 현황" description="연도·월·법인·수집 항목별로 요청 누락과 입력·검토·확정 상태를 확인합니다."/>
    <section className="coverage-summary" aria-label="수집 커버리지 상태 요약">
      <button className={requestedStatus==="전체"?"active":""} onClick={()=>setRequestedStatus("전체")}><span>전체 대상</span><strong>{targetItems.length}<small>건</small></strong></button>
      {COVERAGE_STATUSES.map(status=><button className={`${coverageTone(status)} ${requestedStatus===status?"active":""}`} key={status} onClick={()=>setRequestedStatus(status)}><span>{status==="반려"?"보완 요청":status}</span><strong>{counts[status]}<small>건</small></strong></button>)}
    </section>
    <section className="card coverage-workspace">
      <div className="coverage-toolbar"><div><h2>{year}년 {kind==="ghg"?"온실가스":"기타 ESG"} 수집 지도</h2><p>미요청은 요청 범위에서 빠진 항목이며, 기한 초과는 제출 마감 후에도 확정되지 않은 항목입니다.</p></div><div className="coverage-filters"><label><span>연도</span><select value={year} onChange={event=>setRequestedYear(event.target.value)}>{availableYears.map(item=><option key={item}>{item}</option>)}</select></label><label><span>수집 항목</span><select value={target} onChange={event=>setRequestedTarget(event.target.value)}><option value="all">전체 {kind==="ghg"?"Scope":"활성 지표"}</option>{targetOptions.map(option=><option value={option.id} key={option.id}>{option.label} · {option.cycle}</option>)}</select></label></div></div>
      <div className="coverage-legend">{COVERAGE_STATUSES.map(status=><span key={status}><i className={coverageTone(status)}/>{status==="반려"?"보완 요청":status}</span>)}</div>
      {!companies.length||!targetOptions.length?<div className="empty-state coverage-empty"><Icon name="dashboard"/><strong>커버리지를 계산할 기준정보가 없습니다.</strong><p>{!companies.length?"시스템 설정에서 법인·사업장을 먼저 등록해 주세요.":"ESG 지표 관리에서 사용 중인 지표를 등록해 주세요."}</p></div>:<div className="coverage-matrix-scroll"><table className="coverage-matrix"><thead><tr><th>귀속월</th>{companies.map(company=><th key={company}>{company}</th>)}</tr></thead><tbody>{monthsForYear(year).map(month=><tr key={month}><th><strong>{Number(month.slice(-2))}월</strong><span>{month}</span></th>{companies.map(company=>{
        const cellKey=`${month}|${company}`;
        const allCellItems=targetItemsByCell.get(cellKey)??[];
        const cellItems=filteredItemsByCell.get(cellKey)??[];
        const displayItems=requestedStatus==="전체"?allCellItems:cellItems;
        if(!displayItems.length)return <td key={company} className="coverage-cell empty"><span>{allCellItems.length?"조건 없음":"해당 없음"}</span></td>;
        const displayStatus=coverageDisplayStatus(displayItems);
        const confirmed=allCellItems.filter(item=>item.status==="확정").length;
        const details=allCellItems.map(item=>`${targetLabel(item.targetId)}: ${item.overdue?`기한 초과 (${item.status})`:item.status}`).join("\n");
        return <td key={company} className={`coverage-cell ${coverageTone(displayStatus)}`} title={details}><strong>{displayStatus==="반려"?"보완 요청":displayStatus}</strong><span>{target==="all"?`확정 ${confirmed}/${allCellItems.length}`:`${displayItems.length}건 · ${targetLabel(displayItems[0].targetId)}`}</span></td>;
      })}</tr>)}</tbody></table></div>}
      <footer className="coverage-guide"><span><Icon name="alert" size={15}/>상태 카드를 누르면 해당 항목만 표에서 강조됩니다.</span><span>기타 ESG는 지표의 월·분기·반기·연 수집 주기를 반영합니다.</span></footer>
    </section>
  </>;
}

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
function ProfilePanel({profileName,detail,canManage,isAdmin,onSettings,onBackup}:{profileName:string;detail:string;canManage:boolean;isAdmin:boolean;onSettings:()=>void;onBackup:()=>void}){return <div className="profile-panel"><div><strong>{profileName}</strong><span>{detail}</span></div>{canManage&&<button onClick={onSettings}><Icon name="settings" size={16}/>시스템 설정</button>}{isAdmin&&<Link href="/admin/users"><Icon name="building" size={16}/>사용자·권한 관리</Link>}<button onClick={onBackup}><Icon name="download" size={16}/>전체 데이터 백업</button><p>운영 데이터는 Supabase 서버에 자동 저장되며 계정 권한에 따라 조회·수정 범위가 제한됩니다.</p></div>}

function GuideModal({ onClose }: { onClose: () => void }) { return <Overlay title="SEMS 사용 가이드" eyebrow="OPERATING GUIDE" description="기준 설정부터 목표 이행과 개선조치까지 이어지는 실제 운영 순서입니다." onClose={onClose}><div className="guide-steps"><div><span>01</span><strong>산정 기준 설정</strong><p>조직·사업장과 활동자료별 배출계수를 먼저 등록해 일관된 산정 기준을 만듭니다.</p></div><div><span>02</span><strong>수집·검토·인벤토리 확정</strong><p>기간을 개설하고 활동자료와 증빙을 수집·검토한 뒤 기준연도 인벤토리를 확정합니다.</p></div><div><span>03</span><strong>감축목표 수립·승인</strong><p>확정 인벤토리를 기준값으로 불러와 대상 Scope, 목표연도와 감축률을 정합니다.</p></div><div><span>04</span><strong>이행계획 수립</strong><p>승인 목표의 필요 감축량을 사업장별 감축과제로 분해하고 담당·예산·일정을 지정합니다.</p></div><div><span>05</span><strong>실적·증빙 관리</strong><p>월별 배출실적과 과제 진척도, 실제 감축량 및 검증 증빙을 함께 관리합니다.</p></div><div><span>06</span><strong>목표 대비 분석·보완</strong><p>연도별 경로와 실적 차이, 미확보 감축량과 지연 과제를 확인해 추가 과제를 수립합니다.</p></div></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>; }

function Dashboard({ records, periods, targets, plans, organizationNames, onNavigate, onNew }: { records: ActivityRecord[]; periods: CollectionPeriod[]; targets: ReductionTarget[]; plans: ReductionPlan[]; organizationNames: string[]; onNavigate: (view: View) => void; onNew: () => void }) {
  const years = [...new Set(records.map(r => r.period.slice(0, 4)))].sort().reverse(); const [requestedYear, setRequestedYear] = useState("2026"); const year=years.includes(requestedYear)?requestedYear:years[0]??requestedYear;
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
  return <><PageHeader eyebrow={`${year} ESG PERFORMANCE`} title="ESG 통합 대시보드" description="세원그룹의 ESG 데이터 수집 현황과 주요 성과를 한눈에 확인합니다."><label className="year-select"><Icon name="calendar" size={17} /><select value={year} onChange={e => setRequestedYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />자료 입력</button></PageHeader>
    {activePeriod ? <section className="notice-banner"><div className="notice-icon"><Icon name="alert" /></div><div><strong>{activePeriod.name} · {activePeriod.status === "수집중" ? `제출 마감까지 ${Math.max(0, daysUntil(activePeriod.dueDate))}일` : "기획실 검토 진행 중"}</strong><p>{activePeriod.dataFrom}~{activePeriod.dataTo} 귀속자료 · 검토 대기 {pending.length}건</p></div><button onClick={() => onNavigate(activePeriod.status === "수집중" ? "collection" : "review")}>{activePeriod.status === "수집중" ? "수집 현황 보기" : "검토 화면 열기"} <Icon name="arrow" size={16} /></button></section> : <section className="notice-banner neutral"><div className="notice-icon"><Icon name="calendar" /></div><div><strong>현재 진행 중인 수집기간이 없습니다.</strong><p>수집 기간 메뉴에서 다음 정기수집을 개설해 주세요.</p></div><button onClick={() => onNavigate("metric-collection")}>기간 설정 <Icon name="arrow" size={16} /></button></section>}
    {approvedTarget ? <section className="target-status-banner"><div className="target-status-main"><span><Icon name="target" size={20}/></span><div><small>승인 감축목표</small><strong>{approvedTarget.name}</strong><p>{approvedTarget.baselineYear}년 {formatNumber(approvedTarget.baselineEmissions,0)} tCO₂e → {approvedTarget.targetYear}년 {formatNumber(approvedTarget.targetEmissions,0)} tCO₂e ({approvedTarget.reductionRate}% 감축)</p></div></div><div className="target-status-metrics"><div><span>필요 감축량</span><strong>{formatNumber(requiredReduction,0)}<small> tCO₂e</small></strong></div><div><span>과제 확보율</span><strong>{planCoverage}<small>%</small></strong></div></div><button onClick={()=>onNavigate("targets")}>목표·계획 관리 <Icon name="arrow" size={16}/></button></section> : <section className="notice-banner neutral"><div className="notice-icon"><Icon name="target"/></div><div><strong>승인된 온실가스 감축목표가 없습니다.</strong><p>확정 인벤토리를 기준으로 목표와 실행계획을 먼저 수립해 주세요.</p></div><button onClick={()=>onNavigate("targets")}>목표 설정 <Icon name="arrow" size={16}/></button></section>}
    <section className="kpi-grid"><KpiCard label="온실가스 배출량" value={formatNumber(total, 1)} unit="tCO₂e" trend="확정된 활동자료 기준" trendType="good" icon="leaf" tone="green"/><KpiCard label="데이터 확정률" value={String(completion)} unit="%" trend={`${confirmed}/${data.length}개 항목 확정`} trendType="neutral" icon="database" tone="blue" progress={completion}/><KpiCard label="감축과제 확보율" value={String(planCoverage)} unit="%" trend={approvedTarget?`필요 감축량 중 ${formatNumber(securedReduction,0)} t 확보`:"승인 목표를 먼저 설정하세요."} trendType={planCoverage>=100?"good":"warn"} icon="target" tone="green" progress={planCoverage}/><KpiCard label="증빙 연결률" value={String(evidenceRate)} unit="%" trend={`미연결 증빙 ${data.filter(r => !r.evidence).length}건`} trendType={evidenceRate < 100 ? "warn" : "good"} icon="file" tone="violet" progress={evidenceRate}/></section>
    <section className="dashboard-grid"><article className="card emissions-chart-card"><CardHeader title="월별 온실가스 배출 추이" subtitle="Scope 1·2·3 합산 배출량" action="단위: tCO₂e"/><div className="chart-legend"><span><i className="scope1"/>Scope 1</span><span><i className="scope2"/>Scope 2</span><span><i className="scope3"/>Scope 3</span></div><div className="bar-chart"><div className="axis-labels"><span>{formatNumber(chartMax,0)}</span><span>{formatNumber(chartMax*.75,0)}</span><span>{formatNumber(chartMax*.5,0)}</span><span>{formatNumber(chartMax*.25,0)}</span><span>0</span></div><div className="grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{monthly.map(item => { const sum=item.s1+item.s2+item.s3; return <div className="bar-group" key={item.month}><div className="bar-stack chart-scaled" style={{height:`${Math.max(sum/chartMax*170,4)}px`}}><span className="scope3" style={{height:`${sum ? item.s3/sum*100 : 0}%`}}/><span className="scope2" style={{height:`${sum ? item.s2/sum*100 : 0}%`}}/><span className="scope1" style={{height:`${sum ? item.s1/sum*100 : 0}%`}}/>{sum>0&&<b>{formatNumber(sum,0)}</b>}</div><small>{item.month}</small></div>; })}</div></div></article>
      <article className="card scope-card"><CardHeader title="Scope별 배출 구성" subtitle={`${year}년 누적 기준`}/><div className="donut-wrap"><div className="donut" style={{background:`conic-gradient(#156b55 0 ${percents[0]}%, #42a585 ${percents[0]}% ${percents[0]+percents[1]}%, #a6d7c7 ${percents[0]+percents[1]}% 100%)`}}><div><strong>{formatNumber(total,1)}</strong><span>tCO₂e</span></div></div></div><div className="scope-breakdown"><ScopeRow label="Scope 1" value={scopeTotals[0]} color="dark" percent={percents[0]}/><ScopeRow label="Scope 2" value={scopeTotals[1]} color="mid" percent={percents[1]}/><ScopeRow label="Scope 3" value={scopeTotals[2]} color="light" percent={percents[2]}/></div></article>
      <article className="card collection-card"><CardHeader title="법인별 확정 현황" subtitle={`${year}년 등록 자료 기준`} action={<button onClick={()=>onNavigate("collection")}>전체보기 <Icon name="arrow" size={14}/></button>}/><div className="company-progress">{organizationNames.map(name => { const rows=data.filter(r=>r.company===name); const val=rows.length?Math.round(rows.filter(r=>r.status==="확정").length/rows.length*100):0; return <ProgressRow key={name} label={name} value={val} detail={`${rows.filter(r=>r.status==="확정").length} / ${rows.length}`}/>; })}{!organizationNames.length&&<div className="empty-state compact"><Icon name="building"/><strong>등록된 법인이 없습니다.</strong></div>}</div></article>
      <article className="card review-card"><CardHeader title="검토 대기 자료" subtitle={`${pending.length}건의 자료가 확인을 기다리고 있습니다.`} action={<button onClick={()=>onNavigate("review")}>전체보기 <Icon name="arrow" size={14}/></button>}/><div className="review-list">{pending.length ? pending.slice(0,3).map(record=><button className="review-item" key={record.id} onClick={()=>onNavigate("review")}><div className={`source-icon ${record.scope==="Scope 1"?"green":"blue"}`}><Icon name={record.scope==="Scope 1"?"droplet":"bolt"} size={18}/></div><div><strong>{record.category} · {record.source}</strong><span>{record.company} / {record.site}</span></div><em>{formatNumber(record.emissions,1)} t</em><Icon name="chevron" size={16}/></button>):<div className="empty-state compact"><Icon name="check"/><strong>검토 대기 자료가 없습니다.</strong></div>}</div></article></section></>;
}

function KpiCard({label,value,unit,trend,trendType,icon,tone,progress}:{label:string;value:string;unit:string;trend:string;trendType:string;icon:IconName;tone:string;progress?:number}){return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon}/></div><div className="kpi-label">{label}</div><div className="kpi-value"><strong>{value}</strong><span>{unit}</span></div>{progress!==undefined&&<div className="mini-progress"><span style={{width:`${progress}%`}}/></div>}<div className={`kpi-trend ${trendType}`}>{trendType==="good"&&"✓"}{trendType==="warn"&&"!"} {trend}</div></article>}
function CardHeader({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action&&<div className="card-action">{action}</div>}</div>}
function ScopeRow({label,value,color,percent}:{label:string;value:number;color:string;percent:number}){return <div className="scope-row"><span><i className={color}/>{label}</span><strong>{formatNumber(value,1)}<small> t</small></strong><em>{percent}%</em></div>}
function ProgressRow({label,value,detail}:{label:string;value:number;detail:string}){return <div className="progress-row"><div><strong>{label}</strong><span>{detail}개 항목</span><em>{value}%</em></div><div className="progress-track"><span style={{width:`${value}%`}}/></div></div>}

function Periods({ periods, records, organizationNames, onChange, addAudit, showToast }: { periods: CollectionPeriod[]; records: ActivityRecord[]; organizationNames: string[]; onChange: (items: CollectionPeriod[]) => void; addAudit: (action: string, target: string, detail: string, actor?: string) => void; showToast: (m: string) => void }) {
  const { canManage } = useSemsAuth();
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
    const otherTaskKeys = new Set(periods.filter(item=>item.id!==period.id).flatMap(item=>buildGHGCollectionTasks(item).map(task=>task.key)));
    const taskKeys = period.taskKeys??buildGHGCollectionTasks(period).map(task=>task.key).filter(key=>!otherTaskKeys.has(key));
    if (!taskKeys.length) { showToast("새로 만들거나 유지할 수집 항목이 없습니다."); return; }
    const exists = periods.some(item => item.id === period.id);
    const saved={...period,taskKeys};
    onChange(exists ? periods.map(item => item.id === saved.id ? saved : item) : [saved, ...periods]);
    addAudit(exists ? "수집기간 수정" : "수집기간 개설", period.name, `${period.dataFrom}~${period.dataTo} 귀속자료 / 제출 ${period.dueDate} / 검토 ${period.reviewDate}`);
    setEditing(null); showToast(exists ? "수집기간 설정을 수정했습니다." : "새 수집기간을 개설했습니다.");
  };
  const remove = (period: CollectionPeriod) => {
    const linked = records.filter(record=>record.collectionId===period.id);
    if(linked.length){showToast(`연결된 활동자료 ${linked.length}건이 있어 삭제할 수 없습니다. 자료를 먼저 정리해 주세요.`);return;}
    if(!window.confirm(`"${period.name}" 수집 요청을 삭제하시겠습니까?`))return;
    onChange(periods.filter(item=>item.id!==period.id));
    addAudit("수집기간 삭제",period.name,"연결된 활동자료가 없는 수집 요청을 삭제했습니다.");
    setEditing(null);showToast("수집 요청을 삭제했습니다.");
  };
  return <><PageHeader eyebrow="COLLECTION PERIOD" title="수집 기간 관리" description="귀속기간, 대상 법인·Scope, 제출·검토 마감과 잠금 상태를 운영합니다.">{canManage&&<button className="primary-button" onClick={() => setEditing("new")}><Icon name="plus" size={17}/>수집기간 개설</button>}</PageHeader>
    <section className="period-summary collection-summary"><SummaryTile label="수집 진행" value={periods.filter(item=>item.status==="수집중").length} suffix="건" icon="calendar" tone="green"/><SummaryTile label="검토 진행" value={periods.filter(item=>item.status==="검토중").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="예정" value={periods.filter(item=>item.status==="예정").length} suffix="건" icon="list"/><SummaryTile label="잠금 완료" value={periods.filter(item=>item.status==="잠금").length} suffix="건" icon="lock"/></section>
    <section className="period-grid">{periods.map(period => {
      const rows = records.filter(record => record.collectionId === period.id);
      const tasks=buildGHGCollectionTasks(period);
      const submitted = new Set(rows.filter(record => ["검토대기","확정"].includes(record.status)).map(record=>collectionTaskKey(record.company,record.scope,record.period))).size;
      const confirmed = new Set(rows.filter(record => record.status === "확정").map(record=>collectionTaskKey(record.company,record.scope,record.period))).size;
      const completion = tasks.length ? Math.round(confirmed / tasks.length * 100) : 0;
      return <article className="card period-card" key={period.id}><div className="period-card-top"><div><span className={`status-badge ${periodTone(period.status)}`}><span className="status-dot"/>{period.status}</span><h2>{period.name}</h2><p>{period.description}</p></div></div>
        <div className="period-dates"><div><span>귀속기간</span><strong>{period.dataFrom === period.dataTo ? period.dataFrom : `${period.dataFrom} ~ ${period.dataTo}`}</strong></div><div><span>수집기간</span><strong>{period.openDate} ~ {period.dueDate}</strong></div><div><span>검토마감</span><strong>{period.reviewDate}</strong></div></div>
        <div className="period-targets"><span>{period.cycle} 수집</span><span>{period.companies.length}개 법인</span><span>{period.scopes.join(" · ")}</span><span>{period.evidenceRequired ? "미첨부 확인" : "증빙 선택"}</span></div>
        <div className="period-progress"><div><span>대상 {tasks.length}건 · 제출 {submitted}건 · 확정 {confirmed}건</span><strong>{completion}%</strong></div><div className="progress-track"><span style={{width:`${completion}%`}}/></div></div>
        {canManage&&<div className="period-actions">{period.status === "예정" && <button className="primary-button compact" onClick={()=>updateStatus(period,"수집중")}>수집 시작</button>}{period.status === "수집중" && <button className="primary-button compact" onClick={()=>updateStatus(period,"검토중")}>제출 마감·검토 시작</button>}{period.status === "검토중" && <button className="primary-button compact" onClick={()=>updateStatus(period,"마감")}>검토 완료·마감</button>}{period.status === "마감" && <button className="primary-button compact" onClick={()=>updateStatus(period,"잠금")}>확정자료 잠금</button>}{["마감","잠금"].includes(period.status) && <button className="secondary-button compact" onClick={()=>updateStatus(period,"수집중")}>기간 다시 열기</button>}<button className="secondary-button compact" onClick={()=>setEditing(period)}><Icon name="edit" size={14}/>설정 수정</button><button className="danger-button compact" onClick={()=>remove(period)}><Icon name="trash" size={14}/>삭제</button></div>}
      </article>;
    })}</section>
    {editing && <PeriodForm item={editing === "new" ? null : editing} existing={periods} records={records} organizationNames={organizationNames} onClose={()=>setEditing(null)} onSave={save} onDelete={editing==="new"?undefined:()=>remove(editing)}/>}
  </>;
}

function PeriodForm({ item, existing, records, organizationNames, onClose, onSave, onDelete }: { item: CollectionPeriod | null; existing: CollectionPeriod[]; records: ActivityRecord[]; organizationNames: string[]; onClose: () => void; onSave: (item: CollectionPeriod) => void; onDelete?:()=>void }) {
  const requestYear = new Date().getFullYear();
  const requestIdPrefix = `CP-${requestYear}-`;
  const nextSequence = existing.reduce((highest, request) => {
    if (!request.id.startsWith(requestIdPrefix)) return highest;
    const sequence = Number(request.id.slice(requestIdPrefix.length));
    return Number.isInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0) + 1;
  const nextId = `${requestIdPrefix}${String(nextSequence).padStart(2, "0")}`;
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const defaultScopes:Scope[] = ["Scope 1","Scope 2"];
  const [form, setForm] = useState<CollectionPeriod>(item ?? { id: nextId, name: ghgRequestTitle(currentMonth,currentMonth,defaultScopes), cycle: "월", dataFrom: currentMonth, dataTo: currentMonth, openDate: today, dueDate: today, reviewDate: today, scopes: defaultScopes, companies: [...organizationNames], evidenceRequired: true, status: "예정", description: "" });
  const [autoName,setAutoName] = useState(!item);
  const [error, setError] = useState("");
  const patch = (next: Partial<CollectionPeriod>) => setForm(current => ({ ...current, ...next }));
  const changePeriod = (field:"dataFrom"|"dataTo",value:string) => setForm(current=>{const next={...current,[field]:value};return autoName?{...next,name:ghgRequestTitle(next.dataFrom,next.dataTo,next.scopes)}:next;});
  const toggleScope = (scope: Scope) => setForm(current=>{const scopes=current.scopes.includes(scope)?current.scopes.filter(item=>item!==scope):[...current.scopes,scope];return {...current,scopes,name:autoName?ghgRequestTitle(current.dataFrom,current.dataTo,scopes):current.name};});
  const toggleCompany = (company: string) => patch({ companies: form.companies.includes(company) ? form.companies.filter(item => item !== company) : [...form.companies, company] });
  const candidateTasks=buildGHGCollectionTasks({...form,taskKeys:undefined},false);
  const currentKeys=new Set(item?buildGHGCollectionTasks(item).map(task=>task.key):[]);
  const existingKeys=new Set(existing.filter(request=>request.id!==form.id).flatMap(request=>buildGHGCollectionTasks(request).map(task=>task.key)));
  const confirmedKeys=new Set(records.filter(record=>record.collectionId!==form.id&&record.status==="확정"&&record.active!==false).map(record=>collectionTaskKey(record.company,record.scope,record.period)));
  const taskPreview=classifyCollectionTasks(candidateTasks,existingKeys,confirmedKeys);
  const retainedCount=taskPreview.available.filter(task=>currentKeys.has(task.key)).length;
  const candidateKeys=new Set(candidateTasks.map(task=>task.key));
  const linkedRecords=records.filter(record=>record.collectionId===form.id);
  const preservedKeys=[...new Set(linkedRecords.map(record=>collectionTaskKey(record.company,record.scope,record.period)))].filter(key=>!candidateKeys.has(key));
  const taskKeys=[...new Set([...taskPreview.available.map(task=>task.key),...preservedKeys])];
  const submit = (event: FormEvent) => { event.preventDefault(); if (form.dataFrom > form.dataTo) { setError("귀속기간 종료월은 시작월보다 빠를 수 없습니다."); return; } if (form.openDate > form.dueDate || form.dueDate > form.reviewDate) { setError("수집 시작일 → 제출 마감일 → 검토 마감일 순서로 설정해 주세요."); return; } if (!form.scopes.length || !form.companies.length) { setError("대상 법인과 Scope를 한 개 이상 선택해 주세요."); return; } if (!taskKeys.length) { setError("새로 만들거나 유지할 수집 항목이 없습니다."); return; } onSave({...form,cycle:"월",companies:[...new Set([...form.companies,...linkedRecords.map(record=>record.company)])],scopes:[...new Set([...form.scopes,...linkedRecords.map(record=>record.scope)])],taskKeys}); };
  return <Overlay title={item ? "수집기간 수정" : "새 수집기간 개설"} eyebrow="COLLECTION SCHEDULE" description="기간이 수집중일 때만 담당자가 활동자료를 등록·제출할 수 있습니다." onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>수집 기본정보</h3><div className="form-grid"><label className="full-span">수집기간명<input value={form.name} onChange={e=>{setAutoName(false);patch({name:e.target.value})}} placeholder="기간과 Scope에 따라 자동 작성됩니다." required/><small className="field-help">기간과 Scope를 바꾸면 자동으로 갱신되며, 직접 수정할 수도 있습니다.</small></label><label>수집 주기<input value="월" readOnly className="readonly-input"/><small className="field-help">온실가스 활동자료는 귀속월별 세부 항목으로 생성됩니다.</small></label><label>현재 상태<input value={form.status} readOnly className="readonly-input"/><small className="field-help">상태는 기간 카드의 단계별 버튼으로만 변경됩니다.</small></label><label>귀속 시작월<input type="month" value={form.dataFrom} onChange={e=>changePeriod("dataFrom",e.target.value)} required/></label><label>귀속 종료월<input type="month" value={form.dataTo} onChange={e=>changePeriod("dataTo",e.target.value)} required/></label></div></div>
    <div className="form-section"><h3><span>2</span>운영 일정</h3><div className="form-grid"><label>수집 시작일<input type="date" value={form.openDate} onChange={e=>patch({openDate:e.target.value})} required/></label><label>제출 마감일<input type="date" value={form.dueDate} onChange={e=>patch({dueDate:e.target.value})} required/></label><label>검토 마감일<input type="date" value={form.reviewDate} onChange={e=>patch({reviewDate:e.target.value})} required/></label><Toggle label="증빙 미첨부 항목 확인" description="제출은 허용하고 품질 화면에서 미첨부 항목을 표시합니다." checked={form.evidenceRequired} onChange={value=>patch({evidenceRequired:value})}/></div></div>
    <div className="form-section"><h3><span>3</span>수집 대상</h3><div className="check-group"><strong>대상 Scope</strong><div>{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map(scope=><label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={()=>toggleScope(scope)}/>{scope}</label>)}</div></div><div className="check-group"><strong>대상 법인</strong><div>{organizationNames.map(company=><label key={company}><input type="checkbox" checked={form.companies.includes(company)} onChange={()=>toggleCompany(company)}/>{company}</label>)}{!organizationNames.length&&<span>Supabase에 법인을 먼저 등록해 주세요.</span>}</div></div><label className="textarea-label">운영 설명<textarea value={form.description} onChange={e=>patch({description:e.target.value})} placeholder="수집 목적과 담당자가 확인할 사항을 적어 주세요."/></label><CollectionTaskPreview tasks={candidateTasks} availableCount={taskPreview.available.length} retainedCount={retainedCount} existingCount={taskPreview.existing.length} confirmedCount={taskPreview.confirmed.length} preservedCount={preservedKeys.length}/>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div>
    <div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>수집 요청 삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" type="submit" disabled={!taskKeys.length}><Icon name="check" size={16}/>{item?"수집 항목 저장":`신규 ${taskPreview.available.length}건 생성`}</button></div></div>
  </form></Overlay>;
}

function Collection({ records, periods, criteria, organizationNames, onNew, onBulk, onEdit, onChange, showToast }: { records: ActivityRecord[]; periods: CollectionPeriod[]; criteria: CollectionCriteria; organizationNames: string[]; onNew: () => void; onBulk: () => void; onEdit: (record: ActivityRecord) => void; onChange: (records: ActivityRecord[], auditInfo?: { action: string; target: string; detail: string }) => void; showToast: (m: string) => void }) {
  const { canWrite } = useSemsAuth();
  const activePeriods = periods.filter(period => ["수집중","검토중"].includes(period.status));
  const [periodId,setPeriodId]=useState(activePeriods[0]?.id ?? periods[0]?.id ?? "전체");
  const [search,setSearch]=useState(""); const [status,setStatus]=useState("전체"); const [company,setCompany]=useState("전체 법인"); const [scope,setScope]=useState("전체 Scope"); const [page,setPage]=useState(1); const pageSize=8;
  const baseFiltered=records.filter(r=>(periodId==="전체"||r.collectionId===periodId)&&(company==="전체 법인"||r.company===company)&&(scope==="전체 Scope"||r.scope===scope)&&`${r.company} ${r.site} ${r.category} ${r.source} ${r.owner} ${r.description??""}`.toLowerCase().includes(search.toLowerCase()));
  const filtered=baseFiltered.filter(r=>status==="전체"||r.status===status);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)); const visible=filtered.slice((Math.min(page,pageCount)-1)*pageSize,Math.min(page,pageCount)*pageSize);
  const exportCsv=()=>{downloadCsv("SEMS_activity_data.csv",["수집기간","법인","사업장","귀속월","Scope","구분","배출원","사용량","단위","배출계수","배출량(tCO2e)","증빙","설명","담당자","부서","상태"],filtered.map(r=>[periods.find(p=>p.id===r.collectionId)?.name??"",r.company,r.site,r.period,r.scope,r.category,r.source,r.usage,r.unit,r.factor,r.emissions,r.evidence,r.description??"",r.owner,r.department,r.status]));showToast("현재 조회 결과를 내려받았습니다.");};
  const submitRecord=(record:ActivityRecord)=>{const period=periods.find(item=>item.id===record.collectionId);if(!period||period.status!=="수집중"){showToast("현재 수집중인 기간의 자료만 제출할 수 있습니다.");return;}onChange(records.map(item=>item.id===record.id?{...item,status:"검토대기" as RecordStatus,rejectionReason:"",updatedAt:"방금 전"}:item),{action:"검토 제출",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료를 검토 대기로 제출했습니다.${record.evidence?"":" (증빙 미첨부)"}`});showToast(record.evidence?"기획실 검토 대기로 제출했습니다.":"증빙 없이 기획실 검토 대기로 제출했습니다.");};
  const withdrawRecord=(record:ActivityRecord)=>{if(record.status!=="검토대기"){showToast("검토 대기 중인 자료만 회수할 수 있습니다.");return;}const period=periods.find(item=>item.id===record.collectionId);if(period?.status==="잠금"){showToast("잠금된 수집기간의 자료는 회수할 수 없습니다.");return;}if(!window.confirm("제출을 회수하고 작성 중 상태로 되돌리시겠습니까? 입력값과 증빙은 그대로 유지됩니다."))return;onChange(records.map(item=>item.id===record.id?{...item,status:"작성중" as RecordStatus,updatedAt:"방금 전"}:item),{action:"제출 회수",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료 제출을 회수해 작성 중 상태로 되돌렸습니다.`});showToast("제출을 회수했습니다. 내용을 수정한 뒤 다시 제출할 수 있습니다.");};
  const remove=(record:ActivityRecord)=>{const period=periods.find(item=>item.id===record.collectionId);if(record.locked||record.status==="확정"||period?.status==="잠금"){showToast("확정 또는 잠금된 자료는 삭제할 수 없습니다.");return;}if(!window.confirm("이 활동자료를 삭제하시겠습니까?"))return;onChange(records.filter(item=>item.id!==record.id),{action:"자료 삭제",target:`${record.company} · ${record.source}`,detail:`${record.period} 활동자료를 삭제했습니다.`});showToast("활동자료를 삭제했습니다.");};
  const variance=(record:ActivityRecord)=>{const prev=records.find(item=>item.company===record.company&&item.site===record.site&&item.scope===record.scope&&item.category===record.category&&item.source===record.source&&item.period===previousMonth(record.period));return prev?.usage?((record.usage-prev.usage)/prev.usage*100):null;};
  return <><PageHeader eyebrow="DATA COLLECTION" title="ESG 데이터 수집" description="개설된 수집기간 안에서 활동자료를 입력하고 중복·증빙·이상치를 검증합니다.">{canWrite&&<button className="secondary-button" onClick={onBulk}><Icon name="upload" size={17}/>Excel 일괄등록</button>}<button className="secondary-button" onClick={exportCsv}><Icon name="download" size={17}/>조회결과 내보내기</button>{canWrite&&<button className="primary-button" onClick={onNew} disabled={!periods.some(item=>item.status==="수집중")}><Icon name="plus" size={17}/>신규 자료 입력</button>}</PageHeader>
    <div className="period-filter-bar"><div><Icon name="calendar" size={18}/><span>수집기간</span><select value={periodId} onChange={e=>{setPeriodId(e.target.value);setPage(1)}}><option value="전체">전체 기간</option>{periods.map(item=><option value={item.id} key={item.id}>{item.name} · {item.status}</option>)}</select></div>{periods.find(item=>item.id===periodId)&&<span className={`status-badge ${periodTone(periods.find(item=>item.id===periodId)!.status)}`}><span className="status-dot"/>{periods.find(item=>item.id===periodId)!.status}</span>}</div>
    <section className="collection-summary"><SummaryTile label="조회 항목" value={baseFiltered.length} suffix="건" icon="database"/><SummaryTile label="검토 대기" value={baseFiltered.filter(r=>r.status==="검토대기").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="보완 요청" value={baseFiltered.filter(r=>r.status==="반려").length} suffix="건" icon="alert" tone="red"/><SummaryTile label="확정 완료" value={baseFiltered.filter(r=>r.status==="확정").length} suffix="건" icon="check" tone="green"/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","작성중","검토대기","반려","확정"].map(item=><button className={status===item?"active":""} key={item} onClick={()=>{setStatus(item);setPage(1)}}>{item==="반려"?"보완 요청":item}{item!=="전체"&&<span>{baseFiltered.filter(r=>r.status===item).length}</span>}</button>)}</div><div className="filter-actions"><div className="search-box"><Icon name="search" size={17}/><input placeholder="배출원, 담당자, 설명 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><select value={scope} onChange={e=>{setScope(e.target.value);setPage(1)}} aria-label="Scope 필터"><option>전체 Scope</option><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select><select value={company} onChange={e=>{setCompany(e.target.value);setPage(1)}} aria-label="법인 필터"><option>전체 법인</option>{organizationNames.map(c=><option key={c}>{c}</option>)}</select></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>귀속월</th><th>법인 / 사업장</th><th>Scope</th><th>활동자료 / 배출원</th><th className="align-right">사용량</th><th>전월 대비</th><th className="align-right">배출량</th><th>증빙</th><th>담당자</th><th>상태</th>{canWrite&&<th>작업</th>}</tr></thead><tbody>{visible.map(record=>{const change=variance(record);const isLocked=Boolean(record.locked||periods.find(item=>item.id===record.collectionId)?.status==="잠금");return <tr key={record.id} onDoubleClick={()=>canWrite&&record.status!=="검토대기"&&onEdit(record)} className={isLocked?"locked-row":""}><td className="mono">{record.period}</td><td><strong>{record.company}</strong><span>{record.site}</span></td><td><span className={`scope-tag s${record.scope.slice(-1)}`}>{record.scope}</span></td><td><strong>{record.category}</strong><span>{record.source}</span></td><td className="align-right"><strong>{formatNumber(record.usage,record.usage<100?1:0)}</strong><span>{record.unit}</span></td><td>{change===null?<span className="muted">비교자료 없음</span>:<span className={`variance ${Math.abs(change)>=criteria.variance?"warning":""}`}>{change>=0?"+":""}{formatNumber(change,1)}%</span>}</td><td className="align-right"><strong>{formatNumber(record.emissions,2)}</strong><span>tCO₂e</span></td><td>{record.evidence?<span className="file-linked" title={record.evidence}><Icon name="file" size={15}/>연결</span>:<span className="file-missing">미연결</span>}</td><td><strong>{record.owner}</strong><span>{record.department}</span></td><td><StatusBadge status={record.status}/>{isLocked&&<span className="mini-lock"><Icon name="lock" size={12}/>잠금</span>}</td>{canWrite&&<td><div className="row-actions">{["작성중","반려"].includes(record.status)&&!isLocked&&<button onClick={()=>submitRecord(record)}>제출</button>}{record.status==="검토대기"&&!isLocked&&<button onClick={()=>withdrawRecord(record)}>제출 회수</button>}<button className="icon-row-button" onClick={()=>onEdit(record)} disabled={isLocked||record.status==="검토대기"} aria-label="수정"><Icon name="edit" size={15}/></button><button className="icon-row-button danger" onClick={()=>remove(record)} disabled={isLocked||record.status==="검토대기"} aria-label="삭제"><Icon name="trash" size={15}/></button></div></td>}</tr>})}</tbody></table>{!visible.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 활동자료가 없습니다.</strong><p>필터를 바꾸거나 수집중인 기간에 새 자료를 입력해 주세요.</p></div>}</div>
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
        <div className="review-actions"><button className="danger-button" onClick={reject}><Icon name="alert" size={16}/>보완 요청</button><button className="primary-button" onClick={approve}><Icon name="check" size={17}/>검토 확정</button></div>
      </> : <div className="empty-state review-empty"><Icon name="check"/><strong>모든 제출자료를 확인했습니다.</strong><p>새 자료가 제출되면 여기에 표시됩니다.</p></div>}</article>
    </section></>;
}

type QualityIssue = {
  key: string;
  severity: "오류" | "확인 필요";
  rule: string;
  record: ActivityRecord;
  detail: string;
};

function DataQuality({records,periods,criteria,onNavigate}:{records:ActivityRecord[];periods:CollectionPeriod[];criteria:CollectionCriteria;onNavigate:(view:View)=>void}){
  const [severity,setSeverity]=useState("전체");
  const activeRecords=records.filter(record=>record.active!==false);
  const duplicateCounts=new Map<string,number>();
  for(const record of activeRecords){
    const key=[record.collectionId,record.company,record.site,record.period,record.scope,record.category,record.source].join("|");
    duplicateCounts.set(key,(duplicateCounts.get(key)??0)+1);
  }
  const issues:QualityIssue[]=[];
  for(const record of activeRecords){
    const base=`${record.company}-${record.id}`;
    if(record.usage<=0)issues.push({key:`${base}-usage`,severity:"오류",rule:"사용량 오류",record,detail:"사용량이 0 이하입니다."});
    if(record.factor<=0)issues.push({key:`${base}-factor`,severity:"오류",rule:"배출계수 오류",record,detail:"적용된 배출계수가 0 이하입니다."});
    if(criteria.evidenceRequired&&!record.evidence)issues.push({key:`${base}-evidence`,severity:"확인 필요",rule:"증빙 미첨부",record,detail:"제출은 가능하지만 검토 시 근거자료 필요 여부를 확인해 주세요."});
    if(record.status==="반려")issues.push({key:`${base}-rejected`,severity:"확인 필요",rule:"보완 요청",record,detail:record.rejectionReason||"검토자가 자료 보완을 요청했습니다."});
    const duplicateKey=[record.collectionId,record.company,record.site,record.period,record.scope,record.category,record.source].join("|");
    if((duplicateCounts.get(duplicateKey)??0)>1)issues.push({key:`${base}-duplicate`,severity:"오류",rule:"중복 입력",record,detail:"같은 수집기간·사업장·귀속월·배출원의 자료가 중복되었습니다."});
    const previous=activeRecords.find(item=>item.company===record.company&&item.site===record.site&&item.scope===record.scope&&item.category===record.category&&item.source===record.source&&item.period===previousMonth(record.period));
    if(previous?.usage){
      const variance=(record.usage-previous.usage)/previous.usage*100;
      if(Math.abs(variance)>=criteria.variance)issues.push({key:`${base}-variance`,severity:"확인 필요",rule:"전월 급변",record,detail:`전월 대비 ${formatNumber(Math.abs(variance),1)}% ${variance>0?"증가":"감소"}했습니다.`});
    }
  }
  const filtered=issues.filter(issue=>severity==="전체"||issue.severity===severity);
  const errorCount=issues.filter(issue=>issue.severity==="오류").length;
  const warningCount=issues.filter(issue=>issue.severity==="확인 필요").length;
  const checked=Math.max(0,activeRecords.length-new Set(issues.map(issue=>issue.record.id)).size);
  const qualityRate=activeRecords.length?Math.round(checked/activeRecords.length*100):100;
  return <><PageHeader eyebrow="DATA QUALITY" title="데이터 품질센터" description="누락·중복·단위·급변·반려 자료를 자동으로 찾아 검토 대상을 먼저 보여줍니다."><button className="primary-button" onClick={()=>onNavigate("collection")}><Icon name="database" size={17}/>원천자료 확인</button></PageHeader>
    <section className="summary-grid"><SummaryTile label="검사 대상" value={activeRecords.length} suffix="건" icon="database"/><SummaryTile label="정상 자료" value={checked} suffix="건" icon="check" tone="green"/><SummaryTile label="오류" value={errorCount} suffix="건" icon="alert" tone={errorCount?"red":"green"}/><SummaryTile label="품질 통과율" value={qualityRate} suffix="%" icon="check" tone={qualityRate>=90?"green":"amber"}/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","오류","확인 필요"].map(item=><button key={item} className={severity===item?"active":""} onClick={()=>setSeverity(item)}>{item}<span>{item==="전체"?issues.length:item==="오류"?errorCount:warningCount}</span></button>)}</div><p className="quality-rule-note">급변 기준 ±{criteria.variance}% · 증빙 미첨부 확인 {criteria.evidenceRequired?"적용":"미적용"} · 수집기간 {periods.length}개</p></div><div className="table-scroll"><table className="data-table"><thead><tr><th>중요도</th><th>검사 규칙</th><th>법인 / 사업장</th><th>귀속월</th><th>자료</th><th>확인 내용</th></tr></thead><tbody>{filtered.map(issue=><tr key={issue.key}><td><StatusBadge status={issue.severity}/></td><td><strong>{issue.rule}</strong></td><td><strong>{issue.record.company}</strong><span>{issue.record.site}</span></td><td>{issue.record.period}</td><td><strong>{issue.record.source}</strong><span>{issue.record.scope}</span></td><td>{issue.detail}</td></tr>)}</tbody></table>{!filtered.length&&<div className="empty-state"><Icon name="check"/><strong>조건에 해당하는 품질 문제가 없습니다.</strong><p>현재 등록 자료가 자동 검사 기준을 통과했습니다.</p></div>}</div></section>
  </>;
}

function ComparisonCard({ label, record, current, threshold }: { label: string; record: ActivityRecord | null | undefined; current: ActivityRecord; threshold: number }) {
  const change = record?.usage ? (current.usage - record.usage) / record.usage * 100 : null;
  return <div className="comparison-card"><span>{label} 비교</span>{record ? <><strong>{formatNumber(record.usage,record.usage<100?1:0)} <small>{record.unit}</small></strong><em className={change!==null&&Math.abs(change)>=threshold?"warning":""}>{change!==null&&change>=0?"+":""}{change===null?"-":`${formatNumber(change,1)}%`}</em></> : <><strong>-</strong><em>비교자료 없음</em></>}</div>;
}

function SummaryTile({label,value,suffix,icon,tone="blue"}:{label:string;value:number;suffix:string;icon:IconName;tone?:string}){return <div className="summary-tile"><div className={`summary-icon ${tone}`}><Icon name={icon} size={19}/></div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>}

function Inventory({records,targets,organizationNames,onNavigate,showToast}:{records:ActivityRecord[];targets:ReductionTarget[];organizationNames:string[];onNavigate:(view:View)=>void;showToast:(m:string)=>void}){
  const years=[...new Set(records.map(r=>r.period.slice(0,4)))].sort().reverse(); const [requestedYear,setRequestedYear]=useState("2026"); const year=years.includes(requestedYear)?requestedYear:years[0]??requestedYear; const [scope,setScope]=useState<Scope|null>(null); const base=records.filter(r=>r.period.startsWith(year)&&r.status==="확정"&&r.active!==false); const rows=scope?base.filter(r=>r.scope===scope):base; const total=rows.reduce((s,r)=>s+r.emissions,0);
  const byCompany=organizationNames.map(name=>({name,value:rows.filter(r=>r.company===name).reduce((s,r)=>s+r.emissions,0)})); const max=Math.max(1,...byCompany.map(x=>x.value));
  const approvedTarget=targets.find(target=>target.status==="승인"&&target.company==="그룹 전체")??targets.find(target=>target.status==="승인"); const targetRows=approvedTarget?base.filter(r=>approvedTarget.scopes.includes(r.scope)&&(approvedTarget.company==="그룹 전체"||r.company===approvedTarget.company)):[]; const targetActual=targetRows.reduce((sum,row)=>sum+row.emissions,0); const targetMonths=new Set(targetRows.map(row=>row.period)).size; const annualized=targetMonths?targetActual/targetMonths*12:0; const pathway=approvedTarget?targetValueForYear(approvedTarget,Number(year)):0; const pathReduction=approvedTarget?approvedTarget.baselineEmissions-pathway:0; const targetProgress=approvedTarget&&targetMonths&&pathReduction>0?Math.max(0,Math.min(100,Math.round((approvedTarget.baselineEmissions-annualized)/pathReduction*100))):0;
  const exportData=()=>{downloadCsv("sems2_ghg_inventory.csv",["귀속월","법인","사업장","Scope","활동자료","배출원","사용량","단위","배출량(tCO2e)","상태"],rows.map(r=>[r.period,r.company,r.site,r.scope,r.category,r.source,r.usage,r.unit,r.emissions,r.status]));showToast("산정 내역을 내려받았습니다.");};
  return <><PageHeader eyebrow="GHG INVENTORY" title="온실가스 인벤토리" description="활동자료와 배출계수를 연결해 Scope별 배출량을 산정하고 추적합니다."><label className="year-select"><Icon name="calendar" size={17}/><select value={year} onChange={e=>setRequestedYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="secondary-button" onClick={exportData}><Icon name="download" size={17}/>산정 내역 다운로드</button></PageHeader>
    <section className="inventory-hero"><div><span>{year}년 {scope??"전체 Scope"} 누적 배출량</span><div className="inventory-total"><strong>{formatNumber(total,1)}</strong><em>tCO₂e</em></div><p><b>확정 활동자료 {rows.length}건</b> · 검토 확정 데이터만 반영</p></div>{approvedTarget?<div className="target-block"><div className="target-copy"><span>{approvedTarget.targetYear} 감축경로 달성도</span><strong>{targetMonths?`${targetProgress}%`:"산정 대기"}</strong></div><div className="target-track"><span style={{width:`${targetProgress}%`}}/><i style={{left:"100%"}}/></div><div className="target-labels"><span>{year} 경로 {formatNumber(pathway,0)} t</span><span>{targetMonths?`연환산 ${formatNumber(annualized,0)} t`:"확정 실적 없음"}</span></div><button className="target-link-button" onClick={()=>onNavigate("targets")}>목표 산정근거·이행계획 보기 <Icon name="arrow" size={14}/></button></div>:<div className="target-block empty-target"><div className="target-copy"><span>연결된 감축목표 없음</span><strong>목표 설정 필요</strong></div><p>확정 인벤토리를 기준으로 목표를 먼저 수립해 주세요.</p><button className="target-link-button" onClick={()=>onNavigate("targets")}>감축목표 설정 <Icon name="arrow" size={14}/></button></div>}</section>
    <div className="scope-filter-note"><span>Scope 카드를 누르면 법인별 배출량이 해당 범위로 필터링됩니다.</span>{scope&&<button onClick={()=>setScope(null)}>전체 Scope 보기</button>}</div>
    <section className="inventory-grid"><article className="card"><CardHeader title="Scope별 인벤토리" subtitle="검토 확정 자료 기준"/><div className="inventory-scope-list">{(["Scope 1","Scope 2","Scope 3"] as Scope[]).map((s,i)=><InventoryScope key={s} number={`0${i+1}`} label={s} desc={i===0?"고정연소 · 이동연소 · 비산배출":i===1?"구매 전력 · 구매 열·스팀":"공급망 · 통근 · 출장 · 폐기물"} value={base.filter(r=>r.scope===s).reduce((a,r)=>a+r.emissions,0)} color={i===0?"dark":i===1?"mid":"light"} active={scope===s} onClick={()=>setScope(scope===s?null:s)}/>)}</div></article><article className="card"><CardHeader title="법인별 배출량" subtitle={`${year}년 ${scope??"전체 Scope"} 기준`} action="단위: tCO₂e"/><div className="horizontal-bars">{byCompany.map(item=><div key={item.name}><div><strong>{item.name}</strong><span>{formatNumber(item.value,1)}</span></div><p><span style={{width:`${Math.max(item.value/max*100,item.value?4:0)}%`}}/></p></div>)}</div></article></section>
    <section className="card formula-card"><CardHeader title="배출량 산정 구조" subtitle="원천자료부터 확정 데이터까지의 연결 관계"/><div className="formula-flow"><div><span className="flow-number">1</span><strong>활동자료</strong><small>Scope별 사용량 입력</small></div><Icon name="arrow"/><div><span className="flow-number">2</span><strong>배출계수</strong><small>기준정보에서 자동 적용</small></div><Icon name="arrow"/><div><span className="flow-number">3</span><strong>배출량 산정</strong><small>사용량 × 계수 ÷ 1,000</small></div><Icon name="arrow"/><div className="highlight"><span className="flow-number">4</span><strong>검토·확정</strong><small>증빙 연결 및 이력 보관</small></div></div></section></>;
}
function InventoryScope({number,label,desc,value,color,active,onClick}:{number:string;label:string;desc:string;value:number;color:string;active:boolean;onClick:()=>void}){return <button className={`inventory-scope ${active?"selected":""}`} onClick={onClick}><span className={`scope-number ${color}`}>{number}</span><div><strong>{label}</strong><p>{desc}</p></div><em>{formatNumber(value,1)}<small> tCO₂e</small></em><Icon name="chevron" size={17}/></button>}

function targetInventory(records:ActivityRecord[],company:string,scopes:Scope[],year:number){
  return records.filter(record=>record.status==="확정"&&record.active!==false&&record.period.startsWith(String(year))&&scopes.includes(record.scope)&&(company==="그룹 전체"||record.company===company)).reduce((sum,record)=>sum+record.emissions,0);
}
function defaultAnnualTargets(baselineYear:number,targetYear:number,baselineEmissions:number,existing:AnnualReductionTarget[]=[],finalReductionRate=30,allocationMode:TargetAllocationMode="균등 배분"){
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
}
function targetValueForYear(target:ReductionTarget,year:number){
  const direct=annualTargetsFor(target).find(item=>item.year===year);
  if(direct)return direct.targetEmissions;
  const duration=Math.max(1,target.targetYear-target.baselineYear);
  const ratio=Math.max(0,Math.min(1,(year-target.baselineYear)/duration));
  return target.baselineEmissions-(target.baselineEmissions-target.targetEmissions)*ratio;
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
  const annualRows=selected?annualTargetsFor(selected):[];
  const expectedCost=annualRows.reduce((sum,row)=>sum+row.expectedCost,0);
  const saveTarget=(target:ReductionTarget)=>{
    const isNew=target.id==="NEW-TARGET";
    const before=targets.find(item=>item.id===target.id);
    const materialChanged=Boolean(before?.status==="승인"&&(before.company!==target.company||before.baselineYear!==target.baselineYear||before.targetYear!==target.targetYear||before.reductionRate!==target.reductionRate||before.baselineEmissions!==target.baselineEmissions||before.scopes.join("|")!==target.scopes.join("|")||JSON.stringify(before.annualTargets??[])!==JSON.stringify(target.annualTargets??[])));
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
    const normalized={...plan,id:isNew?`RP-${String(Math.max(0,...plans.map(item=>Number(item.id.replace(/\D/g,""))||0))+1).padStart(3,"0")}`:plan.id,planType:plan.planType??"내부 감축" as PlanType,applicationYear:plan.applicationYear??Number(plan.startDate.slice(0,4)),investmentCost:plan.investmentCost??plan.budget??0,annualSavings:plan.annualSavings??0,budget:plan.investmentCost??plan.budget??0,status:normalizePlanStatus(plan),updatedAt:nowLabel()};
    onPlansChange(isNew?[normalized,...plans]:plans.map(item=>item.id===normalized.id?normalized:item));setPlanModal(null);setSelectedId(normalized.targetId);
    addAudit(isNew?"감축과제 등록":"감축과제 수정",normalized.title,`예상 감축 ${formatNumber(normalized.expectedReduction,1)} tCO₂e · 진척도 ${normalized.progress}%`);
    showToast(isNew?"새 감축과제를 등록했습니다.":"감축과제 실적을 수정했습니다.");
  };
  const deletePlan=(plan:ReductionPlan)=>{
    if(!window.confirm("이 감축과제를 삭제하시겠습니까?"))return;
    onPlansChange(plans.filter(item=>item.id!==plan.id));setPlanModal(null);addAudit("감축과제 삭제",plan.title,"목표에 연결된 이행계획에서 과제를 삭제했습니다.");showToast("감축과제를 삭제했습니다.");
  };
  const exportPlans=()=>{downloadCsv("SEMS_reduction_plan.csv",["목표","과제","구분","법인","사업장","Scope","세부 유형","적용연도","담당부서","담당자","시작일","종료일","예상감축량","실제감축량","투자비","연간 절감비","진척도","상태","검증자료"],visiblePlans.map(plan=>[selected?.name??"",plan.title,plan.planType??"내부 감축",plan.company,plan.site,plan.scope,plan.category,plan.applicationYear??plan.startDate.slice(0,4),plan.department,plan.owner,plan.startDate,plan.endDate,plan.expectedReduction,plan.actualReduction,plan.investmentCost??plan.budget??0,plan.annualSavings??0,plan.progress,normalizePlanStatus(plan),plan.verification]));showToast("현재 목표의 이행계획을 내려받았습니다.");};
  return <><PageHeader eyebrow="TARGET & ACTION PLAN" title="감축목표·이행계획" description="확정 인벤토리를 기준으로 목표를 수립하고, 필요 감축량을 실행과제로 분해해 실적까지 관리합니다."><button className="secondary-button" onClick={()=>setTargetModal("new")}><Icon name="target" size={17}/>새 목표 설정</button><button className="primary-button" onClick={()=>selected?setPlanModal("new"):showToast("감축목표를 먼저 설정해 주세요.")} disabled={!selected}><Icon name="plus" size={17}/>감축과제 등록</button></PageHeader>
    <section className="logic-flow"><div><span>1</span><strong>인벤토리 확정</strong><small>검토 완료 기준값</small></div><Icon name="arrow"/><div className={targets.length?"done":""}><span>2</span><strong>목표 수립·승인</strong><small>{targets.filter(item=>item.status==="승인").length}건 승인</small></div><Icon name="arrow"/><div className={plans.length?"done":""}><span>3</span><strong>이행계획 분해</strong><small>{plans.length}개 감축과제</small></div><Icon name="arrow"/><div className={actual>0?"done":""}><span>4</span><strong>실적·증빙 입력</strong><small>{formatNumber(actual,0)} t 감축 확인</small></div><Icon name="arrow"/><div className={delayed?"warning":""}><span>5</span><strong>분석·보완조치</strong><small>{delayed?`지연 ${delayed}건`:"정상 이행"}</small></div></section>
    <section className="target-summary"><SummaryTile label="승인 목표" value={targets.filter(item=>item.status==="승인").length} suffix="건" icon="target" tone="green"/><SummaryTile label="연결 과제" value={linkedPlans.length} suffix="건" icon="list"/><SummaryTile label="과제 확보율" value={coverage} suffix="%" icon="check" tone={coverage>=100?"green":"amber"}/><SummaryTile label="지연 과제" value={delayed} suffix="건" icon="alert" tone={delayed?"red":"green"}/></section>
    <section className="target-workspace"><aside className="card target-list"><CardHeader title="감축목표" subtitle="목표를 선택하면 산정근거와 이행계획이 연결됩니다." action={<button className="outline-small" onClick={()=>setTargetModal("new")}><Icon name="plus" size={14}/>추가</button>}/><div>{targets.map(target=><button key={target.id} className={selected?.id===target.id?"active":""} onClick={()=>setSelectedId(target.id)}><span className={`target-state ${target.status}`}>{target.status}</span><strong>{target.name}</strong><p>{target.company} · {target.scopes.join("·")}</p><div><span>{target.baselineYear} → {target.targetYear}</span><b>-{target.reductionRate}%</b></div></button>)}{!targets.length&&<div className="empty-state compact"><Icon name="target"/><strong>등록된 감축목표가 없습니다.</strong></div>}</div></aside>
      <div className="target-detail-column">{selected?<><article className="card target-detail-card"><div className="target-detail-head"><div><span className={`target-state ${selected.status}`}>{selected.status}</span><h2>{selected.name}</h2><p>{selected.description}</p></div><div className="row-actions">{selected.status==="초안"&&<button className="primary-button compact" onClick={()=>approveTarget(selected)}><Icon name="check" size={15}/>목표 승인</button>}{selected.status==="승인"&&<button className="secondary-button compact" onClick={()=>changeTargetStatus(selected,"종료")}><Icon name="lock" size={15}/>목표 종료</button>}{selected.status==="종료"&&<button className="secondary-button compact" onClick={()=>changeTargetStatus(selected,"초안")}><Icon name="refresh" size={15}/>다시 열기</button>}<button className="secondary-button compact" onClick={()=>setTargetModal(selected)}><Icon name="edit" size={15}/>수정</button></div></div><div className="target-number-grid"><div><span>기준연도 배출량</span><strong>{formatNumber(selected.baselineEmissions,1)}<small> tCO₂e</small></strong><em>{selected.baselineYear}년 입력 기준값</em></div><div><span>목표연도 배출량</span><strong>{formatNumber(selected.targetEmissions,1)}<small> tCO₂e</small></strong><em>{selected.targetYear}년 · {selected.reductionRate}% 감축</em></div><div><span>필요 감축량</span><strong>{formatNumber(required,1)}<small> tCO₂e</small></strong><em>기준배출량 - 목표배출량</em></div><div className={coverage<100?"warning":""}><span>과제 확보량</span><strong>{formatNumber(expected,1)}<small> tCO₂e</small></strong><em>{coverage}% 확보 · {formatNumber(Math.max(0,required-expected),1)} t 추가 필요</em></div></div><div className="pathway-head"><div><strong>연도별 목표·실적 모니터링</strong><span>감축계획 시트에서 산출한 값을 입력하고 확정 인벤토리 실적과 비교합니다.</span></div><span className="target-owner">예상비용 {formatNumber(expectedCost,0)}원 · 담당 {selected.owner}</span></div><div className="table-scroll annual-monitor-wrap"><table className="annual-monitor-table"><thead><tr><th>연도</th><th>배출 전망</th><th>목표 감축량</th><th>목표 배출량</th><th>목표 감축률</th><th>실제 배출량</th><th>목표 대비</th><th>예상비용</th></tr></thead><tbody>{annualRows.map(row=>{const actualValue=targetInventory(records,selected.company,selected.scopes,row.year);const hasActual=records.some(record=>record.status==="확정"&&record.active!==false&&record.period.startsWith(String(row.year))&&selected.scopes.includes(record.scope)&&(selected.company==="그룹 전체"||record.company===selected.company));const variance=actualValue-row.targetEmissions;return <tr key={row.year}><td><strong>{row.year}</strong></td><td>{formatNumber(row.projectedEmissions,1)}</td><td>{formatNumber(row.targetReduction,1)}</td><td><strong>{formatNumber(row.targetEmissions,1)}</strong></td><td>{formatNumber(row.reductionRate,1)}%</td><td>{hasActual?formatNumber(actualValue,1):"-"}</td><td>{hasActual?<span className={`annual-result ${variance<=0?"good":"bad"}`}>{variance<=0?`${formatNumber(Math.abs(variance),1)} t 여유`:`${formatNumber(variance,1)} t 초과`}</span>:"-"}</td><td>{formatNumber(row.expectedCost,0)}원</td></tr>})}</tbody></table>{!annualRows.length&&<div className="empty-state compact"><strong>연도별 목표값이 없습니다.</strong><p>목표 수정에서 연도별 계획값을 입력해 주세요.</p></div>}</div></article>
        <article className={`coverage-card card ${coverage<100?"needs-action":"complete"}`}><div><span><Icon name={coverage<100?"alert":"check"} size={19}/></span><div><strong>{coverage<100?"필요 감축량을 충족할 추가 과제가 필요합니다.":"필요 감축량을 과제로 모두 확보했습니다."}</strong><p>필요 {formatNumber(required,0)} t · 확보 {formatNumber(expected,0)} t · 실제 확인 {formatNumber(actual,0)} t</p></div></div><div className="coverage-track"><span style={{width:`${coverage}%`}}/></div><button onClick={()=>setPlanModal("new")}>{coverage<100?"추가 감축과제 수립":"이행계획 점검"} <Icon name="arrow" size={15}/></button></article>
        <article className="card plan-card"><CardHeader title="목표 연계 이행계획" subtitle="과제별 감축량, 적용연도, 투자·절감비와 진행상태를 관리합니다." action={<div className="plan-actions"><button className="outline-small" onClick={exportPlans}><Icon name="download" size={14}/>내보내기</button><button className="outline-small" onClick={()=>setPlanModal("new")}><Icon name="plus" size={14}/>과제 등록</button></div>}/><div className="status-tabs plan-tabs">{["전체","계획","진행중","지연","완료"].map(status=><button key={status} className={planFilter===status?"active":""} onClick={()=>setPlanFilter(status)}>{status}<span>{status==="전체"?linkedPlans.length:linkedPlans.filter(plan=>normalizePlanStatus(plan)===status).length}</span></button>)}</div><div className="table-scroll"><table className="data-table plan-table"><thead><tr><th>감축과제</th><th>구분 / 유형</th><th>법인 / 사업장</th><th>적용연도</th><th className="align-right">예상 / 실제 감축</th><th className="align-right">투자비 / 연간 절감비</th><th>진척도</th><th>상태</th><th>작업</th></tr></thead><tbody>{visiblePlans.map(plan=>{const status=normalizePlanStatus(plan);return <tr key={plan.id}><td><strong>{plan.title}</strong><span>{plan.department} · {plan.owner}</span></td><td><strong>{plan.planType??"내부 감축"}</strong><span>{plan.category} · {plan.scope}</span></td><td><strong>{plan.company}</strong><span>{plan.site}</span></td><td><strong>{plan.applicationYear??plan.startDate.slice(0,4)}</strong><span>{plan.startDate.slice(0,7)} ~ {plan.endDate.slice(0,7)}</span></td><td className="align-right"><strong>{formatNumber(plan.expectedReduction,1)} / {formatNumber(plan.actualReduction,1)}</strong><span>tCO₂e</span></td><td className="align-right"><strong>{formatNumber(plan.investmentCost??plan.budget??0,0)}</strong><span>절감 {formatNumber(plan.annualSavings??0,0)}원/년</span></td><td><div className="inline-progress plan-progress"><span><i style={{width:`${plan.progress}%`}}/></span><strong>{plan.progress}%</strong></div></td><td><StatusBadge status={status}/></td><td><button className="outline-small" onClick={()=>setPlanModal(plan)}><Icon name="edit" size={14}/>실적 입력</button></td></tr>})}</tbody></table>{!visiblePlans.length&&<div className="empty-state"><Icon name="list"/><strong>조건에 맞는 감축과제가 없습니다.</strong><p>목표의 필요 감축량을 사업장별 실행과제로 나눠 등록해 주세요.</p></div>}</div></article></>:<div className="card empty-state target-empty"><Icon name="target"/><strong>감축목표를 먼저 설정해 주세요.</strong><p>감축계획 시트에서 산출한 기준값과 연도별 목표를 입력해 주세요.</p><button className="primary-button" onClick={()=>setTargetModal("new")}><Icon name="plus" size={16}/>새 목표 설정</button></div>}</div>
    </section>
    {targetModal&&<TargetForm target={targetModal==="new"?null:targetModal} records={records} organizationNames={Object.keys(organizations)} linkedPlans={targetModal==="new"?0:plans.filter(plan=>plan.targetId===targetModal.id).length} onClose={()=>setTargetModal(null)} onSave={saveTarget} onDelete={targetModal==="new"?undefined:()=>deleteTarget(targetModal)}/>}
    {planModal&&selected&&<PlanForm plan={planModal==="new"?null:planModal} targets={targets} selectedTargetId={selected.id} organizations={organizations} onClose={()=>setPlanModal(null)} onSave={savePlan} onDelete={planModal==="new"?undefined:()=>deletePlan(planModal)}/>}
  </>;
}

function TargetForm({target,records,organizationNames,linkedPlans,onClose,onSave,onDelete}:{target:ReductionTarget|null;records:ActivityRecord[];organizationNames:string[];linkedPlans:number;onClose:()=>void;onSave:(target:ReductionTarget)=>void;onDelete?:()=>void}){
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
    <div className="form-section"><h3><span>3</span>연도별 감축경로</h3><p className="form-section-guide">균등 배분은 최종 감축률까지 매년 같은 폭으로 배분하고, 수동 입력은 연도별 감축률을 직접 조정합니다.</p><div className="target-allocation-toggle">{(["균등 배분","수동 입력"] as TargetAllocationMode[]).map(mode=><button type="button" key={mode} className={(form.allocationMode??"균등 배분")===mode?"active":""} onClick={()=>patch({allocationMode:mode})}><Icon name={mode==="균등 배분"?"target":"edit"} size={16}/><span><strong>{mode}</strong><small>{mode==="균등 배분"?"최종 감축률까지 자동 계산":"연도별 감축률 직접 입력"}</small></span></button>)}</div><div className="annual-input-scroll"><table className="annual-input-table"><thead><tr><th>연도</th><th>연도별 감축률</th><th>목표 감축량</th><th>목표 배출량</th><th>예상비용</th></tr></thead><tbody>{annualTargets.map(row=><tr key={row.year}><td><strong>{row.year}</strong></td><td><div className="input-unit compact"><input aria-label={`${row.year}년 감축률`} type="number" min="0" max="99.9" step="0.1" value={formatNumber(row.reductionRate,1)} readOnly={(form.allocationMode??"균등 배분")==="균등 배분"} onChange={event=>patchAnnualRate(row.year,Number(event.target.value))}/><span>%</span></div></td><td><strong>{formatNumber(row.targetReduction,1)}</strong><span>tCO₂e</span></td><td><strong>{formatNumber(row.targetEmissions,1)}</strong><span>tCO₂e</span></td><td><input aria-label={`${row.year}년 예상비용`} type="number" min="0" step="10000" value={row.expectedCost||""} onChange={event=>patchExpectedCost(row.year,Number(event.target.value))}/><span>원</span></td></tr>)}</tbody></table></div></div>
    <div className="form-section"><h3><span>4</span>운영 근거</h3><label className="textarea-label">목표 설명·산정 근거<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder="목표 경계, 적용 기준, 제외 범위와 감축계획 시트의 파일명·버전을 적어 주세요." required/></label><div className="target-form-note"><Icon name="alert" size={16}/><span>{form.status==="승인"?"승인된 목표 또는 연도별 수치를 변경하면 초안으로 전환되어 변경 이력에 남습니다.":"저장 후 목표 목록에서 승인해야 공식 이행목표로 집계됩니다."}</span></div>{linkedPlans>0&&<div className="target-form-note linked"><Icon name="list" size={16}/><span>이 목표에 {linkedPlans}개의 이행계획이 연결되어 있습니다. 목표 범위를 바꾸면 과제 범위도 함께 확인해 주세요.</span></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>목표 저장</button></div></div>
  </form></Overlay>;
}

function PlanForm({plan,targets,selectedTargetId,organizations,onClose,onSave,onDelete}:{plan:ReductionPlan|null;targets:ReductionTarget[];selectedTargetId:string;organizations:Record<string,string[]>;onClose:()=>void;onSave:(plan:ReductionPlan)=>void;onDelete?:()=>void}){
  const target=targets.find(item=>item.id===(plan?.targetId??selectedTargetId))??targets[0];
  const organizationNames=Object.keys(organizations);
  const defaultCompany=target.company==="그룹 전체"?organizationNames[0]??"":target.company;
  const [form,setForm]=useState<ReductionPlan>(plan?{...plan,planType:plan.planType??"내부 감축",applicationYear:plan.applicationYear??Number(plan.startDate.slice(0,4)),investmentCost:plan.investmentCost??plan.budget??0,annualSavings:plan.annualSavings??0}:{id:"NEW-PLAN",targetId:target.id,title:"",company:defaultCompany,site:organizations[defaultCompany]?.[0]??"",scope:target.scopes[0],category:"에너지 효율",department:"",owner:"",startDate:`${Math.max(new Date().getFullYear(),target.baselineYear+1)}-01-01`,endDate:`${target.targetYear}-12-31`,planType:"내부 감축",applicationYear:Math.max(new Date().getFullYear(),target.baselineYear+1),expectedReduction:0,actualReduction:0,investmentCost:0,annualSavings:0,budget:0,progress:0,status:"계획",verification:"",description:"",updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const selectedTarget=targets.find(item=>item.id===form.targetId)??target;
  const patch=(next:Partial<ReductionPlan>)=>{setForm(current=>({...current,...next}));setError("");};
  const changeTarget=(id:string)=>{const nextTarget=targets.find(item=>item.id===id);if(!nextTarget)return;const company=nextTarget.company==="그룹 전체"?organizationNames[0]??"":nextTarget.company;setForm(current=>({...current,targetId:id,company,site:organizations[company]?.[0]??"",scope:nextTarget.scopes[0],applicationYear:Math.max(nextTarget.baselineYear+1,current.applicationYear??nextTarget.baselineYear+1),endDate:`${nextTarget.targetYear}-12-31`}));};
  const submit=(event:FormEvent)=>{event.preventDefault();if(form.startDate>form.endDate){setError("과제 종료일은 시작일보다 빠를 수 없습니다.");return;}if(Number(form.startDate.slice(0,4))<=selectedTarget.baselineYear||Number(form.endDate.slice(0,4))>selectedTarget.targetYear){setError(`과제 일정은 기준연도 이후부터 목표연도 ${selectedTarget.targetYear}년 안에 설정해 주세요.`);return;}if((form.applicationYear??0)<=selectedTarget.baselineYear||(form.applicationYear??0)>selectedTarget.targetYear){setError(`적용연도는 ${selectedTarget.baselineYear+1}년부터 ${selectedTarget.targetYear}년 사이로 입력해 주세요.`);return;}if(form.planType!=="비정량 과제"&&form.expectedReduction<=0){setError("정량 감축과제의 예상 감축량을 0보다 크게 입력해 주세요.");return;}if(form.actualReduction<0){setError("실제 감축량은 0 이상이어야 합니다.");return;}onSave({...form,budget:form.investmentCost??0,status:normalizePlanStatus(form)});};
  return <Overlay title={plan?"감축과제·실적 수정":"새 감축과제 등록"} eyebrow="REDUCTION ACTION" description="감축계획 시트에서 확정한 과제별 감축량과 투자·절감비를 등록하고 진행상태를 관리합니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>연결 목표와 과제 범위</h3><div className="form-grid"><label className="full-span">연결 감축목표<select value={form.targetId} onChange={event=>changeTarget(event.target.value)}>{targets.filter(item=>item.status!=="종료"||item.id===form.targetId).map(item=><option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label><label className="full-span">과제명<input value={form.title} onChange={event=>patch({title:event.target.value})} placeholder="예: 공장 고효율 공조설비 교체" required/></label><label>과제 구분<select value={form.planType??"내부 감축"} onChange={event=>patch({planType:event.target.value as PlanType})}><option>내부 감축</option><option>외부 감축</option><option>비정량 과제</option></select></label><label>세부 유형<select value={form.category} onChange={event=>patch({category:event.target.value})}><option>에너지 효율</option><option>재생에너지</option><option>연료 전환</option><option>공정 개선</option><option>비산배출</option><option>이동연소</option><option>외부 감축사업</option><option>공급망 협력</option><option>기타</option></select></label><label>법인<select value={form.company} disabled={selectedTarget.company!=="그룹 전체"} onChange={event=>{const company=event.target.value;patch({company,site:organizations[company]?.[0]??""})}}>{organizationNames.filter(company=>selectedTarget.company==="그룹 전체"||company===selectedTarget.company).map(company=><option key={company}>{company}</option>)}</select></label><label>사업장<select value={form.site} onChange={event=>patch({site:event.target.value})}>{(organizations[form.company]??[]).map(site=><option key={site}>{site}</option>)}</select></label><label>Scope<select value={form.scope} onChange={event=>patch({scope:event.target.value as Scope})}>{selectedTarget.scopes.map(scope=><option key={scope}>{scope}</option>)}</select></label><label>적용연도<input type="number" min={selectedTarget.baselineYear+1} max={selectedTarget.targetYear} value={form.applicationYear??""} onChange={event=>patch({applicationYear:Number(event.target.value)})} required/></label></div></div>
    <div className="form-section"><h3><span>2</span>일정·담당·비용</h3><div className="form-grid"><label>시작일<input type="date" value={form.startDate} onChange={event=>patch({startDate:event.target.value})} required/></label><label>종료일<input type="date" value={form.endDate} onChange={event=>patch({endDate:event.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={event=>patch({department:event.target.value})} required/></label><label>담당자<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>예상 감축량<div className="input-unit"><input type="number" min="0" step="0.1" value={form.expectedReduction||""} onChange={event=>patch({expectedReduction:Number(event.target.value)})} required={form.planType!=="비정량 과제"}/><span>tCO₂e</span></div></label><label>투자비<div className="input-unit"><input type="number" min="0" step="10000" value={form.investmentCost||""} onChange={event=>patch({investmentCost:Number(event.target.value),budget:Number(event.target.value)})}/><span>원</span></div></label><label>연간 절감비<div className="input-unit"><input type="number" min="0" step="10000" value={form.annualSavings||""} onChange={event=>patch({annualSavings:Number(event.target.value)})}/><span>원/년</span></div></label></div>{form.planType==="비정량 과제"&&<div className="target-form-note linked"><Icon name="list" size={16}/><span>비정량 과제는 예상 감축량을 0으로 둘 수 있으며, 실행내용과 진척도를 중심으로 관리합니다.</span></div>}</div>
    <div className="form-section"><h3><span>3</span>이행 실적과 검증</h3><div className="form-grid"><label>진척도<div className="input-unit"><input type="number" min="0" max="100" value={form.progress} onChange={event=>patch({progress:Number(event.target.value)})}/><span>%</span></div></label><label>실제 확인 감축량<div className="input-unit"><input type="number" min="0" step="0.1" value={form.actualReduction||""} onChange={event=>patch({actualReduction:Number(event.target.value)})}/><span>tCO₂e</span></div></label><label className="full-span">검증자료·확인방법<input value={form.verification} onChange={event=>patch({verification:event.target.value})} placeholder="예: 설비별 전력계, 개선 전후 동월 사용량, 준공검사서" required/></label><label className="full-span textarea-label">실행내용·실적 메모<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder="주요 실행 단계, 실적 산정 기준, 지연 사유와 후속조치를 적어 주세요." required/></label></div><div className="plan-status-preview"><span>저장 시 상태</span><StatusBadge status={normalizePlanStatus(form)}/><p>진척도와 종료일을 기준으로 계획·진행중·지연·완료 상태가 자동 판정됩니다.</p></div>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>{plan?"실적 저장":"과제 등록"}</button></div></div></form></Overlay>;
}

/*
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
*/

function Evidence({items,onChange,showToast}:{items:EvidenceItem[];onChange:(x:EvidenceItem[])=>void;showToast:(m:string)=>void}){
  const {canWrite}=useSemsAuth();
  const supabase=getSupabaseBrowserClient();
  const [status,setStatus]=useState("전체");
  const [search,setSearch]=useState("");
  const [editing,setEditing]=useState<EvidenceItem|null|"new">(null);
  const normalized=items.map(item=>({...item,status:item.expiresAt&&item.expiresAt<new Date().toISOString().slice(0,10)?"만료" as EvidenceStatus:item.status}));
  const filtered=normalized.filter(item=>(status==="전체"||item.status===status)&&`${item.title} ${item.category} ${item.organization} ${item.owner} ${item.issuer} ${item.linkedIndicators.join(" ")} ${item.linkedFrameworks.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const expiring=normalized.filter(item=>item.expiresAt&&daysUntil(item.expiresAt)>=0&&daysUntil(item.expiresAt)<=60).length;
  const linked=normalized.filter(item=>item.linkedIndicators.length||item.linkedFrameworks.length).length;
  const save=(item:EvidenceItem)=>{const exists=items.some(row=>row.id===item.id);const saved=exists?item:{...item,id:Date.now()};onChange(exists?items.map(row=>row.id===item.id?saved:row):[saved,...items]);setEditing(null);showToast(exists?"증빙자료 정보와 연결 항목을 수정했습니다.":"증빙자료를 라이브러리에 등록했습니다.");};
  const remove=async(item:EvidenceItem)=>{if(!window.confirm("이 증빙자료를 라이브러리에서 삭제하시겠습니까?"))return;if(item.storagePath&&supabase)await supabase.storage.from("sems2-evidence").remove([item.storagePath]);onChange(items.filter(row=>row.id!==item.id));setEditing(null);showToast("증빙자료를 삭제했습니다.");};
  const openFile=async(item:EvidenceItem)=>{if(!item.storagePath||!supabase){showToast("연결된 원본 파일이 없습니다.");return;}const {data,error}=await supabase.storage.from("sems2-evidence").createSignedUrl(item.storagePath,60);if(error||!data?.signedUrl){showToast("원본 파일을 열 수 없습니다.");return;}window.open(data.signedUrl,"_blank","noopener,noreferrer");};
  const exportList=()=>{downloadCsv("SEMS_evidence_library.csv",["증빙자료","분류","법인","발행기관","발행일","유효기간","담당","보안등급","연결 지표","연결 기준","버전","파일","상태"],filtered.map(item=>[item.title,item.category,item.organization,item.issuer,item.issuedDate,item.expiresAt,item.owner,item.securityLevel,item.linkedIndicators.join(", "),item.linkedFrameworks.join(", "),item.version,item.fileName,item.status]));showToast("증빙자료 라이브러리 목록을 내려받았습니다.");};
  return <><PageHeader eyebrow="EVIDENCE LIBRARY" title="증빙자료 라이브러리" description="한 번 등록한 원본 증빙을 여러 지표·평가·공시 항목에 연결하고 버전과 유효기간을 관리합니다."><button className="secondary-button" onClick={exportList}><Icon name="download" size={17}/>목록 내보내기</button>{canWrite&&<button className="primary-button" onClick={()=>setEditing("new")}><Icon name="upload" size={17}/>증빙자료 등록</button>}</PageHeader>
    <section className="summary-grid"><SummaryTile label="등록 문서" value={items.length} suffix="건" icon="file"/><SummaryTile label="승인 문서" value={normalized.filter(item=>item.status==="승인").length} suffix="건" icon="check" tone="green"/><SummaryTile label="60일 내 만료" value={expiring} suffix="건" icon="alert" tone={expiring?"amber":"green"}/><SummaryTile label="지표·평가 연결" value={linked} suffix="건" icon="list" tone="green"/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","검토중","승인","보완 요청","만료"].map(item=><button key={item} className={status===item?"active":""} onClick={()=>setStatus(item)}>{item}<span>{item==="전체"?normalized.length:normalized.filter(row=>row.status===item).length}</span></button>)}</div><div className="search-box"><Icon name="search" size={17}/><input placeholder="문서명, 법인, 지표, 평가기준 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div></div><div className="table-scroll"><table className="data-table evidence-library-table"><thead><tr><th>증빙자료</th><th>법인 / 담당</th><th>발행·유효기간</th><th>연결 지표</th><th>활용 평가·공시</th><th>원본</th><th>상태</th><th>작업</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><strong>{item.title}</strong><span>{item.category} · {item.documentType} · v{item.version}</span></td><td><strong>{item.organization||"공통"}</strong><span>{item.owner}</span></td><td><strong>{item.issuedDate||"-"}</strong><span>{item.expiresAt?`유효 ${item.expiresAt}`:"유효기간 없음"}</span></td><td><div className="chip-list">{item.linkedIndicators.length?item.linkedIndicators.slice(0,3).map(code=><span key={code}>{code}</span>):<em>미연결</em>}</div></td><td><div className="chip-list framework">{item.linkedFrameworks.length?item.linkedFrameworks.slice(0,3).map(code=><span key={code}>{code}</span>):<em>미연결</em>}</div></td><td>{item.fileName?<button className="file-link-button" onClick={()=>void openFile(item)}><Icon name="file" size={15}/>{item.fileName}</button>:<span className="muted">파일 없음</span>}</td><td><StatusBadge status={item.status}/></td><td>{canWrite&&<button className="outline-small" onClick={()=>setEditing(item)}><Icon name="edit" size={14}/>수정</button>}</td></tr>)}</tbody></table>{!filtered.length&&<div className="empty-state"><Icon name="file"/><strong>등록된 증빙자료가 없습니다.</strong><p>원본 파일을 등록한 뒤 여러 지표와 평가기준에 연결해 재사용할 수 있습니다.</p></div>}</div></section>
    {editing&&<EvidenceForm item={editing==="new"?null:editing} organizations={Object.keys(readOrganizations())} onClose={()=>setEditing(null)} onSave={save} onDelete={editing==="new"?undefined:()=>void remove(editing)}/>}
  </>;
}

function readOrganizations(){
  try{return JSON.parse(localStorage.getItem("sems2-organizations")||"{}") as Record<string,string[]>;}catch{return {};}
}

function EvidenceForm({item,organizations,onClose,onSave,onDelete}:{item:EvidenceItem|null;organizations:string[];onClose:()=>void;onSave:(item:EvidenceItem)=>void;onDelete?:()=>void}){
  const supabase=getSupabaseBrowserClient();
  const {profile}=useSemsAuth();
  const [file,setFile]=useState<File|null>(null);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");
  const [form,setForm]=useState<EvidenceItem>(item??{id:0,title:"",category:"온실가스·에너지",documentType:"원천 증빙",organization:profile.organization?.name??"",owner:profile.department||"",issuer:"",issuedDate:"",expiresAt:"",securityLevel:"사내한",linkedIndicators:[],linkedFrameworks:[],version:"1.0",fileName:"",storagePath:"",notes:"",status:"검토중",updatedAt:"방금 전"});
  const patch=(value:Partial<EvidenceItem>)=>setForm(current=>({...current,...value}));
  const submit=async(event:FormEvent)=>{event.preventDefault();setUploading(true);setError("");try{let fileName=form.fileName;let storagePath=form.storagePath;if(file){if(!supabase)throw new Error("Supabase Storage 연결 정보가 없습니다.");const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");storagePath=`${profile.id}/${Date.now()}-${safeName}`;const {error:uploadError}=await supabase.storage.from("sems2-evidence").upload(storagePath,file,{upsert:false});if(uploadError)throw uploadError;fileName=file.name;}onSave({...form,fileName,storagePath,updatedAt:nowLabel()});}catch(uploadError){setError(uploadError instanceof Error?uploadError.message:"파일을 업로드하지 못했습니다.");}finally{setUploading(false);}};
  return <Overlay title={item?"증빙자료 수정":"증빙자료 등록"} eyebrow="EVIDENCE LIBRARY" description="원본 파일과 메타데이터를 저장하고 여러 지표·평가 항목에 재사용할 수 있게 연결합니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>문서 기본정보</h3><div className="form-grid"><label className="full-span">증빙자료명<input value={form.title} onChange={event=>patch({title:event.target.value})} required/></label><label>분류<select value={form.category} onChange={event=>patch({category:event.target.value})}><option>온실가스·에너지</option><option>환경</option><option>사회</option><option>공급망</option><option>지배구조</option></select></label><label>문서 유형<select value={form.documentType} onChange={event=>patch({documentType:event.target.value})}><option>원천 증빙</option><option>정책·규정</option><option>인증서</option><option>검증보고서</option><option>계약서</option><option>기타</option></select></label><label>적용 법인<select value={form.organization} onChange={event=>patch({organization:event.target.value})}><option value="">그룹 공통</option>{organizations.map(name=><option key={name}>{name}</option>)}</select></label><label>담당 부서<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>발행기관<input value={form.issuer} onChange={event=>patch({issuer:event.target.value})}/></label><label>버전<input value={form.version} onChange={event=>patch({version:event.target.value})} required/></label><label>발행일<input type="date" value={form.issuedDate} onChange={event=>patch({issuedDate:event.target.value})}/></label><label>유효기간<input type="date" value={form.expiresAt} onChange={event=>patch({expiresAt:event.target.value})}/></label><label>보안등급<select value={form.securityLevel} onChange={event=>patch({securityLevel:event.target.value as EvidenceItem["securityLevel"]})}><option>일반</option><option>사내한</option><option>기밀</option></select></label><label>검토 상태<select value={form.status} onChange={event=>patch({status:event.target.value as EvidenceStatus})}><option>검토중</option><option>승인</option><option>보완 요청</option><option>만료</option></select></label></div></div><div className="form-section"><h3><span>2</span>재사용 연결</h3><div className="form-grid"><label className="full-span">연결 지표 코드<input value={form.linkedIndicators.join(", ")} onChange={event=>patch({linkedIndicators:event.target.value.split(",").map(value=>value.trim()).filter(Boolean)})} placeholder="예: E-01, E-02"/></label><label className="full-span">활용 평가·공시기준<input value={form.linkedFrameworks.join(", ")} onChange={event=>patch({linkedFrameworks:event.target.value.split(",").map(value=>value.trim()).filter(Boolean)})} placeholder="예: CDP C6, EcoVadis 환경, GRI 305-1"/></label><label className="full-span textarea-label">관리 메모<textarea value={form.notes} onChange={event=>patch({notes:event.target.value})} placeholder="적용 범위, 갱신 조건, 사용 시 주의사항을 적어 주세요."/></label></div></div><div className="form-section"><h3><span>3</span>원본 파일</h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.docx,.jpg,.jpeg,.png" onChange={event=>{const selected=event.target.files?.[0]??null;if(selected&&selected.size>20*1024*1024){setError("파일은 20MB 이하만 등록할 수 있습니다.");return;}setFile(selected);setError("");}}/><span className="upload-icon"><Icon name="upload"/></span><strong>{file?.name||form.fileName||"원본 파일을 선택하세요."}</strong><small>PDF, Excel, Word, JPG, PNG · 최대 20MB</small></label>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={uploading}><Icon name="check" size={16}/>{uploading?"저장 중":"저장"}</button></div></div></form></Overlay>;
}

function Indicators({items,onChange,showToast}:{items:Indicator[];onChange:(x:Indicator[])=>void;showToast:(m:string)=>void}){
  const {canManage}=useSemsAuth();
  const [category,setCategory]=useState("전체");
  const [search,setSearch]=useState("");
  const [visibleLimit,setVisibleLimit]=useState(150);
  const [editing,setEditing]=useState<Indicator|null|"new">(null);
  const filtered=items.filter(item=>(category==="전체"||item.category===category)&&`${item.code} ${item.name} ${item.owner} ${item.reviewer} ${item.definition} ${item.frameworks.join(" ")} ${(item.detailItems??[]).map(detail=>detail.label).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const visible=filtered.slice(0,visibleLimit);
  const save=(row:Indicator)=>{const exists=items.some(item=>item.id===row.id);const saved=exists?row:{...row,id:Date.now()};onChange(exists?items.map(item=>item.id===row.id?saved:item):[...items,saved]);setEditing(null);showToast(exists?"지표 정의서와 담당 체계를 수정했습니다.":"새 ESG 지표 정의서를 등록했습니다.");};
  const remove=(id:number)=>{if(!window.confirm("이 지표 정의서를 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==id));setEditing(null);showToast("지표 정의서를 삭제했습니다.");};
  return <><PageHeader eyebrow="METRIC MASTER" title="ESG 지표 정의서" description={`기존 수집툴과 GRI 보완자료에서 정규화한 ${GRI_WORKBOOK_INDICATOR_COUNTS.total}개 지표를 포함해 정의·범위·산식·담당·증빙을 관리합니다.`}><button className="secondary-button" onClick={()=>{downloadCsv("SEMS_indicator_master.csv",["코드","구분","지표명","정의","범위","단위","산식","원천","주기","담당","승인자","상태","마감","연결 평가"],filtered.map(item=>[item.code,item.category,item.name,item.definition,item.boundary,item.unit,item.formula,item.dataSource,item.cycle,item.owner,item.reviewer,item.status,item.dueDate,item.frameworks.join(", ")]));showToast("지표 정의서 목록을 내려받았습니다.");}}><Icon name="download" size={17}/>정의서 내보내기</button>{canManage&&<button className="primary-button" onClick={()=>setEditing("new")}><Icon name="plus" size={17}/>지표 등록</button>}</PageHeader>
    <section className="pillar-grid"><PillarCard code="E" title="환경" count={items.filter(item=>item.category==="환경").length} color="green" progress={average(items.filter(item=>item.category==="환경"))}/><PillarCard code="S" title="사회" count={items.filter(item=>item.category==="사회").length} color="blue" progress={average(items.filter(item=>item.category==="사회"))}/><PillarCard code="G" title="지배구조" count={items.filter(item=>item.category==="지배구조").length} color="violet" progress={average(items.filter(item=>item.category==="지배구조"))}/></section>
    <section className="card data-card"><div className="data-toolbar"><div className="status-tabs">{["전체","환경","사회","지배구조"].map(item=><button key={item} className={category===item?"active":""} onClick={()=>{setCategory(item);setVisibleLimit(150)}}>{item}<span>{item==="전체"?items.length:items.filter(row=>row.category===item).length}</span></button>)}</div><div className="search-box"><Icon name="search" size={17}/><input placeholder="코드, 제목, 세부값, 담당, 평가기준 검색" value={search} onChange={event=>{setSearch(event.target.value);setVisibleLimit(150)}}/></div></div><div className="table-scroll"><table className="data-table indicator-definition-table"><thead><tr><th>코드 / 구분</th><th>지표명·정의</th><th>단위 / 주기</th><th>담당 → 승인</th><th>평가·공시 매핑</th><th>제출 상태</th><th>수집률</th><th>작업</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><strong className="indicator-code">{row.code}</strong><span className={`pillar-tag ${row.category==="환경"?"e":row.category==="사회"?"s":"g"}`}>{row.category}</span></td><td><strong>{row.name}</strong><span>{row.definition||"정의 미등록"}</span></td><td><strong>{row.detailItems?.length?`세부값 ${row.detailItems.length}개`:row.unit}</strong><span>{row.cycle}</span></td><td><strong>{row.owner||"미지정"}</strong><span>→ {row.reviewer||"미지정"}</span></td><td><div className="chip-list framework">{row.frameworks.length?row.frameworks.slice(0,3).map(value=><span key={value}>{value}</span>):<em>미연결</em>}</div></td><td><StatusBadge status={row.status}/><span>{row.dueDate||"마감 미정"}</span></td><td><div className="inline-progress"><span><i style={{width:`${row.progress}%`}}/></span><strong>{row.progress}%</strong></div></td><td>{canManage&&<button className="outline-small" onClick={()=>setEditing(row)}><Icon name="edit" size={14}/>수정</button>}</td></tr>)}</tbody></table>{filtered.length>visible.length&&<button type="button" className="metric-picker-more table-more" onClick={()=>setVisibleLimit(limit=>limit+150)}>지표 150개 더 보기</button>}{!filtered.length&&<div className="empty-state"><Icon name="list"/><strong>등록된 지표 정의서가 없습니다.</strong><p>평가·공시에 반복 활용할 내부 기준 지표부터 등록해 주세요.</p></div>}</div></section>
    {editing&&<IndicatorForm item={editing==="new"?null:editing} onClose={()=>setEditing(null)} onSave={save} onDelete={editing==="new"?undefined:()=>remove(editing.id)}/>}
  </>;
}

function average(items:Indicator[]){return items.length?Math.round(items.reduce((sum,item)=>sum+item.progress,0)/items.length):0}
function PillarCard({code,title,count,color,progress}:{code:string;title:string;count:number;color:string;progress:number}){return <article className={`pillar-card ${color}`}><div className="pillar-letter">{code}</div><div><span>{title} 지표</span><strong>{count}<small>개 지표</small></strong><p>평균 수집률 <b>{progress}%</b></p></div><div className="pillar-progress" style={{background:`conic-gradient(currentColor ${progress}%, #edf1f0 0)`}}><span/></div></article>}

function IndicatorForm({item,onClose,onSave,onDelete}:{item:Indicator|null;onClose:()=>void;onSave:(item:Indicator)=>void;onDelete?:()=>void}){
  const initial=item??{id:0,code:"",name:"",category:"환경",unit:"",cycle:"월",aggregation:"합계" as const,owner:"",reviewer:"",progress:0,status:"미작성" as IndicatorStatus,definition:"",boundary:"",formula:"",dataSource:"",evidenceExample:"",frameworks:[],dueDate:"",active:true,inputTemplate:"GENERAL" as MetricInputTemplate};
  const [form,setForm]=useState<Indicator>({...initial,inputTemplate:initial.inputTemplate??inferMetricInputTemplate(initial)});
  const patch=(value:Partial<Indicator>)=>setForm(current=>({...current,...value}));
  return <Overlay title={item?"ESG 지표 정의서 수정":"ESG 지표 정의서 등록"} eyebrow="METRIC MASTER" description="담당자가 바뀌어도 동일한 기준으로 수집·검토할 수 있도록 정의와 운영 규칙, 지표별 입력 양식을 등록합니다." onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSave(form)}}>
    <div className="form-section"><h3><span>1</span>지표 기본정보</h3><div className="form-grid"><label>지표 코드<input value={form.code} onChange={event=>patch({code:event.target.value.toUpperCase()})} required/></label><label>구분<select value={form.category} onChange={event=>patch({category:event.target.value as Indicator["category"]})}><option>환경</option><option>사회</option><option>지배구조</option></select></label><label className="full-span">지표명<input value={form.name} onChange={event=>patch({name:event.target.value})} required/></label><label className="full-span textarea-label">지표 정의<textarea value={form.definition} onChange={event=>patch({definition:event.target.value})} placeholder="무엇을 측정하는 지표인지 명확히 적어 주세요." required/></label><label className="full-span textarea-label">포함·제외 범위<textarea value={form.boundary} onChange={event=>patch({boundary:event.target.value})} placeholder="포함 조직·사업장·대상과 제외 조건을 적어 주세요." required/></label><label>단위<input value={form.unit} onChange={event=>patch({unit:event.target.value})} required/></label><label>수집 주기<select value={form.cycle} onChange={event=>patch({cycle:event.target.value})}><option>월</option><option>분기</option><option>반기</option><option>연</option><option>수시</option></select></label><label>수집 양식<select value={form.inputTemplate??"GENERAL"} onChange={event=>patch({inputTemplate:event.target.value as MetricInputTemplate})}>{Object.entries(METRIC_TEMPLATE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small className="field-help">지표 특성에 맞춰 상세 입력 항목과 자동 집계 방식을 선택합니다.</small></label><label>집계 방식<select value={form.aggregation??"합계"} onChange={event=>patch({aggregation:event.target.value as Indicator["aggregation"]})}><option>합계</option><option>평균</option><option>최종값</option></select></label><label className="full-span">산식<input value={form.formula} onChange={event=>patch({formula:event.target.value})} placeholder="예: Scope 1 + Scope 2 배출량" required/></label><label className="full-span">데이터 원천<input value={form.dataSource} onChange={event=>patch({dataSource:event.target.value})} placeholder="예: 전기요금서, SAP 구매내역, 안전보건 시스템" required/></label></div></div>
    <div className="form-section"><h3><span>2</span>담당·승인·제출</h3><div className="form-grid"><label>담당 부서·담당자<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>승인 부서·승인자<input value={form.reviewer} onChange={event=>patch({reviewer:event.target.value})} required/></label><label>제출 상태<select value={form.status} onChange={event=>patch({status:event.target.value as IndicatorStatus})}><option>미작성</option><option>작성중</option><option>제출</option><option>반려</option><option>승인</option></select></label><label>마감일<input type="date" value={form.dueDate} onChange={event=>patch({dueDate:event.target.value})}/></label><label>수집률 (%)<input type="number" min="0" max="100" value={form.progress} onChange={event=>patch({progress:Number(event.target.value)})}/></label><Toggle label="사용 중인 지표" checked={form.active} onChange={value=>patch({active:value})}/></div></div>
    <div className="form-section"><h3><span>3</span>증빙·평가 매핑</h3><div className="form-grid"><label className="full-span">필수 증빙 예시<input value={form.evidenceExample} onChange={event=>patch({evidenceExample:event.target.value})} placeholder="예: 월별 전기요금 고지서, 계량기 검침표"/></label><label className="full-span">연결 평가·공시기준<input value={form.frameworks.join(", ")} onChange={event=>patch({frameworks:event.target.value.split(",").map(value=>value.trim()).filter(Boolean)})} placeholder="예: CDP C6, EcoVadis 환경성과, GRI 305-1"/></label></div></div>
    <div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>정의서 저장</button></div></div>
  </form></Overlay>;
}

const standardMetricIndicators:Omit<Indicator,"id">[]=[
  ...GRI_WORKBOOK_INDICATORS.map(item=>({...item,progress:0,status:"미작성" as const})),
  {code:"E-AIR-01",name:"대기오염물질 배출량",category:"환경",unit:"kg",cycle:"월",aggregation:"합계",owner:"환경 담당부서",reviewer:"기획실",progress:0,status:"미작성",definition:"대기배출시설에서 배출된 대기오염물질의 총량",boundary:"허가·신고 대상 대기배출시설",formula:"물질별 측정농도 × 배출가스 유량 × 가동시간",dataSource:"자가측정 성적서, 대기배출시설 운영기록",evidenceExample:"자가측정 성적서 및 산정 내역",frameworks:["GRI 305-7","ESRS E2-4"],dueDate:"",active:true},
  {code:"S-TRAIN-01",name:"임직원 교육시간",category:"사회",unit:"시간",cycle:"분기",aggregation:"합계",owner:"인사 담당부서",reviewer:"기획실",progress:0,status:"미작성",definition:"보고기간 중 임직원의 총 교육시간과 임직원 총원을 함께 수집해 1인당 교육시간을 산정",boundary:"재직 임직원 대상 직무·법정·리더십 교육",formula:"총 교육시간 합계 및 총 교육시간 ÷ 임직원 총원",dataSource:"교육관리대장, 교육 수료내역, 인사시스템",evidenceExample:"교육 결과보고서, 참석자 명단 및 임직원 현황",frameworks:["GRI 404-1","ESRS S1-13"],dueDate:"",active:true},
];

type MetricTemplateField = {
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
  BREAKDOWN:"세분 항목",
  FIXED:"고정 세부값",
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
  BREAKDOWN:[
    {key:"dimension1",label:"세분 항목",type:"text",placeholder:"예: 제품군, 국가, 근로자 유형"},
    {key:"dimension2",label:"세부 구분",type:"text",placeholder:"예: 남성, 국내, 재활용"},
    {key:"amount",label:"수치",type:"number",aggregate:true},
  ],
  FIXED:[
    {key:"amount",label:"수치",type:"number"},
  ],
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
    {key:"hoursPerPerson",label:"교육시간(1인 기준)",type:"number"},
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
const REDUNDANT_METRIC_CODES=new Set(["E-WATER-01","E-WASTE-01","E-WASTE-02","S-TRAIN-02"]);
const METRIC_CODE_REPLACEMENTS:Record<string,string>={
  "E-WATER-01":"ENV-WATER",
  "E-WASTE-01":"ENV-WASTE",
  "E-WASTE-02":"ENV-WASTE",
  "S-TRAIN-02":"S-TRAIN-01",
};
const CANONICAL_WORKBOOK_INDICATOR_IDS=new Set(GRI_WORKBOOK_INDICATORS.map(item=>item.id));
const LEGACY_WORKBOOK_INDICATOR_IDS=new Set(Object.keys(GRI_WORKBOOK_INDICATOR_ALIASES).map(Number).filter(id=>!CANONICAL_WORKBOOK_INDICATOR_IDS.has(id)));
const EXCLUDED_GHG_METRIC_IDS=new Set(GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS);
function normalizeMetricIndicators(items:Indicator[]):Indicator[]{
  const filtered=items.filter(item=>!REDUNDANT_METRIC_CODES.has(item.code)&&!LEGACY_WORKBOOK_INDICATOR_IDS.has(item.id)&&!EXCLUDED_GHG_METRIC_IDS.has(item.id));
  return filtered.map(item=>{
    if(item.code==="ENV-WASTE")return {...item,inputTemplate:"WASTE",definition:"사업장에서 발생한 폐기물 총량. 처리방법별 상세 입력으로 재활용량을 함께 집계합니다.",formula:"폐기물 처리량 합계(재활용 선택 행은 재활용량으로 별도 자동 집계)"};
    if(item.code==="ENV-WATER")return {...item,inputTemplate:"WATER",definition:"사업장 운영 과정에서 취수하거나 공급받은 전체 용수량",formula:"용수 구분별 사용량 합계"};
    if(item.code==="S-TRAIN-01")return {...item,name:"임직원 교육시간",inputTemplate:"TRAINING",formula:"총 교육시간 합계 및 총 교육시간 ÷ 임직원 총원"};
    return item;
  });
}
function createMetricIndicatorIdMap(source:Indicator[],normalized:Indicator[]):Map<number,number>{
  const canonicalIds=new Map(normalized.map(item=>[item.code,item.id]));
  const mapped=new Map<number,number>(
    Object.entries(GRI_WORKBOOK_INDICATOR_ALIASES).map(([legacyId,alias])=>[Number(legacyId),alias.indicatorId]),
  );
  source.forEach(item=>{
    const replacementCode=METRIC_CODE_REPLACEMENTS[item.code];
    const replacementId=replacementCode?canonicalIds.get(replacementCode):undefined;
    if(replacementId!==undefined)mapped.set(item.id,replacementId);
  });
  return mapped;
}
function createMetricDetailRow(template:MetricInputTemplate):MetricDetailRow{
  const values:Record<string,string|number>={};
  METRIC_TEMPLATE_FIELDS[template].forEach(field=>{values[field.key]=field.type==="number"?0:field.options?.[0]??"";});
  return {id:`MDR-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,values};
}
function createFixedMetricDetailRows(indicator:Indicator):MetricDetailRow[]{
  return (indicator.detailItems??[]).map(detail=>({
    id:`MDR-${indicator.id}-${detail.key}`,
    values:{detailKey:detail.key,label:detail.label,unit:detail.unit,amount:0},
  }));
}
function createInitialMetricDetailRows(indicator:Indicator):MetricDetailRow[]{
  const template=metricTemplateOf(indicator);
  return template==="FIXED"?createFixedMetricDetailRows(indicator):template==="GENERAL"?[]:[createMetricDetailRow(template)];
}
function calculateMetricDetailTotal(template:MetricInputTemplate,rows:MetricDetailRow[]):number{
  const aggregateKey=METRIC_TEMPLATE_FIELDS[template].find(field=>field.aggregate)?.key;
  if(!aggregateKey)return 0;
  return rows.reduce((sum,row)=>sum+(Number(row.values[aggregateKey])||0),0);
}
function calculateRecycledWaste(rows:MetricDetailRow[]):number{
  return rows.reduce((sum,row)=>row.values.treatmentMethod==="재활용"?sum+(Number(row.values.amount)||0):sum,0);
}
function normalizeMetricRequests(source:MetricRequest[],indicatorIdMap:Map<number,number>):MetricRequest[]{
  return source.flatMap(request=>{
    const indicatorIds=[...new Set(request.indicatorIds.filter(id=>!EXCLUDED_GHG_METRIC_IDS.has(id)).map(id=>indicatorIdMap.get(id)??id))];
    const taskKeys=request.taskKeys?.flatMap(key=>{
      const parsed=parseCollectionTaskKey(key);
      if(!parsed)return [];
      const legacyId=Number(parsed.targetId);
      if(EXCLUDED_GHG_METRIC_IDS.has(legacyId))return [];
      const targetId=indicatorIdMap.get(legacyId)??legacyId;
      return [collectionTaskKey(parsed.company,targetId,parsed.period)];
    });
    return indicatorIds.length?[{...request,indicatorIds,taskKeys:taskKeys?[...new Set(taskKeys)]:undefined}]:[];
  });
}
function mergeFixedMetricRows(indicator:Indicator,currentRows:MetricDetailRow[],incomingRows:MetricDetailRow[]):MetricDetailRow[]{
  const rows:MetricDetailRow[]=createFixedMetricDetailRows(indicator);
  const valuesByKey=new Map<string,number>();
  [...currentRows,...incomingRows].forEach(row=>{
    const key=String(row.values.detailKey??"");
    if(!key)return;
    const value=Number(row.values.amount)||0;
    if(value!==0||!valuesByKey.has(key))valuesByKey.set(key,value);
  });
  return rows.map(row=>({...row,values:{...row.values,amount:valuesByKey.get(String(row.values.detailKey))??0}}));
}
function normalizeMetricSubmissions(source:MetricSubmission[],indicatorIdMap:Map<number,number>,indicators:Indicator[]):MetricSubmission[]{
  const indicatorById=new Map(indicators.map(indicator=>[indicator.id,indicator]));
  const indicatorIdByDetailKey=new Map(indicators.flatMap(indicator=>(indicator.detailItems??[]).map(detail=>[detail.key,indicator.id] as const)));
  const normalized=source.filter(submission=>!EXCLUDED_GHG_METRIC_IDS.has(submission.indicatorId)).flatMap<MetricSubmission>(submission=>{
    const alias=GRI_WORKBOOK_INDICATOR_ALIASES[submission.indicatorId];
    const indicatorId=indicatorIdMap.get(submission.indicatorId)??submission.indicatorId;
    const rowsByIndicatorId=new Map<number,MetricDetailRow[]>();
    (submission.detailRows??[]).forEach(row=>{
      const targetId=indicatorIdByDetailKey.get(String(row.values.detailKey??""));
      if(targetId===undefined)return;
      rowsByIndicatorId.set(targetId,[...(rowsByIndicatorId.get(targetId)??[]),row]);
    });
    if(rowsByIndicatorId.size){
      return [...rowsByIndicatorId].flatMap(([targetId,targetRows],index)=>{
        const indicator=indicatorById.get(targetId);
        if(!indicator||metricTemplateOf(indicator)!=="FIXED")return [];
        return [{
          ...submission,
          id:index===0?submission.id:-(Math.abs(submission.id%1_000_000_000)*1000+index),
          indicatorId:targetId,
          unit:indicator.unit,
          value:0,
          detailRows:mergeFixedMetricRows(indicator,[],targetRows),
        }];
      });
    }
    const indicator=indicatorById.get(indicatorId);
    if(!indicator||metricTemplateOf(indicator)!=="FIXED")return [{...submission,indicatorId}];
    let detailRows=mergeFixedMetricRows(indicator,[],[]);
    if(alias)detailRows=detailRows.map(row=>String(row.values.detailKey)===alias.detailKey?{...row,values:{...row.values,amount:submission.value}}:row);
    return [{...submission,indicatorId,unit:indicator.unit,value:0,detailRows}];
  });
  const merged=new Map<string,MetricSubmission>();
  const statusRank:Record<MetricSubmissionStatus,number>={작성중:0,반려:1,검토대기:2,확정:3};
  normalized.forEach(submission=>{
    const indicator=indicatorById.get(submission.indicatorId);
    const key=`${submission.requestId}::${submission.indicatorId}::${submission.company}::${submission.period}`;
    const current=merged.get(key);
    if(!current){merged.set(key,submission);return;}
    const fixed=indicator&&metricTemplateOf(indicator)==="FIXED";
    merged.set(key,{
      ...current,
      site:current.site||submission.site,
      evidence:current.evidence||submission.evidence,
      description:[...new Set([current.description,submission.description].filter(Boolean))].join(" · "),
      status:statusRank[submission.status]>statusRank[current.status]?submission.status:current.status,
      updatedAt:submission.updatedAt||current.updatedAt,
      detailRows:fixed?mergeFixedMetricRows(indicator,current.detailRows??[],submission.detailRows??[]):current.detailRows,
    });
  });
  return [...merged.values()];
}
function metricDerivedSummary(template:MetricInputTemplate,submission:MetricSubmission):string{
  const rows=submission.detailRows??[];
  if(template==="WASTE")return `재활용 ${formatNumber(calculateRecycledWaste(rows),2)} ${submission.unit}`;
  if(template==="TRAINING"&&submission.employeeCount)return `1인당 ${formatNumber(submission.value/submission.employeeCount,2)} 시간 · 총원 ${submission.employeeCount}명`;
  if(template==="FIXED")return `${rows.length}개 세부값`;
  return rows.length?`${rows.length}개 상세행`:"";
}

function MetricCollection({mode,requests,submissions,indicators,organizations,canWrite,canManage,currentOrganization,defaultOwner,defaultDepartment,onRequestsChange,onSubmissionsChange,onIndicatorsChange,addAudit,showToast}:{mode:"input"|"request"|"review";requests:MetricRequest[];submissions:MetricSubmission[];indicators:Indicator[];organizations:Record<string,string[]>;canWrite:boolean;canManage:boolean;currentOrganization:string;defaultOwner:string;defaultDepartment:string;onRequestsChange:(items:MetricRequest[])=>void;onSubmissionsChange:(items:MetricSubmission[])=>void;onIndicatorsChange:(items:Indicator[])=>void;addAudit:(action:string,target:string,detail:string,actor?:string)=>void;showToast:(message:string)=>void}){
  const workspaceTab=mode==="request"?"periods":"collection";
  const [selectedId,setSelectedId]=useState(requests.find(request=>request.status==="수집중")?.id??requests[0]?.id??"");
  const [requestModal,setRequestModal]=useState<MetricRequest|null|"new">(null);
  const [submissionModal,setSubmissionModal]=useState<{request:MetricRequest;indicator:Indicator;company:string;period:string;submission?:MetricSubmission}|null>(null);
  const [statusFilter,setStatusFilter]=useState("전체");
  const [companyFilter,setCompanyFilter]=useState("전체 법인");
  const [search,setSearch]=useState("");
  const selected=requests.find(request=>request.id===selectedId)??requests[0];
  const visibleCompanies=selected?.companies.filter(company=>canManage||!currentOrganization||company===currentOrganization)??[];
  const expectedRows=selected?buildMetricCollectionTasks(selected,indicators).filter(task=>visibleCompanies.includes(task.company)).map(task=>({company:task.company,period:task.period,indicator:indicators.find(indicator=>indicator.id===task.targetId),submission:submissions.find(item=>item.requestId===selected.id&&item.company===task.company&&item.indicatorId===task.targetId&&item.period===task.period)})).filter(row=>row.indicator):[];
  const filteredRows=expectedRows.filter(row=>{
    const rowStatus=row.submission?.status??"미입력";
    const matchesStatus=statusFilter==="전체"||rowStatus===statusFilter;
    const matchesCompany=companyFilter==="전체 법인"||row.company===companyFilter;
    const haystack=`${row.company} ${row.indicator?.name??""} ${row.indicator?.code??""} ${row.submission?.owner??""} ${row.submission?.description??""}`.toLowerCase();
    return matchesStatus&&matchesCompany&&haystack.includes(search.toLowerCase());
  });
  const saveRequest=(request:MetricRequest)=>{
    const otherTaskKeys=new Set(requests.filter(item=>item.id!==request.id).flatMap(item=>buildMetricCollectionTasks(item,indicators).map(task=>task.key)));
    const taskKeys=request.taskKeys??buildMetricCollectionTasks(request,indicators).map(task=>task.key).filter(key=>!otherTaskKeys.has(key));
    if(!taskKeys.length){showToast("새로 만들거나 유지할 수집 항목이 없습니다.");return;}
    const exists=requests.some(item=>item.id===request.id);
    const saved={...request,id:exists?request.id:`MR-${Date.now()}`,taskKeys,updatedAt:nowLabel()};
    onRequestsChange(exists?requests.map(item=>item.id===saved.id?saved:item):[saved,...requests]);
    setSelectedId(saved.id);setRequestModal(null);
    addAudit(exists?"정량데이터 수집 요청 수정":"정량데이터 수집 요청 생성",saved.title,`${saved.taskKeys.length}개 세부 수집 항목 · ${saved.periodFrom}~${saved.periodTo}`);
    showToast(exists?"수집 기간과 요청 설정을 수정했습니다.":"새 수집 기간과 요청을 개설했습니다.");
  };
  const deleteRequest=(request:MetricRequest)=>{
    if(!window.confirm("이 수집 요청과 연결된 제출 데이터를 모두 삭제하시겠습니까?"))return;
    onRequestsChange(requests.filter(item=>item.id!==request.id));onSubmissionsChange(submissions.filter(item=>item.requestId!==request.id));setRequestModal(null);setSelectedId("");
    addAudit("정량데이터 수집 요청 삭제",request.title,"수집 요청과 연결 제출값을 삭제했습니다.");showToast("수집 요청을 삭제했습니다.");
  };
  const addTemplates=()=>{
    const existingCodes=new Set(indicators.map(item=>item.code));
    const rows=standardMetricIndicators.filter(item=>!existingCodes.has(item.code)).map((item,index)=>({...item,id:Date.now()+index,inputTemplate:item.inputTemplate??inferMetricInputTemplate(item)}));
    if(!rows.length){showToast("엑셀·GRI 정량지표가 모두 등록되어 있습니다.");return;}
    onIndicatorsChange([...indicators,...rows]);addAudit("GRI 정량지표 복원","ESG 지표 정의서",`${rows.length}개 엑셀·GRI 지표와 맞춤 수집 양식을 복원했습니다.`);showToast(`${rows.length}개 엑셀·GRI 정량지표를 복원했습니다.`);
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
  const withdrawSubmission=(submission:MetricSubmission)=>{
    if(submission.status!=="검토대기"){showToast("검토 대기 중인 데이터만 회수할 수 있습니다.");return;}
    if(!window.confirm("제출을 회수하고 작성 중 상태로 되돌리시겠습니까? 입력값과 증빙은 그대로 유지됩니다."))return;
    onSubmissionsChange(submissions.map(item=>item.id===submission.id?{...item,status:"작성중" as MetricSubmissionStatus,updatedAt:nowLabel()}:item));
    addAudit("제출 회수",`${submission.company} · ${indicators.find(item=>item.id===submission.indicatorId)?.name??"ESG 지표"}`,`${submission.period} 정량데이터 제출을 회수해 작성 중 상태로 되돌렸습니다.`);
    showToast("제출을 회수했습니다. 내용을 수정한 뒤 다시 제출할 수 있습니다.");
  };
  const exportRows=()=>{
    if(!selected)return;
    downloadCsv("SEMS_ESG_metric_collection.csv",["수집요청","법인","사업장","기간","지표코드","지표명","수집양식","상세행","값","단위","담당자","부서","증빙","상태","설명"],expectedRows.map(row=>[selected.title,row.company,row.submission?.site??"",row.period,row.indicator?.code??"",row.indicator?.name??"",METRIC_TEMPLATE_LABELS[metricTemplateOf(row.indicator!)],row.submission?.detailRows?.length??0,row.submission?.value??"",row.indicator?.unit??"",row.submission?.owner??"",row.submission?.department??"",row.submission?.evidence??"",row.submission?.status??"미입력",row.submission?.description??""]));
    showToast("현재 수집 현황을 내려받았습니다.");
  };
  return <><PageHeader eyebrow={mode==="review"?"ESG DATA REVIEW":mode==="request"?"ESG DATA REQUEST":"ESG DATA INPUT"} title={mode==="review"?"기타 ESG 데이터 검토·승인":mode==="request"?"기타 ESG 수집 요청":"기타 ESG 데이터 입력"} description={mode==="review"?"제출된 정량데이터와 증빙을 확인한 뒤 확정하거나 반려합니다.":mode==="request"?"대상 법인·지표와 수집 기간, 제출 마감을 설정합니다.":"배정된 환경·사회·지배구조 정량데이터를 입력하고 검토 요청으로 제출합니다."}>{mode==="request"&&canManage&&<button className="secondary-button" onClick={addTemplates}><Icon name="list" size={17}/>엑셀·GRI 지표 복원</button>}{selected&&mode!=="request"&&<button className="secondary-button" onClick={exportRows}><Icon name="download" size={17}/>수집현황 내보내기</button>}{mode==="request"&&canManage&&<button className="primary-button" onClick={()=>setRequestModal("new")} disabled={!indicators.length}><Icon name="plus" size={17}/>수집 요청 추가</button>}</PageHeader>
    {workspaceTab==="periods"?<>
      <section className="period-summary collection-summary"><SummaryTile label="수집 진행" value={requests.filter(item=>item.status==="수집중").length} suffix="건" icon="calendar" tone="green"/><SummaryTile label="검토 진행" value={requests.filter(item=>item.status==="검토중").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="예정" value={requests.filter(item=>item.status==="예정").length} suffix="건" icon="list"/><SummaryTile label="마감 완료" value={requests.filter(item=>item.status==="마감").length} suffix="건" icon="lock"/></section>
      <section className="period-grid">{requests.map(request=>{const rows=submissions.filter(item=>item.requestId===request.id);const tasks=buildMetricCollectionTasks(request,indicators);const submitted=rows.filter(item=>["검토대기","확정"].includes(item.status)).length;const confirmed=rows.filter(item=>item.status==="확정").length;const total=tasks.length;const cycleCounts=countTasksByCycle(tasks);const requestCompletion=total?Math.round(confirmed/total*100):0;return <article className="card period-card" key={request.id}><div className="period-card-top"><div><StatusBadge status={request.status}/><h2>{request.title}</h2><p>{request.description||"별도 요청사항이 없습니다."}</p></div></div><div className="period-dates"><div><span>귀속기간</span><strong>{request.periodFrom===request.periodTo?request.periodFrom:`${request.periodFrom} ~ ${request.periodTo}`}</strong></div><div><span>제출마감</span><strong>{request.dueDate}</strong></div><div><span>최근 변경</span><strong>{request.updatedAt}</strong></div></div><div className="period-targets"><span>{request.companies.length}개 법인</span><span>{request.indicatorIds.length}개 지표</span>{(Object.entries(cycleCounts) as [CollectionCycle,number][]).filter(([,count])=>count>0).map(([cycle,count])=><span key={cycle}>{cycle} {count}건</span>)}</div><div className="period-progress"><div><span>대상 {total}건 · 제출 {submitted}건 · 확정 {confirmed}건</span><strong>{requestCompletion}%</strong></div><div className="progress-track"><span style={{width:`${requestCompletion}%`}}/></div></div>{canManage&&<div className="period-actions"><button className="secondary-button compact" onClick={()=>setRequestModal(request)}><Icon name="edit" size={14}/>설정 수정</button><button className="danger-button compact" onClick={()=>deleteRequest(request)}><Icon name="trash" size={14}/>삭제</button></div>}</article>})}</section>
      {!requests.length&&<section className="card metric-empty"><div className="empty-state"><Icon name="calendar"/><strong>등록된 수집 기간이 없습니다.</strong><p>기간, 대상 법인과 지표를 묶어 첫 수집 요청을 만들어 주세요.</p></div></section>}
    </>:<>
      {selected&&<div className="period-filter-bar"><div><Icon name="calendar" size={18}/><span>수집기간</span><select value={selected.id} onChange={event=>{setSelectedId(event.target.value);setStatusFilter("전체");setCompanyFilter("전체 법인")}}>{requests.map(request=><option value={request.id} key={request.id}>{request.title} · {request.status}</option>)}</select></div><StatusBadge status={selected.status}/></div>}
      <section className="collection-summary"><SummaryTile label="조회 항목" value={expectedRows.length} suffix="건" icon="database"/><SummaryTile label="검토 대기" value={expectedRows.filter(row=>row.submission?.status==="검토대기").length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="보완 요청" value={expectedRows.filter(row=>row.submission?.status==="반려").length} suffix="건" icon="alert" tone="red"/><SummaryTile label="확정 완료" value={expectedRows.filter(row=>row.submission?.status==="확정").length} suffix="건" icon="check" tone="green"/></section>
      {!requests.length?<section className="card metric-empty"><div className="empty-state"><Icon name="database"/><strong>개설된 ESG 정량데이터 수집 요청이 없습니다.</strong><p>관리자가 수집 요청을 개설하면 여기에 표시됩니다.</p></div></section>:selected&&<section className="card data-card">{mode==="input"&&<div className="data-toolbar"><div className="status-tabs">{["전체","미입력","작성중","검토대기","반려","확정"].map(item=><button className={statusFilter===item?"active":""} key={item} onClick={()=>setStatusFilter(item)}>{item==="반려"?"보완 요청":item}{item!=="전체"&&<span>{expectedRows.filter(row=>(row.submission?.status??"미입력")===item).length}</span>}</button>)}</div><div className="filter-actions"><div className="search-box"><Icon name="search" size={17}/><input placeholder="지표, 담당자, 설명 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div><select value={companyFilter} onChange={event=>setCompanyFilter(event.target.value)} aria-label="법인 필터"><option>전체 법인</option>{visibleCompanies.map(company=><option key={company}>{company}</option>)}</select></div></div>}<div className="table-scroll"><table className="data-table metric-collection-table"><thead><tr><th>입력 기간</th><th>법인 / 사업장</th><th>요청 지표·양식</th><th className="align-right">제출값</th><th>담당 / 증빙</th><th>상태</th><th>작업</th></tr></thead><tbody>{(mode==="review"?expectedRows.filter(row=>row.submission?.status==="검토대기"):filteredRows).map(row=>{const submission=row.submission;const indicator=row.indicator!;const template=metricTemplateOf(indicator);const ownsRow=canManage||!currentOrganization||row.company===currentOrganization;const canEdit=mode==="input"&&canWrite&&ownsRow&&selected.status==="수집중"&&submission?.status!=="확정"&&submission?.status!=="검토대기";const canWithdraw=mode==="input"&&canWrite&&ownsRow&&submission?.status==="검토대기";return <tr key={`${row.company}-${indicator.id}-${row.period}`}><td className="mono">{row.period}</td><td><strong>{row.company}</strong><span>{submission?.site||"사업장 미입력"}</span></td><td><strong>{indicator.name}</strong><span>{indicator.code} · {indicator.cycle} 수집</span><em className={`metric-template-badge ${template.toLowerCase()}`}>{METRIC_TEMPLATE_LABELS[template]}</em></td><td className="align-right">{submission?template==="FIXED"?<><strong>{submission.detailRows?.length??0}개</strong><span>세부값 입력</span></>:<><strong>{formatNumber(submission.value,2)}</strong><span>{submission.unit}{metricDerivedSummary(template,submission)?` · ${metricDerivedSummary(template,submission)}`:""}</span></>:<span className="missing-value">미입력</span>}</td><td><strong>{submission?.owner||"담당자 미지정"}</strong><span>{submission?.evidence||"증빙 미연결"}</span></td><td>{submission?<><StatusBadge status={submission.status}/>{submission.rejectionReason&&<span className="rejection-inline">{submission.rejectionReason}</span>}</>:<StatusBadge status="미입력"/>}</td><td><div className="metric-row-actions">{canEdit&&<button className="outline-small" onClick={()=>setSubmissionModal({request:selected,indicator,company:row.company,period:row.period,submission})}><Icon name={submission?"edit":"plus"} size={14}/>{submission?"수정":"입력"}</button>}{canWithdraw&&submission&&<button className="outline-small" onClick={()=>withdrawSubmission(submission)}>제출 회수</button>}{mode==="review"&&canManage&&submission?.status==="검토대기"&&<><button className="approve-small" onClick={()=>changeStatus(submission,"확정")}>승인·확정</button><button className="reject-small" onClick={()=>changeStatus(submission,"반려")}>반려</button></>}</div></td></tr>})}</tbody></table>{mode==="review"&&!expectedRows.some(row=>row.submission?.status==="검토대기")&&<div className="empty-state"><Icon name="check"/><strong>현재 요청에 검토 대기 중인 데이터가 없습니다.</strong></div>}{mode==="input"&&!filteredRows.length&&<div className="empty-state"><Icon name="search"/><strong>조건에 맞는 데이터가 없습니다.</strong><p>수집기간이나 필터 조건을 바꿔 확인해 주세요.</p></div>}</div></section>}
    </>}
    {requestModal&&<MetricRequestForm item={requestModal==="new"?null:requestModal} existing={requests} submissions={submissions} indicators={indicators.filter(item=>item.active)} organizationNames={Object.keys(organizations)} onClose={()=>setRequestModal(null)} onSave={saveRequest} onDelete={requestModal==="new"?undefined:()=>deleteRequest(requestModal)}/>}
    {submissionModal&&<MetricSubmissionForm context={submissionModal} organizations={organizations} defaultOwner={defaultOwner} defaultDepartment={defaultDepartment} canManage={canManage} onClose={()=>setSubmissionModal(null)} onSave={saveSubmission}/>} 
  </>;
}

function MetricRequestForm({item,existing,submissions,indicators,organizationNames,onClose,onSave,onDelete}:{item:MetricRequest|null;existing:MetricRequest[];submissions:MetricSubmission[];indicators:Indicator[];organizationNames:string[];onClose:()=>void;onSave:(request:MetricRequest)=>void;onDelete?:()=>void}){
  const month=new Date().toISOString().slice(0,7);const due=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState<MetricRequest>(item??{id:"",title:metricRequestTitle(month,month,[],indicators),periodFrom:month,periodTo:month,dueDate:due,companies:[...organizationNames],indicatorIds:[],description:"",status:"예정",updatedAt:"방금 전"});
  const [autoTitle,setAutoTitle]=useState(!item);
  const [error,setError]=useState("");
  const [indicatorSearch,setIndicatorSearch]=useState("");
  const [indicatorCategory,setIndicatorCategory]=useState("전체");
  const [indicatorLimit,setIndicatorLimit]=useState(120);
  const deferredIndicatorSearch=useDeferredValue(indicatorSearch);
  const patch=(value:Partial<MetricRequest>)=>{setForm(current=>({...current,...value}));setError("");};
  const toggleCompany=(company:string)=>patch({companies:form.companies.includes(company)?form.companies.filter(item=>item!==company):[...form.companies,company]});
  const changePeriod=(field:"periodFrom"|"periodTo",value:string)=>setForm(current=>{const next={...current,[field]:value};return autoTitle?{...next,title:metricRequestTitle(next.periodFrom,next.periodTo,next.indicatorIds,indicators)}:next;});
  const toggleIndicator=(id:number)=>setForm(current=>{const indicatorIds=current.indicatorIds.includes(id)?current.indicatorIds.filter(item=>item!==id):[...current.indicatorIds,id];return {...current,indicatorIds,title:autoTitle?metricRequestTitle(current.periodFrom,current.periodTo,indicatorIds,indicators):current.title};});
  const candidateTasks=buildMetricCollectionTasks({...form,taskKeys:undefined},indicators,false);
  const currentKeys=new Set(item?buildMetricCollectionTasks(item,indicators).map(task=>task.key):[]);
  const existingKeys=new Set(existing.filter(request=>request.id!==form.id).flatMap(request=>buildMetricCollectionTasks(request,indicators).map(task=>task.key)));
  const confirmedKeys=new Set(submissions.filter(submission=>submission.requestId!==form.id&&submission.status==="확정").map(submission=>collectionTaskKey(submission.company,submission.indicatorId,submission.period)));
  const taskPreview=classifyCollectionTasks(candidateTasks,existingKeys,confirmedKeys);
  const retainedCount=taskPreview.available.filter(task=>currentKeys.has(task.key)).length;
  const candidateKeys=new Set(candidateTasks.map(task=>task.key));
  const visibleIndicators=indicators.filter(indicator=>{
    const matchesCategory=indicatorCategory==="전체"||indicator.category===indicatorCategory;
    const query=deferredIndicatorSearch.trim().toLowerCase();
    return matchesCategory&&(!query||`${indicator.code} ${indicator.name} ${indicator.owner} ${indicator.frameworks.join(" ")} ${(indicator.detailItems??[]).map(detail=>detail.label).join(" ")}`.toLowerCase().includes(query));
  });
  const displayedIndicators=visibleIndicators.slice(0,indicatorLimit);
  const linkedSubmissions=submissions.filter(submission=>submission.requestId===form.id);
  const preservedKeys=[...new Set(linkedSubmissions.map(submission=>collectionTaskKey(submission.company,submission.indicatorId,submission.period)))].filter(key=>!candidateKeys.has(key));
  const taskKeys=[...new Set([...taskPreview.available.map(task=>task.key),...preservedKeys])];
  const submit=(event:FormEvent)=>{event.preventDefault();if(!form.companies.length){setError("대상 법인을 한 곳 이상 선택해 주세요.");return;}if(!form.indicatorIds.length){setError("요청할 ESG 지표를 한 개 이상 선택해 주세요.");return;}if(form.periodFrom>form.periodTo){setError("수집 시작기간은 종료기간보다 늦을 수 없습니다.");return;}if(!taskKeys.length){setError("새로 만들거나 유지할 수집 항목이 없습니다.");return;}onSave({...form,companies:[...new Set([...form.companies,...linkedSubmissions.map(submission=>submission.company)])],indicatorIds:[...new Set([...form.indicatorIds,...linkedSubmissions.map(submission=>submission.indicatorId)])],taskKeys});};
  return <Overlay title={item?"수집 기간·요청 수정":"새 수집 기간·요청"} eyebrow="METRIC REQUEST" description="정량데이터의 대상 법인, 지표, 수집 기간과 제출 마감일을 한 번에 지정합니다." onClose={onClose}><form onSubmit={submit}><div className="form-section"><h3><span>1</span>기간·요청 기본정보</h3><div className="form-grid"><label className="full-span">요청명<input value={form.title} onChange={event=>{setAutoTitle(false);patch({title:event.target.value})}} placeholder="기간과 요청 지표에 따라 자동 작성됩니다." required/><small className="field-help">기간과 선택한 지표 분류를 반영해 자동 작성되며, 직접 수정할 수도 있습니다.</small></label><label>시작기간<input type="month" value={form.periodFrom} onChange={event=>changePeriod("periodFrom",event.target.value)} required/></label><label>종료기간<input type="month" value={form.periodTo} onChange={event=>changePeriod("periodTo",event.target.value)} required/></label><label>제출 마감일<input type="date" value={form.dueDate} onChange={event=>patch({dueDate:event.target.value})} required/></label><label>진행 상태<select value={form.status} onChange={event=>patch({status:event.target.value as MetricRequestStatus})}><option>예정</option><option>수집중</option><option>검토중</option><option>마감</option></select></label><label className="full-span textarea-label">요청 안내<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder="산정기준, 포함 범위, 증빙자료 기준 등을 적어 주세요."/></label></div></div><div className="form-section"><h3><span>2</span>대상 법인</h3><div className="selection-grid">{organizationNames.map(company=><label key={company} className={form.companies.includes(company)?"selected":""}><input type="checkbox" checked={form.companies.includes(company)} onChange={()=>toggleCompany(company)}/><span><strong>{company}</strong><small>정량데이터 입력 요청</small></span></label>)}</div></div><div className="form-section"><h3><span>3</span>요청 지표와 맞춤 양식</h3><div className="metric-picker-toolbar"><div className="search-box"><Icon name="search" size={17}/><input placeholder="지표명, GRI 코드, 담당부서 검색" value={indicatorSearch} onChange={event=>{setIndicatorSearch(event.target.value);setIndicatorLimit(120)}}/></div><select value={indicatorCategory} onChange={event=>{setIndicatorCategory(event.target.value);setIndicatorLimit(120)}} aria-label="지표 구분 필터"><option>전체</option><option>환경</option><option>사회</option><option>지배구조</option></select><span>조회 {visibleIndicators.length}개 · 선택 {form.indicatorIds.length}개</span></div><div className="metric-picker">{displayedIndicators.map(indicator=>{return <label key={indicator.id} className={form.indicatorIds.includes(indicator.id)?"selected":""}><input type="checkbox" checked={form.indicatorIds.includes(indicator.id)} onChange={()=>toggleIndicator(indicator.id)}/><span className={`pillar-tag ${indicator.category==="환경"?"e":indicator.category==="사회"?"s":"g"}`}>{indicator.category}</span><div><strong>{indicator.name}</strong><small>{indicator.code} · {indicator.detailItems?.length?`세부값 ${indicator.detailItems.length}개`:indicator.unit} · {indicator.cycle} 수집</small></div></label>})}</div>{visibleIndicators.length>displayedIndicators.length&&<button type="button" className="metric-picker-more" onClick={()=>setIndicatorLimit(limit=>limit+120)}>지표 120개 더 보기</button>}{!visibleIndicators.length&&<div className="empty-state compact"><strong>검색 조건에 맞는 ESG 지표가 없습니다.</strong></div>}<CollectionTaskPreview tasks={candidateTasks} availableCount={taskPreview.available.length} retainedCount={retainedCount} existingCount={taskPreview.existing.length} confirmedCount={taskPreview.confirmed.length} preservedCount={preservedKeys.length}/>{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>요청 삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!taskKeys.length}><Icon name="check" size={16}/>{item?"수집 항목 저장":`신규 ${taskPreview.available.length}건 생성`}</button></div></div></form></Overlay>;
}

function FixedMetricDetailEditor({rows,onChange}:{rows:MetricDetailRow[];onChange:(rowId:string,value:number)=>void}){
  return <div className="metric-detail-editor fixed"><div className="metric-detail-editor-head"><div><span className="metric-template-badge fixed">고정 세부값</span><p>엑셀 표의 제목은 지표 하나로 유지하고, 표 안의 항목만 아래에서 각각 입력합니다.</p></div></div><div className="metric-fixed-rows">{rows.map((row,index)=><label key={row.id}><span className="metric-row-number">{index+1}</span><strong>{String(row.values.label??"세부 항목")}</strong><div className="input-unit"><input type="number" min="0" step="any" value={Number(row.values.amount)||""} onChange={event=>onChange(row.id,Number(event.target.value))}/><span>{String(row.values.unit??"")}</span></div></label>)}</div><div className="metric-fixed-summary"><strong>세부값 {rows.length}개</strong><span>단위가 다른 값은 서로 합산하지 않고 각각 저장합니다.</span></div></div>;
}

function MetricSubmissionForm({context,organizations,defaultOwner,defaultDepartment,canManage,onClose,onSave}:{context:{request:MetricRequest;indicator:Indicator;company:string;period:string;submission?:MetricSubmission};organizations:Record<string,string[]>;defaultOwner:string;defaultDepartment:string;canManage:boolean;onClose:()=>void;onSave:(submission:MetricSubmission)=>void}){
  const existing=context.submission;
  const template=metricTemplateOf(context.indicator);
  const initialRows=existing?.detailRows?.length?existing.detailRows:createInitialMetricDetailRows(context.indicator);
  const [form,setForm]=useState<MetricSubmission>(existing??{id:0,requestId:context.request.id,indicatorId:context.indicator.id,company:context.company,site:organizations[context.company]?.[0]??"",period:context.period,value:0,unit:context.indicator.unit,owner:defaultOwner,department:defaultDepartment,evidence:"",description:"",status:"작성중",detailRows:template==="GENERAL"?undefined:initialRows,employeeCount:template==="TRAINING"?0:undefined,updatedAt:"방금 전"});
  const [rows,setRows]=useState<MetricDetailRow[]>(initialRows);
  const [error,setError]=useState("");
  const patch=(value:Partial<MetricSubmission>)=>{setForm(current=>({...current,...value}));setError("");};
  const syncRows=(nextRows:MetricDetailRow[])=>{setRows(nextRows);setForm(current=>({...current,detailRows:nextRows,value:template==="FIXED"?0:calculateMetricDetailTotal(template,nextRows)}));setError("");};
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
    if(form.period!==context.period){setError("생성된 세부 수집 항목의 입력 기간과 일치하지 않습니다.");return;}
    if(template!=="GENERAL"&&!rows.length){setError("상세 입력행을 한 개 이상 등록해 주세요.");return;}
    onSave({...form,detailRows:template==="GENERAL"?undefined:rows,value:template==="GENERAL"?form.value:template==="FIXED"?0:calculateMetricDetailTotal(template,rows)});
  };
  const fields=METRIC_TEMPLATE_FIELDS[template];
  return <Overlay title={`${context.indicator.name} 입력`} eyebrow="METRIC SUBMISSION" description={`${context.company} · ${context.period} · ${context.indicator.cycle} 수집 · ${METRIC_TEMPLATE_LABELS[template]} 양식`} onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>지표와 대상</h3><div className="form-grid"><label>법인<input value={form.company} readOnly/></label><label>사업장<select value={form.site} onChange={event=>patch({site:event.target.value})}>{(organizations[form.company]??[]).map(site=><option key={site}>{site}</option>)}</select></label><label>지표명<input value={context.indicator.name} readOnly/></label><label>입력 기간<input type="month" value={form.period} readOnly className="readonly-input"/></label></div></div>
    <div className="form-section"><h3><span>2</span>{template==="GENERAL"?"값 입력":`${METRIC_TEMPLATE_LABELS[template]} 상세 입력`}</h3>{template==="GENERAL"?<div className="form-grid"><label>제출값<div className="input-unit"><input type="number" min="0" step="any" value={form.value||""} onChange={event=>patch({value:Number(event.target.value)})} required/><span>{form.unit}</span></div></label><label>저장 상태<select value={form.status} onChange={event=>patch({status:event.target.value as MetricSubmissionStatus})}><option>작성중</option><option>검토대기</option>{canManage&&<option>확정</option>}</select></label></div>:template==="FIXED"?<FixedMetricDetailEditor rows={rows} onChange={(rowId,value)=>updateRow(rowId,"amount",value)}/>:<div className="metric-detail-editor">{template==="TRAINING"&&<div className="training-headcount"><label><span>임직원 총원</span><div className="input-unit"><input type="number" min="1" step="1" value={form.employeeCount||""} onChange={event=>patch({employeeCount:Number(event.target.value)})} required/><span>명</span></div></label><p>총 교육시간을 임직원 총원으로 나눠 1인당 교육시간을 자동 계산합니다.</p></div>}<div className="metric-detail-editor-head"><div><span className={`metric-template-badge ${template.toLowerCase()}`}>{METRIC_TEMPLATE_LABELS[template]}</span><p>상세행을 추가하면 {fields.find(field=>field.aggregate)?.label??"값"}이 자동 합산됩니다.</p></div><button type="button" className="outline-small" onClick={addRow}><Icon name="plus" size={14}/>행 추가</button></div><div className="metric-detail-rows">{rows.map((row,index)=><div className="metric-detail-row" key={row.id}><span className="metric-row-number">{index+1}</span><div className="metric-detail-fields" style={{gridTemplateColumns:`repeat(${Math.min(fields.length,5)}, minmax(130px, 1fr))`}}>{fields.map(field=><label key={field.key}><span>{field.label}</span>{field.type==="select"?<select value={String(row.values[field.key]??field.options?.[0]??"")} onChange={event=>updateRow(row.id,field.key,event.target.value)}>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:<input type={field.type} min={field.type==="number"?"0":undefined} step={field.type==="number"?"any":undefined} value={row.values[field.key]??""} readOnly={field.readOnly} placeholder={field.placeholder} onChange={event=>updateRow(row.id,field.key,field.type==="number"?Number(event.target.value):event.target.value)}/>}</label>)}</div><button type="button" className="metric-row-remove" onClick={()=>removeRow(row.id)} aria-label={`${index+1}번 상세행 삭제`}><Icon name="trash" size={15}/></button></div>)}</div><div className="metric-derived-totals"><div><span>자동 집계 제출값</span><strong>{formatNumber(calculateMetricDetailTotal(template,rows),2)} <small>{form.unit}</small></strong><em>{rows.length}개 상세행 합계</em></div>{template==="WASTE"&&<div><span>재활용량</span><strong>{formatNumber(calculateRecycledWaste(rows),2)} <small>{form.unit}</small></strong><em>처리방법 ‘재활용’ 합계</em></div>}{template==="TRAINING"&&<div><span>1인당 교육시간</span><strong>{form.employeeCount?formatNumber(calculateMetricDetailTotal(template,rows)/form.employeeCount,2):"-"} <small>시간/인</small></strong><em>총 교육시간 ÷ 임직원 총원</em></div>}</div></div>}<div className="form-grid metric-submission-meta"><label>저장 상태<select value={form.status} onChange={event=>patch({status:event.target.value as MetricSubmissionStatus})}><option>작성중</option><option>검토대기</option>{canManage&&<option>확정</option>}</select></label><label>담당자<input value={form.owner} onChange={event=>patch({owner:event.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={event=>patch({department:event.target.value})} required/></label><label className="full-span textarea-label">산정 기준·변동 사유<textarea value={form.description} onChange={event=>patch({description:event.target.value})} placeholder={context.indicator.formula||"산정 기준과 특이사항을 적어 주세요."}/></label></div></div>
    <div className="form-section"><h3><span>3</span>증빙자료 <small>(선택)</small></h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setError("증빙파일은 20MB 이하만 선택할 수 있습니다.");event.target.value="";return;}patch({evidence:file.name})}}/><span className="upload-icon"><Icon name="upload"/></span>{form.evidence?<><strong>{form.evidence}</strong><small>원본 파일명과 연결정보가 저장됩니다.</small></>:<><strong>증빙자료가 있으면 선택하세요.</strong><small>{context.indicator.evidenceExample||"선택사항 · PDF, XLSX, CSV, JPG, PNG · 최대 20MB"}</small></>}</label>{form.rejectionReason&&<div className="rejection-note"><Icon name="alert" size={16}/><div><strong>이전 보완 요청</strong><p>{form.rejectionReason}</p></div></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>{form.status==="검토대기"?"검토 제출":"저장"}</button></div>
  </form></Overlay>;
}

function createPageTitleBlock(title:string,report:Pick<SustainabilityReport,"primaryColor"|"accentColor">):ReportBlock{
  return {
    id:`RB-${crypto.randomUUID()}`,
    type:"title",
    title,
    body:"",
    x:7,
    y:10,
    textAlign:"left",
    pageTitle:true,
    ...reportHeadingPreset("major",report),
  };
}

function normalizeReportDefaults(items:SustainabilityReport[],indicatorIdMap=new Map<number,number>()):SustainabilityReport[]{
  return items.map(report=>({
    ...report,
    pages:report.pages.map(page=>{
      const normalizedBlocks=page.blocks.map(block=>{
        if(block.type==="title"){
          const style=block.headingStyle??"major";
          const legacySize=({major:26,middle:20,minor:16,table:13} as Record<ReportHeadingStyle,number>)[style];
          return {...block,headingStyle:style,fontSize:block.fontSize===undefined||block.fontSize===legacySize?REPORT_HEADING_SIZES[style]:block.fontSize};
        }
        const title=block.dataSource==="ESG 지표"?"정량지표 표":block.title.startsWith("SEMS 데이터")?(block.type==="chart"?"데이터 그래프":"데이터 표"):block.title;
        const sourceId=block.dataSource?.startsWith("ESG:")?Number(block.dataSource.slice(4)):null;
        const mappedSourceId=sourceId===null?undefined:indicatorIdMap.get(sourceId);
        const dataSource=mappedSourceId===undefined?block.dataSource:`ESG:${mappedSourceId}` as ReportDataSource;
        return {...block,title,dataSource,body:["data","chart"].includes(block.type)?"":block.body,fontSize:block.fontSize===undefined||block.fontSize===16?REPORT_BODY_SIZE:block.fontSize};
      });
      const blocks=normalizedBlocks.some(block=>block.pageTitle)?normalizedBlocks:[createPageTitleBlock(page.title,report),...normalizedBlocks];
      return {...page,blocks};
    }),
  }));
}

function createReportPages(reportStyle:Pick<SustainabilityReport,"primaryColor"|"accentColor">):ReportPage[]{
  const block=(type:ReportBlock["type"],title:string,body="",dataSource?:ReportDataSource,index=0):ReportBlock=>({id:`RB-${crypto.randomUUID()}`,type,title,body,dataSource,x:7,y:24+index*23,w:86,h:type==="data"?21:22,fontSize:REPORT_BODY_SIZE,textAlign:"left",color:"#263832",backgroundColor:type==="callout"?"#eef7f3":"#ffffff",border:type==="callout"});
  const page=(title:string,section:ReportSection,blocks:ReportBlock[]):ReportPage=>({id:`RP-${crypto.randomUUID()}`,title,section,blocks:[createPageTitleBlock(title,reportStyle),...blocks]});
  return [
    page("CEO 메시지","보고서 개요",[block("text","CEO Message","지속가능한 성장을 위한 세원그룹의 방향과 이해관계자에게 전하는 메시지를 작성해 주세요.")]),
    page("보고서 개요","보고서 개요",[block("text","About This Report","보고 범위, 보고 기간, 작성 기준, 문의처와 외부 검증 여부를 작성해 주세요.")]),
    page("환경 Environmental","환경",[block("text","환경경영","환경경영 추진체계와 주요 정책, 목표 및 활동을 작성해 주세요.",undefined,0),block("data","온실가스 배출 실적","","온실가스 배출량",1)]),
    page("사회 Social","사회",[block("text","사람과 공급망","임직원, 안전보건, 인권, 공급망 및 지역사회 관련 주요 활동과 성과를 작성해 주세요.")]),
    page("지배구조 Governance","지배구조",[block("text","책임 있는 경영","이사회, 윤리·준법, 리스크 관리체계와 주요 성과를 작성해 주세요.")]),
    page("ESG Data Factbook","부록",[block("data","온실가스 배출량","","온실가스 배출량",0),block("data","감축목표","","감축목표",1)]),
    page("공시기준 Index","부록",[block("callout","GRI·ESRS·KSSB Index","ESG 지표 정의서에 연결한 공시기준이 자동으로 대응표에 표시됩니다.")]),
  ];
}

function createReportDraft(title:string,year:number,organization:string,reportingPeriod:string,frameworks:string[]):SustainabilityReport{
  const primaryColor="#1f6f5c";const accentColor="#dfeee8";
  return {id:`SR-${Date.now()}`,title,year,organization,reportingPeriod,status:"초안",primaryColor,accentColor,fontFamily:"Noto Sans KR",orientation:"landscape",frameworks,pages:createReportPages({primaryColor,accentColor}),updatedAt:nowLabel()};
}

function ReportBuilder({reports,records,metricSubmissions,targets,indicators,standards,organizationNames,canManage,onChange,addAudit,showToast}:{reports:SustainabilityReport[];records:ActivityRecord[];metricSubmissions:MetricSubmission[];targets:ReductionTarget[];indicators:Indicator[];standards:DisclosureStandard[];organizationNames:string[];canManage:boolean;onChange:(items:SustainabilityReport[])=>void;addAudit:(action:string,target:string,detail:string,actor?:string)=>void;showToast:(message:string)=>void}){
  const [selectedId,setSelectedId]=useState(reports[0]?.id??"");
  const [pageId,setPageId]=useState(reports[0]?.pages[0]?.id??"");
  const [tab,setTab]=useState<"edit"|"preview"|"standards">("edit");
  const [editing,setEditing]=useState<SustainabilityReport|null|"new">(null);
  const selected=reports.find(report=>report.id===selectedId)??reports[0];
  const selectedPage=selected?.pages.find(page=>page.id===pageId)??selected?.pages[0];
  const commit=(next:SustainabilityReport)=>onChange(reports.map(report=>report.id===next.id?{...next,updatedAt:nowLabel()}:report));
  const patchPage=(patch:Partial<ReportPage>)=>{if(!selected||!selectedPage||!canManage)return;commit({...selected,pages:selected.pages.map(page=>page.id===selectedPage.id?{...page,...patch}:page)});};
  const addPage=()=>{if(!selected||!canManage)return;const page:ReportPage={id:`RP-${crypto.randomUUID()}`,title:"새 페이지",section:"보고서 개요",blocks:[createPageTitleBlock("새 페이지",selected)]};const pages=[...selected.pages];const selectedIndex=selectedPage?pages.findIndex(item=>item.id===selectedPage.id):pages.length-1;pages.splice(Math.max(0,selectedIndex+1),0,page);commit({...selected,pages});setPageId(page.id);setTab("edit");addAudit("보고서 페이지 추가",selected.title,`${selectedPage?.title??"마지막 페이지"} 바로 뒤에 새 페이지를 추가했습니다.`);};
  const removePage=()=>{if(!selected||!selectedPage||selected.pages.length===1||!window.confirm("이 페이지와 안의 콘텐츠를 삭제하시겠습니까?"))return;const pages=selected.pages.filter(page=>page.id!==selectedPage.id);commit({...selected,pages});setPageId(pages[0]?.id??"");addAudit("보고서 페이지 삭제",selected.title,`${selectedPage.title} 페이지를 삭제했습니다.`);};
  const reorderPage=(pageToMoveId:string,targetPageId:string,placement:"before"|"after")=>{if(!selected||!canManage||pageToMoveId===targetPageId)return;const pages=[...selected.pages];const sourceIndex=pages.findIndex(item=>item.id===pageToMoveId);if(sourceIndex<0)return;const [moved]=pages.splice(sourceIndex,1);const targetIndex=pages.findIndex(item=>item.id===targetPageId);if(targetIndex<0)return;pages.splice(targetIndex+(placement==="after"?1:0),0,moved);commit({...selected,pages});setPageId(pageToMoveId);addAudit("보고서 페이지 순서 변경",selected.title,`${moved.title} 페이지의 순서를 드래그해 변경했습니다.`);};
  const saveReport=(report:SustainabilityReport)=>{const exists=reports.some(item=>item.id===report.id);const next={...report,updatedAt:nowLabel(),publishedAt:report.status==="발행완료"?(report.publishedAt??nowLabel()):undefined};onChange(exists?reports.map(item=>item.id===next.id?next:item):[...reports,next]);setSelectedId(next.id);setPageId(next.pages[0]?.id??"");setEditing(null);addAudit(exists?"보고서 기본정보 수정":"보고서 생성",next.title,`${next.year}년 지속가능경영보고서 ${exists?"설정을 수정":"초안을 생성"}했습니다.`);showToast(exists?"보고서 기본정보를 저장했습니다.":"보고서 초안을 생성했습니다.");};
  const deleteReport=()=>{if(!selected||!window.confirm("이 보고서와 작성한 모든 원고를 삭제하시겠습니까?"))return;onChange(reports.filter(report=>report.id!==selected.id));setSelectedId("");setPageId("");addAudit("보고서 삭제",selected.title,"지속가능경영보고서 원고를 삭제했습니다.");showToast("보고서를 삭제했습니다.");};
  const saveCheckpoint=()=>{if(!selected)return;commit(selected);addAudit("보고서 원고 저장",selected.title,`${selected.pages.length}개 페이지의 최신 원고를 저장했습니다.`);showToast("보고서 원고를 서버에 저장했습니다.");};
  const pageCompletion=selected?selected.pages.filter(page=>page.blocks.some(block=>["data","chart","line","divider"].includes(block.type)||Boolean(block.imageData)||block.body.trim()||block.title.trim())).length:0;
  const completion=selected?.pages.length?Math.round(pageCompletion/selected.pages.length*100):0;
  const standardOptions=[...new Set(["GRI","ESRS","KSSB",...standards.filter(item=>item.active).map(item=>item.code)])];
  return <><PageHeader eyebrow="SUSTAINABILITY REPORT" title="지속가능경영보고서 작성" description="SEMS에서 확정한 데이터와 ESG 지표를 원고에 연결하고, 목차별 본문 작성부터 공시기준 대응·미리보기·PDF 출력까지 관리합니다.">{selected&&<button className="secondary-button" onClick={()=>window.print()}><Icon name="download" size={17}/>PDF 인쇄</button>}{canManage&&<button className="primary-button" onClick={()=>setEditing("new")}><Icon name="plus" size={17}/>새 보고서</button>}</PageHeader>
    {!reports.length?<section className="card report-empty"><div className="empty-state"><Icon name="edit"/><strong>작성 중인 지속가능경영보고서가 없습니다.</strong><p>기본 목차가 포함된 새 보고서를 만든 뒤 SEMS 데이터를 연결해 주세요.</p>{canManage&&<button className="primary-button" onClick={()=>setEditing("new")}><Icon name="plus" size={16}/>첫 보고서 만들기</button>}</div></section>:selected&&<><section className="report-summary card"><div className="report-summary-main" style={{borderColor:selected.primaryColor}}><span style={{background:selected.primaryColor}}>{selected.year}</span><div><div className="report-meta-line"><StatusBadge status={selected.status}/><em>{selected.organization}</em><em>{selected.reportingPeriod}</em></div><h2>{selected.title}</h2><p>{selected.frameworks.join(" · ")} 기준 · 최근 저장 {selected.updatedAt}</p></div></div><div className="report-summary-stat"><span>목차</span><strong>{selected.pages.length}<small>개</small></strong></div><div className="report-summary-stat"><span>원고 진행률</span><strong>{completion}<small>%</small></strong><div className="report-progress"><i style={{width:`${completion}%`,background:selected.primaryColor}}/></div></div><div className="report-summary-actions">{canManage&&<button className="secondary-button compact" onClick={()=>setEditing(selected)}><Icon name="settings" size={15}/>기본정보</button>}{canManage&&<button className="primary-button compact" onClick={saveCheckpoint}><Icon name="check" size={15}/>원고 저장</button>}</div></section>
      <section className="report-tabs"><button className={tab==="edit"?"active":""} onClick={()=>setTab("edit")}><Icon name="edit" size={16}/>목차·본문 작성</button><button className={tab==="standards"?"active":""} onClick={()=>setTab("standards")}><Icon name="list" size={16}/>공시기준 대응표</button><button className={tab==="preview"?"active":""} onClick={()=>setTab("preview")}><Icon name="file" size={16}/>보고서 미리보기</button></section>
      {tab==="edit"&&<ReportCanvasEditor reports={reports} report={selected} page={selectedPage} canManage={canManage} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators} onReportSelect={(reportId)=>{const next=reports.find(report=>report.id===reportId);setSelectedId(reportId);setPageId(next?.pages[0]?.id??"")}} onPageSelect={setPageId} onPagePatch={patchPage} onPageAdd={addPage} onPageReorder={reorderPage} onPageRemove={removePage} addAudit={addAudit} showToast={showToast}/>}
      {tab==="standards"&&<ReportStandards report={selected} indicators={indicators} standards={standards}/>}
      {tab==="preview"&&<ReportPreview report={selected} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators}/>}
    </>}
    {editing&&<ReportSettingsModal item={editing==="new"?null:editing} organizationNames={organizationNames} standardOptions={standardOptions} onClose={()=>setEditing(null)} onSave={saveReport} onDelete={editing==="new"?undefined:deleteReport}/>}
  </>;
}

function reportBlockLayout(block:ReportBlock,index:number){
  return {x:block.x??7,y:block.y??Math.min(72,12+index*24),w:block.w??86,h:block.h??(block.type==="data"?27:block.type==="line"||block.type==="divider"?6:22)};
}

function reportBlockLabel(type:ReportBlockType){
  return ({title:"제목",text:"본문",image:"이미지",data:"데이터 표",chart:"그래프",file:"파일",line:"선",callout:"강조 상자",divider:"구분선"} as Record<ReportBlockType,string>)[type];
}

function reportHeadingLabel(style:ReportHeadingStyle){
  return ({major:"대제목",middle:"중제목",minor:"소제목",table:"표제목"} as Record<ReportHeadingStyle,string>)[style];
}

function reportHeadingPreset(style:ReportHeadingStyle,report:Pick<SustainabilityReport,"primaryColor"|"accentColor">):Partial<ReportBlock>{
  if(style==="major")return {headingStyle:style,title:"대제목",fontSize:REPORT_HEADING_SIZES.major,w:86,h:10,color:report.primaryColor,backgroundColor:"transparent",border:false};
  if(style==="middle")return {headingStyle:style,title:"중제목",fontSize:REPORT_HEADING_SIZES.middle,w:72,h:8,color:"#263832",backgroundColor:"transparent",border:false};
  if(style==="minor")return {headingStyle:style,title:"소제목",fontSize:REPORT_HEADING_SIZES.minor,w:58,h:7,color:"#34473f",backgroundColor:"transparent",border:false};
  return {headingStyle:style,title:"표 제목",fontSize:REPORT_HEADING_SIZES.table,w:58,h:6,color:"#33473f",backgroundColor:report.accentColor,border:false};
}

function cloneReportPage(page:ReportPage):ReportPage{
  return { ...page, blocks: page.blocks.map(block=>({...block})) };
}

async function prepareReportImage(file:File){
  if(file.size>8*1024*1024)throw new Error("이미지는 8MB 이하만 선택할 수 있습니다.");
  const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("이미지를 읽을 수 없습니다."));reader.readAsDataURL(file);});
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(new Error("이미지 형식을 확인해 주세요."));element.src=source;});
  const scale=Math.min(1,1600/Math.max(image.width,image.height));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext("2d")?.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",.82);
}

function ReportCanvasEditor({reports,report,page,canManage,records,metricSubmissions,targets,indicators,onReportSelect,onPageSelect,onPagePatch,onPageAdd,onPageReorder,onPageRemove,addAudit,showToast}:{reports:SustainabilityReport[];report:SustainabilityReport;page?:ReportPage;canManage:boolean;records:ActivityRecord[];metricSubmissions:MetricSubmission[];targets:ReductionTarget[];indicators:Indicator[];onReportSelect:(id:string)=>void;onPageSelect:(id:string)=>void;onPagePatch:(patch:Partial<ReportPage>)=>void;onPageAdd:()=>void;onPageReorder:(pageId:string,targetId:string,placement:"before"|"after")=>void;onPageRemove:()=>void;addAudit:(action:string,target:string,detail:string,actor?:string)=>void;showToast:(message:string)=>void}){
  const [selectedBlockId,setSelectedBlockId]=useState("");
  const [snapEnabled,setSnapEnabled]=useState(true);
  const [gridSize,setGridSize]=useState(8);
  const [fullscreen,setFullscreen]=useState(false);
  const [draggingPageId,setDraggingPageId]=useState("");
  const [dragTarget,setDragTarget]=useState<{id:string;placement:"before"|"after"}|null>(null);
  const [historyStatus,setHistoryStatus]=useState({pageId:page?.id??"",past:0,future:0});
  const canvasRef=useRef<HTMLDivElement>(null);
  const imageInputRef=useRef<HTMLInputElement>(null);
  const fileInputRef=useRef<HTMLInputElement>(null);
  const pendingAssetId=useRef("");
  const pageRef=useRef<ReportPage|undefined>(page);
  const histories=useRef(new Map<string,{past:ReportPage[];future:ReportPage[]}>());
  const lastHistory=useRef({pageId:"",key:""});
  const orientation=report.orientation??"landscape";
  const selectedBlock=page?.blocks.find(block=>block.id===selectedBlockId);
  const canUndo=historyStatus.pageId===page?.id&&historyStatus.past>0;
  const canRedo=historyStatus.pageId===page?.id&&historyStatus.future>0;

  useEffect(()=>{pageRef.current=page;},[page]);
  useEffect(()=>{
    document.body.classList.toggle("report-editor-open",fullscreen);
    return()=>document.body.classList.remove("report-editor-open");
  },[fullscreen]);

  const rememberCurrent=(key="")=>{
    const current=pageRef.current;if(!current)return;
    const currentHistory=histories.current.get(current.id)??{past:[],future:[]};
    const merge=Boolean(key)&&lastHistory.current.pageId===current.id&&lastHistory.current.key===key;
    if(!merge)currentHistory.past.push(cloneReportPage(current));
    if(currentHistory.past.length>80)currentHistory.past.shift();
    currentHistory.future=[];
    histories.current.set(current.id,currentHistory);
    lastHistory.current={pageId:current.id,key};
    setHistoryStatus({pageId:current.id,past:currentHistory.past.length,future:0});
  };
  const applyPagePatch=(patch:Partial<ReportPage>,record=true,historyKey="")=>{
    const current=pageRef.current;if(!current||!canManage)return;
    if(record)rememberCurrent(historyKey);
    pageRef.current={...current,...patch};
    onPagePatch(patch);
  };
  const updatePageTitle=(title:string)=>{
    const current=pageRef.current;if(!current)return;
    applyPagePatch({title,blocks:current.blocks.map(block=>block.pageTitle?{...block,title}:block)},true,"page:title");
  };
  const undo=()=>{
    const current=pageRef.current;if(!current||!canManage)return;
    const currentHistory=histories.current.get(current.id);const previous=currentHistory?.past.pop();if(!currentHistory||!previous)return;
    currentHistory.future.push(cloneReportPage(current));
    histories.current.set(current.id,currentHistory);
    pageRef.current=cloneReportPage(previous);
    lastHistory.current={pageId:"",key:""};
    onPagePatch(previous);
    setHistoryStatus({pageId:current.id,past:currentHistory.past.length,future:currentHistory.future.length});
  };
  const redo=()=>{
    const current=pageRef.current;if(!current||!canManage)return;
    const currentHistory=histories.current.get(current.id);const next=currentHistory?.future.pop();if(!currentHistory||!next)return;
    currentHistory.past.push(cloneReportPage(current));
    histories.current.set(current.id,currentHistory);
    pageRef.current=cloneReportPage(next);
    lastHistory.current={pageId:"",key:""};
    onPagePatch(next);
    setHistoryStatus({pageId:current.id,past:currentHistory.past.length,future:currentHistory.future.length});
  };
  useEffect(()=>{
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&fullscreen){event.preventDefault();setFullscreen(false);return;}
      if(!canManage||!(event.ctrlKey||event.metaKey))return;
      const key=event.key.toLowerCase();
      if(key==="z"&&!event.shiftKey){event.preventDefault();undo();}
      else if(key==="y"||(key==="z"&&event.shiftKey)){event.preventDefault();redo();}
    };
    window.addEventListener("keydown",handleKey);
    return()=>window.removeEventListener("keydown",handleKey);
  });

  const patchBlock=(id:string,patch:Partial<ReportBlock>,record=true,historyKey="")=>{
    const current=pageRef.current;if(!current||!canManage)return;
    applyPagePatch({blocks:current.blocks.map(block=>block.id===id?{...block,...patch}:block)},record,historyKey||`block:${id}:${Object.keys(patch).sort().join(",")}`);
  };
  const addBlock=(type:ReportBlockType,headingStyle:ReportHeadingStyle="major")=>{
    const current=pageRef.current;if(!current||!canManage)return;
    const index=current.blocks.length;
    const title=type==="title"?"새 제목":type==="data"?"데이터 표":type==="chart"?"데이터 그래프":type==="image"?"이미지":type==="file"?"첨부 파일":type==="line"||type==="divider"?"":type==="callout"?"핵심 메시지":"본문 제목";
    const body=type==="text"?"내용을 입력해 주세요.":type==="callout"?"강조할 메시지를 입력해 주세요.":"";
    const base:ReportBlock={id:`RB-${crypto.randomUUID()}`,type,title,body,dataSource:type==="data"||type==="chart"?"온실가스 배출량":undefined,dataYears:type==="data"||type==="chart"?reportYears(report):undefined,x:7+(index%3)*3,y:12+(index%4)*7,w:type==="line"||type==="divider"?86:type==="title"?70:44,h:type==="line"||type==="divider"?5:type==="title"?10:type==="data"?30:24,fontSize:type==="title"?REPORT_HEADING_SIZES.major:REPORT_BODY_SIZE,textAlign:"left",color:"#263832",backgroundColor:type==="callout"?report.accentColor:"#ffffff",border:type==="callout",imageFit:"cover",chartType:"bar"};
    const block=type==="title"?{...base,...reportHeadingPreset(headingStyle,report)}:base;
    applyPagePatch({blocks:[...current.blocks,block]});setSelectedBlockId(block.id);addAudit("보고서 콘텐츠 추가",current.title,`${type==="title"?reportHeadingLabel(headingStyle):reportBlockLabel(type)} 블록을 추가했습니다.`);
    if(type==="image"){pendingAssetId.current=block.id;window.setTimeout(()=>imageInputRef.current?.click(),0);}
    if(type==="file"){pendingAssetId.current=block.id;window.setTimeout(()=>fileInputRef.current?.click(),0);}
  };
  const removeBlock=(block:ReportBlock)=>{const current=pageRef.current;if(!current||!window.confirm("선택한 콘텐츠를 삭제하시겠습니까?"))return;applyPagePatch({blocks:current.blocks.filter(item=>item.id!==block.id)});setSelectedBlockId("");addAudit("보고서 콘텐츠 삭제",current.title,`${block.title||reportBlockLabel(block.type)} 블록을 삭제했습니다.`);};
  const moveLayer=(block:ReportBlock,direction:-1|1)=>{const current=pageRef.current;if(!current)return;const blocks=[...current.blocks];const index=blocks.findIndex(item=>item.id===block.id);const target=direction===1?blocks.length-1:0;if(index===target)return;blocks.splice(index,1);blocks.splice(target,0,block);applyPagePatch({blocks});};
  const beginTransform=(event:ReactPointerEvent<HTMLElement>,block:ReportBlock,mode:"move"|"resize")=>{
    if(!canManage||!canvasRef.current)return;
    event.preventDefault();event.stopPropagation();setSelectedBlockId(block.id);
    const current=pageRef.current;const rect=canvasRef.current.getBoundingClientRect();const startX=event.clientX;const startY=event.clientY;const layout=reportBlockLayout(block,current?.blocks.indexOf(block)??0);
    const snap=(value:number,axisSize:number)=>snapEnabled?Math.round((value/100*axisSize)/gridSize)*gridSize/axisSize*100:value;
    const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
    let captured=false;
    const onMove=(moveEvent:PointerEvent)=>{
      if(!captured){rememberCurrent();captured=true;}
      const dx=(moveEvent.clientX-startX)/rect.width*100;const dy=(moveEvent.clientY-startY)/rect.height*100;
      if(mode==="move"){
        const x=clamp(snap(layout.x+dx,rect.width),0,100-layout.w);
        const y=clamp(snap(layout.y+dy,rect.height),0,100-layout.h);
        patchBlock(block.id,{x,y},false);
      }else{
        const w=clamp(snap(layout.w+dx,rect.width),8,100-layout.x);
        const h=clamp(snap(layout.h+dy,rect.height),4,100-layout.y);
        patchBlock(block.id,{w,h},false);
      }
    };
    const onUp=()=>{lastHistory.current={pageId:"",key:""};window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);};
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp,{once:true});
  };
  const uploadImage=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;try{const imageData=await prepareReportImage(file);patchBlock(pendingAssetId.current,{imageData,imageName:file.name,title:file.name});showToast("이미지를 캔버스에 넣었습니다.");}catch(error){showToast(error instanceof Error?error.message:"이미지를 처리할 수 없습니다.");}};
  const attachFile=(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;if(file.size>20*1024*1024){showToast("첨부파일은 20MB 이하만 선택할 수 있습니다.");return;}patchBlock(pendingAssetId.current,{fileName:file.name,title:file.name,body:`${formatNumber(file.size/1024,0)} KB`});showToast("파일 표시 블록을 추가했습니다.");};
  const selectPage=(id:string)=>{const nextHistory=histories.current.get(id);setSelectedBlockId("");setHistoryStatus({pageId:id,past:nextHistory?.past.length??0,future:nextHistory?.future.length??0});onPageSelect(id);};
  const openFullscreen=(id=page?.id)=>{if(id)selectPage(id);setFullscreen(true);};
  const pageDropPlacement=(event:ReactDragEvent<HTMLElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return event.clientY<rect.top+rect.height/2?"before" as const:"after" as const;};
  const beginPageDrag=(event:ReactDragEvent<HTMLButtonElement>,id:string)=>{event.stopPropagation();setDraggingPageId(id);setDragTarget(null);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/report-page-id",id);};
  const trackPageDrag=(event:ReactDragEvent<HTMLDivElement>,id:string)=>{const source=draggingPageId||event.dataTransfer.getData("text/report-page-id");if(!source||source===id)return;event.preventDefault();event.dataTransfer.dropEffect="move";setDragTarget({id,placement:pageDropPlacement(event)});};
  const dropPage=(event:ReactDragEvent<HTMLDivElement>,targetId:string)=>{event.preventDefault();const source=draggingPageId||event.dataTransfer.getData("text/report-page-id");if(source&&source!==targetId)onPageReorder(source,targetId,pageDropPlacement(event));setDraggingPageId("");setDragTarget(null);};
  const movePageWithKeyboard=(id:string,direction:-1|1)=>{const index=report.pages.findIndex(item=>item.id===id);const target=report.pages[index+direction];if(!target)return;onPageReorder(id,target.id,direction<0?"before":"after");};
  return <section className={`report-workbench canvas-workbench ${fullscreen?"report-editor-fullscreen":""}`}>
    {fullscreen&&<header className="report-fullscreen-bar"><div><span>전체 화면 편집</span><strong>{page?.title}</strong><em>{orientation==="portrait"?"세로형":"가로형"}</em></div><label>페이지<select value={page?.id??""} onChange={event=>selectPage(event.target.value)}>{report.pages.map((item,index)=><option key={item.id} value={item.id}>{index+1}. {item.title}</option>)}</select></label><div className="report-fullscreen-actions"><button onClick={undo} disabled={!canUndo} aria-keyshortcuts="Control+Z">↶ 실행 취소 <kbd>Ctrl+Z</kbd></button><button onClick={redo} disabled={!canRedo} aria-keyshortcuts="Control+Y">↷ 다시 실행 <kbd>Ctrl+Y</kbd></button><button className="fullscreen-close" onClick={()=>setFullscreen(false)}><Icon name="close" size={15}/>전체 화면 닫기</button></div></header>}
    <aside className="card report-outline"><CardHeader title="보고서 목차" subtitle="햄버거 핸들을 끌어 페이지 순서를 바꿀 수 있습니다." action={canManage?<button className="outline-small" onClick={onPageAdd}><Icon name="plus" size={14}/>페이지</button>:undefined}/><div className="report-select-wrap"><select value={report.id} onChange={event=>onReportSelect(event.target.value)}>{reports.map(item=><option value={item.id} key={item.id}>{item.year} · {item.title}</option>)}</select></div><div className="report-page-list">{report.pages.map((item,index)=>{const targetClass=dragTarget?.id===item.id?`drag-${dragTarget.placement}`:"";return <div key={item.id} className={`report-page-item ${item.id===page?.id?"active":""} ${draggingPageId===item.id?"dragging":""} ${targetClass}`} onDragOver={event=>trackPageDrag(event,item.id)} onDrop={event=>dropPage(event,item.id)}><button className="report-page-drag" draggable={canManage} onDragStart={event=>beginPageDrag(event,item.id)} onDragEnd={()=>{setDraggingPageId("");setDragTarget(null)}} onKeyDown={event=>{if(event.key==="ArrowUp"){event.preventDefault();movePageWithKeyboard(item.id,-1)}else if(event.key==="ArrowDown"){event.preventDefault();movePageWithKeyboard(item.id,1)}}} aria-label={`${item.title} 페이지 순서 이동`} title="드래그해서 페이지 순서 변경"><Icon name="menu" size={17}/></button><button className="report-page-select" onClick={()=>selectPage(item.id)}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item.title}</strong><small>{item.section} · {item.blocks.length}개 요소</small></div><Icon name="chevron" size={15}/></button>{canManage&&<button className="report-page-edit" onClick={()=>openFullscreen(item.id)}><Icon name="edit" size={14}/>수정하기</button>}</div>})}</div></aside>
    <article className="card report-canvas-editor">{page?<><div className="report-editor-head"><div><span>{page.section}</span><h2>{page.title}</h2><p>요소를 끌어 이동하고 우측 아래 핸들로 크기를 조절합니다. 격자 맞춤을 켜면 위치와 크기가 간격에 맞춰 고정됩니다.</p></div>{canManage&&<div className="row-actions"><button className="secondary-button compact fullscreen-open" onClick={()=>openFullscreen()}><Icon name="edit" size={14}/>전체 화면 수정</button><button className="danger-button compact" onClick={onPageRemove} disabled={report.pages.length===1}><Icon name="trash" size={14}/>페이지 삭제</button></div>}</div>
      {canManage&&<div className="report-page-settings"><label>페이지 제목<input value={page.title} onChange={event=>updatePageTitle(event.target.value)}/></label><label>구분<select value={page.section} onChange={event=>applyPagePatch({section:event.target.value as ReportSection},true,"page:section")}><option>보고서 개요</option><option>환경</option><option>사회</option><option>지배구조</option><option>부록</option></select></label></div>}
      <div className="report-canvas-toolbar"><span>제목 서식</span><div className="report-heading-controls">{(["major","middle","minor","table"] as ReportHeadingStyle[]).map(style=><button key={style} onClick={()=>addBlock("title",style)} title={`${reportHeadingLabel(style)} ${REPORT_HEADING_SIZES[style]}pt`}>{reportHeadingLabel(style)} <small>{REPORT_HEADING_SIZES[style]}</small></button>)}</div><span className="toolbar-separator">콘텐츠</span><button onClick={()=>addBlock("text")}><Icon name="edit" size={14}/>본문 <small>{REPORT_BODY_SIZE}</small></button><button onClick={()=>addBlock("image")}>▧ 이미지</button><button onClick={()=>addBlock("data")}><Icon name="database" size={14}/>데이터 표 <small>{REPORT_TABLE_SIZE}</small></button><button onClick={()=>addBlock("chart")}>▥ 그래프</button><button onClick={()=>addBlock("file")}><Icon name="file" size={14}/>파일</button><button onClick={()=>addBlock("line")}>― 선</button><div className="report-history-controls"><button onClick={undo} disabled={!canUndo} title="실행 취소 (Ctrl+Z)">↶</button><button onClick={redo} disabled={!canRedo} title="다시 실행 (Ctrl+Y)">↷</button></div><div className="report-grid-controls"><label className={snapEnabled?"active":""} title="요소 이동과 크기 조절을 격자 간격에 맞춥니다."><input type="checkbox" checked={snapEnabled} onChange={event=>setSnapEnabled(event.target.checked)}/><i aria-hidden="true"/><span>격자 맞춤</span></label><select value={gridSize} onChange={event=>setGridSize(Number(event.target.value))} disabled={!snapEnabled} aria-label="격자 간격"><option value={8}>8 px</option><option value={12}>12 px</option><option value={16}>16 px</option><option value={24}>24 px</option></select></div><input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadImage}/><input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx" hidden onChange={attachFile}/></div>
      <div className="report-canvas-stage"><div ref={canvasRef} className={`report-slide-canvas orientation-${orientation} ${snapEnabled?"snap-grid-visible":""}`} style={{fontFamily:report.fontFamily,"--report-primary":report.primaryColor,"--report-accent":report.accentColor,"--report-grid-size":`${gridSize}px`,"--report-grid-major-size":`${gridSize*4}px`} as CSSProperties} onPointerDown={()=>setSelectedBlockId("")}><header><span>{page.section.toUpperCase()}</span><em>{page.title}</em></header>{page.blocks.map((block,index)=>{const layout=reportBlockLayout(block,index);return <div key={block.id} className={`report-canvas-block ${block.type} ${selectedBlockId===block.id?"selected":""}`} style={{left:`${layout.x}%`,top:`${layout.y}%`,width:`${layout.w}%`,height:`${layout.h}%`,zIndex:index+1,color:block.color??"#263832",backgroundColor:block.backgroundColor??"transparent",textAlign:block.textAlign??"left",border:block.border?"1px solid #b9cfc6":"1px solid transparent"} as CSSProperties} onPointerDown={event=>beginTransform(event,block,"move")}><ReportCanvasBlockContent block={block} report={report} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators}/>{canManage&&selectedBlockId===block.id&&<span className="report-resize-handle" onPointerDown={event=>beginTransform(event,block,"resize")}/>}</div>})}{!page.blocks.length&&<div className="report-canvas-empty"><Icon name="edit"/><strong>빈 페이지</strong><span>상단 도구에서 콘텐츠를 추가하세요.</span></div>}<footer>{report.organization} · {report.year}</footer></div></div>
    </>:<div className="empty-state"><strong>목차를 선택해 주세요.</strong></div>}</article>
    <aside className="card report-inspector"><CardHeader title="속성" subtitle={selectedBlock?`${selectedBlock.type==="title"?reportHeadingLabel(selectedBlock.headingStyle??"major"):reportBlockLabel(selectedBlock.type)} 요소 편집`:"요소를 선택해 주세요."}/>{page&&canManage?<div className="report-inspector-body">{selectedBlock?<><div className="inspector-type"><span>{selectedBlock.type==="title"?reportHeadingLabel(selectedBlock.headingStyle??"major"):reportBlockLabel(selectedBlock.type)}</span><div><button onClick={()=>moveLayer(selectedBlock,-1)} title="맨 뒤로">↓</button><button onClick={()=>moveLayer(selectedBlock,1)} title="맨 앞으로">↑</button><button onClick={()=>removeBlock(selectedBlock)} title="삭제"><Icon name="trash" size={13}/></button></div></div>{selectedBlock.type==="title"&&<label>제목 서식<select value={selectedBlock.headingStyle??"major"} onChange={event=>patchBlock(selectedBlock.id,reportHeadingPreset(event.target.value as ReportHeadingStyle,report))}>{(["major","middle","minor","table"] as ReportHeadingStyle[]).map(style=><option key={style} value={style}>{reportHeadingLabel(style)} · {REPORT_HEADING_SIZES[style]}pt</option>)}</select></label>}{!["line","divider","image"].includes(selectedBlock.type)&&<label>제목<input value={selectedBlock.title} onChange={event=>patchBlock(selectedBlock.id,{title:event.target.value})}/></label>}{["text","callout"].includes(selectedBlock.type)&&<label>본문<textarea value={selectedBlock.body} onChange={event=>patchBlock(selectedBlock.id,{body:event.target.value})}/></label>}{["data","chart"].includes(selectedBlock.type)&&<><label>연결 데이터<select value={selectedBlock.dataSource??"온실가스 배출량"} onChange={event=>patchBlock(selectedBlock.id,{dataSource:event.target.value as ReportDataSource})}><option>온실가스 배출량</option><option>감축목표</option><option value="ESG 지표">정량지표를 선택하세요</option><optgroup label="ESG 정량지표">{indicators.filter(indicator=>indicator.active).map(indicator=><option key={indicator.id} value={`ESG:${indicator.id}`}>{indicator.name} · {indicator.detailItems?.length?`세부값 ${indicator.detailItems.length}개`:indicator.unit}</option>)}</optgroup></select></label><div className="report-data-years"><span>표시 연도</span><div>{availableReportDataYears(report,selectedBlock).map(year=>{const selectedYears=reportYears(report,selectedBlock.dataYears);const checked=selectedYears.includes(year);return <label key={year} className={checked?"selected":""}><input type="checkbox" checked={checked} onChange={()=>{const next=checked?selectedYears.filter(item=>item!==year):[...selectedYears,year].sort((a,b)=>a-b);if(next.length)patchBlock(selectedBlock.id,{dataYears:next})}}/>{year}</label>})}</div><small>기본값은 보고서 연도 기준 최근 3개년입니다.</small></div></>}{selectedBlock.type==="chart"&&<label>그래프 형태<select value={selectedBlock.chartType??"bar"} onChange={event=>patchBlock(selectedBlock.id,{chartType:event.target.value as ReportBlock["chartType"]})}><option value="bar">막대</option><option value="line">추이</option></select></label>}{selectedBlock.type==="image"&&<><button className="secondary-button inspector-upload" onClick={()=>{pendingAssetId.current=selectedBlock.id;imageInputRef.current?.click()}}><Icon name="upload" size={14}/>이미지 교체</button><label>맞춤<select value={selectedBlock.imageFit??"cover"} onChange={event=>patchBlock(selectedBlock.id,{imageFit:event.target.value as ReportBlock["imageFit"]})}><option value="cover">영역 채우기</option><option value="contain">전체 보이기</option></select></label></>}<div className="inspector-grid"><label>X<input type="number" min="0" max="100" value={Math.round(reportBlockLayout(selectedBlock,page.blocks.indexOf(selectedBlock)).x)} onChange={event=>patchBlock(selectedBlock.id,{x:Number(event.target.value)})}/></label><label>Y<input type="number" min="0" max="100" value={Math.round(reportBlockLayout(selectedBlock,page.blocks.indexOf(selectedBlock)).y)} onChange={event=>patchBlock(selectedBlock.id,{y:Number(event.target.value)})}/></label><label>너비<input type="number" min="8" max="100" value={Math.round(reportBlockLayout(selectedBlock,page.blocks.indexOf(selectedBlock)).w)} onChange={event=>patchBlock(selectedBlock.id,{w:Number(event.target.value)})}/></label><label>높이<input type="number" min="4" max="100" value={Math.round(reportBlockLayout(selectedBlock,page.blocks.indexOf(selectedBlock)).h)} onChange={event=>patchBlock(selectedBlock.id,{h:Number(event.target.value)})}/></label></div>{!["image","file","line","divider","data","chart"].includes(selectedBlock.type)&&<><label>글자 크기<div className="input-unit"><input type="number" min="6" max="48" value={selectedBlock.fontSize??(selectedBlock.type==="title"?REPORT_HEADING_SIZES[selectedBlock.headingStyle??"major"]:REPORT_BODY_SIZE)} onChange={event=>patchBlock(selectedBlock.id,{fontSize:Number(event.target.value)})}/><span>pt</span></div></label><div className="inspector-align">{(["left","center","right"] as const).map(align=><button key={align} className={(selectedBlock.textAlign??"left")===align?"active":""} onClick={()=>patchBlock(selectedBlock.id,{textAlign:align})}>{align==="left"?"왼쪽":align==="center"?"가운데":"오른쪽"}</button>)}</div></>}<div className="report-type-reference">현대차 보고서 기준 · 본문 {REPORT_BODY_SIZE}pt · 표 {REPORT_TABLE_SIZE}pt · 주석 {REPORT_CAPTION_SIZE}pt</div><div className="inspector-colors"><label>글자색<input type="color" value={selectedBlock.color??"#263832"} onChange={event=>patchBlock(selectedBlock.id,{color:event.target.value})}/></label><label>배경색<input type="color" value={selectedBlock.backgroundColor??"#ffffff"} onChange={event=>patchBlock(selectedBlock.id,{backgroundColor:event.target.value})}/></label></div><Toggle label="테두리 표시" checked={selectedBlock.border??false} onChange={value=>patchBlock(selectedBlock.id,{border:value})}/></>:<div className="inspector-empty"><span>↖</span><p>캔버스의 요소를 선택하면 글꼴·색상·크기·데이터 연결을 수정할 수 있습니다.</p></div>}</div>:<div className="inspector-empty"><p>조회 권한으로 보고서 원고를 확인하고 있습니다.</p></div>}</aside>
  </section>;
}

function ReportCanvasBlockContent({block,report,records,metricSubmissions,targets,indicators}:{block:ReportBlock;report:SustainabilityReport;records:ActivityRecord[];metricSubmissions:MetricSubmission[];targets:ReductionTarget[];indicators:Indicator[]}){
  if(block.type==="line"||block.type==="divider")return <hr style={{borderColor:block.color??report.primaryColor}}/>;
  if(block.type==="image")return block.imageData?<div className="report-image-block" role="img" aria-label={block.imageName||"보고서 이미지"} style={{backgroundImage:`url(${block.imageData})`,backgroundSize:block.imageFit??"cover"}}/>:<div className="report-image-placeholder"><span>▧</span><strong>이미지를 선택하세요</strong></div>;
  if(block.type==="file")return <div className="report-file-block"><Icon name="file" size={22}/><div><strong>{block.fileName||block.title||"첨부 파일"}</strong><small>{block.body||"파일 정보"}</small></div></div>;
  if(block.type==="data")return <div className="report-data-block"><h3>{block.title}</h3><ReportDataTable source={block.dataSource??"온실가스 배출량"} years={reportYears(report,block.dataYears)} report={report} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators}/></div>;
  if(block.type==="chart")return <div className="report-data-block"><h3>{block.title}</h3><ReportDataChart source={block.dataSource??"온실가스 배출량"} years={reportYears(report,block.dataYears)} report={report} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators} chartType={block.chartType??"bar"}/></div>;
  if(block.type==="title"){
    const size=block.fontSize??REPORT_HEADING_SIZES[block.headingStyle??"major"];
    return <div className={`report-title-block heading-${block.headingStyle??"major"}`} style={{"--report-font-screen":`${size}px`,"--report-font-print":`${size}pt`} as CSSProperties}>{block.title||block.body}</div>;
  }
  const size=block.fontSize??REPORT_BODY_SIZE;
  const headingSize=Math.max(REPORT_HEADING_SIZES.minor,size+1);
  return <div className={`report-text-block ${block.type}`} style={{"--report-font-screen":`${size}px`,"--report-font-print":`${size}pt`,"--report-subheading-screen":`${headingSize}px`,"--report-subheading-print":`${headingSize}pt`} as CSSProperties}><h3>{block.title}</h3><p>{block.body}</p></div>;
}

function metricSourceId(source:ReportDataSource) {
  return source.startsWith("ESG:") ? Number(source.slice(4)) : null;
}

function annualMetricValue(indicator:Indicator,rows:MetricSubmission[],year:number) {
  const values=rows.filter(row=>row.indicatorId===indicator.id&&Number(row.period.slice(0,4))===year).sort((a,b)=>a.period.localeCompare(b.period)).map(row=>row.value);
  if(!values.length)return null;
  if(indicator.aggregation==="평균")return values.reduce((sum,value)=>sum+value,0)/values.length;
  if(indicator.aggregation==="최종값")return values.at(-1)??0;
  return values.reduce((sum,value)=>sum+value,0);
}

function annualMetricDetailValue(indicator:Indicator,rows:MetricSubmission[],year:number,detail:GriWorkbookDetailSeed){
  const values=rows
    .filter(row=>row.indicatorId===indicator.id&&Number(row.period.slice(0,4))===year)
    .sort((a,b)=>a.period.localeCompare(b.period))
    .map(row=>Number(row.detailRows?.find(item=>String(item.values.detailKey)===detail.key)?.values.amount))
    .filter(Number.isFinite);
  if(!values.length)return null;
  if(detail.aggregation==="평균")return values.reduce((sum,value)=>sum+value,0)/values.length;
  if(detail.aggregation==="최종값")return values.at(-1)??0;
  return values.reduce((sum,value)=>sum+value,0);
}

function ReportDataChart({source,years,report,records,metricSubmissions,targets,indicators,chartType}:{source:ReportDataSource;years:number[];report:SustainabilityReport;records:ActivityRecord[];metricSubmissions:MetricSubmission[];targets:ReductionTarget[];indicators:Indicator[];chartType:"bar"|"line"}){
  let values:{label:string;value:number}[]=[];
  if(source==="온실가스 배출량")values=years.map(year=>({label:String(year),value:records.filter(record=>record.status==="확정"&&(report.organization==="세원그룹"||record.company===report.organization)&&Number(record.period.slice(0,4))===year).reduce((sum,record)=>sum+record.emissions,0)}));
  else if(source==="감축목표")values=targets.filter(target=>report.organization==="세원그룹"||target.company==="그룹 전체"||target.company===report.organization).slice(0,5).map(target=>({label:String(target.targetYear),value:target.reductionRate}));
  else {
    const indicator=indicators.find(item=>item.id===metricSourceId(source));
    const confirmed=metricSubmissions.filter(row=>row.status==="확정"&&(report.organization==="세원그룹"||row.company===report.organization));
    if(indicator)values=years.map(year=>({label:String(year),value:annualMetricValue(indicator,confirmed,year)??0}));
  }
  const max=Math.max(1,...values.map(item=>item.value));
  return values.length?<div className={`report-mini-chart ${chartType}`}>{values.map(item=><div key={item.label}><span style={{height:`${Math.max(3,item.value/max*100)}%`,background:report.primaryColor}}><em>{formatNumber(item.value,1)}</em></span><small>{item.label}</small></div>)}</div>:<p className="report-data-empty">표시할 정량지표를 선택해 주세요.</p>;
}

function ReportSettingsModal({item,organizationNames,standardOptions,onClose,onSave,onDelete}:{item:SustainabilityReport|null;organizationNames:string[];standardOptions:string[];onClose:()=>void;onSave:(report:SustainabilityReport)=>void;onDelete?:()=>void}){
  const currentYear=new Date().getFullYear();
  const [form,setForm]=useState<SustainabilityReport>(item?{...item,orientation:item.orientation??"landscape"}:createReportDraft(`${currentYear} 세원그룹 지속가능경영보고서`,currentYear,"세원그룹",`${currentYear-1}.01.01 ~ ${currentYear-1}.12.31`,["GRI","ESRS","KSSB"]));
  const patch=(value:Partial<SustainabilityReport>)=>setForm(current=>({...current,...value}));
  const toggleFramework=(framework:string)=>patch({frameworks:form.frameworks.includes(framework)?form.frameworks.filter(item=>item!==framework):[...form.frameworks,framework]});
  return <Overlay title={item?"보고서 기본정보·디자인":"새 지속가능경영보고서"} eyebrow="REPORT SETTINGS" description="보고서의 기본정보, 적용 공시기준과 미리보기 디자인을 설정합니다." onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSave(form)}}><div className="form-section"><h3><span>1</span>보고서 기본정보</h3><div className="form-grid"><label className="full-span">보고서명<input value={form.title} onChange={event=>patch({title:event.target.value})} required/></label><label>발행연도<input type="number" min="2020" max="2100" value={form.year} onChange={event=>patch({year:Number(event.target.value)})} required/></label><label>작성 대상<select value={form.organization} onChange={event=>patch({organization:event.target.value})}><option>세원그룹</option>{organizationNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="full-span">보고기간<input value={form.reportingPeriod} onChange={event=>patch({reportingPeriod:event.target.value})} placeholder="예: 2025.01.01 ~ 2025.12.31" required/></label><label>작성 상태<select value={form.status} onChange={event=>patch({status:event.target.value as ReportStatus})}><option>초안</option><option>검토중</option><option>발행완료</option></select></label><label>본문 글꼴<select value={form.fontFamily} onChange={event=>patch({fontFamily:event.target.value as SustainabilityReport["fontFamily"]})}><option>Noto Sans KR</option><option>Pretendard</option><option value="serif">명조 계열</option></select></label></div></div><div className="form-section"><h3><span>2</span>디자인 설정</h3><div className="form-grid"><label>보고서 방향<select value={form.orientation??"landscape"} onChange={event=>patch({orientation:event.target.value as ReportOrientation})}><option value="landscape">가로형 · 현대차 보고서형 16:9</option><option value="portrait">세로형 · A4</option></select></label><label>주요 색상<div className="color-field"><input type="color" value={form.primaryColor} onChange={event=>patch({primaryColor:event.target.value})}/><input value={form.primaryColor} onChange={event=>patch({primaryColor:event.target.value})}/></div></label><label>보조 색상<div className="color-field"><input type="color" value={form.accentColor} onChange={event=>patch({accentColor:event.target.value})}/><input value={form.accentColor} onChange={event=>patch({accentColor:event.target.value})}/></div></label><div className={`report-orientation-sample ${form.orientation??"landscape"}`}><span>{form.orientation==="portrait"?"세로형 A4 · 210×297mm":"가로형 16:9 · 407×229mm"}</span></div><div className="report-format-reference full-span"><strong>기본 인쇄 서식</strong><span>대제목 20pt</span><span>중제목 12pt</span><span>소제목 11pt</span><span>본문 10pt</span><span>표 8pt</span><span>주석 7pt</span></div></div></div><div className="form-section"><h3><span>3</span>적용 공시기준</h3><div className="check-group"><div>{standardOptions.map(framework=><label key={framework}><input type="checkbox" checked={form.frameworks.includes(framework)} onChange={()=>toggleFramework(framework)}/>{framework}</label>)}</div></div><p className="form-section-guide">기준정보·규제 관리에서 사용 중인 보고기준 코드와 ESG 지표 정의서의 연결 항목이 대응표에 반영됩니다.</p></div><div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>보고서 삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>저장</button></div></div></form></Overlay>;
}

function reportYears(report:SustainabilityReport,selected?:number[]){
  return selected?.length?[...new Set(selected)].sort((a,b)=>a-b):[report.year-2,report.year-1,report.year];
}
function availableReportDataYears(report:SustainabilityReport,block:ReportBlock){
  return [...new Set([...Array.from({length:6},(_,index)=>report.year-5+index),...(block.dataYears??[])])].sort((a,b)=>a-b);
}
function ReportDataTable({source,years,report,records,metricSubmissions,targets,indicators}:{source:ReportDataSource;years:number[];report:SustainabilityReport;records:ActivityRecord[];metricSubmissions:MetricSubmission[];targets:ReductionTarget[];indicators:Indicator[]}){
  const scopedRecords=records.filter(record=>record.status==="확정"&&record.active!==false&&(report.organization==="세원그룹"||record.company===report.organization));
  if(source==="온실가스 배출량"){const scopes:(Scope|"합계")[]=["Scope 1","Scope 2","Scope 3","합계"];const hasData=scopedRecords.some(record=>years.includes(Number(record.period.slice(0,4))));return <div className="report-linked-table"><div className="table-scroll"><table><thead><tr><th>구분</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody>{scopes.map(scope=><tr key={scope}><td><strong>{scope}</strong></td>{years.map(year=>{const rows=scopedRecords.filter(record=>Number(record.period.slice(0,4))===year&&(scope==="합계"||record.scope===scope));const value=rows.reduce((sum,record)=>sum+record.emissions,0);return <td key={year}>{rows.length?formatNumber(value,1):"-"}</td>})}</tr>)}</tbody></table></div>{!hasData&&<p className="report-data-empty">선택한 연도에 확정된 인벤토리 실적이 없습니다.</p>}<small>단위: tCO₂e</small></div>}
  if(source==="감축목표"){const rows=targets.filter(target=>target.company==="그룹 전체"||report.organization==="세원그룹"||target.company===report.organization);return <div className="report-linked-table"><div className="table-scroll"><table><thead><tr><th>목표명</th><th>대상</th><th>기준연도</th><th>목표연도</th><th>감축률</th><th>상태</th></tr></thead><tbody>{rows.map(target=><tr key={target.id}><td><strong>{target.name}</strong></td><td>{target.scopes.join("·")}</td><td>{target.baselineYear}</td><td>{target.targetYear}</td><td>{formatNumber(target.reductionRate,1)}%</td><td>{target.status}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="report-data-empty">연결할 감축목표가 없습니다.</p>}</div>}
  const indicator=indicators.find(item=>item.id===metricSourceId(source)&&item.active);
  if(!indicator)return <div className="report-linked-table"><p className="report-data-empty">표에 표시할 정량지표를 속성에서 선택해 주세요.</p></div>;
  const confirmed=metricSubmissions.filter(row=>row.status==="확정"&&(report.organization==="세원그룹"||row.company===report.organization));
  if(indicator.detailItems?.length){
    const detailValues=indicator.detailItems.map(detail=>({detail,values:years.map(year=>annualMetricDetailValue(indicator,confirmed,year,detail))}));
    const hasData=detailValues.some(row=>row.values.some(value=>value!==null));
    return <div className="report-linked-table"><div className="table-scroll"><table><thead><tr><th>구분</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody>{detailValues.map(({detail,values})=><tr key={detail.key}><td><strong>{detail.label}</strong><small>{detail.unit}</small></td>{values.map((value,index)=><td key={years[index]}>{value===null?"-":formatNumber(value,2)}</td>)}</tr>)}</tbody></table></div>{!hasData&&<p className="report-data-empty">선택한 연도에 확정된 {indicator.name} 자료가 없습니다.</p>}</div>;
  }
  const values=years.map(year=>annualMetricValue(indicator,confirmed,year));
  return <div className="report-linked-table"><div className="table-scroll"><table><thead><tr><th>구분</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody><tr><td><strong>{indicator.name}</strong></td>{values.map((value,index)=><td key={years[index]}>{value===null?"-":formatNumber(value,2)}</td>)}</tr></tbody></table></div>{values.every(value=>value===null)&&<p className="report-data-empty">선택한 연도에 확정된 {indicator.name} 자료가 없습니다.</p>}<small>단위: {indicator.unit}</small></div>;
}

function ReportStandards({report,indicators,standards}:{report:SustainabilityReport;indicators:Indicator[];standards:DisclosureStandard[]}){
  const standardCodes=[...new Set(["GRI","ESRS","KSSB",...standards.filter(item=>item.active).map(item=>item.code)])];
  const rows=indicators.flatMap(indicator=>indicator.frameworks.map(framework=>({indicator,framework,standard:standardCodes.find(code=>framework.toUpperCase().includes(code.toUpperCase()))??"기타"}))).filter(row=>report.frameworks.includes(row.standard));
  const pageFor=(indicator:Indicator)=>report.pages.find(page=>page.section===indicator.category)?.title??report.pages.find(page=>page.section==="부록")?.title??"미연결";
  return <section className="card report-standards"><CardHeader title="공시기준 대응표" subtitle="ESG 지표 정의서에 연결한 기준 코드를 보고서 목차와 자동 대조합니다."/><div className="standard-summary">{report.frameworks.map(framework=><div key={framework}><span>{framework}</span><strong>{rows.filter(row=>row.standard===framework).length}<small>개 항목</small></strong></div>)}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>기준</th><th>공시 항목</th><th>SEMS 지표</th><th>담당</th><th>보고서 위치</th><th>상태</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.indicator.id}-${row.framework}-${index}`}><td><strong className="standard-code">{row.standard}</strong></td><td>{row.framework}</td><td><strong>{row.indicator.code}</strong><span>{row.indicator.name}</span></td><td>{row.indicator.owner||"미지정"}</td><td>{pageFor(row.indicator)}</td><td><StatusBadge status={row.indicator.status}/></td></tr>)}</tbody></table>{!rows.length&&<div className="empty-state"><Icon name="list"/><strong>연결된 공시기준 항목이 없습니다.</strong><p>ESG 지표 정의서의 ‘연결 평가·공시기준’에 GRI, ESRS 또는 KSSB 코드를 등록해 주세요.</p></div>}</div></section>;
}

function ReportPreview({report,records,metricSubmissions,targets,indicators}:{report:SustainabilityReport;records:ActivityRecord[];metricSubmissions:MetricSubmission[];targets:ReductionTarget[];indicators:Indicator[]}){
  const style={"--report-primary":report.primaryColor,"--report-accent":report.accentColor,fontFamily:report.fontFamily} as CSSProperties;
  const orientation=report.orientation??"landscape";
  return <section className="report-preview-shell"><div className="report-preview-note"><Icon name="file" size={16}/><span>{orientation==="portrait"?"세로형 A4":"현대차 보고서형 16:9"} 캔버스의 위치·크기·인쇄 서식을 그대로 미리봅니다. 상단의 PDF 인쇄 버튼으로 저장할 수 있습니다.</span></div><article className={`report-preview-document orientation-${orientation}`} style={style}><section className="report-cover"><div className="report-cover-mark">SEWON</div><div><span>{report.year} SUSTAINABILITY REPORT</span><h1>{report.title}</h1><p>{report.organization}</p></div><footer><span>{report.reportingPeriod}</span><span>{report.frameworks.join(" · ")}</span></footer></section>{report.pages.map((page,index)=><section className="report-preview-page" key={page.id}><header><span>{page.section.toUpperCase()}</span><em>{page.title}</em></header>{page.blocks.map((block,blockIndex)=>{const layout=reportBlockLayout(block,blockIndex);return <div className={`report-preview-positioned ${block.type}`} key={block.id} style={{left:`${layout.x}%`,top:`${layout.y}%`,width:`${layout.w}%`,height:`${layout.h}%`,zIndex:blockIndex+1,color:block.color??"#263832",backgroundColor:block.backgroundColor??"transparent",textAlign:block.textAlign??"left",border:block.border?"1px solid #b9cfc6":"1px solid transparent"} as CSSProperties}><ReportCanvasBlockContent block={block} report={report} records={records} metricSubmissions={metricSubmissions} targets={targets} indicators={indicators}/></div>})}<footer>{report.organization} · {report.year} · {String(index+1).padStart(3,"0")}</footer></section>)}</article></section>;
}

type Scope3WorkspaceTab="requests"|"responses"|"diagnostics";

function Scope3SupplyChain({requests,suppliers,formulas,fields,templates,assessments,organizations,canManage,onRequestsChange,onTemplatesChange,onAssessmentsChange,addAudit,showToast}:{requests:Scope3DataRequest[];suppliers:SupplierMaster[];formulas:CalculationFormula[];fields:Scope3FieldDefinition[];templates:DiagnosticTemplate[];assessments:SupplyChainAssessment[];organizations:Record<string,string[]>;canManage:boolean;onRequestsChange:(x:Scope3DataRequest[])=>void;onTemplatesChange:(x:DiagnosticTemplate[])=>void;onAssessmentsChange:(x:SupplyChainAssessment[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const [tab,setTab]=useState<Scope3WorkspaceTab>("requests");
  const [requestOpen,setRequestOpen]=useState(false);
  const [templateOpen,setTemplateOpen]=useState(false);
  const [assessmentOpen,setAssessmentOpen]=useState(false);
  const activeRequests=requests.filter(item=>["대기중","진행중","재요청"].includes(item.status));
  const totalTargets=requests.reduce((sum,item)=>sum+item.targetIds.length,0);
  const totalSubmitted=requests.reduce((sum,item)=>sum+item.submittedCount,0);
  const responseRate=totalTargets?Math.round(totalSubmitted/totalTargets*100):0;
  const assessmentTargets=assessments.reduce((sum,item)=>sum+item.supplierIds.length,0);
  const assessmentCompleted=assessments.reduce((sum,item)=>sum+item.completedCount,0);
  const categoryName=(code:string)=>SCOPE3_CATEGORIES.find(item=>item.code===code)?.name??code;
  const updateRequestStatus=(id:string,status:Scope3RequestStatus)=>{
    if(!canManage)return;
    onRequestsChange(requests.map(item=>item.id===id?{...item,status,updatedAt:nowLabel()}:item));
    addAudit("Scope 3 요청 상태 변경",requests.find(item=>item.id===id)?.title??id,status);
    showToast(`요청 상태를 ${status}(으)로 변경했습니다.`);
  };
  return <><PageHeader eyebrow="SCOPE 3 & SUPPLY CHAIN" title="Scope 3·공급망 관리" description="범주별 입력항목과 산정식을 기준으로 협력사·업무담당자에게 데이터를 요청하고, 취합·검토·공급망 진단까지 이어서 관리합니다."><button className="secondary-button" onClick={()=>setAssessmentOpen(true)} disabled={!canManage}><Icon name="check" size={16}/>공급망 진단 요청</button><button className="primary-button" onClick={()=>setRequestOpen(true)} disabled={!canManage}><Icon name="plus" size={16}/>데이터 수집 요청</button></PageHeader>
    <section className="collection-summary scope3-summary"><SummaryTile label="진행 중 요청" value={activeRequests.length} suffix="건" icon="clock" tone="amber"/><SummaryTile label="데이터 취합률" value={responseRate} suffix="%" icon="database" tone="green"/><SummaryTile label="등록 협력사" value={suppliers.filter(item=>item.active).length} suffix="개사" icon="building" tone="blue"/><SummaryTile label="진단 완료율" value={assessmentTargets?Math.round(assessmentCompleted/assessmentTargets*100):0} suffix="%" icon="check" tone="green"/></section>
    <section className="card scope3-workspace"><div className="workspace-tabs"><button className={tab==="requests"?"active":""} onClick={()=>setTab("requests")}>수집 요청 <span>{requests.length}</span></button><button className={tab==="responses"?"active":""} onClick={()=>setTab("responses")}>담당자 입력·검토 <span>{totalSubmitted}</span></button><button className={tab==="diagnostics"?"active":""} onClick={()=>setTab("diagnostics")}>공급망 수준 진단 <span>{assessments.length}</span></button></div>
      {tab==="requests"&&<div className="table-scroll"><table className="data-table scope3-request-table"><thead><tr><th>요청명</th><th>보고연도·범주</th><th>대상</th><th>입력기간</th><th>취합률</th><th>상태</th><th>관리</th></tr></thead><tbody>{requests.map(item=>{const progress=item.targetIds.length?Math.round(item.submittedCount/item.targetIds.length*100):0;return <tr key={item.id}><td><strong>{item.title}</strong><span>{item.organizationScope.join(" · ")||"전체 조직"}{item.cbam?" · CBAM 항목 포함":""}</span></td><td>{item.year}<span>{item.categoryCode} · {categoryName(item.categoryCode)}</span></td><td>{item.targetType}<span>{item.targetIds.length}개 대상</span></td><td>{item.dueDate||"미지정"}<span>{item.reminder?"마감 1일 전 알림":"알림 없음"}</span></td><td><strong>{progress}%</strong><span>{item.submittedCount}/{item.targetIds.length} 제출 · {item.reviewedCount} 검토</span></td><td><StatusBadge status={item.status}/></td><td><div className="row-actions">{item.status==="대기중"&&<button onClick={()=>updateRequestStatus(item.id,"진행중")}>수집 시작</button>}{["진행중","입력완료","재요청"].includes(item.status)&&<button className="confirm" onClick={()=>updateRequestStatus(item.id,"검토완료")}>검토 완료</button>}{item.status==="검토완료"&&<button onClick={()=>updateRequestStatus(item.id,"재요청")}>보완 요청</button>}</div></td></tr>})}</tbody></table>{!requests.length&&<ReferenceEmpty icon="database" title="등록된 Scope 3 수집 요청이 없습니다." description="범주와 산정식, 대상자를 연결해 첫 수집 요청을 만들어 주세요."/>}</div>}
      {tab==="responses"&&<div className="scope3-response-board"><div className="response-status-strip">{(["대기중","진행중","입력완료","검토완료","재요청","요청취소"] as Scope3RequestStatus[]).map(status=><div key={status}><span>{status}</span><strong>{requests.filter(item=>item.status===status).length}</strong></div>)}</div><div className="response-card-grid">{requests.map(item=><article key={item.id}><div><span>{item.categoryCode}</span><StatusBadge status={item.status}/></div><strong>{item.title}</strong><p>{categoryName(item.categoryCode)} · {item.targetType} {item.targetIds.length}개</p><div className="mini-progress"><span style={{width:`${item.targetIds.length?Math.round(item.submittedCount/item.targetIds.length*100):0}%`}}/></div><footer><span>입력항목 {fields.filter(field=>field.categoryCode===item.categoryCode&&field.active).length}개</span><span>검토 {item.reviewedCount}/{item.targetIds.length}</span></footer></article>)}</div>{!requests.length&&<ReferenceEmpty icon="list" title="검토할 요청이 없습니다." description="수집 요청을 만들면 대상별 입력·검토 상태가 여기에 표시됩니다."/>}</div>}
      {tab==="diagnostics"&&<div className="diagnostic-workspace"><div className="diagnostic-toolbar"><div><strong>진단 템플릿과 실시 현황</strong><span>평가구간·문항수·대상 협력사와 완료율을 함께 관리합니다.</span></div><button className="outline-small" onClick={()=>setTemplateOpen(true)} disabled={!canManage}><Icon name="plus" size={14}/>템플릿 등록</button></div><div className="diagnostic-grid"><section><h3>진단 템플릿</h3>{templates.map(item=><article key={item.id}><div><strong>{item.title}</strong><StatusBadge status={item.active?"사용":"중지"}/></div><p>{item.description||"설명 없음"}</p><footer><span>{item.questionCount}문항</span><span>{item.totalScore}점 · {item.gradeScheme}</span></footer></article>)}{!templates.length&&<ReferenceEmpty icon="file" title="진단 템플릿이 없습니다." description="평가문항과 등급구간의 기준이 될 템플릿을 등록해 주세요."/>}</section><section><h3>수준 진단 실시</h3>{assessments.map(item=>{const rate=item.supplierIds.length?Math.round(item.completedCount/item.supplierIds.length*100):0;return <article key={item.id}><div><strong>{item.title}</strong><StatusBadge status={item.status}/></div><p>{item.periodFrom} ~ {item.periodTo} · {item.supplierIds.length}개사</p><div className="mini-progress"><span style={{width:`${rate}%`}}/></div><footer><span>완료 {item.completedCount}/{item.supplierIds.length}</span><span>{rate}%</span></footer></article>})}{!assessments.length&&<ReferenceEmpty icon="check" title="진행 중인 공급망 진단이 없습니다." description="템플릿과 대상 협력사를 선택해 진단을 요청해 주세요."/>}</section></div></div>}
    </section>
    {requestOpen&&<Scope3RequestForm suppliers={suppliers} formulas={formulas} fields={fields} organizations={organizations} onClose={()=>setRequestOpen(false)} onSave={item=>{onRequestsChange([item,...requests]);addAudit("Scope 3 수집 요청",item.title,`${item.categoryCode} · ${item.targetIds.length}개 대상`);setRequestOpen(false);showToast("Scope 3 데이터 수집 요청을 저장했습니다.");}}/>}
    {templateOpen&&<DiagnosticTemplateForm onClose={()=>setTemplateOpen(false)} onSave={item=>{onTemplatesChange([item,...templates]);addAudit("진단 템플릿 등록",item.title,`${item.questionCount}문항 · ${item.gradeScheme}`);setTemplateOpen(false);showToast("공급망 진단 템플릿을 저장했습니다.");}}/>}
    {assessmentOpen&&<SupplyChainAssessmentForm suppliers={suppliers} templates={templates} onClose={()=>setAssessmentOpen(false)} onSave={item=>{onAssessmentsChange([item,...assessments]);addAudit("공급망 진단 요청",item.title,`${item.supplierIds.length}개사`);setAssessmentOpen(false);showToast("공급망 수준 진단 요청을 저장했습니다.");}}/>}
  </>;
}

function Scope3RequestForm({suppliers,formulas,fields,organizations,onClose,onSave}:{suppliers:SupplierMaster[];formulas:CalculationFormula[];fields:Scope3FieldDefinition[];organizations:Record<string,string[]>;onClose:()=>void;onSave:(x:Scope3DataRequest)=>void}){
  const firstCategory=SCOPE3_CATEGORIES[0]?.code??"Cat.1";
  const [form,setForm]=useState<Scope3DataRequest>({id:`S3REQ-${crypto.randomUUID()}`,title:"",year:new Date().getFullYear(),categoryCode:firstCategory,organizationScope:[],formulaId:"",dueDate:"",targetType:"협력사",targetIds:[],reminder:true,cbam:false,status:"대기중",submittedCount:0,reviewedCount:0,updatedAt:nowLabel()});
  const patch=(p:Partial<Scope3DataRequest>)=>setForm(value=>({...value,...p}));
  const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];
  const targets=form.targetType==="협력사"?suppliers.filter(item=>item.active).map(item=>({id:item.id,label:`${item.name} · ${item.category} · ${item.tier}`})):Object.keys(organizations).map(item=>({id:item,label:`${item} 업무담당자`}));
  const categoryFields=fields.filter(item=>item.categoryCode===form.categoryCode&&item.active).sort((a,b)=>a.sortOrder-b.sortOrder);
  const availableFormulas=formulas.filter(item=>item.active&&item.scope==="Scope 3"&&(!item.categoryCode||item.categoryCode===form.categoryCode));
  return <Overlay title="Scope 3 데이터 수집 요청" eyebrow="DATA REQUEST" description="범주별 입력양식·산정식·대상자를 연결해 수집 업무를 생성합니다." onClose={onClose}><form onSubmit={event=>{event.preventDefault();if(!form.targetIds.length)return;onSave({...form,updatedAt:nowLabel()})}}>
    <div className="form-section"><h3><span>1</span>보고기준·산정방식</h3><div className="form-grid"><label className="full-span">요청명<input value={form.title} onChange={e=>patch({title:e.target.value})} placeholder="예: 2026년 구매한 재화 및 서비스 데이터 수집" required/></label><label>보고연도<input type="number" min="2015" max="2100" value={form.year} onChange={e=>patch({year:Number(e.target.value)})}/></label><label>Scope 3 범주<select value={form.categoryCode} onChange={e=>patch({categoryCode:e.target.value,formulaId:""})}>{SCOPE3_CATEGORIES.map(item=><option value={item.code} key={item.code}>{item.code} · {item.name}</option>)}</select></label><label>산정식<select value={form.formulaId} onChange={e=>patch({formulaId:e.target.value})}><option value="">산정식 선택</option>{availableFormulas.map(item=><option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>마감일<input type="date" value={form.dueDate} onChange={e=>patch({dueDate:e.target.value})} required/></label></div><div className="request-field-preview"><strong>요청 데이터 미리보기</strong><div>{categoryFields.length?categoryFields.map(item=><span key={item.id}>{item.nameKr}{item.required?" *":""}<small>{item.inputType}</small></span>):<p>기준정보에서 이 범주의 입력항목을 먼저 생성해 주세요.</p>}</div></div></div>
    <div className="form-section"><h3><span>2</span>조직·입력 대상</h3><div className="request-option-grid"><div><strong>관련 조직</strong>{Object.keys(organizations).map(item=><label key={item}><input type="checkbox" checked={form.organizationScope.includes(item)} onChange={()=>patch({organizationScope:toggle(form.organizationScope,item)})}/>{item}</label>)}</div><div><strong>입력 대상</strong><div className="segmented-control"><button type="button" className={form.targetType==="협력사"?"active":""} onClick={()=>patch({targetType:"협력사",targetIds:[]})}>협력사</button><button type="button" className={form.targetType==="업무담당자"?"active":""} onClick={()=>patch({targetType:"업무담당자",targetIds:[]})}>업무담당자</button></div>{targets.map(item=><label key={item.id}><input type="checkbox" checked={form.targetIds.includes(item.id)} onChange={()=>patch({targetIds:toggle(form.targetIds,item.id)})}/>{item.label}</label>)}{!targets.length&&<p>기준정보에서 대상을 먼저 등록해 주세요.</p>}</div></div><div className="toggle-stack"><Toggle label="마감일 1일 전 리마인드" checked={form.reminder} onChange={reminder=>patch({reminder})}/><Toggle label="CBAM 보고항목 포함" checked={form.cbam} onChange={cbam=>patch({cbam})}/></div></div>
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!form.title||!form.dueDate||!form.targetIds.length}><Icon name="check" size={16}/>요청 저장</button></div>
  </form></Overlay>;
}

function DiagnosticTemplateForm({onClose,onSave}:{onClose:()=>void;onSave:(x:DiagnosticTemplate)=>void}){
  const [form,setForm]=useState<DiagnosticTemplate>({id:`DIAGTPL-${crypto.randomUUID()}`,title:"",description:"",totalScore:100,gradeScheme:"5단계",questionCount:0,active:true,updatedAt:nowLabel()});
  const patch=(p:Partial<DiagnosticTemplate>)=>setForm(value=>({...value,...p}));
  return <Overlay title="진단 템플릿 등록" eyebrow="SUPPLY CHAIN DIAGNOSIS" description="문항 구성의 기준과 결과 등급구간을 설정합니다." onClose={onClose} size="small"><form onSubmit={event=>{event.preventDefault();onSave(form)}}><div className="form-section"><div className="form-grid"><label className="full-span">템플릿명<input value={form.title} onChange={e=>patch({title:e.target.value})} required/></label><label>총점<input type="number" min="1" value={form.totalScore} onChange={e=>patch({totalScore:Number(e.target.value)})}/></label><label>문항수<input type="number" min="0" value={form.questionCount} onChange={e=>patch({questionCount:Number(e.target.value)})}/></label><label>등급구간<select value={form.gradeScheme} onChange={e=>patch({gradeScheme:e.target.value as DiagnosticTemplate["gradeScheme"]})}><option>5단계</option><option>7단계</option><option>사용자 지정</option></select></label><label className="full-span textarea-label">설명<textarea value={form.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="진단 요청 시 사용" checked={form.active} onChange={active=>patch({active})}/></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button">저장</button></div></form></Overlay>;
}

function SupplyChainAssessmentForm({suppliers,templates,onClose,onSave}:{suppliers:SupplierMaster[];templates:DiagnosticTemplate[];onClose:()=>void;onSave:(x:SupplyChainAssessment)=>void}){
  const [form,setForm]=useState<SupplyChainAssessment>({id:`DIAG-${crypto.randomUUID()}`,title:"",year:new Date().getFullYear(),periodFrom:"",periodTo:"",templateId:templates.find(item=>item.active)?.id??"",supplierIds:[],reminder:true,completedCount:0,status:"예정",updatedAt:nowLabel()});
  const patch=(p:Partial<SupplyChainAssessment>)=>setForm(value=>({...value,...p}));
  const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];
  return <Overlay title="공급망 수준 진단 요청" eyebrow="ASSESSMENT REQUEST" description="진단 템플릿과 대상 협력사, 실시기간을 연결합니다." onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSave(form)}}><div className="form-section"><div className="form-grid"><label className="full-span">진단명<input value={form.title} onChange={e=>patch({title:e.target.value})} required/></label><label>기준연도<input type="number" value={form.year} onChange={e=>patch({year:Number(e.target.value)})}/></label><label>진단 템플릿<select value={form.templateId} onChange={e=>patch({templateId:e.target.value})} required><option value="">템플릿 선택</option>{templates.filter(item=>item.active).map(item=><option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>시작일<input type="date" value={form.periodFrom} onChange={e=>patch({periodFrom:e.target.value})} required/></label><label>종료일<input type="date" value={form.periodTo} onChange={e=>patch({periodTo:e.target.value})} required/></label></div><div className="assessment-targets"><strong>진단 대상기업</strong>{suppliers.filter(item=>item.active).map(item=><label key={item.id}><input type="checkbox" checked={form.supplierIds.includes(item.id)} onChange={()=>patch({supplierIds:toggle(form.supplierIds,item.id)})}/><span>{item.name}</span><small>{item.category} · {item.tier}</small></label>)}{!suppliers.some(item=>item.active)&&<p>기준정보에서 협력사를 먼저 등록해 주세요.</p>}</div><Toggle label="종료일 1일 전 리마인드" checked={form.reminder} onChange={reminder=>patch({reminder})}/></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!form.templateId||!form.supplierIds.length}>진단 요청 저장</button></div></form></Overlay>;
}

type ReferenceTab="overview"|"assets"|"activities"|"formulas"|"factors"|"scope3"|"suppliers"|"materials"|"routes"|"standards"|"mappings"|"regulations";

function ReferenceManagement({factors,formulas,activityMasters,assetUnits,scope3Fields,standards,regulations,suppliers,productMaterials,transportRoutes,disclosureMappings,indicators,organizations,canManage,onFactorsChange,onFormulasChange,onActivityMastersChange,onAssetUnitsChange,onScope3FieldsChange,onStandardsChange,onRegulationsChange,onSuppliersChange,onProductMaterialsChange,onTransportRoutesChange,onDisclosureMappingsChange,addAudit,showToast}:{factors:EmissionFactor[];formulas:CalculationFormula[];activityMasters:ActivityMaster[];assetUnits:AssetUnit[];scope3Fields:Scope3FieldDefinition[];standards:DisclosureStandard[];regulations:ComplianceRegulation[];suppliers:SupplierMaster[];productMaterials:ProductMaterialMaster[];transportRoutes:TransportRoute[];disclosureMappings:DisclosureMapping[];indicators:Indicator[];organizations:Record<string,string[]>;canManage:boolean;onFactorsChange:(x:EmissionFactor[])=>void;onFormulasChange:(x:CalculationFormula[])=>void;onActivityMastersChange:(x:ActivityMaster[])=>void;onAssetUnitsChange:(x:AssetUnit[])=>void;onScope3FieldsChange:(x:Scope3FieldDefinition[])=>void;onStandardsChange:(x:DisclosureStandard[])=>void;onRegulationsChange:(x:ComplianceRegulation[])=>void;onSuppliersChange:(x:SupplierMaster[])=>void;onProductMaterialsChange:(x:ProductMaterialMaster[])=>void;onTransportRoutesChange:(x:TransportRoute[])=>void;onDisclosureMappingsChange:(x:DisclosureMapping[])=>void;addAudit:(action:string,target:string,detail:string,actor?:string)=>void;showToast:(m:string)=>void}){
  const [tab,setTab]=useState<ReferenceTab>("overview");
  const [reviewHorizon]=useState(()=>Date.now()+30*86400000);
  const tabs:{id:ReferenceTab;label:string;icon:IconName;group:string}[]=[
    {id:"overview",label:"기준정보 현황",icon:"dashboard",group:"현황"},
    {id:"assets",label:"조직·자산 계층",icon:"building",group:"조직·산정"},
    {id:"activities",label:"물질·단위",icon:"database",group:"조직·산정"},
    {id:"factors",label:"배출계수",icon:"leaf",group:"조직·산정"},
    {id:"formulas",label:"산정식",icon:"edit",group:"조직·산정"},
    {id:"scope3",label:"범주별 입력항목",icon:"list",group:"Scope 3·공급망"},
    {id:"suppliers",label:"공급사",icon:"building",group:"Scope 3·공급망"},
    {id:"materials",label:"자재·제품",icon:"database",group:"Scope 3·공급망"},
    {id:"routes",label:"이동거리",icon:"arrow",group:"Scope 3·공급망"},
    {id:"standards",label:"보고기준·항목",icon:"file",group:"공시·규제"},
    {id:"mappings",label:"지표·기준 연결",icon:"list",group:"공시·규제"},
    {id:"regulations",label:"규제·준수",icon:"alert",group:"공시·규제"},
  ];
  const reviewDue=regulations.filter(item=>item.active&&item.nextReviewDate&&new Date(item.nextReviewDate).getTime()<=reviewHorizon).length;
  const changeTab=(next:ReferenceTab)=>{setTab(next);window.requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"smooth"}));};
  return <><PageHeader eyebrow="MASTER DATA & COMPLIANCE" title="기준정보·규제 관리" description="배출량 산정에 필요한 조직·자산·물질·단위·계산식·배출계수와 보고기준·규제·검토주기를 한곳에서 연결합니다."><span className="reference-source-badge"><Icon name="check" size={15}/>통합 기준정보</span></PageHeader>
    <div className="reference-layout"><aside className="reference-nav">{["현황","조직·산정","Scope 3·공급망","공시·규제"].map(group=><div className="reference-nav-group" key={group}><strong>{group}</strong>{tabs.filter(item=>item.group===group).map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>changeTab(item.id)}><Icon name={item.icon} size={17}/><span>{item.label}</span>{item.id==="regulations"&&reviewDue>0?<em>{reviewDue}</em>:null}</button>)}</div>)}</aside><section className="reference-content">
      {tab==="overview"&&<ReferenceOverview factors={factors} formulas={formulas} assetUnits={assetUnits} scope3Fields={scope3Fields} standards={standards} regulations={regulations} suppliers={suppliers} mappings={disclosureMappings} onNavigate={changeTab}/>}
      {tab==="assets"&&<AssetManager items={assetUnits} formulas={formulas} organizations={organizations} canManage={canManage} onChange={onAssetUnitsChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="activities"&&<ActivityMasterManager items={activityMasters} canManage={canManage} onChange={onActivityMastersChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="formulas"&&<FormulaManager items={formulas} factors={factors} canManage={canManage} onChange={onFormulasChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="factors"&&<ReferenceFactorManager items={factors} canManage={canManage} onChange={onFactorsChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="scope3"&&<Scope3FieldManager items={scope3Fields} canManage={canManage} onChange={onScope3FieldsChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="suppliers"&&<SupplierManager items={suppliers} canManage={canManage} onChange={onSuppliersChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="materials"&&<ProductMaterialManager items={productMaterials} suppliers={suppliers} canManage={canManage} onChange={onProductMaterialsChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="routes"&&<TransportRouteManager items={transportRoutes} canManage={canManage} onChange={onTransportRoutesChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="standards"&&<StandardManager items={standards} canManage={canManage} onChange={onStandardsChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="mappings"&&<DisclosureMappingManager items={disclosureMappings} standards={standards} regulations={regulations} indicators={indicators} canManage={canManage} onChange={onDisclosureMappingsChange} addAudit={addAudit} showToast={showToast}/>}
      {tab==="regulations"&&<RegulationManager items={regulations} standards={standards} indicators={indicators} canManage={canManage} onChange={onRegulationsChange} addAudit={addAudit} showToast={showToast}/>}
    </section></div>
  </>;
}

function ReferenceOverview({factors,formulas,assetUnits,scope3Fields,standards,regulations,suppliers,mappings,onNavigate}:{factors:EmissionFactor[];formulas:CalculationFormula[];assetUnits:AssetUnit[];scope3Fields:Scope3FieldDefinition[];standards:DisclosureStandard[];regulations:ComplianceRegulation[];suppliers:SupplierMaster[];mappings:DisclosureMapping[];onNavigate:(tab:ReferenceTab)=>void}){
  const configuredCategories=new Set(scope3Fields.filter(item=>item.active).map(item=>item.categoryCode)).size;
  const cards=[
    {tab:"assets" as ReferenceTab,title:"조직·자산 계층",value:assetUnits.length,unit:"개",desc:"사업장·기능위치·배출시설·계측기",icon:"building" as IconName},
    {tab:"formulas" as ReferenceTab,title:"산정 계산식",value:formulas.length,unit:"개",desc:`S1·2 ${COMPLILAW_MASTER_COUNTS.scope12Formulas}개 · S3 ${COMPLILAW_MASTER_COUNTS.scope3Formulas}개 포함`,icon:"edit" as IconName},
    {tab:"factors" as ReferenceTab,title:"배출계수 마스터",value:factors.length,unit:"개",desc:`S1·2 ${COMPLILAW_MASTER_COUNTS.scope12Indicators}개 · S3 ${COMPLILAW_MASTER_COUNTS.scope3Factors}개 포함`,icon:"leaf" as IconName},
    {tab:"scope3" as ReferenceTab,title:"Scope 3 범주",value:configuredCategories,unit:"/ 15",desc:"범주별 입력 필드·단위·필수값",icon:"list" as IconName},
    {tab:"suppliers" as ReferenceTab,title:"공급사 기준정보",value:suppliers.filter(item=>item.active).length,unit:"개사",desc:"공급망 분류·Tier·연락처·담당자",icon:"building" as IconName},
    {tab:"standards" as ReferenceTab,title:"보고기준",value:standards.length,unit:"개",desc:"원본 6개 기준·버전·계층형 공시항목",icon:"file" as IconName},
    {tab:"mappings" as ReferenceTab,title:"공시 연결표",value:mappings.filter(item=>item.status==="연결완료").length,unit:"건",desc:"정량지표·기준항목·규제·증빙 연결",icon:"list" as IconName},
    {tab:"regulations" as ReferenceTab,title:"적용 규제",value:regulations.filter(item=>item.active&&item.status!=="미적용").length,unit:"건",desc:"담당자·검토주기·지표·증빙 연결",icon:"alert" as IconName},
  ];
  return <><section className="card reference-overview-card"><CardHeader title="기준정보 연결 현황" subtitle={`Complilaw 마스터를 코드 기준으로 병합했습니다. 이동거리 마스터 원본 ${COMPLILAW_MASTER_COUNTS.movementDistances}건은 빈 상태를 유지하고 등록 즉시 Cat.4·6·7·9 수집에 연결됩니다.`}/><div className="reference-flow"><div><span>카테고리 항목</span><strong>수집 필드</strong></div><Icon name="arrow" size={17}/><div><span>산정식·배출계수</span><strong>배출량 산정</strong></div><Icon name="arrow" size={17}/><div><span>정량지표·보고기준</span><strong>공시 데이터</strong></div><Icon name="arrow" size={17}/><div><span>규제·증빙·보고서</span><strong>준수·공시</strong></div></div></section>
    <div className="reference-card-grid">{cards.map(card=><button className="reference-count-card" key={card.tab} onClick={()=>onNavigate(card.tab)}><span className="reference-card-icon"><Icon name={card.icon}/></span><div><span>{card.title}</span><strong>{card.value}<small>{card.unit}</small></strong><p>{card.desc}</p></div><Icon name="chevron" size={18}/></button>)}</div>
    <section className="card reference-guide"><CardHeader title="권장 설정 순서" subtitle="상위 기준을 먼저 만든 뒤 하위 데이터에 연결하면 변경 추적과 재사용이 쉬워집니다."/><ol><li><span>1</span><div><strong>조직·자산 경계 등록</strong><p>법인·사업장 아래 기능위치와 배출시설·계측기를 계층으로 구성합니다.</p></div></li><li><span>2</span><div><strong>활동자료·단위와 계산식 정의</strong><p>물질 기준단위와 산식을 등록하고 적용할 배출계수를 연결합니다.</p></div></li><li><span>3</span><div><strong>Scope 3 범주별 입력항목 설정</strong><p>15개 범주마다 숫자·단위·선택값·증빙 필수 여부를 구성합니다.</p></div></li><li><span>4</span><div><strong>보고기준·규제 연결</strong><p>공시항목, ESG 지표, 담당자, 검토주기와 근거 증빙을 연결합니다.</p></div></li></ol></section></>;
}

function AssetManager({items,formulas,organizations,canManage,onChange,addAudit,showToast}:{items:AssetUnit[];formulas:CalculationFormula[];organizations:Record<string,string[]>;canManage:boolean;onChange:(x:AssetUnit[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const companyNames=Object.keys(organizations);const empty:AssetUnit={id:"",code:"",company:companyNames[0]??"",site:organizations[companyNames[0]??""]?.[0]??"",name:"",type:"배출시설",parentId:"",scope:"Scope 1",formulaId:"",address:"",description:"",active:true,updatedAt:"",classification:"설비 및 기계",activityType:"고정연소",country:"대한민국",latitude:"",longitude:"",department:"",owner:"",position:"",phone:"",email:""};
  const [draft,setDraft]=useState<AssetUnit>(empty);const patch=(p:Partial<AssetUnit>)=>setDraft(current=>({...current,...p}));
  const save=(e:FormEvent)=>{e.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`ASSET-${crypto.randomUUID()}`,updatedAt:nowLabel()};onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"자산 수정":"자산 등록",next.name,`${next.company} · ${next.site} · ${next.type}`);setDraft({...empty,company:next.company,site:next.site});showToast("조직·자산 기준정보를 저장했습니다.");};
  const remove=()=>{if(!draft.id||!canManage||!window.confirm("이 자산 기준정보를 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id&&item.parentId!==draft.id));addAudit("자산 삭제",draft.name,"선택 자산과 바로 연결된 하위 기준을 삭제했습니다.");setDraft(empty);showToast("자산 기준정보를 삭제했습니다.");};
  return <ReferencePanel title="조직·사업장·자산 계층" subtitle="법인·사업장 아래 기능위치·배출시설·계측기를 구성하고 위치·책임자·활동구분·기본 산정식을 연결합니다."><div className="reference-split"><div className="reference-list"><div className="reference-list-head"><strong>계층 목록</strong><button className="outline-small" disabled={!canManage} onClick={()=>setDraft(empty)}><Icon name="plus" size={14}/>새 항목</button></div>{items.map(item=><button key={item.id} className={draft.id===item.id?"active":""} onClick={()=>setDraft(item)}><span className={`reference-node type-${item.type}`}>{item.type.slice(0,1)}</span><div><strong>{item.code?`${item.code} · `:""}{item.name}</strong><small>{item.company} · {item.site} · {item.type} · {item.scope}</small></div><StatusBadge status={item.active?"사용":"중지"}/></button>)}{!items.length&&<ReferenceEmpty icon="building" title="등록된 조직·자산이 없습니다." description="사업장 또는 첫 배출시설을 추가해 주세요."/>}</div><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"조직·자산 수정":"새 조직·자산"} description="상위 항목·산정식을 연결하면 활동자료 입력과 인벤토리 위치 분석에 재사용됩니다."/><div className="form-grid"><label>법인<select value={draft.company} onChange={e=>patch({company:e.target.value,site:organizations[e.target.value]?.[0]??""})}>{companyNames.map(item=><option key={item}>{item}</option>)}</select></label><label>사업장<select value={draft.site} onChange={e=>patch({site:e.target.value})}>{(organizations[draft.company]??[]).map(item=><option key={item}>{item}</option>)}</select></label><label>표준 코드<input value={draft.code??""} onChange={e=>patch({code:e.target.value})} placeholder="영문·숫자 10자 이내"/></label><label>항목 유형<select value={draft.type} onChange={e=>patch({type:e.target.value as AssetUnit["type"]})}><option>사업장</option><option>기능위치</option><option>배출시설</option><option>계측기</option></select></label><label className="full-span">항목명<input value={draft.name} onChange={e=>patch({name:e.target.value})} required/></label><label>자산 분류<select value={draft.classification??"설비 및 기계"} onChange={e=>patch({classification:e.target.value as AssetUnit["classification"]})}><option>건물</option><option>자동차 및 이동수단</option><option>설비 및 기계</option><option>기타</option></select></label><label>활동구분<select value={draft.activityType??"고정연소"} onChange={e=>patch({activityType:e.target.value as AssetUnit["activityType"]})}><option>고정연소</option><option>이동연소</option><option>공정배출</option><option>탈루배출</option><option>전력</option><option>재생에너지</option><option>기타배출</option></select></label><label>Scope<select value={draft.scope} onChange={e=>patch({scope:e.target.value as Scope,formulaId:""})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label><label>상위 조직·자산<select value={draft.parentId} onChange={e=>patch({parentId:e.target.value})}><option value="">최상위</option>{items.filter(item=>item.id!==draft.id&&item.company===draft.company).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>기본 산정식<select value={draft.formulaId} onChange={e=>patch({formulaId:e.target.value})}><option value="">연결 안 함</option>{formulas.filter(item=>item.active&&item.scope===draft.scope).map(item=><option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>국가<input value={draft.country??""} onChange={e=>patch({country:e.target.value})}/></label><label className="full-span">주소·위치<input value={draft.address} onChange={e=>patch({address:e.target.value})}/></label><label>위도<input value={draft.latitude??""} onChange={e=>patch({latitude:e.target.value})}/></label><label>경도<input value={draft.longitude??""} onChange={e=>patch({longitude:e.target.value})}/></label><label>담당부서<input value={draft.department??""} onChange={e=>patch({department:e.target.value})}/></label><label>담당자<input value={draft.owner??""} onChange={e=>patch({owner:e.target.value})}/></label><label>직급<input value={draft.position??""} onChange={e=>patch({position:e.target.value})}/></label><label>전화번호<input value={draft.phone??""} onChange={e=>patch({phone:e.target.value})}/></label><label className="full-span">이메일<input type="email" value={draft.email??""} onChange={e=>patch({email:e.target.value})}/></label><label className="full-span textarea-label">설명<textarea value={draft.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="산정·수집에 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={remove}/></form></div></ReferencePanel>;
}

function ActivityMasterManager({items,canManage,onChange,addAudit,showToast}:{items:ActivityMaster[];canManage:boolean;onChange:(x:ActivityMaster[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:ActivityMaster={id:"",code:"",name:"",group:"에너지",scope:"Scope 1",unit:"",density:undefined,densityUnit:"kg/L",description:"",active:true,updatedAt:"",materialType:"연료",casNumber:""};const [draft,setDraft]=useState(empty);const patch=(p:Partial<ActivityMaster>)=>setDraft(current=>({...current,...p}));
  const save=(e:FormEvent)=>{e.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`ACT-${crypto.randomUUID()}`,code:draft.code.trim().toUpperCase(),updatedAt:nowLabel()};if(items.some(item=>item.id!==next.id&&item.code===next.code)){showToast("같은 물질 코드가 이미 있습니다.");return;}onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"물질 기준 수정":"물질 기준 등록",next.name,`${next.code} · ${next.unit}`);setDraft(empty);showToast("물질·단위 기준정보를 저장했습니다.");};
  return <ReferencePanel title="물질·단위 기준" subtitle="연료·온실가스·에너지·냉매·운송 등 활동자료의 표준 코드와 기준단위·밀도·CAS 번호를 관리합니다."><div className="reference-split"><ReferenceTableList items={items} selectedId={draft.id} onSelect={setDraft} primary={item=>`${item.code} · ${item.name}`} secondary={item=>`${item.materialType??item.group} · ${item.scope} · ${item.unit}`} onNew={()=>setDraft(empty)} canManage={canManage} emptyTitle="등록된 물질·단위가 없습니다."/><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"물질·단위 수정":"새 물질·단위"} description="표준 코드는 Excel 검증, 산정식과 Scope별 입력항목에 재사용됩니다."/><div className="form-grid"><label>표준 코드<input value={draft.code} onChange={e=>patch({code:e.target.value})} required/></label><label>표준 명칭<input value={draft.name} onChange={e=>patch({name:e.target.value})} required/></label><label>물질구분<select value={draft.materialType??"연료"} onChange={e=>patch({materialType:e.target.value as ActivityMaster["materialType"]})}><option>연료</option><option>온실가스</option><option>기타</option></select></label><label>상세 분류<input value={draft.group} onChange={e=>patch({group:e.target.value})}/></label><label>Scope<select value={draft.scope} onChange={e=>patch({scope:e.target.value as Scope})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label><label>기준 단위<input value={draft.unit} onChange={e=>patch({unit:e.target.value})} placeholder="kWh, L, kg, ton·km" required/></label><label>밀도(선택)<input type="number" step="any" min="0" value={draft.density??""} onChange={e=>patch({density:e.target.value?Number(e.target.value):undefined})}/></label><label>밀도 단위<input value={draft.densityUnit??""} onChange={e=>patch({densityUnit:e.target.value})}/></label><label className="full-span">CAS 번호<input value={draft.casNumber??""} onChange={e=>patch({casNumber:e.target.value})} placeholder="온실가스·화학물질 식별번호"/></label><label className="full-span textarea-label">설명<textarea value={draft.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="산정·수집에 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 기준정보를 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("물질·단위 기준정보를 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function FormulaManager({items,factors,canManage,onChange,addAudit,showToast}:{items:CalculationFormula[];factors:EmissionFactor[];canManage:boolean;onChange:(x:CalculationFormula[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:CalculationFormula={id:"",code:"",name:"",scope:"Scope 1",expression:"활동량 × 배출계수",activityUnit:"",outputUnit:"tCO₂e",factorId:"",description:"",active:true,updatedAt:"",categoryCode:"",resultLabel:"탄소배출량",variableKeys:["활동량","배출계수"]};const [draft,setDraft]=useState(empty);const patch=(p:Partial<CalculationFormula>)=>setDraft(current=>({...current,...p}));
  const save=(e:FormEvent)=>{e.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`FORM-${crypto.randomUUID()}`,code:draft.code.trim().toUpperCase(),updatedAt:nowLabel()};if(items.some(item=>item.id!==next.id&&item.code===next.code)){showToast("같은 계산식 코드가 이미 있습니다.");return;}onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"계산식 수정":"계산식 등록",next.name,next.expression);setDraft(empty);showToast("계산식을 저장했습니다.");};
  return <ReferencePanel title="배출량 산정식" subtitle="산정 로직, 변수, 입·출력 단위와 적용 배출계수를 연결해 조직·자산·Scope 3 수집에서 재사용합니다."><div className="reference-split"><ReferenceTableList items={items} selectedId={draft.id} onSelect={setDraft} primary={item=>`${item.code} · ${item.name}`} secondary={item=>`${item.scope}${item.categoryCode?` · ${item.categoryCode}`:""} · ${item.expression}`} onNew={()=>setDraft(empty)} canManage={canManage} emptyTitle="등록된 산정식이 없습니다."/><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"산정식 수정":"새 산정식"} description="표현식·변수·계수·결과표시명을 함께 저장하면 수집 요청과 배출량 계산에 재사용됩니다."/><div className="form-grid"><label>산정식 코드<input value={draft.code} onChange={e=>patch({code:e.target.value})} required/></label><label>산정식명<input value={draft.name} onChange={e=>patch({name:e.target.value})} required/></label><label>Scope<select value={draft.scope} onChange={e=>patch({scope:e.target.value as Scope,factorId:"",categoryCode:""})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label>{draft.scope==="Scope 3"&&<label>관련 범주<select value={draft.categoryCode??""} onChange={e=>patch({categoryCode:e.target.value})}><option value="">전체 범주</option>{SCOPE3_CATEGORIES.map(item=><option value={item.code} key={item.code}>{item.code} · {item.name}</option>)}</select></label>}<label>연결 배출계수<select value={draft.factorId} onChange={e=>patch({factorId:e.target.value})}><option value="">계수 미지정</option>{factors.filter(item=>item.active&&item.scope===draft.scope).map(item=><option value={item.id} key={item.id}>{item.source} · {item.value} {item.factorUnit}</option>)}</select></label><label>결과 표시명<input value={draft.resultLabel??""} onChange={e=>patch({resultLabel:e.target.value})} placeholder="탄소배출량"/></label><label className="full-span">산정식 표현<input value={draft.expression} onChange={e=>patch({expression:e.target.value})} placeholder="활동량 × 배출계수 ÷ 1,000" required/></label><label className="full-span">입력 변수<input value={(draft.variableKeys??[]).join(", ")} onChange={e=>patch({variableKeys:e.target.value.split(",").map(item=>item.trim()).filter(Boolean)})} placeholder="활동량, 배출계수, 거리, 중량"/></label><label>입력 단위<input value={draft.activityUnit} onChange={e=>patch({activityUnit:e.target.value})}/></label><label>출력 단위<input value={draft.outputUnit} onChange={e=>patch({outputUnit:e.target.value})}/></label><label className="full-span textarea-label">산정 설명·가정<textarea value={draft.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="조직·자산·수집 화면에서 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 산정식을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("산정식을 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function ReferenceFactorManager({items,canManage,onChange,addAudit,showToast}:{items:EmissionFactor[];canManage:boolean;onChange:(x:EmissionFactor[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const [editing,setEditing]=useState<EmissionFactor|null|"new">(null);const [search,setSearch]=useState("");const [scopeFilter,setScopeFilter]=useState("전체");const [kindFilter,setKindFilter]=useState("전체");const filtered=items.filter(item=>(scopeFilter==="전체"||item.scope===scopeFilter)&&(kindFilter==="전체"||(item.indicatorKind??"배출계수")===kindFilter)&&`${item.source} ${item.category} ${item.detailCategory??""} ${item.authority}`.toLowerCase().includes(search.toLowerCase()));const restore=()=>{const next=mergeMasterRows(mergeDefaultEmissionFactors(items) as EmissionFactor[],DEFAULT_MASTER_FACTORS);onChange(next);showToast(next.length===items.length?"기본·Complilaw 배출계수가 모두 등록되어 있습니다.":`기본·Complilaw 배출계수 ${next.length-items.length}개를 복원했습니다.`);};
  const save=(factor:EmissionFactor)=>{const next=factor.id==="NEW-FACTOR"?{...factor,id:`F-${crypto.randomUUID()}`}:factor;onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(factor.id==="NEW-FACTOR"?"배출계수 등록":"배출계수 수정",next.source,`${next.scope} · ${next.value} ${next.factorUnit}`);setEditing(null);showToast("배출계수와 산정기준을 저장했습니다.");};
  return <><ReferencePanel title="Scope 1·2·3 배출계수" subtitle="Complilaw S1·2 지표 마스터와 S3 배출계수 마스터를 구분해 조회하고, 승인된 유효 계수만 실제 산정에 사용합니다." action={<div className="row-actions"><button className="outline-small" disabled={!canManage} onClick={restore}><Icon name="refresh" size={14}/>마스터 누락분 복원</button><button className="primary-button compact" disabled={!canManage} onClick={()=>setEditing("new")}><Icon name="plus" size={14}/>계수 추가</button></div>}><div className="data-toolbar"><div className="search-box"><Icon name="search" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="배출원·분류·출처 검색"/></div><select value={scopeFilter} onChange={e=>setScopeFilter(e.target.value)}><option>전체</option><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option>전체</option><option>열량계수</option><option>지구온난화지수</option><option>산화계수</option><option>배출계수</option></select><span>{filtered.length} / {items.length}개</span></div><div className="table-scroll"><table className="data-table reference-table"><thead><tr><th>Scope</th><th>활동자료·배출원</th><th>배출계수</th><th>구분·연도</th><th>출처·산정방법</th><th>상태</th><th></th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><span className={`scope-tag s${item.scope.slice(-1)}`}>{item.scope}</span></td><td><strong>{item.source}</strong><small>{item.category} · {item.detailCategory??"기타"}</small></td><td className="mono"><strong>{formatNumber(item.value,item.value<10?5:1)}</strong><small>{item.factorUnit}</small></td><td>{item.indicatorKind??item.factorType??"배출계수"}<small>{item.year}</small></td><td><strong>{item.reference||item.authority}</strong><small>{item.method||"활동량 × 배출계수"}</small></td><td><StatusBadge status={item.active?"사용":"중지"}/></td><td><button className="outline-small" disabled={!canManage} onClick={()=>setEditing(item)}>수정</button></td></tr>)}</tbody></table></div></ReferencePanel>{editing&&<FactorForm factor={editing==="new"?null:editing} onClose={()=>setEditing(null)} onSave={save} onDelete={editing==="new"?undefined:()=>{const item=editing as EmissionFactor;if(!window.confirm("이 배출계수를 삭제하시겠습니까?"))return;onChange(items.filter(row=>row.id!==item.id));setEditing(null);showToast("배출계수를 삭제했습니다.");}}/>}</>;
}

function Scope3FieldManager({items,canManage,onChange,addAudit,showToast}:{items:Scope3FieldDefinition[];canManage:boolean;onChange:(x:Scope3FieldDefinition[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const [category,setCategory]=useState(SCOPE3_CATEGORIES[0]?.code??"Cat.1");const empty:Scope3FieldDefinition={id:"",categoryCode:category,fieldKey:"",nameKr:"",nameEn:"",inputType:"NUMBER",dataType:"NUMBER",unitGroup:"",required:true,sortOrder:items.filter(item=>item.categoryCode===category).length+1,active:true};const [draft,setDraft]=useState<Scope3FieldDefinition>(empty);const current=items.filter(item=>item.categoryCode===category).sort((a,b)=>a.sortOrder-b.sortOrder);const patch=(p:Partial<Scope3FieldDefinition>)=>setDraft(value=>({...value,...p}));
  const seed=()=>{
    if(!canManage)return;
    const additions=DEFAULT_MASTER_SCOPE3_FIELDS.filter(field=>!items.some(item=>item.categoryCode===field.categoryCode&&item.fieldKey===field.fieldKey));
    onChange([...items,...additions]);
    addAudit("Scope 3 입력항목 동기화","15개 범주",`Complilaw 마스터 누락분 ${additions.length}개를 생성하고 기존 ${Object.keys(DEFAULT_SCOPE3_FIELD_BLUEPRINTS).length}개 범주 템플릿과 연결했습니다.`);
    showToast(additions.length?`카테고리 항목 마스터 누락분 ${additions.length}개를 생성했습니다.`:"카테고리 항목 마스터가 이미 모두 반영되어 있습니다.");
  };
  const save=(e:FormEvent)=>{e.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`S3F-${crypto.randomUUID()}`,categoryCode:category,fieldKey:draft.fieldKey.trim().toLowerCase().replace(/\s+/g,"_")};if(items.some(item=>item.id!==next.id&&item.categoryCode===category&&item.fieldKey===next.fieldKey)){showToast("이 범주에 같은 필드 키가 이미 있습니다.");return;}onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"Scope 3 필드 수정":"Scope 3 필드 등록",`${category} · ${next.nameKr}`,next.fieldKey);setDraft({...empty,categoryCode:category,sortOrder:current.length+2});showToast("Scope 3 입력항목을 저장했습니다.");};
  return <ReferencePanel title="Scope 3 범주별 입력항목" subtitle="Complilaw 카테고리 항목 마스터의 코드·입력유형·단위그룹·필수여부·표시순서를 그대로 연결해 수집 요청에 사용합니다." action={<button className="primary-button compact" title="15개 범주 기본필드 생성" disabled={!canManage} onClick={seed}><Icon name="plus" size={14}/>마스터 누락분 동기화</button>}><div className="scope3-reference-layout"><div className="scope3-category-nav">{SCOPE3_CATEGORIES.map(item=><button key={item.code} className={category===item.code?"active":""} onClick={()=>{setCategory(item.code);setDraft({...empty,categoryCode:item.code,sortOrder:items.filter(field=>field.categoryCode===item.code).length+1})}}><span>{item.code}</span><strong>{item.name}</strong><em>{items.filter(field=>field.categoryCode===item.code).length}</em></button>)}</div><div className="scope3-fields"><div className="reference-list-head"><div><strong>{category} 입력항목</strong><span>{SCOPE3_CATEGORIES.find(item=>item.code===category)?.method}</span></div><button className="outline-small" disabled={!canManage} onClick={()=>setDraft({...empty,categoryCode:category,sortOrder:current.length+1})}><Icon name="plus" size={14}/>필드 추가</button></div>{current.map(item=><button className={`scope3-field-row ${draft.id===item.id?"active":""}`} key={item.id} onClick={()=>setDraft(item)}><span>{item.sortOrder}</span><div><strong>{item.nameKr}</strong><small>{item.fieldKey} · {item.inputType} · {item.unitGroup||"단위 없음"}</small></div>{item.required&&<em>필수</em>}</button>)}{!current.length&&<ReferenceEmpty icon="list" title="이 범주의 입력항목이 없습니다." description="마스터를 동기화하거나 새 필드를 추가해 주세요."/>}</div><form className="reference-form scope3-field-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"입력항목 수정":"새 입력항목"} description={`${category} 수집 화면에 표시될 필드를 정의합니다.`}/><div className="form-grid"><label>필드 키<input value={draft.fieldKey} onChange={e=>patch({fieldKey:e.target.value})} required/></label><label>표시 순서<input type="number" min="1" value={draft.sortOrder} onChange={e=>patch({sortOrder:Number(e.target.value)})}/></label><label>국문명<input value={draft.nameKr} onChange={e=>patch({nameKr:e.target.value})} required/></label><label>영문명<input value={draft.nameEn} onChange={e=>patch({nameEn:e.target.value})}/></label><label>입력 유형<select value={draft.inputType} onChange={e=>patch({inputType:e.target.value as Scope3FieldDefinition["inputType"]})}><option>TEXT</option><option>NUMBER</option><option>SELECT</option><option>DATE</option><option>UNIT_CODE</option><option>FILE</option></select></label><label>데이터 유형<select value={draft.dataType} onChange={e=>patch({dataType:e.target.value as Scope3FieldDefinition["dataType"]})}><option>STRING</option><option>NUMBER</option><option>DATE</option></select></label><label className="full-span">단위 그룹<input value={draft.unitGroup} onChange={e=>patch({unitGroup:e.target.value})} placeholder="ACTIVITY, CURRENCY, DISTANCE 등"/></label></div><Toggle label="필수 입력" checked={draft.required} onChange={required=>patch({required})}/><Toggle label="사용 중" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 입력항목을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft({...empty,categoryCode:category});showToast("입력항목을 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function SupplierManager({items,canManage,onChange,addAudit,showToast}:{items:SupplierMaster[];canManage:boolean;onChange:(x:SupplierMaster[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:SupplierMaster={id:"",code:"",name:"",region:"국내",category:"제조사-일반",tier:"tier1",country:"대한민국",email:"",owner:"",active:true,updatedAt:""};
  const [draft,setDraft]=useState(empty);const patch=(p:Partial<SupplierMaster>)=>setDraft(value=>({...value,...p}));
  const save=(event:FormEvent)=>{event.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`SUP-${crypto.randomUUID()}`,code:draft.code.trim().toUpperCase(),updatedAt:nowLabel()};if(items.some(item=>item.id!==next.id&&item.code===next.code)){showToast("같은 공급사 코드가 이미 있습니다.");return;}onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"공급사 수정":"공급사 등록",next.name,`${next.category} · ${next.tier}`);setDraft(empty);showToast("공급사 기준정보를 저장했습니다.");};
  return <ReferencePanel title="공급사 마스터" subtitle="Scope 3 데이터 수집과 공급망 진단에 사용할 회사 분류·Tier·연락처·담당자를 관리합니다."><div className="reference-split"><ReferenceTableList items={items} selectedId={draft.id} onSelect={setDraft} primary={item=>`${item.code} · ${item.name}`} secondary={item=>`${item.category} · ${item.tier} · ${item.region}`} onNew={()=>setDraft(empty)} canManage={canManage} emptyTitle="등록된 공급사가 없습니다."/><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"공급사 수정":"새 공급사"} description="등록된 공급사는 Scope 3 수집 요청과 공급망 진단 대상에서 바로 선택할 수 있습니다."/><div className="form-grid"><label>공급사 코드<input value={draft.code} onChange={e=>patch({code:e.target.value})} required/></label><label>회사명<input value={draft.name} onChange={e=>patch({name:e.target.value})} required/></label><label>국내·해외<select value={draft.region} onChange={e=>patch({region:e.target.value as SupplierMaster["region"]})}><option>국내</option><option>해외</option></select></label><label>국가<input value={draft.country} onChange={e=>patch({country:e.target.value})}/></label><label>공급망 분류<select value={draft.category} onChange={e=>patch({category:e.target.value as SupplierMaster["category"]})}><option>제조사-일반</option><option>제조사-특수</option><option>운송사</option><option>물류사</option><option>원자재사</option><option>기타</option></select></label><label>Tier<select value={draft.tier} onChange={e=>patch({tier:e.target.value as SupplierMaster["tier"]})}><option>tier1</option><option>tier2</option><option>tier3</option><option>tier4</option><option>해당없음</option></select></label><label>대표 이메일<input type="email" value={draft.email} onChange={e=>patch({email:e.target.value})}/></label><label>내부 담당자<input value={draft.owner} onChange={e=>patch({owner:e.target.value})}/></label></div><Toggle label="Scope 3 수집·진단에 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 공급사를 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("공급사 기준정보를 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function ProductMaterialManager({items,suppliers,canManage,onChange,addAudit,showToast}:{items:ProductMaterialMaster[];suppliers:SupplierMaster[];canManage:boolean;onChange:(x:ProductMaterialMaster[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:ProductMaterialMaster={id:"",code:"",name:"",type:"원자재",supplierId:"",unit:"kg",description:"",active:true,updatedAt:""};
  const [draft,setDraft]=useState(empty);const patch=(p:Partial<ProductMaterialMaster>)=>setDraft(value=>({...value,...p}));
  const save=(event:FormEvent)=>{event.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`MAT-${crypto.randomUUID()}`,code:draft.code.trim().toUpperCase(),updatedAt:nowLabel()};onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"자재 수정":"자재 등록",next.name,`${next.type} · ${next.unit}`);setDraft(empty);showToast("자재·제품 기준정보를 저장했습니다.");};
  return <ReferencePanel title="자재·제품 마스터" subtitle="구매한 재화·서비스, 자본재, 판매제품 산정에 사용할 자재코드·유형·공급사·단위를 관리합니다."><div className="reference-split"><ReferenceTableList items={items} selectedId={draft.id} onSelect={setDraft} primary={item=>`${item.code} · ${item.name}`} secondary={item=>`${item.type} · ${item.unit} · ${suppliers.find(s=>s.id===item.supplierId)?.name??"공급사 미연결"}`} onNew={()=>setDraft(empty)} canManage={canManage} emptyTitle="등록된 자재·제품이 없습니다."/><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"자재·제품 수정":"새 자재·제품"} description="공급사와 연결하면 Scope 3 요청 대상 및 원재료별 배출계수 관리에 재사용됩니다."/><div className="form-grid"><label>자재코드<input value={draft.code} onChange={e=>patch({code:e.target.value})} required/></label><label>자재명<input value={draft.name} onChange={e=>patch({name:e.target.value})} required/></label><label>유형<select value={draft.type} onChange={e=>patch({type:e.target.value as ProductMaterialMaster["type"]})}><option>완제품</option><option>반제품</option><option>원자재</option><option>반자재</option><option>상품</option></select></label><label>기준 단위<input value={draft.unit} onChange={e=>patch({unit:e.target.value})} required/></label><label className="full-span">공급사<select value={draft.supplierId} onChange={e=>patch({supplierId:e.target.value})}><option value="">공급사 미연결</option>{suppliers.filter(item=>item.active).map(item=><option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="full-span textarea-label">설명<textarea value={draft.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="Scope 3 산정에 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 자재·제품을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("자재·제품 기준정보를 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function TransportRouteManager({items,canManage,onChange,addAudit,showToast}:{items:TransportRoute[];canManage:boolean;onChange:(x:TransportRoute[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:TransportRoute={id:"",code:"",name:"",mode:"도로",vehicle:"",origin:"",destination:"",distance:0,distanceUnit:"km",calculationType:"자동계산",description:"",active:true,updatedAt:""};
  const [draft,setDraft]=useState(empty);const patch=(p:Partial<TransportRoute>)=>setDraft(value=>({...value,...p}));
  const save=(event:FormEvent)=>{event.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`ROUTE-${crypto.randomUUID()}`,code:draft.code.trim().toUpperCase(),updatedAt:nowLabel()};onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"이동거리 수정":"이동거리 등록",next.name,`${next.origin} → ${next.destination} · ${next.distance}${next.distanceUnit}`);setDraft(empty);showToast("이동거리 기준정보를 저장했습니다.");};
  return <ReferencePanel title="이동거리 마스터" subtitle="상·하류 운송·출장·통근 산정에 사용할 출발지·도착지·운송방식·거리 기준을 관리합니다."><div className="reference-split"><ReferenceTableList items={items} selectedId={draft.id} onSelect={setDraft} primary={item=>`${item.code} · ${item.name}`} secondary={item=>`${item.mode} · ${item.origin} → ${item.destination} · ${item.distance}${item.distanceUnit}`} onNew={()=>setDraft(empty)} canManage={canManage} emptyTitle="등록된 이동거리가 없습니다."/><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"이동거리 수정":"새 이동거리"} description="운송구간을 코드화하면 Scope 3 데이터 요청과 운송 산정에서 반복 사용할 수 있습니다."/><div className="form-grid"><label>이동거리 코드<input value={draft.code} onChange={e=>patch({code:e.target.value})} placeholder="KRPUS/KRICN" required/></label><label>코드명<input value={draft.name} onChange={e=>patch({name:e.target.value})} required/></label><label>운송방식<select value={draft.mode} onChange={e=>patch({mode:e.target.value as TransportRoute["mode"]})}><option>도로</option><option>철도</option><option>해상</option><option>항공</option></select></label><label>운송수단<input value={draft.vehicle} onChange={e=>patch({vehicle:e.target.value})} placeholder="화물차, 컨테이너선 등"/></label><label>출발지<input value={draft.origin} onChange={e=>patch({origin:e.target.value})} required/></label><label>도착지<input value={draft.destination} onChange={e=>patch({destination:e.target.value})} required/></label><label>이동거리<input type="number" min="0" step="any" value={draft.distance||""} onChange={e=>patch({distance:Number(e.target.value)})}/></label><label>거리 단위<select value={draft.distanceUnit} onChange={e=>patch({distanceUnit:e.target.value as TransportRoute["distanceUnit"]})}><option value="km">km</option><option value="mile">mile</option></select></label><label>산정 방식<select value={draft.calculationType} onChange={e=>patch({calculationType:e.target.value as TransportRoute["calculationType"]})}><option>자동계산</option><option>직접입력</option></select></label><label className="full-span textarea-label">설명·출처<textarea value={draft.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="Scope 3 산정에 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 이동거리 기준을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("이동거리 기준정보를 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function DisclosureMappingManager({items,standards,regulations,indicators,canManage,onChange,addAudit,showToast}:{items:DisclosureMapping[];standards:DisclosureStandard[];regulations:ComplianceRegulation[];indicators:Indicator[];canManage:boolean;onChange:(x:DisclosureMapping[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:DisclosureMapping={id:"",indicatorCode:"",standardId:"",standardItemCode:"",regulationIds:[],evidenceRequired:true,owner:"",status:"미연결",updatedAt:""};
  const [draft,setDraft]=useState(empty);const patch=(p:Partial<DisclosureMapping>)=>setDraft(value=>({...value,...p}));const selectedStandard=standards.find(item=>item.id===draft.standardId);const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];
  const save=(event:FormEvent)=>{event.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`MAP-${crypto.randomUUID()}`,status:(draft.indicatorCode&&draft.standardId&&draft.standardItemCode?"연결완료":"검토 필요") as DisclosureMapping["status"],updatedAt:nowLabel()};onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"공시 연결 수정":"공시 연결 등록",next.indicatorCode,`${selectedStandard?.code??""} ${next.standardItemCode}`);setDraft(empty);showToast("정량지표·보고기준 연결을 저장했습니다.");};
  return <ReferencePanel title="정량지표 × 보고기준 연결" subtitle="정량지표를 보고기준의 세부 항목과 규제·증빙 요구에 연결해 보고서 대응표로 재사용합니다."><div className="mapping-summary"><div><span>전체 지표</span><strong>{indicators.length}</strong></div><div><span>연결완료</span><strong>{items.filter(item=>item.status==="연결완료").length}</strong></div><div><span>검토 필요</span><strong>{items.filter(item=>item.status!=="연결완료").length}</strong></div><div><span>보고기준 항목</span><strong>{standards.reduce((sum,item)=>sum+item.items.length,0)}</strong></div></div><div className="reference-split"><ReferenceTableList items={items.map(item=>({...item,active:item.status==="연결완료"}))} selectedId={draft.id} onSelect={item=>setDraft(items.find(row=>row.id===item.id)??empty)} primary={item=>`${item.indicatorCode||"지표 미선택"} · ${standards.find(std=>std.id===item.standardId)?.code??"기준 미선택"}`} secondary={item=>`${item.standardItemCode||"항목 미선택"} · ${item.owner||"담당자 미지정"}`} onNew={()=>setDraft(empty)} canManage={canManage} emptyTitle="등록된 공시 연결이 없습니다."/><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"연결정보 수정":"새 연결"} description="지표 하나를 여러 기준에 대응하려면 연결정보를 각각 추가해 주세요."/><div className="form-grid"><label className="full-span">정량지표<select value={draft.indicatorCode} onChange={e=>patch({indicatorCode:e.target.value})} required><option value="">지표 선택</option>{indicators.map(item=><option value={item.code} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>보고기준<select value={draft.standardId} onChange={e=>patch({standardId:e.target.value,standardItemCode:""})} required><option value="">기준 선택</option>{standards.filter(item=>item.active).map(item=><option value={item.id} key={item.id}>{item.code} · {item.title} ({item.version})</option>)}</select></label><label>세부 항목<select value={draft.standardItemCode} onChange={e=>patch({standardItemCode:e.target.value})} required><option value="">항목 선택</option>{(selectedStandard?.items??[]).filter(item=>item.active).map(item=><option value={item.code} key={item.id}>{item.code} · {item.title}</option>)}</select></label><label>내부 담당자<input value={draft.owner} onChange={e=>patch({owner:e.target.value})}/></label></div><div className="reference-links single-links"><div><strong>연결 규제·평가기준</strong>{regulations.filter(item=>item.active).map(item=><label key={item.id}><input type="checkbox" checked={draft.regulationIds.includes(item.id)} onChange={()=>patch({regulationIds:toggle(draft.regulationIds,item.id)})}/><span>{item.title}</span></label>)}{!regulations.length&&<p>등록된 규제가 없습니다.</p>}</div></div><Toggle label="증빙 필수" description="정량데이터 확정 시 근거자료 연결 여부를 확인합니다." checked={draft.evidenceRequired} onChange={evidenceRequired=>patch({evidenceRequired})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 공시 연결을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("공시 연결을 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function StandardManager({items,canManage,onChange,addAudit,showToast}:{items:DisclosureStandard[];canManage:boolean;onChange:(x:DisclosureStandard[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:DisclosureStandard={id:"",code:"",title:"",category:"공시",version:"",description:"",active:true,items:[],history:[],updatedAt:""};const [draft,setDraft]=useState(empty);const [itemDraft,setItemDraft]=useState<DisclosureStandardItem>({id:"",code:"",title:"",level:1,parentCode:"",contents:"",risk:"보통",active:true});const patch=(p:Partial<DisclosureStandard>)=>setDraft(value=>({...value,...p}));
  const persist=(next:DisclosureStandard,message:string)=>{onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);setDraft(next);showToast(message);};
  const save=(e:FormEvent)=>{e.preventDefault();if(!canManage)return;const exists=Boolean(draft.id);const next={...draft,id:draft.id||`STD-${crypto.randomUUID()}`,code:draft.code.trim().toUpperCase(),updatedAt:nowLabel(),history:exists?draft.history:[{date:new Date().toISOString().slice(0,10),contents:`${draft.version||"초기"} 기준 등록`} ]};persist(next,"보고기준을 저장했습니다.");addAudit(exists?"보고기준 수정":"보고기준 등록",next.title,`${next.code} · ${next.version}`);};
  const saveItem=(e:FormEvent)=>{e.preventDefault();if(!draft.id){showToast("보고기준 기본정보를 먼저 저장해 주세요.");return;}const nextItem={...itemDraft,id:itemDraft.id||`STDI-${crypto.randomUUID()}`,code:itemDraft.code.trim().toUpperCase()};const next={...draft,items:draft.items.some(item=>item.id===nextItem.id)?draft.items.map(item=>item.id===nextItem.id?nextItem:item):[...draft.items,nextItem],updatedAt:nowLabel()};persist(next,"보고기준 항목을 저장했습니다.");setItemDraft({id:"",code:"",title:"",level:1,parentCode:"",contents:"",risk:"보통",active:true});};
  return <ReferencePanel title="보고기준·공시항목" subtitle="Complilaw의 보고기준 분류·버전·항목수를 보존하고, 실제 세부항목은 정량지표·규제·보고서 대응표에 연결합니다."><div className="standard-layout"><div className="reference-list standards-list"><div className="reference-list-head"><strong>보고기준</strong><button className="outline-small" disabled={!canManage} onClick={()=>setDraft(empty)}><Icon name="plus" size={14}/>새 기준</button></div>{items.map(item=><button key={item.id} className={draft.id===item.id?"active":""} onClick={()=>setDraft(item)}><span className="standard-code">{item.code.slice(0,4)}</span><div><strong>{item.title}</strong><small>{item.sourceClassification??item.category} · {item.version||"버전 미지정"} · {item.sourceItemCount??item.items.length}개 항목</small></div><StatusBadge status={item.active?"사용":"중지"}/></button>)}{!items.length&&<ReferenceEmpty icon="file" title="등록된 보고기준이 없습니다." description="새 보고기준을 등록해 주세요."/>}</div><form className="reference-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"보고기준 수정":"새 보고기준"} description="코드와 버전을 구분하면 개정 시점과 적용 보고서를 추적할 수 있습니다."/><div className="form-grid"><label>기준 코드<input value={draft.code} onChange={e=>patch({code:e.target.value})} placeholder="GRI, ESRS, KSSB" required/></label><label>버전<input value={draft.version} onChange={e=>patch({version:e.target.value})} placeholder="2026"/></label><label className="full-span">기준명<input value={draft.title} onChange={e=>patch({title:e.target.value})} required/></label><label>분류<select value={draft.category} onChange={e=>patch({category:e.target.value as DisclosureStandard["category"]})}><option>공시</option><option>산정</option><option>평가</option><option>법정</option></select></label><label className="full-span textarea-label">설명<textarea value={draft.description} onChange={e=>patch({description:e.target.value})}/></label></div><Toggle label="보고서 작성 시 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 보고기준과 하위 항목을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("보고기준을 삭제했습니다.");}}/></form></div>{draft.id&&<div className="standard-items"><div className="reference-list-head"><div><strong>{draft.code} 공시항목</strong><span>상위 코드와 레벨로 항목 계층을 구성합니다.</span></div></div><div className="standard-item-grid"><div className="table-scroll"><table className="data-table reference-table"><thead><tr><th>코드</th><th>레벨</th><th>항목명</th><th>중요도</th><th>상태</th></tr></thead><tbody>{draft.items.map(item=><tr key={item.id} onClick={()=>setItemDraft(item)} className={itemDraft.id===item.id?"selected-row":""}><td className="mono">{item.code}</td><td>{item.level}</td><td><strong>{item.title}</strong><small>{item.parentCode?`상위 ${item.parentCode}`:"최상위"}</small></td><td>{item.risk}</td><td>{item.active?"사용":"중지"}</td></tr>)}</tbody></table>{!draft.items.length&&<ReferenceEmpty icon="list" title={`${draft.sourceItemCount??0}개 원본 항목 요약만 동기화됨`} description={draft.active?"세부항목을 추가해 주세요.":"테스트 기준은 운영 공시에서 제외되어 있습니다."}/>}</div><form className="reference-form compact-reference-form" onSubmit={saveItem}><ReferenceFormTitle title={itemDraft.id?"항목 수정":"항목 추가"} description="기준서의 원문을 요약하고 내부 대응항목을 계층으로 정리합니다."/><label>항목 코드<input value={itemDraft.code} onChange={e=>setItemDraft(value=>({...value,code:e.target.value}))} required/></label><label>항목명<input value={itemDraft.title} onChange={e=>setItemDraft(value=>({...value,title:e.target.value}))} required/></label><div className="form-grid"><label>레벨<input type="number" min="1" max="6" value={itemDraft.level} onChange={e=>setItemDraft(value=>({...value,level:Number(e.target.value)}))}/></label><label>상위 코드<input value={itemDraft.parentCode} onChange={e=>setItemDraft(value=>({...value,parentCode:e.target.value}))}/></label><label>중요도<select value={itemDraft.risk} onChange={e=>setItemDraft(value=>({...value,risk:e.target.value as DisclosureStandardItem["risk"]}))}><option>낮음</option><option>보통</option><option>높음</option></select></label></div><label className="textarea-label">기준 내용<textarea value={itemDraft.contents} onChange={e=>setItemDraft(value=>({...value,contents:e.target.value}))}/></label><ReferenceFormActions canManage={canManage} editing={Boolean(itemDraft.id)} onDelete={()=>{if(!itemDraft.id)return;const next={...draft,items:draft.items.filter(item=>item.id!==itemDraft.id)};persist(next,"공시항목을 삭제했습니다.");setItemDraft({id:"",code:"",title:"",level:1,parentCode:"",contents:"",risk:"보통",active:true});}}/></form></div></div>}</ReferencePanel>;
}

function RegulationManager({items,standards,indicators,canManage,onChange,addAudit,showToast}:{items:ComplianceRegulation[];standards:DisclosureStandard[];indicators:Indicator[];canManage:boolean;onChange:(x:ComplianceRegulation[])=>void;addAudit:(a:string,t:string,d:string)=>void;showToast:(m:string)=>void}){
  const empty:ComplianceRegulation={id:"",title:"",category:"환경·기후",jurisdiction:"대한민국",contents:"",applicability:"",owner:"",reviewCycleMonths:12,lastReviewDate:"",nextReviewDate:"",status:"검토 필요",tags:[],linkedStandardIds:[],linkedIndicatorCodes:[],evidence:"",active:true,updatedAt:""};const [draft,setDraft]=useState(empty);const [tagText,setTagText]=useState("");const [today]=useState(()=>Date.now());const patch=(p:Partial<ComplianceRegulation>)=>setDraft(value=>({...value,...p}));const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];
  const save=(e:FormEvent)=>{e.preventDefault();if(!canManage)return;const next={...draft,id:draft.id||`REG-${crypto.randomUUID()}`,tags:tagText.trim()?[...new Set([...draft.tags,...tagText.split(",").map(item=>item.trim()).filter(Boolean)])]:draft.tags,updatedAt:nowLabel()};onChange(items.some(item=>item.id===next.id)?items.map(item=>item.id===next.id?next:item):[...items,next]);addAudit(draft.id?"규제 수정":"규제 등록",next.title,`${next.status} · 다음 검토 ${next.nextReviewDate||"미지정"}`);setDraft(next);setTagText("");showToast("규제 기준과 검토정보를 저장했습니다.");};
  const dueTone=(item:ComplianceRegulation)=>item.nextReviewDate&&new Date(item.nextReviewDate).getTime()<=today?"반려":item.nextReviewDate&&new Date(item.nextReviewDate).getTime()<=today+30*86400000?"확인 필요":item.status;
  return <ReferencePanel title="규제·준수 관리" subtitle="Complilaw 규제 버전·항목수·적용상태를 보존하고 담당자, 검토주기, 공시기준·ESG 지표·근거 증빙을 연결합니다."><div className="regulation-layout"><div className="reference-list regulation-list"><div className="reference-list-head"><strong>규제 목록</strong><button className="outline-small" disabled={!canManage} onClick={()=>{setDraft(empty);setTagText("")}}><Icon name="plus" size={14}/>새 규제</button></div>{items.map(item=><button key={item.id} className={draft.id===item.id?"active":""} onClick={()=>{setDraft(item);setTagText("")}}><span className="regulation-marker"><Icon name="alert" size={16}/></span><div><strong>{item.title}</strong><small>{item.version??"버전 미지정"} · {item.sourceUsedItemCount??0}/{item.sourceItemCount??0}개 사용 · {item.jurisdiction}</small></div><StatusBadge status={dueTone(item)}/></button>)}{!items.length&&<ReferenceEmpty icon="alert" title="등록된 규제가 없습니다." description="적용 대상 규제와 검토주기를 등록해 주세요."/>}</div><form className="reference-form regulation-form" onSubmit={save}><ReferenceFormTitle title={draft.id?"규제정보 수정":"새 규제"} description="법령 원문 대신 내부 적용 판단과 준수 활동·증빙 연결정보를 관리합니다."/><div className="form-grid"><label className="full-span">규제·법령명<input value={draft.title} onChange={e=>patch({title:e.target.value})} required/></label><label>버전<input value={draft.version??""} onChange={e=>patch({version:e.target.value})}/></label><label>분류<input value={draft.category} onChange={e=>patch({category:e.target.value})}/></label><label>관할<input value={draft.jurisdiction} onChange={e=>patch({jurisdiction:e.target.value})}/></label><label>적용 상태<select value={draft.status} onChange={e=>patch({status:e.target.value as ComplianceRegulation["status"]})}><option>검토 필요</option><option>적용</option><option>미적용</option><option>개정 검토</option></select></label><label>담당자<input value={draft.owner} onChange={e=>patch({owner:e.target.value})}/></label><label>검토주기(개월)<input type="number" min="1" value={draft.reviewCycleMonths} onChange={e=>patch({reviewCycleMonths:Number(e.target.value)})}/></label><label>최근 검토일<input type="date" value={draft.lastReviewDate} onChange={e=>patch({lastReviewDate:e.target.value})}/></label><label>다음 검토일<input type="date" value={draft.nextReviewDate} onChange={e=>patch({nextReviewDate:e.target.value})}/></label><label className="full-span textarea-label">주요 요구사항<textarea value={draft.contents} onChange={e=>patch({contents:e.target.value})}/></label><label className="full-span textarea-label">적용 판단·조치<textarea value={draft.applicability} onChange={e=>patch({applicability:e.target.value})}/></label><label className="full-span">증빙·근거 위치<input value={draft.evidence} onChange={e=>patch({evidence:e.target.value})} placeholder="증빙자료명, 내부 규정, 파일 경로"/></label><label className="full-span">태그<input value={tagText} onChange={e=>setTagText(e.target.value)} placeholder={`${draft.tags.join(", ")}${draft.tags.length?" · 새 태그를 쉼표로 추가":""}`}/></label></div><div className="reference-links"><div><strong>연결 보고기준</strong>{standards.map(item=><label key={item.id}><input type="checkbox" checked={draft.linkedStandardIds.includes(item.id)} onChange={()=>patch({linkedStandardIds:toggle(draft.linkedStandardIds,item.id)})}/><span>{item.code} · {item.title}</span></label>)}{!standards.length&&<p>등록된 보고기준이 없습니다.</p>}</div><div><strong>연결 ESG 지표</strong>{indicators.filter(item=>item.active).map(item=><label key={item.id}><input type="checkbox" checked={draft.linkedIndicatorCodes.includes(item.code)} onChange={()=>patch({linkedIndicatorCodes:toggle(draft.linkedIndicatorCodes,item.code)})}/><span>{item.code} · {item.name}</span></label>)}{!indicators.length&&<p>등록된 ESG 지표가 없습니다.</p>}</div></div><Toggle label="준수 관리에 사용" checked={draft.active} onChange={active=>patch({active})}/><ReferenceFormActions canManage={canManage} editing={Boolean(draft.id)} onDelete={()=>{if(!draft.id||!window.confirm("이 규제 기준을 삭제하시겠습니까?"))return;onChange(items.filter(item=>item.id!==draft.id));setDraft(empty);showToast("규제 기준을 삭제했습니다.");}}/></form></div></ReferencePanel>;
}

function ReferencePanel({title,subtitle,action,children}:{title:string;subtitle:string;action?:ReactNode;children:ReactNode}){return <section className="card reference-panel"><CardHeader title={title} subtitle={subtitle} action={action}/>{children}</section>}
function ReferenceFormTitle({title,description}:{title:string;description:string}){return <div className="reference-form-title"><div><strong>{title}</strong><p>{description}</p></div></div>}
function ReferenceFormActions({canManage,editing,onDelete}:{canManage:boolean;editing:boolean;onDelete:()=>void}){return <div className="reference-form-actions">{editing?<button type="button" className="danger-button" disabled={!canManage} onClick={onDelete}><Icon name="trash" size={14}/>삭제</button>:<span/>}<button type="submit" className="primary-button" disabled={!canManage}><Icon name="check" size={15}/>저장</button></div>}
function ReferenceEmpty({icon,title,description}:{icon:IconName;title:string;description:string}){return <div className="reference-empty"><Icon name={icon}/><strong>{title}</strong><p>{description}</p></div>}
function ReferenceTableList<T extends {id:string;active:boolean}>({items,selectedId,onSelect,primary,secondary,onNew,canManage,emptyTitle}:{items:T[];selectedId:string;onSelect:(item:T)=>void;primary:(item:T)=>string;secondary:(item:T)=>string;onNew:()=>void;canManage:boolean;emptyTitle:string}){return <div className="reference-list"><div className="reference-list-head"><strong>등록 목록</strong><button className="outline-small" disabled={!canManage} onClick={onNew}><Icon name="plus" size={14}/>새 항목</button></div>{items.map(item=><button key={item.id} className={selectedId===item.id?"active":""} onClick={()=>onSelect(item)}><span className="reference-node"><Icon name="database" size={15}/></span><div><strong>{primary(item)}</strong><small>{secondary(item)}</small></div><StatusBadge status={item.active?"사용":"중지"}/></button>)}{!items.length&&<ReferenceEmpty icon="database" title={emptyTitle} description="오른쪽 입력창에서 첫 항목을 추가해 주세요."/>}</div>}

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
  const downloadTemplate=async()=>{const XLSX=await import("xlsx");const task=selectedPeriod?buildGHGCollectionTasks(selectedPeriod)[0]:undefined;const factor=factors.find(item=>item.active&&item.scope===task?.targetId);const company=task?.company??Object.keys(organizations)[0]??"";const sample=[company,organizations[company]?.[0]??"",task?.period??new Date().toISOString().slice(0,7),factor?.scope??"Scope 1",factor?.category??"",factor?.source??"",1000,"담당자명","담당 부서","증빙파일.pdf","원천자료 기준을 적어 주세요."];const sheet=XLSX.utils.aoa_to_sheet([headers,sample]);sheet["!cols"]=headers.map((header,index)=>({wch:index===10?32:Math.max(12,header.length+4)}));const guide=XLSX.utils.aoa_to_sheet([["SEMS 활동자료 일괄등록 안내"],["1. 열 제목은 수정하지 마세요."],["2. Scope·활동자료 구분·배출원은 시스템 설정의 배출계수 명칭과 정확히 일치해야 합니다."],["3. 같은 수집기간·사업장·귀속월·활동자료는 중복 등록되지 않습니다."],["4. 배출계수와 배출량은 등록 시 시스템에서 자동 적용됩니다."],["5. 증빙 파일명은 실제 원본과 동일하게 적어 주세요."]]);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"활동자료 입력");XLSX.utils.book_append_sheet(book,guide,"작성 안내");XLSX.writeFile(book,"SEMS_activity_import_template.xlsx");};
  const readFile=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setErrors([]);setPreview([]);try{const XLSX=await import("xlsx");const data=await file.arrayBuffer();const book=XLSX.read(data,{type:"array"});const sheet=book.Sheets[book.SheetNames[0]];const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""});const next:ActivityRecord[]=[];const issues:string[]=[];const seen=new Set<string>();rows.forEach((row,index)=>{const line=index+2;const company=String(row["법인"]??"").trim();const site=String(row["사업장"]??"").trim();const period=String(row["귀속월"]??"").trim();const scope=String(row["Scope"]??"").trim() as Scope;const category=String(row["활동자료 구분"]??"").trim();const source=String(row["배출원"]??"").trim();const usage=Number(row["사용량"]);const factor=factors.find(item=>item.active&&item.scope===scope&&item.category===category&&item.source===source);if(!selectedPeriod){issues.push(`${line}행: 수집기간을 선택해 주세요.`);return;}if(!organizations[company]?.includes(site)){issues.push(`${line}행: 대상 법인 또는 사업장이 올바르지 않습니다.`);return;}if(!buildGHGCollectionTasks(selectedPeriod).some(task=>task.company===company&&task.targetId===scope&&task.period===period)){issues.push(`${line}행: 이 요청에 생성된 세부 수집 항목이 아닙니다.`);return;}if(!factor){issues.push(`${line}행: 사용 중인 배출계수와 일치하는 활동자료를 찾지 못했습니다.`);return;}if(!Number.isFinite(usage)||usage<=0){issues.push(`${line}행: 사용량은 0보다 큰 숫자여야 합니다.`);return;}const key=[periodId,company,site,period,scope,category,source].join("|");if(seen.has(key)||records.some(item=>[item.collectionId,item.company,item.site,item.period,item.scope,item.category,item.source].join("|")===key)){issues.push(`${line}행: 이미 등록된 중복 자료입니다.`);return;}seen.add(key);next.push({id:Math.max(0,...records.map(item=>item.id))+next.length+1,collectionId:periodId,company,site,period,scope,category,source,usage,unit:factor.activityUnit,factor:factor.value,emissions:Math.round(usage*factor.value/1000*100)/100,owner:String(row["담당자"]??"").trim()||"미지정",department:String(row["담당 부서"]??"").trim()||"미지정",status:"작성중",evidence:String(row["증빙 파일명"]??"").trim(),description:String(row["입력 설명"]??"").trim(),active:true,createdAt:nowLabel(),updatedAt:"방금 전"});});setPreview(next);setErrors(issues);}catch{setErrors(["파일을 읽을 수 없습니다. 제공된 양식을 사용해 다시 시도해 주세요."]);}finally{event.target.value="";}};
  return <Overlay title="Excel 일괄등록" eyebrow="BULK IMPORT" description="양식 검증을 통과한 행만 작성 중 상태로 등록합니다." onClose={onClose}><div className="form-section"><div className="form-grid"><label>수집기간<select value={periodId} onChange={e=>{setPeriodId(e.target.value);setPreview([]);setErrors([])}}>{availablePeriods.map(period=><option key={period.id} value={period.id}>{period.name}</option>)}</select></label><div className="bulk-buttons"><button className="secondary-button" onClick={downloadTemplate} disabled={!selectedPeriod}><Icon name="download" size={16}/>양식 다운로드</button><button className="primary-button" onClick={()=>inputRef.current?.click()} disabled={!selectedPeriod}><Icon name="upload" size={16}/>파일 선택</button><input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={readFile} hidden/></div></div><div className="factor-notice bulk-notice"><Icon name="lock" size={18}/><p><strong>배출계수는 Excel에서 입력하지 않습니다.</strong><br/>Scope·활동자료·배출원을 기준으로 시스템의 사용 중 계수를 자동 적용합니다.</p></div></div>
    <div className="bulk-result">{preview.length>0&&<div className="bulk-success"><Icon name="check" size={18}/><strong>{preview.length}건 등록 가능</strong><span>중복·기간·배출계수 검증을 통과했습니다.</span></div>}{errors.length>0&&<div className="bulk-errors"><strong><Icon name="alert" size={16}/>{errors.length}건 확인 필요</strong><ul>{errors.slice(0,12).map(error=><li key={error}>{error}</li>)}</ul>{errors.length>12&&<p>외 {errors.length-12}건</p>}</div>}{preview.length>0&&<div className="table-scroll"><table className="data-table compact-table"><thead><tr><th>법인</th><th>귀속월</th><th>Scope</th><th>배출원</th><th>사용량</th><th>배출량</th></tr></thead><tbody>{preview.slice(0,8).map(item=><tr key={item.id}><td>{item.company}</td><td>{item.period}</td><td>{item.scope}</td><td>{item.source}</td><td>{formatNumber(item.usage,1)} {item.unit}</td><td>{formatNumber(item.emissions,2)} t</td></tr>)}</tbody></table></div>}</div>
    <div className="modal-footer"><button className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={!preview.length} onClick={()=>onImport(preview)}><Icon name="check" size={16}/>{preview.length}건 등록</button></div></Overlay>;
}

function Settings({factors,onFactorsChange,criteria,onCriteriaChange,noticePrefs,onNoticePrefsChange,organizations,onOrganizationsChange,onExport,onRestore,showToast}:{factors:EmissionFactor[];onFactorsChange:(x:EmissionFactor[])=>void;criteria:CollectionCriteria;onCriteriaChange:(x:CollectionCriteria)=>void;noticePrefs:NotificationPrefs;onNoticePrefsChange:(x:NotificationPrefs)=>void;organizations:Record<string,string[]>;onOrganizationsChange:(x:Record<string,string[]>)=>void;onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){
  const [tab,setTab]=useState<SettingTab>("factors"); const [factorModal,setFactorModal]=useState<EmissionFactor|null|"new">(null);
  const saveFactor=(factor:EmissionFactor)=>{const normalized=factor.id==="NEW-FACTOR"?{...factor,id:`F-${String(factors.length+1).padStart(3,"0")}`}:factor;const exists=factors.some(f=>f.id===normalized.id);onFactorsChange(exists?factors.map(f=>f.id===normalized.id?normalized:f):[...factors,normalized]);setFactorModal(null);showToast(exists?"배출계수를 수정했습니다.":"새 배출계수를 추가했습니다.");};
  const removeFactor=(id:string)=>{if(!window.confirm("이 배출계수를 삭제하시겠습니까? 기존 활동자료의 산정값은 유지됩니다."))return;onFactorsChange(factors.filter(f=>f.id!==id));setFactorModal(null);showToast("배출계수를 삭제했습니다.");};
  const restoreFactors=()=>{const next=mergeDefaultEmissionFactors(factors) as EmissionFactor[];onFactorsChange(next);showToast(next.length===factors.length?"기본 배출계수가 모두 등록되어 있습니다.":`누락된 기본 배출계수 ${next.length-factors.length}개를 복원했습니다.`);};
  return <><PageHeader eyebrow="SYSTEM SETTINGS" title="시스템 설정" description="조직, 산정 기준, 알림, 권한과 운영 데이터 백업을 관리합니다."/><div className="settings-layout"><aside className="settings-nav"><button className={tab==="organization"?"active":""} onClick={()=>setTab("organization")}><Icon name="building" size={18}/>조직·사업장</button><button className={tab==="factors"?"active":""} onClick={()=>setTab("factors")}><Icon name="leaf" size={18}/>배출계수·산정기준</button><button className={tab==="criteria"?"active":""} onClick={()=>setTab("criteria")}><Icon name="list" size={18}/>수집 기준</button><button className={tab==="notifications"?"active":""} onClick={()=>setTab("notifications")}><Icon name="bell" size={18}/>알림 설정</button><button className={tab==="permissions"?"active":""} onClick={()=>setTab("permissions")}><Icon name="settings" size={18}/>권한 관리</button><button className={tab==="data"?"active":""} onClick={()=>setTab("data")}><Icon name="database" size={18}/>데이터 백업</button></aside><section className="card settings-content">
    {tab==="factors"&&<><CardHeader title="Scope 1·2·3 배출계수·산정기준" subtitle="활동자료 등록에 연결되는 계수와 경계·산정방법·출처를 함께 관리합니다." action={<div className="row-actions"><button className="outline-small" onClick={restoreFactors}><Icon name="refresh" size={15}/>기본계수 복원</button><button className="outline-small" onClick={()=>setFactorModal("new")}><Icon name="plus" size={15}/>계수 추가</button></div>}/><div className="scope-guidance-grid">{SCOPE_GUIDANCE.map(guide=><article key={guide.scope} className={`scope-guidance-card s${guide.scope.slice(-1)}`}><div><span className={`scope-tag s${guide.scope.slice(-1)}`}>{guide.scope}</span><strong>{guide.title}</strong></div><p>{guide.definition}</p><dl><div><dt>주요 예시</dt><dd>{guide.examples}</dd></div><div><dt>기본 산식</dt><dd>{guide.formula}</dd></div><div><dt>기준</dt><dd>{guide.standard}</dd></div><div><dt>적용 주의</dt><dd>{guide.caution}</dd></div></dl></article>)}</div><details className="scope3-category-reference"><summary>Scope 3 전체 15개 범주·기본 산정방법 보기</summary><div>{SCOPE3_CATEGORIES.map(category=><article key={category.code}><span>{category.code}</span><strong>{category.name}</strong><p>{category.method}</p></article>)}</div></details><div className="factor-notice"><Icon name="lock" size={18}/><p><strong>기존 활동자료에는 저장 당시 계수가 유지됩니다.</strong><br/>공식계수와 공급자계수는 보고연도·단위를 확인해 선택하고, Scope 3 참고계수는 공급자 PCF·EPD 확보 시 교체하세요.</p></div><div className="table-scroll"><table className="data-table factor-table factor-detail-table"><thead><tr><th>Scope</th><th>활동자료·배출원</th><th>배출계수</th><th>유형·연도</th><th>산정방법·출처</th><th>상태</th><th>작업</th></tr></thead><tbody>{factors.map(row=><tr key={row.id}><td><span className={`scope-tag s${row.scope.slice(-1)}`}>{row.scope}</span></td><td><span>{row.category}</span><strong>{row.source}</strong><small>{row.notes||"별도 적용 주의사항 없음"}</small></td><td className="mono"><strong>{formatNumber(row.value,row.value<10?5:1)}</strong><span>{row.factorUnit}</span></td><td><span className={`factor-type ${row.factorType==="참고계수"?"reference":row.factorType==="공급자계수"?"supplier":""}`}>{row.factorType||"운영계수"}</span><small>{row.year}</small></td><td><strong>{row.method||"활동량 × 배출계수"}</strong><span>{row.reference||row.authority}</span>{row.referenceUrl&&<a href={row.referenceUrl} target="_blank" rel="noreferrer">기준 원문 ↗</a>}</td><td><span className={row.active?"active-label":"inactive-label"}>{row.active?"사용 중":"중지"}</span></td><td><button className="outline-small" onClick={()=>setFactorModal(row)}><Icon name="edit" size={14}/>수정</button></td></tr>)}</tbody></table></div></>}
    {tab==="organization"&&<OrganizationSettings organizations={organizations} onChange={onOrganizationsChange} showToast={showToast}/>} {tab==="criteria"&&<><CardHeader title="데이터 수집 기준" subtitle="입력 검증과 확정 데이터 처리 기준을 설정합니다."/><div className="settings-form"><label>기본 귀속연도<select value={criteria.defaultYear} onChange={e=>onCriteriaChange({...criteria,defaultYear:e.target.value})}><option>2026</option><option>2027</option><option>2028</option></select></label><label>전월 대비 이상치 경고 기준<div className="input-unit"><input type="number" min="1" value={criteria.variance} onChange={e=>onCriteriaChange({...criteria,variance:Number(e.target.value)})}/><span>%</span></div></label><Toggle label="증빙 미첨부 항목 확인" description="증빙 없이도 제출·확정할 수 있으며 품질 확인 목록에만 표시합니다." checked={criteria.evidenceRequired} onChange={v=>onCriteriaChange({...criteria,evidenceRequired:v})}/><Toggle label="확정 자료 수정 잠금" checked={criteria.lockConfirmed} onChange={v=>onCriteriaChange({...criteria,lockConfirmed:v})}/></div><SettingsFooter onSave={()=>showToast("수집 기준을 저장했습니다.")}/></>}
    {tab==="notifications"&&<><CardHeader title="알림 설정" subtitle="업무 상황별 알림 수신 여부를 설정합니다."/><div className="toggle-list"><Toggle label="수집 마감 3일 전 알림" description="미제출 담당자와 기획팀에 안내" checked={noticePrefs.deadline} onChange={v=>onNoticePrefsChange({...noticePrefs,deadline:v})}/><Toggle label="검토 대기 등록 알림" description="담당 부서가 제출하면 기획팀에 안내" checked={noticePrefs.review} onChange={v=>onNoticePrefsChange({...noticePrefs,review:v})}/><Toggle label="반려 및 보완 요청 알림" description="반려 사유와 재제출 기한 안내" checked={noticePrefs.rejected} onChange={v=>onNoticePrefsChange({...noticePrefs,rejected:v})}/><Toggle label="주간 수집 현황 요약" description="매주 월요일 관리자에게 요약" checked={noticePrefs.weekly} onChange={v=>onNoticePrefsChange({...noticePrefs,weekly:v})}/><div className="server-note"><Icon name="alert" size={17}/>설정은 저장됩니다. 실제 메일·사내 알림 발송은 사내 알림 서버 연결 후 적용됩니다.</div></div><SettingsFooter onSave={()=>showToast("알림 설정을 저장했습니다.")}/></>}
    {tab==="permissions"&&<PermissionSettings showToast={showToast}/>}
    {tab==="data"&&<DataSettings onExport={onExport} onRestore={onRestore} showToast={showToast}/>}</section></div>{factorModal&&<FactorForm factor={factorModal==="new"?null:factorModal} onClose={()=>setFactorModal(null)} onSave={saveFactor} onDelete={factorModal==="new"?undefined:()=>removeFactor(factorModal.id)}/>}</>;
}
/*
function OrganizationSettings({organizations,onChange,showToast}:{organizations:Record<string,string[]>;onChange:(x:Record<string,string[]>)=>void;showToast:(m:string)=>void}){const [selected,setSelected]=useState("세원정공");const [adding,setAdding]=useState(false);const [newSite,setNewSite]=useState("");const addSite=()=>{const name=newSite.trim();if(!name)return;if(organizations[selected].includes(name)){showToast("이미 등록된 사업장입니다.");return;}onChange({...organizations,[selected]:[...organizations[selected],name]});setNewSite("");setAdding(false);showToast(`${selected}에 ${name}을(를) 추가했습니다.`);};const removeSite=(site:string)=>{if(organizations[selected].length<=1){showToast("법인별 사업장은 최소 한 개가 필요합니다.");return;}if(!window.confirm(`${site}을(를) 사업장 목록에서 삭제하시겠습니까?`))return;onChange({...organizations,[selected]:organizations[selected].filter(item=>item!==site)});showToast(`${site}을(를) 삭제했습니다.`);};return <><CardHeader title="조직·사업장" subtitle="여기서 추가한 사업장은 활동자료 입력과 Excel 검증에 바로 반영됩니다."/><div className="organization-grid"><div className="org-list">{companies.map(c=><button key={c} className={selected===c?"active":""} onClick={()=>{setSelected(c);setAdding(false)}}><span className="company-initial">{c.slice(-1)}</span><div><strong>{c}</strong><small>{organizations[c].length}개 사업장</small></div><Icon name="chevron" size={16}/></button>)}</div><div className="site-panel"><div><strong>{selected} 사업장</strong><button className="outline-small" onClick={()=>setAdding(!adding)}><Icon name={adding?"close":"plus"} size={14}/>{adding?"취소":"사업장 추가"}</button></div>{adding&&<div className="inline-add"><input placeholder="새 사업장명" value={newSite} onChange={e=>setNewSite(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSite()}/><button className="primary-button" onClick={addSite}>추가</button></div>}{organizations[selected].map(site=><div className="site-row" key={site}><span><Icon name="building" size={17}/></span><div><strong>{site}</strong><small>사용 중 · 국내 사업장</small></div><button className="icon-row-button danger" onClick={()=>removeSite(site)} aria-label={`${site} 삭제`}><Icon name="trash" size={14}/></button></div>)}</div></div><SettingsFooter onSave={()=>showToast("조직·사업장 설정을 저장했습니다.")}/></>}
function PermissionSettings({showToast}:{showToast:(m:string)=>void}){const [roles,setRoles]=useState([{name:"관리자",desc:"모든 법인 조회·검토·기준정보 관리",members:3,write:true,approve:true},{name:"법인 담당자",desc:"소속 법인 자료 입력·수정·제출",members:12,write:true,approve:false},{name:"조회자",desc:"확정 자료와 대시보드 조회",members:6,write:false,approve:false}]);return <><CardHeader title="권한 관리" subtitle="역할별 화면 접근과 작업 권한을 설계합니다."/><div className="permission-table">{roles.map((r,index)=><div key={r.name}><div><strong>{r.name}</strong><p>{r.desc}</p></div><span>{r.members}명</span><label><input type="checkbox" checked={r.write} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,write:e.target.checked}:x))}/>입력</label><label><input type="checkbox" checked={r.approve} onChange={e=>setRoles(roles.map((x,i)=>i===index?{...x,approve:e.target.checked}:x))}/>확정</label></div>)}</div><div className="server-note"><Icon name="lock" size={17}/>현재는 권한 설계 화면입니다. 실제 사용자별 접근 제한은 사내 로그인·권한 서버 연결 후 적용됩니다.</div><SettingsFooter onSave={()=>showToast("권한 설계안을 저장했습니다.")}/></>}
function DataSettings({onExport,onRestore,showToast}:{onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){const inputRef=useRef<HTMLInputElement>(null);const restore=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()) as Record<string,unknown>;if(window.confirm("현재 브라우저의 운영 데이터를 백업 파일 내용으로 교체하시겠습니까?"))onRestore(parsed);}catch{showToast("백업 파일을 읽을 수 없습니다.");}finally{event.target.value="";}};return <><CardHeader title="운영 데이터 백업" subtitle="기간·활동자료·목표·이행계획·배출계수·증빙·지표·설정을 한 파일로 보관합니다."/><div className="backup-grid"><article><span className="backup-icon"><Icon name="download"/></span><div><strong>전체 데이터 내보내기</strong><p>정기 백업과 다른 PC로의 이관에 사용할 JSON 파일을 생성합니다.</p><button className="primary-button" onClick={onExport}><Icon name="download" size={16}/>백업 파일 저장</button></div></article><article><span className="backup-icon restore"><Icon name="upload"/></span><div><strong>백업 데이터 복원</strong><p>SEMS에서 내보낸 백업 파일로 현재 운영 데이터를 교체합니다.</p><button className="secondary-button" onClick={()=>inputRef.current?.click()}><Icon name="upload" size={16}/>백업 파일 선택</button><input ref={inputRef} type="file" accept=".json" hidden onChange={restore}/></div></article></div><div className="server-note"><Icon name="alert" size={17}/>현재 버전은 브라우저 단위로 저장됩니다. 다중 사용자 공동 운영은 사내 데이터베이스 연결 후 같은 화면 구조를 그대로 사용합니다.</div></>}

*/

function OrganizationSettings({organizations}:{organizations:Record<string,string[]>;onChange:(x:Record<string,string[]>)=>void;showToast:(m:string)=>void}){
  const names=Object.keys(organizations);
  const [selected,setSelected]=useState(names[0]??"");
  const activeSelected=organizations[selected]?selected:names[0]??"";
  return <><CardHeader title="조직·사업장" subtitle="Supabase 기준정보에 등록된 실제 법인·사업장을 표시합니다."/><div className="organization-grid"><div className="org-list">{names.map(name=><button key={name} className={activeSelected===name?"active":""} onClick={()=>setSelected(name)}><span className="company-initial">{name.slice(-1)}</span><div><strong>{name}</strong><small>{organizations[name]?.length??0}개 사업장</small></div><Icon name="chevron" size={16}/></button>)}{!names.length&&<div className="empty-state compact"><Icon name="building"/><strong>등록된 법인이 없습니다.</strong></div>}</div><div className="site-panel"><div><strong>{activeSelected?`${activeSelected} 사업장`:"사업장"}</strong></div>{(organizations[activeSelected]??[]).map(site=><div className="site-row" key={site}><span><Icon name="building" size={17}/></span><div><strong>{site}</strong><small>Supabase 기준정보 · 사용 중</small></div></div>)}{activeSelected&&!(organizations[activeSelected]??[]).length&&<div className="empty-state compact"><strong>등록된 사업장이 없습니다.</strong></div>}</div></div><div className="server-note"><Icon name="lock" size={17}/>조직·사업장 기준정보는 사용자 권한 범위와 연결되므로 Supabase 관리자 기준정보에서 관리합니다.</div></>;
}

function PermissionSettings({showToast}:{showToast:(m:string)=>void}){
  const roles=[{name:"시스템 관리자",desc:"전체 법인 조회·계정·권한·기준정보 관리",write:true,approve:true},{name:"기획실 관리자",desc:"전체 법인 자료 검토·확정·지표 및 목표 관리",write:true,approve:true},{name:"자료 입력자",desc:"소속 법인 자료 입력·수정·제출 및 증빙 등록",write:true,approve:false},{name:"조회자",desc:"소속 법인의 확정 자료와 대시보드 조회",write:false,approve:false}];
  return <><CardHeader title="사용자·권한 관리" subtitle="계정마다 역할과 법인·사업장을 지정해 조회·입력·승인 범위를 제한합니다."/><div className="permission-table">{roles.map(role=><div key={role.name}><div><strong>{role.name}</strong><p>{role.desc}</p></div><span>{role.write?"입력 가능":"조회 전용"}</span><label><input type="checkbox" checked={role.write} readOnly/>입력</label><label><input type="checkbox" checked={role.approve} readOnly/>승인</label></div>)}</div><div className="server-note"><Icon name="lock" size={17}/>권한은 화면 표시뿐 아니라 서버 API와 Supabase 접근 정책에서도 확인합니다.</div><Link className="primary-button settings-link-button" href="/admin/users" onClick={()=>showToast("사용자·권한 관리 화면으로 이동합니다.")}><Icon name="building" size={16}/>사용자 계정 관리</Link></>;
}

function DataSettings({onExport,onRestore,showToast}:{onExport:()=>void;onRestore:(payload:Record<string,unknown>)=>void;showToast:(m:string)=>void}){
  const inputRef=useRef<HTMLInputElement>(null);
  const restore=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()) as Record<string,unknown>;if(window.confirm("Supabase 서버의 운영 데이터를 백업 파일 내용으로 교체하시겠습니까?"))onRestore(parsed);}catch{showToast("백업 파일을 읽을 수 없습니다.");}finally{event.target.value="";}};
  return <><CardHeader title="운영 데이터 백업" subtitle="Supabase에 저장된 기간·활동자료·목표·배출계수·증빙·지표·설정을 파일로 백업하거나 복원합니다."/><div className="backup-grid"><article><span className="backup-icon"><Icon name="download"/></span><div><strong>전체 데이터 내보내기</strong><p>감사 대응과 비상 복구를 위한 JSON 백업 파일을 생성합니다.</p><button className="primary-button" onClick={onExport}><Icon name="download" size={16}/>백업 파일 저장</button></div></article><article><span className="backup-icon restore"><Icon name="upload"/></span><div><strong>서버 데이터 복원</strong><p>SEMS 백업 파일로 현재 권한 범위의 서버 운영 데이터를 교체합니다.</p><button className="secondary-button" onClick={()=>inputRef.current?.click()}><Icon name="upload" size={16}/>백업 파일 선택</button><input ref={inputRef} type="file" accept=".json" hidden onChange={restore}/></div></article></div><div className="server-note"><Icon name="check" size={17}/>운영 데이터는 로그인 계정의 권한 범위에 따라 Supabase 서버에 자동 저장됩니다.</div></>;
}

function Toggle({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><div><strong>{label}</strong>{description&&<p>{description}</p>}</div><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span/></label>}
function SettingsFooter({onSave}:{onSave:()=>void}){return <div className="settings-footer"><span>변경 내용은 로그인 계정의 권한 범위에 따라 Supabase 서버에 저장됩니다.</span><button className="primary-button" onClick={onSave}>변경사항 저장</button></div>}
function FactorForm({factor,onClose,onSave,onDelete}:{factor:EmissionFactor|null;onClose:()=>void;onSave:(f:EmissionFactor)=>void;onDelete?:()=>void}){
  const [form,setForm]=useState<EmissionFactor>(factor??{id:"NEW-FACTOR",scope:"Scope 1",category:"",source:"",value:0,activityUnit:"L",factorUnit:"kgCO₂e/L",year:String(new Date().getFullYear()),authority:"",active:true,factorType:"공식계수",method:"활동량 × 배출계수",reference:"",referenceUrl:"",notes:"",indicatorKind:"배출계수",detailCategory:"",country:"대한민국",validFrom:"",validTo:""});
  const patch=(p:Partial<EmissionFactor>)=>setForm(c=>({...c,...p}));
  return <Overlay title={factor?"배출계수·산정기준 수정":"배출계수 추가"} eyebrow="EMISSION FACTOR" description="계수값과 함께 적용 범위·산식·근거문서를 기록합니다." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(form)}}>
    <div className="form-section"><h3><span>1</span>계수 기본정보</h3><div className="form-grid"><label>Scope<select value={form.scope} onChange={e=>patch({scope:e.target.value as Scope})}><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label><label>지표 구분<select value={form.indicatorKind??"배출계수"} onChange={e=>patch({indicatorKind:e.target.value as EmissionFactor["indicatorKind"]})}><option>열량계수</option><option>지구온난화지수</option><option>산화계수</option><option>배출계수</option></select></label><label>계수 유형<select value={form.factorType??"공식계수"} onChange={e=>patch({factorType:e.target.value as EmissionFactor["factorType"]})}><option>공식계수</option><option>공급자계수</option><option>참고계수</option></select></label><label>활동자료 구분<input value={form.category} onChange={e=>patch({category:e.target.value})} required/></label><label>상세분류<input value={form.detailCategory??""} onChange={e=>patch({detailCategory:e.target.value})} placeholder="연료·온실가스·운송수단 등"/></label><label>배출원·계수명<input value={form.source} onChange={e=>patch({source:e.target.value})} required/></label><label>활동자료 단위<input value={form.activityUnit} onChange={e=>patch({activityUnit:e.target.value,factorUnit:`kgCO₂e/${e.target.value}`})} required/></label><label>계수값<input type="number" min="0" step="any" value={form.value||""} onChange={e=>patch({value:Number(e.target.value)})} required/></label><label>계수 단위<input value={form.factorUnit} onChange={e=>patch({factorUnit:e.target.value})} required/></label><label>기준국가<input value={form.country??""} onChange={e=>patch({country:e.target.value})}/></label><label>적용 연도<input value={form.year} onChange={e=>patch({year:e.target.value})} required/></label></div></div>
    <div className="form-section"><h3><span>2</span>산정방법·기준정보</h3><div className="form-grid"><label className="full-span">산정방법<input value={form.method??""} onChange={e=>patch({method:e.target.value})} placeholder="예: 활동량 × 순발열량 × 탄소배출계수 × 44/12" required/></label><label>적용 시작일<input type="date" value={form.validFrom??""} onChange={e=>patch({validFrom:e.target.value})}/></label><label>적용 종료일<input type="date" value={form.validTo??""} onChange={e=>patch({validTo:e.target.value})}/></label><label>기관·출처<input value={form.authority} onChange={e=>patch({authority:e.target.value})} required/></label><label>근거문서<input value={form.reference??""} onChange={e=>patch({reference:e.target.value})} placeholder="지침·공급자 명세서·EPD 등"/></label><label className="full-span">기준 원문 URL<input type="url" value={form.referenceUrl??""} onChange={e=>patch({referenceUrl:e.target.value})} placeholder="https://"/></label><label className="full-span textarea-label">적용 범위·주의사항<textarea value={form.notes??""} onChange={e=>patch({notes:e.target.value})} placeholder="적용할 활동자료 단위, 조직경계, 연도, 추정 가정 등을 기록해 주세요."/></label><Toggle label="활동자료 입력 시 사용" checked={form.active} onChange={v=>patch({active:v})}/></div></div>
    <div className="modal-footer split">{onDelete?<button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={15}/>삭제</button>:<span/>}<div><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>계수 저장</button></div></div>
  </form></Overlay>;
}

function RecordModal({record,records,periods,factors,criteria,organizations,defaultOwner,defaultDepartment,onClose,onSave}:{record:ActivityRecord|null;records:ActivityRecord[];periods:CollectionPeriod[];factors:EmissionFactor[];criteria:CollectionCriteria;organizations:Record<string,string[]>;defaultOwner:string;defaultDepartment:string;onClose:()=>void;onSave:(r:ActivityRecord)=>void}){
  const editablePeriods=periods.filter(period=>period.status==="수집중"||period.id===record?.collectionId);
  const defaultPeriod=editablePeriods.find(period=>period.status==="수집중")??editablePeriods[0];
  const defaultTask=defaultPeriod?buildGHGCollectionTasks(defaultPeriod)[0]:undefined;
  const defaultScope=defaultTask?.targetId??(defaultPeriod?.scopes.includes("Scope 2")?"Scope 2":defaultPeriod?.scopes[0]??"Scope 1");
  const fallback=factors.find(f=>f.scope===defaultScope&&f.active)??factors.find(f=>f.active)??{id:"UNSET",scope:defaultScope,category:"미등록",source:"배출계수를 먼저 등록하세요",value:0,activityUnit:"",factorUnit:"",year:String(new Date().getFullYear()),authority:"",active:false};
  const defaultCompany=defaultTask?.company??defaultPeriod?.companies[0]??Object.keys(organizations)[0]??"";
  const [form,setForm]=useState<ActivityRecord>(record??{id:0,collectionId:defaultPeriod?.id,company:defaultCompany,site:organizations[defaultCompany]?.[0]??"",period:defaultTask?.period??defaultPeriod?.dataFrom??new Date().toISOString().slice(0,7),scope:fallback.scope,category:fallback.category,source:fallback.source,usage:0,unit:fallback.activityUnit,factor:fallback.value,emissions:0,owner:defaultOwner,department:defaultDepartment,status:"작성중",evidence:"",description:"",active:true,updatedAt:"방금 전"});
  const [error,setError]=useState("");
  const selectedPeriod=periods.find(period=>period.id===form.collectionId);
  const selectedTasks=selectedPeriod?buildGHGCollectionTasks(selectedPeriod):[];
  const availableCompanies=[...new Set(selectedTasks.map(task=>task.company))];
  const availableScopes=[...new Set(selectedTasks.filter(task=>task.company===form.company).map(task=>task.targetId))];
  const availableMonths=[...new Set(selectedTasks.filter(task=>task.company===form.company&&task.targetId===form.scope).map(task=>task.period))];
  const available=factors.filter(f=>f.active&&f.scope===form.scope); const categories=[...new Set(available.map(f=>f.category))]; const sources=available.filter(f=>f.category===form.category); const selected=factors.find(f=>f.scope===form.scope&&f.category===form.category&&f.source===form.source)??null; const patch=(p:Partial<ActivityRecord>)=>setForm(c=>({...c,...p}));
  const applyFactor=(f:EmissionFactor)=>patch({category:f.category,source:f.source,unit:f.activityUnit,factor:f.value});
  const changeScope=(scope:Scope)=>{const first=factors.find(f=>f.active&&f.scope===scope);const period=selectedTasks.find(task=>task.company===form.company&&task.targetId===scope)?.period??form.period;setForm(current=>({...current,period,scope,category:first?.category??current.category,source:first?.source??current.source,unit:first?.activityUnit??current.unit,factor:first?.value??current.factor}));};
  const changeCompany=(company:string)=>{const task=selectedTasks.find(item=>item.company===company);if(!task)return;const first=factors.find(f=>f.active&&f.scope===task.targetId);setForm(current=>({...current,company,site:organizations[company]?.[0]??"",period:task.period,scope:task.targetId,category:first?.category??current.category,source:first?.source??current.source,unit:first?.activityUnit??current.unit,factor:first?.value??current.factor}));};
  const changePeriod=(id:string)=>{const period=periods.find(item=>item.id===id);if(!period)return;const task=buildGHGCollectionTasks(period)[0];if(!task)return;const first=factors.find(f=>f.active&&f.scope===task.targetId);setForm(current=>({...current,collectionId:id,company:task.company,site:organizations[task.company]?.[0]??"",period:task.period,scope:task.targetId,category:first?.category??current.category,source:first?.source??current.source,unit:first?.activityUnit??current.unit,factor:first?.value??current.factor}));};
  const duplicate=records.some(item=>item.id!==form.id&&item.collectionId===form.collectionId&&item.company===form.company&&item.site===form.site&&item.period===form.period&&item.scope===form.scope&&item.category===form.category&&item.source===form.source);
  const previous=records.find(item=>item.company===form.company&&item.site===form.site&&item.scope===form.scope&&item.category===form.category&&item.source===form.source&&item.period===previousMonth(form.period));
  const previousYear=records.find(item=>item.company===form.company&&item.site===form.site&&item.scope===form.scope&&item.category===form.category&&item.source===form.source&&item.period===previousMonth(form.period,1));
  const variance=previous?.usage?(form.usage-previous.usage)/previous.usage*100:null;
  const submit=(e:FormEvent)=>{e.preventDefault();if(!selectedPeriod||selectedPeriod.status!=="수집중"){setError("현재 수집중인 기간을 선택해 주세요.");return;}if(!selectedTasks.some(task=>task.company===form.company&&task.targetId===form.scope&&task.period===form.period)){setError("이 요청에 생성된 세부 수집 항목을 선택해 주세요.");return;}if(!form.usage){setError("사용량을 입력해 주세요.");return;}if(duplicate){setError("같은 사업장·귀속월·활동자료가 이미 등록되어 있습니다.");return;}onSave({...form,status:form.status==="반려"?"작성중":form.status,emissions:Math.round(form.usage*form.factor/1000*100)/100,updatedAt:"방금 전"});};
  if(!editablePeriods.length)return <Overlay title="활동자료 입력 불가" eyebrow="ACTIVITY DATA" description="현재 수집중인 기간이 없습니다." onClose={onClose}><div className="empty-state"><Icon name="calendar"/><strong>수집기간을 먼저 개설해 주세요.</strong><p>수집 기간 메뉴에서 대상과 마감일을 설정한 뒤 수집을 시작할 수 있습니다.</p></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>확인</button></div></Overlay>;
  return <Overlay title={record?"활동자료 수정":"신규 활동자료 입력"} eyebrow="ACTIVITY DATA" description="수집기간과 Scope에 맞는 활동자료·배출계수가 자동 연결됩니다." onClose={onClose}><form onSubmit={submit}>
    <div className="form-section"><h3><span>1</span>수집기간 및 기본 정보</h3><div className="form-grid"><label className="full-span">수집기간<select value={form.collectionId} onChange={e=>changePeriod(e.target.value)}>{editablePeriods.map(period=><option value={period.id} key={period.id}>{period.name} · {period.status}</option>)}</select></label><label>법인<select value={form.company} onChange={e=>changeCompany(e.target.value)}>{availableCompanies.map(c=><option key={c}>{c}</option>)}</select></label><label>사업장<select value={form.site} onChange={e=>patch({site:e.target.value})}>{(organizations[form.company]??[]).map(s=><option key={s}>{s}</option>)}</select></label><label>귀속월<select value={form.period} onChange={e=>patch({period:e.target.value})}>{availableMonths.map(month=><option key={month}>{month}</option>)}</select></label><label>Scope<select value={form.scope} onChange={e=>changeScope(e.target.value as Scope)}>{availableScopes.map(scope=><option key={scope}>{scope}</option>)}</select></label></div></div>
    <div className="scope-context"><span className={`scope-tag s${form.scope.slice(-1)}`}>{form.scope}</span><strong>{form.scope==="Scope 1"?"직접 배출 활동자료":form.scope==="Scope 2"?"구매 에너지 활동자료":"기타 간접 배출 활동자료"}</strong><p>현재 Scope에 해당하는 활동자료만 표시되며 배출계수는 수정할 수 없습니다.</p></div>
    <div className="form-section"><h3><span>2</span>활동자료 및 산정</h3>{available.length?<><div className="form-grid"><label>활동자료 구분<select value={form.category} onChange={e=>{const first=available.find(f=>f.category===e.target.value);if(first)applyFactor(first)}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>배출원<select value={form.source} onChange={e=>{const found=sources.find(f=>f.source===e.target.value);if(found)applyFactor(found)}}>{sources.map(f=><option key={f.id} value={f.source}>{f.source}</option>)}</select></label><label>사용량<div className="input-unit"><input type="number" min="0" step="any" value={form.usage||""} onChange={e=>patch({usage:Number(e.target.value)})} required/><span>{form.unit}</span></div></label><label>단위<input value={form.unit} readOnly className="readonly-input"/></label><label>배출계수<div className="locked-input"><input value={form.factor} readOnly tabIndex={-1}/><Icon name="lock" size={15}/></div><small className="field-help">{selected?.factorType??"운영계수"} · {selected?.year} · {selected?.authority}<br/>{selected?.method??"활동량 × 배출계수"} / 시스템 설정에서만 변경 가능</small></label><div className="calculated-field"><span>예상 배출량</span><strong>{formatNumber(form.usage*form.factor/1000,2)} <small>tCO₂e</small></strong><em>사용량 × 배출계수 ÷ 1,000</em></div></div>{selected?.notes&&<div className="factor-notice compact-notice"><Icon name="alert" size={16}/><p><strong>계수 적용 기준</strong><br/>{selected.notes}</p></div>}<div className="comparison-grid form-comparison"><ComparisonCard label="전월" record={previous} current={{...form,emissions:0}} threshold={criteria.variance}/><ComparisonCard label="전년 동월" record={previousYear} current={{...form,emissions:0}} threshold={criteria.variance}/></div>{variance!==null&&Math.abs(variance)>=criteria.variance&&<p className="form-warning"><Icon name="alert" size={15}/>전월 대비 {formatNumber(Math.abs(variance),1)}% {variance>0?"증가":"감소"}했습니다. 입력 설명에 변동 사유를 남겨 주세요.</p>}{duplicate&&<p className="form-error"><Icon name="alert" size={14}/>같은 조건의 활동자료가 이미 등록되어 있습니다.</p>}</>:<div className="empty-state"><Icon name="alert"/><strong>이 Scope에 사용 가능한 배출계수가 없습니다.</strong><p>시스템 설정 &gt; 배출계수·산정기준에서 계수를 먼저 등록해 주세요.</p></div>}</div>
    <div className="form-section"><h3><span>3</span>증빙 및 담당자</h3><label className="upload-zone"><input type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setError("증빙파일은 20MB 이하만 선택할 수 있습니다.");e.target.value="";return;}setError("");patch({evidence:file.name})}}/><span className="upload-icon"><Icon name="upload"/></span>{form.evidence?<><strong>{form.evidence}</strong><small>원본 파일명과 연결정보가 저장됩니다.</small></>:<><strong>증빙자료가 있으면 선택하세요. (선택)</strong><small>증빙 없이도 저장·제출 가능 · PDF, XLSX, JPG, PNG · 최대 20MB</small></>}</label><div className="form-grid two"><label>담당자<input value={form.owner} onChange={e=>patch({owner:e.target.value})} required/></label><label>담당 부서<input value={form.department} onChange={e=>patch({department:e.target.value})} required/></label><label className="full-span textarea-label">입력 설명·산정 근거<textarea value={form.description??""} onChange={e=>patch({description:e.target.value})} placeholder="원천자료 기준, 전월 대비 변동 사유, 계산 시 가정 등을 적어 주세요."/></label></div>{form.rejectionReason&&<div className="rejection-note"><Icon name="alert" size={16}/><div><strong>이전 보완 요청</strong><p>{form.rejectionReason}</p></div></div>}{error&&<p className="form-error"><Icon name="alert" size={14}/>{error}</p>}</div>
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={!available.length||duplicate}><Icon name="check" size={17}/>{record?"수정사항 저장":"작성 중으로 저장"}</button></div></form></Overlay>;
}
