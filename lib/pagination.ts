export type PaginationResult<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startItem: number;
  endItem: number;
};

export function parsePageParam(value: string | number | undefined, fallback = 1) {
  const page = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(page) || page < 1) {
    return fallback;
  }
  return page;
}

export function paginateItems<T>(
  items: T[],
  requestedPage: number,
  pageSize: number,
): PaginationResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    currentPage,
    totalPages,
    totalItems,
    pageSize: safePageSize,
    startItem: totalItems === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
  };
}

export function getPaginationWindow(currentPage: number, totalPages: number, radius = 2) {
  const start = Math.max(1, currentPage - radius);
  const end = Math.min(totalPages, currentPage + radius);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
