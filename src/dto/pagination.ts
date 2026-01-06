export interface Pagination {
  count: number;
  limit: number;
  offset: number;
}

export class PaginationInfo implements Pagination {
  count: number;
  limit: number;
  offset: number;

  constructor(pagination: Pagination) {
    this.count = pagination.count;
    this.limit = pagination.limit;
    this.offset = pagination.offset;
  }

  get headers() {
    return {
      'X-Pagination-Count': this.count,
      'X-Pagination-Limit': this.limit,
      'X-Pagination-Offset': this.offset,
      'X-Pagination-TotalPages': Math.ceil(this.count / this.limit),
    };
  }
}
