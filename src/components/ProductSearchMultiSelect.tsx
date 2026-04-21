import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import type { MiniProductResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

export interface ProductSearchMultiSelectProps {
  /** Currently selected product IDs. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Labels for already-selected products. Used so chips show names when the search is empty. */
  initialSelection?: MiniProductResponse[];
  /** Extra query parameters appended to Product/GetProductOptions. */
  extraParams?: Record<string, string | undefined>;
  placeholder?: string;
  disabled?: boolean;
  maxHeight?: number;
  className?: string;
}

export function ProductSearchMultiSelect({
  value,
  onChange,
  initialSelection = [],
  extraParams,
  placeholder = "Search for products…",
  disabled,
  maxHeight = 220,
  className,
}: ProductSearchMultiSelectProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const valueSet = useMemo(() => new Set(value), [value]);
  const labelsRef = useRef<Map<string, MiniProductResponse>>(new Map());

  // Seed label map with initial selection
  useEffect(() => {
    for (const p of initialSelection) {
      labelsRef.current.set(p.id, p);
    }
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

  const selectedLabels = useMemo(() => {
    return value.map((id) => labelsRef.current.get(id) ?? { id, productName: id });
  }, [value]);

  function add(id: string) {
    if (valueSet.has(id)) return;
    onChange([...value, id]);
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  const filteredResults = (results ?? []).filter((p) => !valueSet.has(p.id));

  return (
    <div className={cn("rounded-md border", className)}>
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b p-2">
          {selectedLabels.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[240px] truncate">{p.productName}</span>
              {!disabled && (
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={() => remove(p.id)}
                  aria-label={`Remove ${p.productName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <div className="border-b p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-8"
          />
        </div>
      </div>
      <div className="overflow-y-auto p-1" style={{ maxHeight }}>
        {!debouncedSearch.trim() ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Start typing to search for products.
          </div>
        ) : isFetching ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No matches.
          </div>
        ) : (
          filteredResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p.id)}
              disabled={disabled}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="truncate">{p.productName}</span>
              {p.dynamicsId && (
                <span className="text-xs text-muted-foreground">{p.dynamicsId}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
