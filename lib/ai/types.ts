export type AiMode = "extract" | "guide" | "report" | "answer";

export type AiDraftRequest = {
  mode: "guide" | "report" | "answer";
  question: string;
  company: string;
  year: number;
  indicatorId?: number;
  reportId?: string;
};

export type AiExtractionContext = {
  mode: "extract";
  company: string;
  year: number;
  targetLabel: string;
  expectedUnit: string;
  period?: string;
  site?: string;
  indicatorId?: number;
};

export type AiExtraction = {
  company: string | null;
  site: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  metricName: string | null;
  amount: number | null;
  unit: string | null;
  sourceExcerpt: string | null;
  sourcePage: number | null;
  notes: string[];
};

export type AiSource = {
  id: string;
  kind: "activity" | "metric" | "indicator" | "evidence" | "target";
  title: string;
  excerpt: string;
  company?: string;
  period?: string;
  view?: "inventory" | "metric-collection" | "indicators" | "evidence" | "targets";
};

export type AiResult = {
  mode: AiMode;
  text: string;
  sources: AiSource[];
  gaps: string[];
  warnings: string[];
  extraction?: AiExtraction;
  fileName?: string;
  scope: { company: string; year: number };
};

export type AiIndicator = {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  cycle: string;
  aggregation?: "합계" | "평균" | "최종값";
  organizationAggregation?: "합계" | "평균" | "비율";
  ratioMultiplier?: number;
  owner: string;
  reviewer?: string;
  definition?: string;
  boundary?: string;
  formula?: string;
  dataSource?: string;
  evidenceExample?: string;
  frameworks: string[];
  active?: boolean;
  inputTemplate?: string;
  detailItems?: { key: string; label: string; unit: string; aggregation: "합계" | "평균" | "최종값"; legacyIndicatorIds?: number[] }[];
};

export type AiWorkspace = {
  organizations: Record<string, string[]>;
  records: Record<string, unknown>[];
  metricSubmissions: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  indicators: Record<string, unknown>[];
  targets: Record<string, unknown>[];
  reports: Record<string, unknown>[];
};

export type AiEvidenceCandidate = {
  id: number;
  sourceId: string;
  fileName: string;
  storagePath: string;
};

export type AiGroundingContext = {
  sources: AiSource[];
  warnings: string[];
  evidenceCandidates: AiEvidenceCandidate[];
  hasFacts: boolean;
};
