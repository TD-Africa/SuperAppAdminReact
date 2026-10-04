import { Pagination, Typography } from "antd";
import { ANALYTICS_MAX_ROWS, ANALYTICS_PAGE_SIZE } from "@/lib/analytics";
import { count } from "@/lib/analyticsFormat";

/**
 * Pager for analytics lists. The API serves at most 10,000 rows, so paging
 * stops there and a note asks the user to narrow the filters.
 */
export function CappedPagination({
  current,
  total,
  noun,
  onChange,
}: {
  current: number;
  total: number;
  /** What the rows are, for the "1,234 partners" total. */
  noun: string;
  onChange: (page: number) => void;
}) {
  return (
    <>
      <Pagination
        className="mt-4"
        current={current}
        total={Math.min(total, ANALYTICS_MAX_ROWS)}
        pageSize={ANALYTICS_PAGE_SIZE}
        showSizeChanger={false}
        showTotal={() => `${count(total)} ${noun}`}
        onChange={onChange}
      />

      {total > ANALYTICS_MAX_ROWS && (
        <Typography.Text type="secondary">
          Narrow the filters to browse beyond 10,000 rows.
        </Typography.Text>
      )}
    </>
  );
}
