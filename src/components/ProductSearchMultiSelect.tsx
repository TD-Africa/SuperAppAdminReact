import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, Spin } from "antd";
import { apiGet } from "@/lib/api";
import type { MiniProductResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export interface ProductSearchMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Labels for already-selected products; used to render chips when they aren't in the latest search results. */
  initialSelection?: MiniProductResponse[];
  /** Extra query parameters appended to Product/GetProductOptions. */
  extraParams?: Record<string, string | undefined>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProductSearchMultiSelect({
  value,
  onChange,
  initialSelection = [],
  extraParams,
  placeholder = "Search for products…",
  disabled,
  className,
}: ProductSearchMultiSelectProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const labelsRef = useRef<Map<string, MiniProductResponse>>(new Map());

  useEffect(() => {
    for (const p of initialSelection) labelsRef.current.set(p.id, p);
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

  // Union of search results and currently selected items, so chips always show
  // a real label even when the search box has been cleared.
  const options = useMemo(() => {
    const all: MiniProductResponse[] = [];
    const seen = new Set<string>();
    for (const id of value) {
      const cached = labelsRef.current.get(id);
      if (cached && !seen.has(id)) {
        all.push(cached);
        seen.add(id);
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
      label: p.dynamicsId
        ? `${p.productName} · ${p.dynamicsId}`
        : p.productName,
    }));
  }, [results, value]);

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={(v: string[]) => onChange(v)}
      onSearch={setSearch}
      searchValue={search}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={{ width: "100%" }}
      showSearch
      filterOption={false}
      maxTagCount="responsive"
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
