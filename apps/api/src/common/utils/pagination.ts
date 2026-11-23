import { PageQuery } from '../dto/page-query.dto';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function page<T>(items: T[], total: number, q: PageQuery): Page<T> {
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export function skipTake(q: PageQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
