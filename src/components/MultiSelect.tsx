import { useMemo } from "react";
import { Select } from "antd";

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
  disabled?: boolean;
  className?: string;
}

// Thin wrapper over antd Select (mode="multiple") so existing call sites in
// the customer flows don't have to change their props shape.
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  className,
}: MultiSelectProps) {
  const antdOptions = useMemo(
    () =>
      options.map((o) => ({
        value: o.id,
        label: o.sublabel ? `${o.label} · ${o.sublabel}` : o.label,
        searchLabel: `${o.label} ${o.sublabel ?? ""}`,
      })),
    [options],
  );

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={(v: string[]) => onChange(v)}
      options={antdOptions}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={{ width: "100%" }}
      maxTagCount="responsive"
      optionFilterProp="searchLabel"
      allowClear
    />
  );
}
