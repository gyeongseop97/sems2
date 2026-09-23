type CollectionWindow = { status?: unknown; dueDate?: unknown };

/** Date-only deadlines include the entire calendar day in Korea. */
export function submissionExpired(request: CollectionWindow | null | undefined, now = Date.now()): boolean {
  const date = String(request?.dueDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const end = Date.parse(`${date}T23:59:59.999+09:00`);
  return Number.isFinite(end) && now > end;
}

export function canCollect<T extends CollectionWindow>(request: T | null | undefined, now = Date.now()): request is T {
  return request?.status === "수집중" && !submissionExpired(request, now);
}

export function effectiveCollection<T extends CollectionWindow>(request: T, now = Date.now()): T {
  return request.status === "수집중" && submissionExpired(request, now)
    ? { ...request, status: "검토중" } : request;
}
