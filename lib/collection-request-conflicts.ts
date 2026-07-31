export type CollectionRequestTarget = string | number;

export type CollectionRequestInput<TTarget extends CollectionRequestTarget> = {
  id: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  companies: readonly string[];
  targetIds: readonly TTarget[];
  status: string;
};

export type CollectionRequestConflict<TTarget extends CollectionRequestTarget> = {
  requestId: string;
  title: string;
  status: string;
  months: string[];
  companies: string[];
  targetIds: TTarget[];
  duplicateCount: number;
};

function monthIndex(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return year * 12 + month - 1;
}

function formatMonth(index: number) {
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
}

function overlappingMonths(
  firstFrom: string,
  firstTo: string,
  secondFrom: string,
  secondTo: string,
) {
  const starts = [monthIndex(firstFrom), monthIndex(secondFrom)];
  const ends = [monthIndex(firstTo), monthIndex(secondTo)];
  if (starts.some(value => value === null) || ends.some(value => value === null)) return [];

  const start = Math.max(...(starts as number[]));
  const end = Math.min(...(ends as number[]));
  if (start > end) return [];

  return Array.from({ length: end - start + 1 }, (_, index) => formatMonth(start + index));
}

function intersection<T extends CollectionRequestTarget>(
  first: readonly T[],
  second: readonly T[],
) {
  const secondSet = new Set(second);
  return [...new Set(first.filter(item => secondSet.has(item)))];
}

export function findCollectionRequestConflicts<TTarget extends CollectionRequestTarget>(
  candidate: CollectionRequestInput<TTarget>,
  existing: readonly CollectionRequestInput<TTarget>[],
) {
  return existing.flatMap<CollectionRequestConflict<TTarget>>(request => {
    if (request.id === candidate.id) return [];

    const months = overlappingMonths(
      candidate.periodFrom,
      candidate.periodTo,
      request.periodFrom,
      request.periodTo,
    );
    const companies = intersection(candidate.companies, request.companies);
    const targetIds = intersection(candidate.targetIds, request.targetIds);
    if (!months.length || !companies.length || !targetIds.length) return [];

    return [{
      requestId: request.id,
      title: request.title,
      status: request.status,
      months,
      companies,
      targetIds,
      duplicateCount: months.length * companies.length * targetIds.length,
    }];
  });
}
