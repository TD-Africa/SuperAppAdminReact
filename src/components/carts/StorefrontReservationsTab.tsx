import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App as AntdApp, Button, Card, Input, Select, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { RollbackOutlined } from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import { getStoreOwners } from "@/lib/storefrontApi";
import type {
  PaginationResponse,
  StorefrontInventoryReservationReportResponse,
  StorefrontInventoryReservationResponse,
  StorefrontInventoryReservationStatus,
} from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Age } from "./shared";

type Row = StorefrontInventoryReservationReportResponse;

const ALL = "__all__";

const STATUS_COLOR: Record<StorefrontInventoryReservationStatus, string> = {
  Held: "gold",
  CheckoutPending: "orange",
  Released: "default",
  Expired: "default",
  Committed: "green",
};

const STATUS_HINT: Record<StorefrontInventoryReservationStatus, string> = {
  Held: "Units reserved for a storefront cart; returned automatically when it expires",
  CheckoutPending: "Customer is paying; units stay reserved until it completes or expires",
  Released: "Released early; stock returned",
  Expired: "Ran out of time; stock returned by the expiry sweep",
  Committed: "Became a storefront order",
};

/** Reservations that still take stock out of what customers can buy. */
const isHolding = (s: StorefrontInventoryReservationStatus) =>
  s === "Held" || s === "CheckoutPending";

/**
 * Stock held by storefront carts. Unlike customer carts these reserve stock
 * while Held/CheckoutPending; the expiry sweep returns it, or an admin can.
 */
export function StorefrontReservationsTab({ canRelease }: { canRelease: boolean }) {
  const { message, modal } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>(ALL);
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [ownerKeyword, setOwnerKeyword] = useState("");
  const ownerSearch = useDebouncedValue(ownerKeyword, 350);
  const [keyword, setKeyword] = useState("");
  const search = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [releasing, setReleasing] = useState<string | null>(null);

  const owners = useQuery({
    queryKey: ["cart-admin", "reservation-owners", ownerSearch],
    queryFn: async () => {
      const res = await getStoreOwners({
        PageSize: 20,
        PageNumber: 1,
        SearchString: ownerSearch.trim() || undefined,
      });
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("PageNumber", String(page));
    p.set("PageSize", String(pageSize));
    if (search.trim()) p.set("SearchString", search.trim());
    if (status !== ALL) p.set("status", status);
    if (ownerId) p.set("storefrontOwnerId", ownerId);
    return p.toString();
  }, [page, pageSize, search, status, ownerId]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["cart-admin", "storefront-reservations", params],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<Row>>(
        `storefront/inventory-reservations/report?${params}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load reservations");
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  function confirmRelease(r: Row) {
    modal.confirm({
      title: "Release this reservation?",
      content:
        "The held units go back into available stock now. If the customer is mid-checkout, their checkout will fail.",
      okText: "Release",
      okButtonProps: { danger: true },
      onOk: async () => {
        setReleasing(r.reservationId);
        try {
          const res = await apiPost<StorefrontInventoryReservationResponse>(
            `storefront/inventory-reservations/${r.reservationId}/release`,
            {},
          );
          if (!res.status) {
            message.error(res.message ?? "Release failed");
            return;
          }
          message.success(res.message ?? "Reservation released");
          await queryClient.invalidateQueries({ queryKey: ["cart-admin"] });
        } finally {
          setReleasing(null);
        }
      },
    });
  }

  const ownerName = (id: string | null) => {
    if (!id) return "—";
    const o = owners.data?.find((x) => x.id === id);
    return o?.companyName || o?.userName || id;
  };

  const columns: TableColumnsType<Row> = [
    {
      title: "Reservation",
      key: "id",
      render: (_, r) => (
        <div>
          <div className="font-mono text-xs">{r.reservationId}</div>
          {r.storefrontCartKey && (
            <div className="text-xs text-muted-foreground">Cart {r.storefrontCartKey}</div>
          )}
        </div>
      ),
    },
    {
      title: "Storefront owner",
      key: "owner",
      render: (_, r) => (
        <Tooltip title={r.storefrontOwnerId}>
          <span>{ownerName(r.storefrontOwnerId)}</span>
        </Tooltip>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => (
        <Tooltip title={STATUS_HINT[r.status]}>
          <Tag color={STATUS_COLOR[r.status]} className="!m-0">
            {r.status === "CheckoutPending" ? "Checkout pending" : r.status}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: "Lines",
      dataIndex: "lineCount",
      align: "right",
      render: (v: number) => <span className="tabular-nums">{formatNumber(v)}</span>,
    },
    { title: "Created", key: "created", render: (_, r) => <Age at={r.dateCreated} /> },
    {
      title: "Expires",
      key: "expires",
      render: (_, r) => {
        const overdue = isHolding(r.status) && new Date(r.expiresAtUtc).getTime() < Date.now();
        return (
          <span className={overdue ? "text-amber-600" : ""}>
            {overdue ? "Overdue · " : ""}
            {formatDateTime(r.expiresAtUtc)}
          </span>
        );
      },
    },
    {
      title: "Order",
      key: "order",
      render: (_, r) =>
        r.storefrontOrderId ? (
          <span className="font-mono text-xs">{r.storefrontOrderId}</span>
        ) : (
          "—"
        ),
    },
    ...(canRelease
      ? [
          {
            title: "",
            key: "actions",
            align: "right" as const,
            width: 70,
            render: (_: unknown, r: Row) =>
              isHolding(r.status) ? (
                <Tooltip title="Release the held stock now">
                  <Button
                    size="small"
                    danger
                    icon={<RollbackOutlined />}
                    loading={releasing === r.reservationId}
                    onClick={() => confirmRelease(r)}
                  />
                </Tooltip>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="Storefront carts reserve stock while Held or Checkout pending. The expiry sweep returns it automatically, and D365 stock syncs subtract these holds so they aren't counted twice."
      />

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search reservations…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            className="min-w-[180px]"
            options={[
              { value: ALL, label: "All statuses" },
              { value: "Held", label: "Held" },
              { value: "CheckoutPending", label: "Checkout pending" },
              { value: "Committed", label: "Committed" },
              { value: "Released", label: "Released" },
              { value: "Expired", label: "Expired" },
            ]}
          />
          <Select
            showSearch
            allowClear
            filterOption={false}
            placeholder="Any storefront owner"
            value={ownerId}
            onSearch={setOwnerKeyword}
            onChange={(v) => {
              setOwnerId(v);
              setPage(1);
            }}
            loading={owners.isFetching}
            className="min-w-[240px]"
            options={(owners.data ?? []).map((o) => ({
              value: o.id,
              label: o.companyName || o.userName || o.id,
            }))}
          />
        </div>
      </Card>

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Row>
          rowKey="reservationId"
          dataSource={data?.data ?? []}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.count ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: "No storefront reservations match." }}
        />
      </Card>
    </div>
  );
}
