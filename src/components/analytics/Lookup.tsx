import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, Tag } from "antd";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  ANALYTICS_STALE_TIME,
  analyticsError,
  getAnalytics,
} from "@/lib/analytics";
import type { AnalyticsLookup } from "@/lib/analytics";
import { stageLabel } from "@/lib/analyticsFormat";

/** Searchable select for a brand, category or partner filter. */
export function Lookup({
  dimension,
  value,
  onChange,
  scope,
}: {
  dimension: string;
  value?: string;
  onChange: (id?: string) => void;
  scope: string;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ["analytics", scope, "lookup", dimension, debounced, value],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsLookup[]>(
        `lookups/${dimension}`,
        { search: debounced || value || "" },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const id = `analytics-${dimension}`;
  const label = dimension[0].toUpperCase() + dimension.slice(1);
  const plural = dimension === "category" ? "categories" : `${dimension}s`;

  let notFoundContent = "No matches";
  if (query.isError) notFoundContent = analyticsError(query.error);
  else if (query.isFetching) notFoundContent = "Searching…";

  return (
    <div className="min-w-0 flex-1">
      <label className="mb-1 block text-sm" htmlFor={id}>
        {label}
      </label>

      <Select
        id={id}
        aria-label={dimension}
        className="w-full"
        placeholder={`All ${plural}`}
        showSearch
        allowClear
        filterOption={false}
        value={value}
        onChange={(selected) => {
          setSearch("");
          onChange(selected);
        }}
        onSearch={setSearch}
        loading={query.isFetching}
        options={query.data?.map((item) => ({
          value: item.id,
          label: item.name,
        }))}
        notFoundContent={notFoundContent}
      />
    </div>
  );
}

/** Removable chip for an applied filter, showing the item's name rather than its id. */
export function ActiveFilter({
  dimension,
  label,
  value,
  scope,
  remove,
}: {
  dimension: string;
  label: string;
  value: string;
  scope: string;
  remove: () => void;
}) {
  const query = useQuery({
    queryKey: ["analytics", scope, "lookup", dimension, "", value],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsLookup[]>(
        `lookups/${dimension}`,
        { search: value },
        signal,
      ),
    enabled: dimension !== "stage",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const name =
    dimension === "stage"
      ? stageLabel(value)
      : (query.data?.find((row) => row.id === value)?.name ?? "Selected");

  return (
    <Tag
      closable
      closeIcon={
        <button
          type="button"
          className="border-0 bg-transparent p-0 text-inherit"
          aria-label={`Remove ${label.toLowerCase()} filter`}
        >
          ×
        </button>
      }
      onClose={remove}
    >
      {label}: {name}
    </Tag>
  );
}
