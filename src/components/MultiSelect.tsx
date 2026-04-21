import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  id: string;
  label: string;
  sublabel?: string | null;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  maxHeight?: number;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
  disabled,
  maxHeight = 220,
  className,
}: MultiSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? "").toLowerCase().includes(q),
    );
  }, [options, search]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <div className="border-b p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled}
            className="pl-8"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {value.length > 0
              ? `${value.length} selected`
              : placeholder}
          </span>
          {value.length > 0 && !disabled && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="overflow-y-auto p-1" style={{ maxHeight }}>
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          filtered.map((o) => (
            <Label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selectedSet.has(o.id)}
                onCheckedChange={() => toggle(o.id)}
                disabled={disabled}
              />
              <span className="flex-1 truncate text-sm font-normal">
                {o.label}
              </span>
              {o.sublabel && (
                <span className="truncate text-xs text-muted-foreground">
                  {o.sublabel}
                </span>
              )}
            </Label>
          ))
        )}
      </div>
    </div>
  );
}
