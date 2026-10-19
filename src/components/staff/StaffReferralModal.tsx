import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, App as AntdApp, Input, Modal, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { apiGet, apiPut } from "@/lib/api";
import type { StaffAdminResponse, StaffWorkerResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface Props {
  staff: StaffAdminResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated staff record SetReferral returns. */
  onSaved: (staff: StaffAdminResponse | null) => void;
}

// A worker another staff account holds can't be picked; the one this staff
// member already holds comes back with their own email and stays selectable.
function takenByOther(worker: StaffWorkerResponse, staff: StaffAdminResponse | null) {
  if (!worker.linkedStaffEmail) return false;
  if (worker.referralId === staff?.referralId) return false;
  return worker.linkedStaffEmail.toLowerCase() !== (staff?.email ?? "").toLowerCase();
}

export function StaffReferralModal({ staff, open, onOpenChange, onSaved }: Props) {
  const { message } = AntdApp.useApp();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start each opening seeded with the staff member's surname so the likely
  // match is usually on screen straight away. Not the full name: D365 often
  // carries a middle name the Entra display name doesn't.
  useEffect(() => {
    if (!open) return;
    setSearch(staff?.displayName?.trim().split(/\s+/).pop() ?? "");
    setSelected(staff?.referralId ?? null);
    setError(null);
  }, [open, staff?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const term = debouncedSearch.trim();
  const { data: workers, isFetching, error: searchError } = useQuery({
    queryKey: ["staff", "workers", term],
    queryFn: async () => {
      const qs = term ? `?search=${encodeURIComponent(term)}` : "";
      const res = await apiGet<StaffWorkerResponse[]>(`Staff/Workers${qs}`);
      if (!res.status) throw new Error(res.message ?? "Failed to search D365 workers");
      return res.data ?? [];
    },
    enabled: open && !!staff,
    staleTime: 30_000,
    retry: false,
  });

  async function save() {
    if (!staff || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiPut<StaffAdminResponse>(`Staff/SetReferral/${staff.id}`, {
        referralId: selected,
      });
      if (!res.status) {
        // The API's message names the exact problem (unknown, inactive, taken).
        setError(res.message ?? "Couldn't link the D365 worker");
        return;
      }
      message.success(res.message ?? "D365 sales taker linked");
      onSaved(res.data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const columns: TableColumnsType<StaffWorkerResponse> = [
    {
      title: "Name",
      dataIndex: "fullName",
      render: (v: string | null, w) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {v || "—"}
            {w.referralId === staff?.referralId && (
              <Tag color="blue" className="!ml-2">
                Current
              </Tag>
            )}
          </span>
          {w.email && <span className="text-xs text-muted-foreground">{w.email}</span>}
        </div>
      ),
    },
    {
      // Names repeat across D365, so the personnel number is what tells people apart.
      title: "Personnel no.",
      dataIndex: "personnelNumber",
      width: 130,
      render: (v: string | null) => <span className="font-mono text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Referral ID",
      dataIndex: "referralId",
      width: 120,
      render: (v: string) => <span className="font-mono text-xs">{v}</span>,
    },
    {
      title: "",
      key: "taken",
      width: 190,
      render: (_, w) =>
        takenByOther(w, staff) ? (
          <span className="text-xs text-muted-foreground">Linked to {w.linkedStaffEmail}</span>
        ) : null,
    },
  ];

  const unchanged = !!selected && selected === staff?.referralId;

  return (
    <Modal
      open={open}
      title={staff?.referralId ? "Change D365 worker" : "Link to D365 worker"}
      okText="Link"
      onOk={save}
      okButtonProps={{ disabled: !selected || unchanged }}
      confirmLoading={saving}
      onCancel={() => onOpenChange(false)}
      width={760}
      destroyOnClose
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Orders <span className="font-medium text-foreground">{staff?.displayName || staff?.email}</span>{" "}
          places are sent to D365 with this worker as the sales taker.
        </p>
        <Input.Search
          placeholder="Search by name, email, personnel number or referral ID…"
          value={search}
          allowClear
          loading={isFetching}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {searchError && (
          <Alert type="error" showIcon title={(searchError as Error).message} />
        )}
        {error && <Alert type="error" showIcon title={error} />}
        <Table<StaffWorkerResponse>
          rowKey="referralId"
          size="small"
          columns={columns}
          dataSource={workers}
          loading={isFetching}
          pagination={false}
          scroll={{ y: 360 }}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selected ? [selected] : [],
            onChange: (keys) => setSelected((keys[0] as string) ?? null),
            getCheckboxProps: (w) => ({ disabled: takenByOther(w, staff) }),
          }}
          onRow={(w) => ({
            onClick: () => {
              if (!takenByOther(w, staff)) setSelected(w.referralId);
            },
            className: takenByOther(w, staff) ? "opacity-50" : "cursor-pointer",
          })}
          locale={{
            emptyText: term ? "No active D365 workers match that search." : "Type to search D365 workers.",
          }}
        />
        <p className="text-xs text-muted-foreground">
          Shows up to 25 active workers. Narrow the search if the person isn't listed.
        </p>
      </div>
    </Modal>
  );
}
