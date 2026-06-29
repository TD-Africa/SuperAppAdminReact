import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, Spin } from "antd";
import { apiGet } from "@/lib/api";
import type { CustomerResponse, PaginationResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** Minimal customer shape needed to render a chip label. */
export interface CustomerOption {
  id: string;
  companyName?: string | null;
  email?: string | null;
}

export interface CustomerSearchMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Labels for already-selected customers; used to render chips when they aren't in the latest search results. */
  initialSelection?: CustomerOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function labelFor(c: CustomerOption): string {
  const name = c.companyName?.trim();
  if (name && c.email) return `${name} · ${c.email}`;
  return name || c.email || c.id;
}

export function CustomerSearchMultiSelect({
  value,
  onChange,
  initialSelection = [],
  placeholder = "Search customers by name or email…",
  disabled,
  className,
}: CustomerSearchMultiSelectProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const labelsRef = useRef<Map<string, CustomerOption>>(new Map());

  useEffect(() => {
    for (const c of initialSelection) labelsRef.current.set(c.id, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: results, isFetching } = useQuery({
    queryKey: ["customer-options", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("PageSize", "20");
      params.set("PageNumber", "1");
      params.set("SearchString", debouncedSearch.trim());
      const res = await apiGet<PaginationResponse<CustomerResponse>>(
        `User/GetUsers?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Search failed");
      return res.data?.data ?? [];
    },
    enabled: !!debouncedSearch.trim(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (results) {
      for (const c of results) {
        labelsRef.current.set(c.id, {
          id: c.id,
          companyName: c.companyName,
          email: c.email,
        });
      }
    }
  }, [results]);

  // Union of search results and currently selected items, so chips always show
  // a real label even when the search box has been cleared.
  const options = useMemo(() => {
    const all: CustomerOption[] = [];
    const seen = new Set<string>();
    for (const id of value) {
      const cached = labelsRef.current.get(id);
      if (cached && !seen.has(id)) {
        all.push(cached);
        seen.add(id);
      }
    }
    for (const c of results ?? []) {
      if (!seen.has(c.id)) {
        all.push({ id: c.id, companyName: c.companyName, email: c.email });
        seen.add(c.id);
      }
    }
    return all.map((c) => ({ value: c.id, label: labelFor(c) }));
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
