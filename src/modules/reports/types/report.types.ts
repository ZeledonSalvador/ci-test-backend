export type ReportResponse<TRow, TSummary = any> = {
  rows: TRow[];
  summary?: TSummary;
  meta?: Record<string, any>;
};
