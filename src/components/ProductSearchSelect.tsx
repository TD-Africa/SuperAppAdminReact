import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, Spin } from "antd";
import { apiGet } from "@/lib/api";
import type { MiniProductResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export interface ProductSearchSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Label for an already-selected product; used to render the value when it isn't in the latest search results. */
  initialSelection?: MiniProductResponse | null;
  /** Extra query parameters appended to Product/GetProductOptions. */
  extraParams?: Record<string, string | undefined>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProductSearchSelect({
  value,
  onChange,
  initialSelection,
  extraParams,
  placeholder = "Search for a product…",
  disabled,
  className,
}: ProductSearchSelectProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const labelsRef = useRef<Map<string, MiniProductResponse>>(new Map());

  useEffect(() => {
    if (initialSelection) labelsRef.current.set(initialSelection.id, initialSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanExtra = useMemo(() => {
    const out: Record<string, string> = {};
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v !== undefined && v !== null && v !== "") out[k] = v;
      }
    }
    return out;
  }, [extraParams]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["product-options", debouncedSearch, cleanExtra],
    queryFn: async () => {
      const params = new URLSearchParams(cleanExtra);
      if (debouncedSearch.trim()) params.set("searchString", debouncedSearch.trim());
      const res = await apiGet<MiniProductResponse[]>(
        `Product/GetProductOptions?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Search failed");
      return res.data ?? [];
    },
    enabled: !!debouncedSearch.trim(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (results) {
      for (const p of results) labelsRef.current.set(p.id, p);
    }
  }, [results]);

  // Union of the current selection and the latest search results, so the
  // selected value always shows a real label even when the box is cleared.
  const options = useMemo(() => {
    const all: MiniProductResponse[] = [];
    const seen = new Set<string>();
    if (value) {
      const cached = labelsRef.current.get(value);
      if (cached) {
        all.push(cached);
        seen.add(value);
      }
    }
    for (const p of results ?? []) {
      if (!seen.has(p.id)) {
        all.push(p);
        seen.add(p.id);
      }
    }
    return all.map((p) => ({
      value: p.id,
      label: p.dynamicsId ? `${p.productName} · ${p.dynamicsId}` : p.productName,
    }));
  }, [results, value]);

  return (
    <Select
      allowClear
      value={value ?? undefined}
      onChange={(v: string | undefined) => onChange(v ?? null)}
      onSearch={setSearch}
      searchValue={search}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={{ width: "100%" }}
      showSearch
      filterOption={false}
      notFoundContent={
        isFetching ? (
          <div className="flex items-center justify-center py-3">
            <Spin size="small" />
          </div>
        ) : debouncedSearch.trim() ? (
          <div className="py-3 text-center text-sm text-muted-foreground">
            No matches
          </div>
        ) : (
          <div className="py-3 text-center text-sm text-muted-foreground">
            Start typing to search
          </div>
        )
      }
    />
  );
}
