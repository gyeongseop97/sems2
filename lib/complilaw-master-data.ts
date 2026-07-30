type Scope = "Scope 1" | "Scope 2" | "Scope 3";

export type MasterFactorSeed = {
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
  factorType: "공식계수" | "공급자계수" | "참고계수";
  method: string;
  reference: string;
  referenceUrl: string;
  notes: string;
  indicatorKind?: "열량계수" | "지구온난화지수" | "산화계수" | "배출계수";
  detailCategory?: string;
  country?: string;
};

export type MasterFormulaSeed = {
  id: string;
  code: string;
  name: string;
  scope: Scope;
  expression: string;
  activityUnit: string;
  outputUnit: string;
  factorId: string;
  description: string;
  active: boolean;
  updatedAt: string;
  categoryCode?: string;
  resultLabel?: string;
  variableKeys?: string[];
};

export type MasterScope3FieldSeed = {
  id: string;
  categoryCode: string;
  fieldKey: string;
  nameKr: string;
  nameEn: string;
  inputType: "TEXT" | "NUMBER" | "SELECT" | "DATE" | "UNIT_CODE" | "FILE";
  dataType: "STRING" | "NUMBER" | "DATE";
  unitGroup: string;
  required: boolean;
  sortOrder: number;
  active: boolean;
};

type StandardItemSeed = {
  id: string;
  code: string;
  title: string;
  level: number;
  parentCode: string;
  contents: string;
  risk: "낮음" | "보통" | "높음";
  active: boolean;
};

export type MasterStandardSeed = {
  id: string;
  code: string;
  title: string;
  category: "공시" | "산정" | "평가" | "법정";
  version: string;
  description: string;
  active: boolean;
  items: StandardItemSeed[];
  history: { date: string; contents: string }[];
  updatedAt: string;
  sourceItemCount?: number;
  sourceClassification?: string;
};

export type MasterIndicatorSeed = {
  id: number;
  code: string;
  name: string;
  category: "환경" | "사회" | "지배구조";
  unit: string;
  cycle: string;
  owner: string;
  progress: number;
  active?: boolean;
  source?: string;
};

export type MasterMappingSeed = {
  id: string;
  indicatorCode: string;
  standardId: string;
  standardItemCode: string;
  regulationIds: string[];
  evidenceRequired: boolean;
  owner: string;
  status: "미연결" | "연결완료" | "검토 필요";
  updatedAt: string;
};

export type MasterRegulationSeed = {
  id: string;
  title: string;
  category: string;
  jurisdiction: string;
  contents: string;
  applicability: string;
  owner: string;
  reviewCycleMonths: number;
  lastReviewDate: string;
  nextReviewDate: string;
  status: "검토 필요" | "적용" | "미적용" | "개정 검토";
  tags: string[];
  linkedStandardIds: string[];
  linkedIndicatorCodes: string[];
  evidence: string;
  active: boolean;
  updatedAt: string;
  version?: string;
  sourceItemCount?: number;
  sourceUsedItemCount?: number;
  sourceReviewCount?: string;
};

const IPCC_FUELS = [
  "원유", "오리멀전", "액성 천연가스", "자동차용 가솔린", "항공용 가솔린", "제트용 가솔린",
  "제트용 등유", "기타 등유", "혈암유", "가스/디젤 오일", "B-A유", "B-B유", "잔여 연료유",
  "액화석유가스", "에탄", "나프타", "역청(아스팔트)", "윤활유", "석유 코크스", "정제 원료",
  "정제가스", "접착제(파라핀왁스)", "백유", "기타석유제품", "무연탄", "점결탄(Coking coal)",
  "기타 역청탄", "하위 유연탄", "갈탄", "유혈암 및 역청암", "갈탄 연탄", "특허연료",
  "코크스로 코크스", "가스 코크스", "콜타르", "가스공장 가스", "코크스로 가스", "고로 가스",
  "산소 강철로 가스", "천연가스", "도시 폐기물(비-바이오매스 부분)", "폐유", "토탄",
  "목재/목재 폐기물", "아황산염 잿물", "기타 고체바이오매스", "목탄", "바이오 가솔린",
  "바이오 디젤", "기타 액체바이오연료", "매립지 가스", "슬러지 가스", "기타 바이오가스",
  "도시 폐기물(바이오매스부분)",
];

const NATIONAL_FUELS = [
  "휘발유", "등유", "경유", "B-A유", "B-B유", "B-C유", "나프타", "용제", "항공유(JET-A1)",
  "아스팔트", "석유코크스", "윤활유", "부생연료 1호", "부생연료 2호", "프로판(LPG1호)",
  "부탄(LPG3호)", "천연가스(LNG)", "도시가스(LNG)", "도시가스(LPG)", "국내무연탄",
  "수입무연탄(연료용)", "수입무연탄(원료용)", "유연탄(연료용)", "유연탄(원료용)", "아역청탄",
];

function detailCategory(name: string) {
  if (/가스|LNG/.test(name)) return "가스";
  if (/탄|코크스|콜타르/.test(name)) return "석탄";
  if (/바이오|목재|목탄|슬러지|매립지/.test(name)) return "바이오매스";
  if (/폐기물|폐유|토탄/.test(name)) return "기타화석연료";
  return "석유";
}

function factorSeed(
  id: string,
  source: string,
  indicatorKind: MasterFactorSeed["indicatorKind"],
  options: Partial<MasterFactorSeed> = {},
): MasterFactorSeed {
  return {
    id,
    scope: "Scope 1",
    category: indicatorKind === "지구온난화지수" ? "온실가스" : "연료",
    source,
    value: 0,
    activityUnit: indicatorKind === "열량계수" ? "원자료 단위" : "활동자료 단위",
    factorUnit: indicatorKind === "열량계수" ? "원본 기준단위" : "원본 배출계수 단위",
    year: "Complilaw 기준정보",
    authority: "Complilaw 마스터",
    active: false,
    factorType: "참고계수",
    method: "원본 마스터의 상세값·단위를 확인한 뒤 산정식에 연결",
    reference: "Complilaw OCF 기준정보",
    referenceUrl: "",
    notes: "마스터 목록은 동기화했지만 0 또는 상세값 미노출 항목은 계산에 사용되지 않도록 비활성화했습니다.",
    indicatorKind,
    detailCategory: detailCategory(source),
    country: "대한민국",
    ...options,
  };
}

const HEAT_FACTOR_NAMES = [
  "2006IPCC_액화석유가스(LPG)_순발열량",
  "2006IPCC_자동차용 가솔린(휘발유)_순발열량",
  "테스트 열량계수 (Scope1)",
  ...IPCC_FUELS.slice(34).map((name) => `2006IPCC_${name}`),
  ...NATIONAL_FUELS.map((name) => `국가고유_${name}`),
  "전기(발전기준)",
  "전기(소비기준)",
  ...IPCC_FUELS.slice(0, 34).map((name) => `2006IPCC_${name}`),
];

const EXTRA_INDICATORS: Array<[MasterFactorSeed["indicatorKind"], string]> = [
  ["배출계수", "수소_배출계수"],
  ["지구온난화지수", "과불화탄소 (PFCs)"],
  ["산화계수", "산화계수_Tier1_1.0"],
  ["산화계수", "산화계수_Tier2_0.99"],
  ["배출계수", "테스트 배출계수 (Scope1)"],
  ["배출계수", "테스트 배출계수 (Scope2)"],
  ["지구온난화지수", "테스트 지구온난화지수 CH4"],
  ["지구온난화지수", "테스트 지구온난화지수 N2O"],
  ["배출계수", "국가고유_열·스팀(평균)_종합 배출계수"],
  ["지구온난화지수", "지구온난화지수_아산화질소(N2O)_310"],
  ["지구온난화지수", "지구온난화지수_메탄(CH4)_21"],
  ["지구온난화지수", "지구온난화지수_이산화탄소(CO2)_1"],
  ["배출계수", "국가고유_전력(평균)_종합 배출계수"],
  ["배출계수", "2006IPCC_자동차용 가솔린(휘발유)_아산화질소(N2O)"],
  ["배출계수", "2006IPCC_자동차용 가솔린(휘발유)_메탄(CH4)"],
  ["배출계수", "2006IPCC_자동차용 가솔린(휘발유)_이산화탄소(CO2)"],
  ["배출계수", "2006IPCC_액화석유가스(LPG)_아산화질소(N2O)"],
  ["배출계수", "2006IPCC_액화석유가스(LPG)_메탄(CH4)"],
  ["배출계수", "2006IPCC_액화석유가스(LPG)_이산화탄소(CO2)"],
];

const SYSTEM_EMISSION_NAMES = [
  ["지구온난화지수", "온실가스_이산화탄소"],
  ["지구온난화지수", "온실가스_메탄"],
  ["지구온난화지수", "온실가스_아산화질소"],
  ["배출계수", "전기(발전기준) - 전력평균"],
  ["배출계수", "전기(소비기준) - 전력평균"],
  ...IPCC_FUELS.map((name) => ["배출계수", `2006IPCC_${name}`]),
  ...NATIONAL_FUELS.map((name) => ["배출계수", `국가고유_${name}`]),
] as Array<[MasterFactorSeed["indicatorKind"], string]>;

export const COMPLILAW_SCOPE12_INDICATORS: MasterFactorSeed[] = [
  ...HEAT_FACTOR_NAMES.map((name, index) => factorSeed(
    `CL-EI-HEAT-${String(index + 1).padStart(3, "0")}`,
    name,
    "열량계수",
    name === "2006IPCC_액화석유가스(LPG)_순발열량"
      ? { value: 47.3, factorUnit: "10⁻³ toe", notes: "Complilaw 상세 화면에서 확인된 값 47.3. 산정식 적용 전 활동단위 환산 검토가 필요합니다." }
      : {},
  )),
  ...EXTRA_INDICATORS.map(([kind, name], index) => factorSeed(`CL-EI-EXTRA-${String(index + 1).padStart(3, "0")}`, name, kind)),
  ...SYSTEM_EMISSION_NAMES.map(([kind, name], index) => factorSeed(`CL-EI-SYS-${String(index + 1).padStart(3, "0")}`, name, kind)),
];

const CUSTOM_SCOPE12_FORMULAS: Array<[string, string, Scope]> = [
  ["hydrogen01", "수소_계산식", "Scope 1"],
  ["gbh001", "과불화탄소-공정특이배출계산식", "Scope 1"],
  ["arum001", "알루미늄 탄소배출량", "Scope 1"],
  ["test05", "테스트 계산식 (Scope1)", "Scope 1"],
  ["test09", "테스트 계산식 (Scope2)", "Scope 2"],
  ["004", "국가고유_열·스팀(평균)_종합", "Scope 2"],
  ["003", "국가고유_전력(평균)_종합", "Scope 2"],
  ["001", "2006IPCC_액화석유가스(LPG)", "Scope 1"],
  ["002", "2006IPCC_자동차용 가솔린(휘발유)", "Scope 1"],
];

const SYSTEM_FORMULA_NAMES = [
  ...IPCC_FUELS.map((name) => `2006IPCC_${name}_온실가스배출량`),
  ...NATIONAL_FUELS.map((name) => `국가고유_${name}_온실가스배출량`),
];

export const COMPLILAW_SCOPE12_FORMULAS: MasterFormulaSeed[] = [
  ...CUSTOM_SCOPE12_FORMULAS.map(([code, name, scope]) => ({
    id: `CL-FORM-${code}`,
    code,
    name,
    scope,
    expression: scope === "Scope 2"
      ? "사용량 × 적용 배출계수"
      : "사용량 × 열량계수-순발열량 × 배출계수-CO₂ ÷ 10,000,000",
    activityUnit: "원본 활동자료 단위",
    outputUnit: "tCO₂",
    factorId: "",
    description: "Complilaw 계산식 마스터에서 동기화",
    active: !name.includes("테스트"),
    updatedAt: "Complilaw 동기화",
  })),
  ...SYSTEM_FORMULA_NAMES.map((name, index) => ({
    id: `CL-FORM-SYSCAL${String(index + 1).padStart(4, "0")}`,
    code: `SYSCAL${String(index + 1).padStart(4, "0")}`,
    name,
    scope: "Scope 1" as Scope,
    expression: "사용량 × 열량계수-순발열량 × 배출계수-이산화탄소(CO₂) ÷ 10,000,000",
    activityUnit: "연료 사용단위",
    outputUnit: "tCO₂",
    factorId: "",
    description: "연료별 열량계수와 CO₂ 배출계수를 연결하는 Complilaw 시스템 산정식",
    active: true,
    updatedAt: "Complilaw 동기화",
    variableKeys: ["activity", "netCalorificValue", "co2Factor"],
  })),
];

type FieldTuple = [
  code: string,
  name: string,
  inputType: MasterScope3FieldSeed["inputType"],
  required: boolean,
  order: number,
  unitGroup?: string,
];

const SCOPE3_FIELD_ROWS: Record<string, FieldTuple[]> = {
  "Cat.1": [
    ["CAT1_0001", "자재코드", "TEXT", true, 1], ["CAT1_0002", "자재명", "TEXT", true, 2],
    ["CAT1_0003", "단위", "SELECT", true, 3, "PCFMATUNIT"], ["CAT1_0004", "수량", "NUMBER", true, 4],
    ["CAT1_0005", "금액", "NUMBER", true, 5], ["CAT1_0006", "금액단위", "UNIT_CODE", true, 6, "CURR"],
    ["CAT1_0007", "첨부파일", "FILE", false, 7], ["CAT1_0008", "상품/서비스 기준 배출계수", "UNIT_CODE", true, 8, "EMISSION_FACTOR"],
  ],
  "Cat.2": [["CAT2_0005", "상품/서비스 기준 배출계수", "UNIT_CODE", true, 1, "EMISSION_FACTOR"]],
  "Cat.3": [
    ["CAT3_0001", "연료구분", "TEXT", true, 1], ["CAT3_0002", "사용량", "NUMBER", true, 2],
    ["CAT3_0003", "사용단위", "TEXT", true, 3], ["CAT3_0004", "근거자료", "FILE", true, 5],
    ["CAT3_0005", "연료 업스트림 배출계수", "UNIT_CODE", true, 6, "EFTYPE"],
  ],
  "Cat.4": [
    ["CAT4_0001", "출발지", "TEXT", true, 1], ["CAT4_0008", "선적일자", "DATE", false, 2],
    ["CAT4_0002", "도착지", "TEXT", true, 3], ["CAT4_0003", "운송거리", "NUMBER", true, 4],
    ["CAT4_0004", "운송거리 단위", "UNIT_CODE", true, 5, "CFUDIST"], ["CAT4_0005", "운송량", "NUMBER", true, 6],
    ["CAT4_0006", "운송량 단위", "UNIT_CODE", true, 7, "WTUNIT"], ["CAT4_0009", "운행횟수", "NUMBER", false, 8],
    ["CAT4_0007", "운송수단", "UNIT_CODE", true, 9, "CFSHTYPE"],
  ],
  "Cat.5": [
    ["CAT5_0001", "처리방법", "TEXT", true, 11], ["CAT5_0002", "폐기물 대분류", "TEXT", true, 12],
    ["CAT5_0003", "폐기물 상세분류", "TEXT", true, 13], ["CAT5_0004", "폐기물 발생량(ton)", "NUMBER", true, 14],
    ["CAT5_0005", "근거자료", "FILE", false, 15], ["CAT5_00014", "폐기물 종류와 처리방식에 따른 배출계수", "UNIT_CODE", true, 16, "GRBTYPE"],
  ],
  "Cat.6": [
    ["CAT6_0001", "이동거리", "NUMBER", true, 11], ["CAT6_0002", "배출량", "NUMBER", true, 12],
    ["CAT6_0003", "연료의 사용량", "NUMBER", true, 13], ["CAT6_0005", "근거자료", "FILE", false, 15],
    ["CAT6_0006", "운송수단별 배출계수", "UNIT_CODE", true, 16, "CFSHTYPE"],
  ],
  "Cat.7": [
    ["CAT7_0001", "사업장", "TEXT", true, 1], ["CAT7_0002", "노선명", "TEXT", true, 2],
    ["CAT7_0003", "회사명(버스)", "TEXT", true, 3], ["CAT7_0004", "편도 이동거리(km)", "NUMBER", true, 4],
    ["CAT7_0005", "월간운행회수(회)", "NUMBER", true, 5], ["CAT7_0006", "소유형태", "TEXT", true, 6],
    ["CAT7_0007", "운행용도", "TEXT", true, 7], ["CAT7_0008", "거리산출근거", "TEXT", true, 8],
    ["CAT7_0009", "전체운송거리(km)", "NUMBER", true, 9], ["CAT7_0010", "운송수단", "UNIT_CODE", true, 10, "CHGTYPE"],
  ],
  "Cat.8": [
    ["CAT8_0001", "자산분류", "TEXT", true, 1], ["CAT8_0002", "자산면적", "TEXT", true, 2],
    ["CAT8_0003", "자산수", "NUMBER", true, 3], ["CAT8_0010", "유형에 따른 배출계수", "UNIT_CODE", true, 10, "IMDATYPE"],
  ],
  "Cat.9": [
    ["CATE9_0002", "출발지", "TEXT", true, 1], ["CATE9_0004", "도착지", "TEXT", true, 2],
    ["CATE9_0008", "운송거리", "NUMBER", true, 3], ["CATE9_0009", "운송거리 단위", "UNIT_CODE", true, 4, "CFUDIST"],
    ["CATE9_0005", "운송량", "NUMBER", true, 5], ["CATE9_0006", "운송량 단위", "UNIT_CODE", true, 6, "WTUNIT"],
    ["CATE9_0001", "운송수단", "UNIT_CODE", true, 7, "CFSHTYPE"],
  ],
  "Cat.10": [
    ["CATE10_0004", "제품분류", "TEXT", true, 1], ["CATE10_0002", "제품질량", "NUMBER", true, 2],
    ["CATE10_0003", "제품질량 단위", "UNIT_CODE", true, 3, "WTUNIT"], ["CATE10_0001", "제품가공 배출계수", "UNIT_CODE", true, 4, "GAGOTYPE"],
  ],
  "Cat.11": [
    ["CATE11_0004", "연료분류", "TEXT", true, 1], ["CATE11_0002", "사용횟수", "NUMBER", true, 2],
    ["CATE11_0003", "판매량", "NUMBER", true, 3], ["CATE11_0005", "함유량", "NUMBER", true, 4],
    ["CATE11_0001", "연소배출계수", "UNIT_CODE", true, 5, "PRDCTYPE"],
  ],
  "Cat.12": [
    ["CATE12_0004", "제품분류", "TEXT", true, 1], ["CATE12_0002", "제품의 양", "NUMBER", true, 2],
    ["CATE12_0003", "비율", "NUMBER", true, 3], ["CATE12_0001", "폐기방식에 따른 배출계수", "UNIT_CODE", true, 4, "PEGYTYPE"],
  ],
  "Cat.13": [
    ["CAT13_0002", "면적", "NUMBER", true, 1], ["CAT13_0003", "수량", "NUMBER", true, 2],
    ["CAT13_0004", "사용량", "NUMBER", true, 3], ["CAT13_0010", "유형에 따른 배출계수", "UNIT_CODE", true, 10, "HIMDATYPE"],
  ],
  "Cat.14": [
    ["CAT14_0001", "건물 면적", "TEXT", true, 1], ["CAT14_0002", "건물/자산의 수", "NUMBER", true, 2],
    ["CAT14_0010", "건물유형 배출계수", "UNIT_CODE", true, 10, "FRCTYPE"],
  ],
  "Cat.15": [
    ["CAT15_0001", "총수익", "NUMBER", true, 1], ["CAT15_0002", "점유율", "NUMBER", true, 2],
    ["CAT15_0020", "투자기업 배출량", "UNIT_CODE", true, 20, "INVESTMENT"],
  ],
};

export const COMPLILAW_SCOPE3_FIELDS: MasterScope3FieldSeed[] = Object.entries(SCOPE3_FIELD_ROWS).flatMap(
  ([categoryCode, rows]) => rows.map(([code, name, inputType, required, sortOrder, unitGroup = ""]) => ({
    id: `CL-S3-FIELD-${code}`,
    categoryCode,
    fieldKey: code,
    nameKr: name,
    nameEn: name,
    inputType,
    dataType: inputType === "NUMBER" ? "NUMBER" : inputType === "DATE" ? "DATE" : "STRING",
    unitGroup,
    required,
    sortOrder,
    active: true,
  })),
);

const SCOPE3_FACTOR_GROUPS: Record<string, Record<string, string[]>> = {
  "Cat.3": { 전력: ["국내 전력", "해외 전력", "송배전 손실"], 연료: ["LNG", "경유", "휘발유", "LPG"], "열/스팀": ["지역난방", "외부 스팀"] },
  "Cat.4": { 도로: ["경형/소형트럭(1~4.5톤)", "중형트럭(5톤~11톤)", "대형트럭 (12톤 이상)"], 철도: ["디젤 기관차", "전기 기관차"], 해상: ["컨테이너선", "벌크선", "탱커선", "냉동/냉장선"], 항공: ["화물기", "여객기"] },
  "Cat.5": { 매립: ["일반폐기물 매립", "지정(유해)폐기물 매립"], 소각: ["일반폐기물 소각", "지정(유해)폐기물 소각", "에너지회수(RDF/열회수) 소각"], 재활용: ["물질재활용", "에너지회수(연료화 등)재활용"], "퇴비화/생물": ["음식물/유기성 폐기물 퇴비화", "혐기성 소화(바이오가스)"], "하폐수/슬러지": ["하수처리(방류)", "슬러지처리(소각/건조/매립 등)"] },
  "Cat.6": { 도로: ["경형/소형트럭(1~4.5톤)", "중형트럭(5톤~11톤)", "대형트럭 (12톤 이상)"], 철도: ["디젤 기관차", "전기 기관차"], 해상: ["컨테이너선", "벌크선", "탱커선", "냉동/냉장선"], 항공: ["화물기", "여객기"] },
  "Cat.7": { 자가용: ["가솔린", "디젤", "하이브리드", "전기차(EV)"], 대중교통: ["버스", "지하철", "철도", "광역/시외버스"], "도보/자전거": ["도보", "자전거"], 기타: ["회사 통근버스", "카풀", "기타"] },
  "Cat.8": { 건물: ["사무실", "공장", "창고", "연구시설"], "설비/장비": ["생산설비", "IT장비", "기타설비"], 차량: ["승용차", "화물차", "특수차량"], "기타 자산": ["데이터센터", "기타"] },
  "Cat.9": { 도로: ["경형/소형트럭(1~4.5톤)", "중형트럭(5톤~11톤)", "대형트럭 (12톤 이상)"], 철도: ["디젤 기관차", "전기 기관차"], 해상: ["컨테이너선", "벌크선", "탱커선", "냉동/냉장선"], 항공: ["화물기", "여객기"] },
  "Cat.10": { 금속가공: ["절단", "프레스", "용접", "표면처리"], 화학가공: ["반응공정", "증류/정제", "혼합"], 기계가공: ["사출성형", "압출", "성형"], "전자/반도체": ["식각", "증창", "패키징"], "기타 제조": ["조립", "열처리"] },
  "Cat.11": { "에너지 사용 제품": ["가전제품", "IT장비", "산업기기", "조명제품"], "연료/연소": ["차량", "보일러", "발전설비", "연료판매(휘발유/경유 등)"], "냉매/가스": ["에어컨", "냉장설비", "산업용가스"], 기타: ["소비재", "특수제품"] },
  "Cat.12": { 매립: ["일반매립", "유해폐기물 매립"], 소각: ["일반소각", "에너지회수 소각", "유해폐기물 소각"], 재활용: ["물질재활용", "금속회수", "플라스틱 재활용"], 생물: ["퇴비화", "혐기성소화"], 기타: ["전자폐기물 특수처리", "배터리 재처리"] },
  "Cat.13": { 건물: ["사무실", "상업시설", "공장", "창고"], 차량: ["승용차", "화물차", "전기차", "특수차량"], 설비: ["산업설비", "생산라인", "특수장비"], IT: ["서버장비", "랙공간임대", "클라우드인프라"], 기타: ["농기계", "기타"] },
  "Cat.14": { 소매점: ["편의점", "의류매장", "전문소매점"], 음식점: ["카페", "패스트푸드", "레스토랑"], 서비스: ["교육시설", "헬스장", "미용/뷰티"], "유통/물류": ["지역물류센터", "배송거점"], "기타 영업점": ["딜러점", "기타"] },
  "Cat.15": { 상장주식: ["국내 상장사", "해외 상장사"], 비상장: ["자회사", "관계회사", "벤처투자"], 채권: ["회사채", "국채", "금융채"], PF: ["발전소", "인프라", "부동산 개발"], 펀드: ["사모펀드", "공모펀드", "ESG펀드"], "기타 투자": ["파생상품", "기타"] },
};

export const COMPLILAW_SCOPE3_FACTORS: MasterFactorSeed[] = Object.entries(SCOPE3_FACTOR_GROUPS).flatMap(
  ([category, groups]) => Object.entries(groups).flatMap(([group, names]) => names.map((name, index) => factorSeed(
    `CL-S3-EF-${category.replace("Cat.", "").padStart(2, "0")}-${group}-${index + 1}`,
    name,
    "배출계수",
    {
      scope: "Scope 3",
      category,
      detailCategory: group,
      activityUnit: "t",
      factorUnit: "kgN₂O/t",
      value: 0,
      active: false,
      notes: "Complilaw 원본 값이 0으로 등록된 항목입니다. 유효 계수 입력·승인 전에는 산정에 사용되지 않습니다.",
    },
  ))),
);

const SCOPE3_FORMULAS: Array<[string, string, string, string]> = [
  ["CAT01CALC", "Cat.1", "평균 산정법", "수량 또는 구매금액 × 상품/서비스 기준 배출계수"],
  ["CAT4CALCA", "Cat.4", "운송수단별 배출량 산정법", "운송수단별 활동량 × 운송수단별 배출계수"],
  ["CAT03CALC", "Cat.3", "구매한 연료 산정법", "연료 사용량 × 연료 업스트림 배출계수"],
  ["CAT04CALC", "Cat.4", "거리 기반 산정법", "운송거리 × 운송량 × 운행횟수 × 운송수단별 배출계수"],
  ["CAT05CALC", "Cat.5", "폐기물 종류 기반 산정법", "폐기물 발생량 × 처리방식별 배출계수"],
  ["CAT15CALC", "Cat.15", "평균 산정법", "투자기업 배출량 × 점유율"],
  ["CAT14CALC", "Cat.14", "평균 산정법", "건물 면적 또는 자산 수 × 건물유형 배출계수"],
  ["CAT13CALC", "Cat.13", "평균 산정법", "면적·수량·사용량 × 유형별 배출계수"],
  ["CAT12CALC", "Cat.12", "폐기물 기반 산정법", "제품의 양 × 폐기비율 × 폐기방식별 배출계수"],
  ["CAT11CALC", "Cat.11", "연료 및 원료 산정법", "판매량 × 사용횟수 × 함유량 × 연소배출계수"],
  ["CAT06CALC", "Cat.6", "거리 기반 산정법", "이동거리 또는 연료 사용량 × 운송수단별 배출계수"],
  ["CAT10CALC", "Cat.10", "평균 산정법", "제품질량 × 제품가공 배출계수"],
  ["CAT09CALC", "Cat.9", "거리 기반 산정법", "운송거리 × 운송량 × 운송수단별 배출계수"],
  ["CAT08CALC", "Cat.8", "평균 산정법", "자산면적 또는 자산 수 × 유형별 배출계수"],
  ["CAT07CALC", "Cat.7", "거리 기반 산정법", "전체운송거리 × 운송수단별 배출계수"],
];

export const COMPLILAW_SCOPE3_FORMULAS: MasterFormulaSeed[] = SCOPE3_FORMULAS.map(([code, categoryCode, name, expression]) => ({
  id: `CL-FORM-${code}`,
  code,
  name,
  scope: "Scope 3",
  expression,
  activityUnit: "카테고리 입력항목 단위",
  outputUnit: "tCO₂e",
  factorId: "",
  description: `Complilaw ${categoryCode} 산정식 마스터`,
  active: true,
  updatedAt: "Complilaw 동기화",
  categoryCode,
  resultLabel: "탄소배출량",
}));

function standardItem(
  standard: string,
  code: string,
  title: string,
  parentCode = "",
  level = parentCode ? 2 : 1,
  contents = "",
): StandardItemSeed {
  return {
    id: `${standard}-${code}`,
    code,
    title,
    level,
    parentCode,
    contents,
    risk: /배출|기후|법률|규정|안전|부패/.test(title) ? "높음" : "보통",
    active: true,
  };
}

const GRI_ITEMS = [
  standardItem("GRI", "2", "GRI 2: 일반 공시 2021"),
  ...[
    "조직 정보", "조직의 지속가능성 보고에 포함된 법인", "보고기간, 빈도 및 문의처", "정보의 재기술", "외부 검증",
    "활동, 가치사슬 및 기타 비즈니스 관계", "직원", "직원이 아닌 근로자", "거버넌스 구조 및 구성",
    "최상위 거버넌스 기구의 임명 및 선정", "최상위 거버넌스 기구의 의장",
    "영향 관리에 대해 감독하는 최상위 거버넌스 기구의 역할", "영향 관리에 대한 책임 위임",
    "지속가능성 보고에서 최상위 거버넌스 기구의 역할", "이해관계 상충", "중요 사안에 대한 커뮤니케이션",
    "최상위 거버넌스 기구의 집단지식", "최상위 거버넌스 기구의 성과 평가", "보수 정책", "보수 결정 절차",
    "연간 총 보상 비율", "지속가능발전 전략에 관한 성명서", "정책 선언", "정책 선언의 내재화",
    "부정적인 영향을 해소하기 위한 프로세스", "고충 제기 및 자문 요청 메커니즘", "법률 및 규정 준수",
    "가입 협회", "이해관계자 참여 방식", "단체교섭협약",
  ].map((title, index) => standardItem("GRI", `2.${index + 1}`, `2-${index + 1} ${title}`, "2")),
  standardItem("GRI", "3", "GRI 3: 중요 주제 2021"),
  standardItem("GRI", "3.1", "3-1 중요 주제 결정 프로세스", "3"),
  standardItem("GRI", "3.2", "3-2 중요 주제 목록", "3"),
  standardItem("GRI", "3.3", "3-3 중요 주제 관리", "3"),
  standardItem("GRI", "4", "GRI 305: 배출 2016"),
  standardItem("GRI", "4.1", "305-1 직접 온실가스 배출량(Scope 1)", "4"),
  standardItem("GRI", "4.2", "305-2 간접 온실가스 배출량(Scope 2)", "4"),
  standardItem("GRI", "4.3", "305-3 기타 간접 온실가스 배출량(Scope 3)", "4"),
];

const KSSB_ITEMS = [
  standardItem("KSSB", "2", "제2호: 기후 관련 공시사항"),
  standardItem("KSSB", "2.1", "목적", "2"), standardItem("KSSB", "2.2", "적용범위", "2"),
  standardItem("KSSB", "2.3", "핵심요소", "2"),
  ...["거버넌스", "전략", "기후 관련 위험 및 기회", "사업모형 및 가치사슬", "전략 및 의사결정",
    "재무상태, 재무성과 및 현금흐름", "기후 회복력", "위험관리", "지표 및 목표", "기후 관련 지표",
    "기후 관련 목표"].map((title, index) => standardItem("KSSB", `2.3.${index + 1}`, title, "2.3", 3)),
  standardItem("KSSB", "2.4", "부록 A. 용어의 정의", "2"),
  standardItem("KSSB", "2.5", "부록 B. 적용지침", "2"),
  standardItem("KSSB", "2.6", "부록 C. 시행일 및 경과규정", "2"),
  standardItem("KSSB", "3", "제101호: 정책 목적을 고려한 추가 공시사항"),
];

const ESRS_SECTIONS: Array<[string, string, string, string]> = [
  ["2", "ESRS 2 일반 공시", "SBM-1 시장 여건·사업전략·사업모델·가치사슬", "SBM-2 이해관계자 의견 수렴·반영"],
  ["3", "E1 기후변화", "E1-5 에너지원별 사용량 및 에너지 집약도", "E1-6 Scope 1·2·3 및 총 온실가스 배출량·집약도"],
  ["4", "E2 오염", "E2-1 환경오염 예방 및 통제 정책", "E2-2 환경오염 예방 및 통제 계획·자원·예산"],
  ["5", "E3 수자원 및 해양자원", "E3-1 수자원 및 해양자원 보호·관리 정책", "E3-2 수자원 및 해양자원 계획·자원·예산"],
  ["6", "E4 생물다양성 및 생태계", "E4-1 생물다양성·생태계 복원 전환 로드맵", "E4-2 생물다양성·생태계 복원 정책"],
  ["7", "E5 자원사용 및 순환경제", "E5-1 자원사용·순환경제 정책", "E5-2 자원사용·순환경제 계획·자원·예산"],
  ["8", "S1 자사 근로자", "S1-1 근로자 노동·인권 정책", "S1-2 노동자 및 대표와의 소통 프로세스"],
  ["9", "S2 가치사슬 내 근로자", "S2-1 가치사슬 근로자 노동·인권 정책", "S2-2 근로자·대표 협의 절차"],
  ["10", "S3 영향 받는 지역사회", "S3-1 지역사회 환경·안전·보건·인권 정책", "S3-2 지역사회 소통 절차"],
  ["11", "S4 소비자 및 최종 사용자", "S4-1 고객·소비자 권리존중 및 피해보상 정책", "S4-2 고객·소비자 소통 절차"],
  ["12", "G1 비즈니스 수행", "G1-1 윤리경영 선언·책임·윤리헌장", "G1-2 공정거래·상생결제·협력사 ESG 실사"],
];
const ESRS_ITEMS = ESRS_SECTIONS.flatMap(([code, title, first, second]) => [
  standardItem("ESRS", code, title),
  standardItem("ESRS", `${code}.1`, first, code),
  standardItem("ESRS", `${code}.2`, second, code),
]);

const REPORT_OUTLINE_ITEMS = [
  ["1", "환경 Environmental", "기후변화", "수자원·폐기물"],
  ["2", "사회 Social", "임직원", "안전보건"],
  ["3", "지배구조 Governance", "이사회", "윤리·준법 경영"],
  ["4", "경제 Economic", "주요 실적 및 목표", "재무 성과"],
].flatMap(([code, title, first, second]) => [
  standardItem("OUTLINE", code, title),
  standardItem("OUTLINE", `${code}.1`, first, code),
  standardItem("OUTLINE", `${code}.2`, second, code),
]);

export const COMPLILAW_DISCLOSURE_STANDARDS: MasterStandardSeed[] = [
  { id: "CL-STD-GRI", code: "GRI", title: "GRI 보고기준", category: "공시", version: "2021", description: "Complilaw 보고 기준 관리의 GRI 39개 사용 항목", active: true, items: GRI_ITEMS, history: [{ date: "2026-01-28", contents: "Complilaw 기준정보 동기화" }], updatedAt: "2026-01-28", sourceItemCount: 39, sourceClassification: "이니셔티브" },
  { id: "CL-STD-KSSB", code: "KSSB", title: "KSSB 보고기준", category: "법정", version: "제2호", description: "기후 관련 공시사항 및 추가 공시사항", active: true, items: KSSB_ITEMS, history: [{ date: "2025-11-11", contents: "Complilaw 기준정보 동기화" }], updatedAt: "2025-11-11", sourceItemCount: 19, sourceClassification: "규제" },
  { id: "CL-STD-ESRS", code: "ESRS", title: "ESRS 보고기준", category: "법정", version: "1.0", description: "ESRS 2, E1~E5, S1~S4, G1의 33개 사용 항목", active: true, items: ESRS_ITEMS, history: [{ date: "2025-11-11", contents: "Complilaw 기준정보 동기화" }], updatedAt: "2025-11-11", sourceItemCount: 33, sourceClassification: "규제" },
  { id: "CL-STD-OUTLINE", code: "DISCLOSURE-OUTLINE", title: "공시 보고서 목차", category: "공시", version: "2025", description: "환경·사회·지배구조·경제 보고서 기본 목차", active: true, items: REPORT_OUTLINE_ITEMS, history: [{ date: "2025-11-11", contents: "Complilaw 기준정보 동기화" }], updatedAt: "2025-11-11", sourceItemCount: 12, sourceClassification: "내부기준" },
  { id: "CL-STD-PCF-TEST", code: "PCF-TEST", title: "PCF TEST", category: "평가", version: "1.0", description: "Complilaw 테스트 기준. 운영 공시에는 사용하지 않습니다.", active: false, items: [], history: [{ date: "2025-11-07", contents: "원본 테스트 데이터 동기화" }], updatedAt: "2025-11-07", sourceItemCount: 150, sourceClassification: "규제" },
  { id: "CL-STD-TEST-OUTLINE", code: "TEST-OUTLINE", title: "test목차", category: "공시", version: "2026", description: "Complilaw 테스트 목차. 운영 공시에는 사용하지 않습니다.", active: false, items: [], history: [{ date: "2026-07-29", contents: "원본 테스트 데이터 동기화" }], updatedAt: "2026-07-29", sourceItemCount: 9, sourceClassification: "내부기준" },
];

export const COMPLILAW_QUANTITATIVE_INDICATORS: MasterIndicatorSeed[] = [
  [10001, "ENV-GHG-S1", "온실가스 배출량(Scope 1)", "환경", "tCO₂e", "환경안전"],
  [10002, "ENV-GHG-S2", "온실가스 배출량(Scope 2)", "환경", "tCO₂e", "환경안전"],
  [10003, "ENV-GHG-S3", "온실가스 배출량(Scope 3)", "환경", "tCO₂e", "ESG"],
  [10004, "ENV-ENERGY", "에너지 소비량", "환경", "MWh", "환경안전"],
  [10005, "ENV-WASTE", "폐기물 발생량", "환경", "t", "환경안전"],
  [10006, "ENV-WATER", "용수 취수량", "환경", "m³", "환경안전"],
  [10007, "SOC-HIRES", "신규 채용 직원 수", "사회", "명", "인사"],
  [10008, "SOC-EMPLOYEES", "총 임직원 수", "사회", "명", "인사"],
  [10009, "SOC-INCIDENTS", "산업재해 사고 건수", "사회", "건", "안전보건"],
  [10010, "SOC-DISABILITY", "장애인 고용률", "사회", "%", "인사"],
  [10011, "GOV-WOMEN-BOARD", "이사회 여성 임원 비율", "지배구조", "%", "이사회사무국"],
  [10012, "GOV-CORRUPTION-SITES", "부패 리스크 평가 수행 사업장 수", "지배구조", "개", "준법"],
  [10013, "GOV-ANTI-CORRUPTION-TRAINING", "반부패 교육 이수 인원 수", "지배구조", "명", "준법"],
  [10014, "GOV-CORRUPTION-VIOLATIONS", "반부패 관련 법규 위반 건수", "지배구조", "건", "준법"],
  [10015, "GOV-FAIR-TRADE-VIOLATIONS", "공정거래 관련 법규 위반 건수", "지배구조", "건", "준법"],
  [10016, "BASIC-REVENUE", "매출액", "지배구조", "KRW", "재무"],
  [10017, "BASIC-OPERATING-PROFIT", "영업이익", "지배구조", "KRW", "재무"],
  [10018, "BASIC-NET-INCOME", "당기순이익", "지배구조", "KRW", "재무"],
  [10019, "BASIC-KCGS", "국내 ESG 평가 등급(KCGS)", "지배구조", "등급", "ESG"],
  [10020, "BASIC-MSCI", "글로벌 ESG 평가 등급(MSCI)", "지배구조", "등급", "ESG"],
  [10021, "TEST-PCF-BASIC", "PCF TEST_일반/기본", "지배구조", "-", "테스트"],
  [10022, "TEST-PCF-G", "PCF TEST_G", "지배구조", "-", "테스트"],
  [10023, "TEST-PCF-S", "PCF TEST_S", "사회", "-", "테스트"],
  [10024, "TEST-PCF-E", "PCF TEST_E", "환경", "-", "테스트"],
].map(([id, code, name, category, unit, owner]) => ({
  id: id as number,
  code: code as string,
  name: name as string,
  category: category as MasterIndicatorSeed["category"],
  unit: unit as string,
  cycle: "연",
  owner: owner as string,
  progress: 0,
  active: !(code as string).startsWith("TEST-"),
  source: "Complilaw 정량 데이터 항목 관리",
}));

const MAPPING_GROUPS: Array<[string, string[], Record<string, string>]> = [
  ["ENV-GHG-S1", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "3.2", "CL-STD-GRI": "4.1", "CL-STD-KSSB": "2.3.10", "CL-STD-OUTLINE": "1.1" }],
  ["ENV-GHG-S2", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "3.2", "CL-STD-GRI": "4.2", "CL-STD-KSSB": "2.3.10", "CL-STD-OUTLINE": "1.1" }],
  ["ENV-GHG-S3", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "3.2", "CL-STD-GRI": "4.3", "CL-STD-KSSB": "2.3.10", "CL-STD-OUTLINE": "1.1" }],
  ["ENV-ENERGY", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "3.1", "CL-STD-GRI": "4", "CL-STD-OUTLINE": "1.1" }],
  ["ENV-WASTE", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "7.2", "CL-STD-GRI": "4", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "1.2" }],
  ["ENV-WATER", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "5.2", "CL-STD-GRI": "4", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "1.2" }],
  ["SOC-HIRES", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "8.1", "CL-STD-GRI": "2.7", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "2.1" }],
  ["SOC-EMPLOYEES", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "8.1", "CL-STD-GRI": "2.7", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "2.1" }],
  ["SOC-INCIDENTS", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "8.1", "CL-STD-GRI": "2.27", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "2.2" }],
  ["SOC-DISABILITY", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "8.1", "CL-STD-GRI": "2.7", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "2.1" }],
  ["GOV-WOMEN-BOARD", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "12.1", "CL-STD-GRI": "2.9", "CL-STD-KSSB": "2.3.1", "CL-STD-OUTLINE": "3.1" }],
  ["GOV-CORRUPTION-SITES", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "12.1", "CL-STD-GRI": "2.27", "CL-STD-OUTLINE": "3.2" }],
  ["GOV-ANTI-CORRUPTION-TRAINING", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "12.1", "CL-STD-GRI": "2.24", "CL-STD-OUTLINE": "3.2" }],
  ["GOV-CORRUPTION-VIOLATIONS", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "12.1", "CL-STD-GRI": "2.27", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "3.2" }],
  ["GOV-FAIR-TRADE-VIOLATIONS", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "12.2", "CL-STD-GRI": "2.27", "CL-STD-KSSB": "2.3.9", "CL-STD-OUTLINE": "3.2" }],
  ["BASIC-REVENUE", ["CL-STD-GRI", "CL-STD-OUTLINE"], { "CL-STD-GRI": "2.6", "CL-STD-OUTLINE": "4.2" }],
  ["BASIC-OPERATING-PROFIT", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "2.1", "CL-STD-GRI": "2.6", "CL-STD-KSSB": "2.3.6", "CL-STD-OUTLINE": "4.2" }],
  ["BASIC-NET-INCOME", ["CL-STD-ESRS", "CL-STD-GRI", "CL-STD-KSSB", "CL-STD-OUTLINE"], { "CL-STD-ESRS": "2.1", "CL-STD-GRI": "2.6", "CL-STD-KSSB": "2.3.6", "CL-STD-OUTLINE": "4.2" }],
  ["BASIC-KCGS", ["CL-STD-OUTLINE"], { "CL-STD-OUTLINE": "4.1" }],
  ["BASIC-MSCI", ["CL-STD-OUTLINE"], { "CL-STD-OUTLINE": "4.1" }],
  ["TEST-PCF-E", ["CL-STD-PCF-TEST"], { "CL-STD-PCF-TEST": "" }],
  ["TEST-PCF-G", ["CL-STD-PCF-TEST"], { "CL-STD-PCF-TEST": "" }],
  ["TEST-PCF-S", ["CL-STD-PCF-TEST"], { "CL-STD-PCF-TEST": "" }],
];

export const COMPLILAW_DISCLOSURE_MAPPINGS: MasterMappingSeed[] = MAPPING_GROUPS.flatMap(
  ([indicatorCode, standardIds, itemCodes]) => standardIds.map((standardId) => ({
    id: `CL-MAP-${indicatorCode}-${standardId}`,
    indicatorCode,
    standardId,
    standardItemCode: itemCodes[standardId] ?? "",
    regulationIds: standardId === "CL-STD-GRI"
      ? ["CL-REG-GRI-2021", "CL-REG-DEMO-GRI"]
      : standardId === "CL-STD-KSSB"
        ? ["CL-REG-DEMO-KSSB", "CL-REG-ISSB-S1", "CL-REG-TCFD-2021"]
        : standardId === "CL-STD-ESRS"
          ? ["CL-REG-DEMO-ESRS"]
          : [],
    evidenceRequired: !indicatorCode.startsWith("TEST-"),
    owner: indicatorCode.startsWith("ENV-") ? "환경안전" : indicatorCode.startsWith("SOC-") ? "인사·안전" : "ESG·준법",
    status: itemCodes[standardId] ? "연결완료" : "검토 필요",
    updatedAt: "Complilaw 동기화",
  })),
);

export const COMPLILAW_REGULATIONS: MasterRegulationSeed[] = [
  { id: "CL-REG-DEMO-ESRS", title: "[DEMO] ESRS 기준", category: "ESG 공시", jurisdiction: "EU", version: "v1.01", sourceItemCount: 34, sourceUsedItemCount: 34, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-ESRS"], linkedIndicatorCodes: ["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3", "ENV-ENERGY", "ENV-WASTE", "ENV-WATER"], tags: ["ESRS", "DEMO"], updatedAt: "2025-11-11" },
  { id: "CL-REG-DEMO-GRI", title: "[DEMO] GRI 기준", category: "ESG 공시", jurisdiction: "국제", version: "v1.01", sourceItemCount: 40, sourceUsedItemCount: 40, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-GRI"], linkedIndicatorCodes: ["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3"], tags: ["GRI", "DEMO"], updatedAt: "2025-11-11" },
  { id: "CL-REG-DEMO-KSSB", title: "[DEMO] KSSB 기준", category: "ESG 공시", jurisdiction: "대한민국", version: "v1.01", sourceItemCount: 20, sourceUsedItemCount: 20, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-KSSB"], linkedIndicatorCodes: ["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3"], tags: ["KSSB", "DEMO"], updatedAt: "2025-11-11" },
  { id: "CL-REG-GRI-2021", title: "[ESG] GRI Standards: 2021", category: "ESG 공시", jurisdiction: "국제", version: "v1.01", sourceItemCount: 150, sourceUsedItemCount: 150, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-GRI"], linkedIndicatorCodes: COMPLILAW_QUANTITATIVE_INDICATORS.filter((item) => item.active).map((item) => item.code), tags: ["GRI", "2021"], updatedAt: "2025-06-10" },
  { id: "CL-REG-ISSB-S1", title: "[ESG] IFRS S1(ISSB)", category: "ESG 공시", jurisdiction: "국제", version: "v1", sourceItemCount: 30, sourceUsedItemCount: 30, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-KSSB"], linkedIndicatorCodes: ["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3", "BASIC-REVENUE", "BASIC-OPERATING-PROFIT", "BASIC-NET-INCOME"], tags: ["ISSB", "IFRS S1"], updatedAt: "2025-04-18" },
  { id: "CL-REG-TCFD-2021", title: "[ESG] TCFD: 2021", category: "기후 공시", jurisdiction: "국제", version: "v1", sourceItemCount: 59, sourceUsedItemCount: 59, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-KSSB"], linkedIndicatorCodes: ["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3", "ENV-ENERGY"], tags: ["TCFD", "기후"], updatedAt: "2025-04-18" },
  { id: "CL-REG-ISO37001", title: "[ISO] ISO 37001: 2016(2022확인) - 전체", category: "반부패", jurisdiction: "국제", version: "v1", sourceItemCount: 211, sourceUsedItemCount: 211, sourceReviewCount: "1/0", linkedStandardIds: ["CL-STD-GRI", "CL-STD-ESRS"], linkedIndicatorCodes: ["GOV-CORRUPTION-SITES", "GOV-ANTI-CORRUPTION-TRAINING", "GOV-CORRUPTION-VIOLATIONS"], tags: ["ISO 37001", "반부패"], updatedAt: "2025-06-24" },
  { id: "CL-REG-ISO37301", title: "[ISO] ISO 37301: 2021 - 전체", category: "준법경영", jurisdiction: "국제", version: "v1", sourceItemCount: 152, sourceUsedItemCount: 152, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-GRI", "CL-STD-ESRS"], linkedIndicatorCodes: ["GOV-FAIR-TRADE-VIOLATIONS", "GOV-CORRUPTION-VIOLATIONS"], tags: ["ISO 37301", "컴플라이언스"], updatedAt: "2025-06-24" },
  { id: "CL-REG-SAPA", title: "[참고자료] 1. 중대재해처벌법", category: "안전보건", jurisdiction: "대한민국", version: "v1", sourceItemCount: 33, sourceUsedItemCount: 33, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-GRI", "CL-STD-ESRS"], linkedIndicatorCodes: ["SOC-INCIDENTS"], tags: ["중대재해", "안전보건"], updatedAt: "2025-06-24" },
  { id: "CL-REG-OSHA", title: "[참고자료] 2. 산업안전보건법", category: "안전보건", jurisdiction: "대한민국", version: "v1", sourceItemCount: 52, sourceUsedItemCount: 52, sourceReviewCount: "-", linkedStandardIds: ["CL-STD-GRI", "CL-STD-ESRS"], linkedIndicatorCodes: ["SOC-INCIDENTS"], tags: ["산업안전보건법", "안전보건"], updatedAt: "2025-06-24" },
].map((item) => ({
  contents: `Complilaw 규제관리 원본 ${item.sourceItemCount}개 항목`,
  applicability: "원본에서 적용 상태로 관리 중. 내부 담당자·증빙·검토주기를 지정해 준수 현황을 갱신하세요.",
  owner: "",
  reviewCycleMonths: 12,
  lastReviewDate: "",
  nextReviewDate: "",
  status: "적용",
  evidence: "",
  active: true,
  ...item,
})) as MasterRegulationSeed[];

export const COMPLILAW_MASTER_COUNTS = {
  scope12Indicators: COMPLILAW_SCOPE12_INDICATORS.length,
  scope12Formulas: COMPLILAW_SCOPE12_FORMULAS.length,
  scope3Fields: COMPLILAW_SCOPE3_FIELDS.length,
  scope3Factors: COMPLILAW_SCOPE3_FACTORS.length,
  scope3Formulas: COMPLILAW_SCOPE3_FORMULAS.length,
  movementDistances: 0,
  disclosureStandards: COMPLILAW_DISCLOSURE_STANDARDS.length,
  quantitativeIndicators: COMPLILAW_QUANTITATIVE_INDICATORS.length,
  disclosureMappingGroups: MAPPING_GROUPS.length,
  disclosureLinks: COMPLILAW_DISCLOSURE_MAPPINGS.length,
  regulations: COMPLILAW_REGULATIONS.length,
};

export function mergeMasterRows<T extends { id?: string | number; code?: string }>(
  current: T[],
  defaults: T[],
): T[] {
  const result = [...current];
  const ids = new Set(current.map((item) => String(item.id ?? "")).filter(Boolean));
  const codes = new Set(current.map((item) => item.code ?? "").filter(Boolean));
  for (const item of defaults) {
    const id = String(item.id ?? "");
    const code = item.code ?? "";
    if ((id && ids.has(id)) || (!id && code && codes.has(code))) continue;
    result.push(item);
    if (id) ids.add(id);
    if (code) codes.add(code);
  }
  return result;
}
