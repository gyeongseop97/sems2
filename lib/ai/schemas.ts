import { z } from "zod";
import { isAiEvidencePeriod } from "./extraction";

export const draftRequestSchema = z.object({
  mode: z.enum(["guide", "report", "answer"]),
  question: z.string().trim().min(1).max(2000),
  company: z.string().trim().max(160),
  year: z.number().int().min(2000).max(2100),
  indicatorId: z.number().int().positive().optional(),
  reportId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const extractionContextSchema = z.object({
  mode: z.literal("extract"), company: z.string().trim().max(160),
  year: z.number().int().min(2000).max(2100),
  targetLabel: z.string().trim().min(1).max(200),
  expectedUnit: z.string().trim().min(1).max(80),
  indicatorId: z.number().int().positive().optional(),
  period: z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/).optional(),
  site: z.string().trim().max(160).optional(),
}).strict();

export const draftOutputSchema = z.object({
  text: z.string().min(1).max(12000),
  sourceIds: z.array(z.string()).max(40),
  gaps: z.array(z.string().max(600)).max(15),
}).strict();

export const extractionOutputSchema = z.object({
  company: z.string().max(160).nullable(), site: z.string().max(160).nullable(),
  periodFrom: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/).refine(isAiEvidencePeriod).nullable(),
  periodTo: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/).refine(isAiEvidencePeriod).nullable(),
  metricName: z.string().max(200).nullable(),
  amount: z.number().finite().nonnegative().nullable(), unit: z.string().max(80).nullable(),
  sourceExcerpt: z.string().max(1500).nullable(), sourcePage: z.number().int().positive().nullable(),
  notes: z.array(z.string().max(600)).max(15),
}).strict();
