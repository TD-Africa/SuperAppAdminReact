import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  getAdminStorefrontWalletOrders,
  getStoreOwners,
} from "@/lib/storefrontApi";
import type {
  StorefrontStoreOwnerDto,
  StorefrontWalletOrderDto,
} from "@/lib/storefrontTypes";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EyeOutlined, ShopOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { TableColumnsType } from "antd";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const ALL = "__all__";

function ownerLabel(row: StorefrontStoreOwnerDto) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  const company = row.companyName?.trim();
  if (company && name) return `${company} — ${name}`;
  return company || name || row.userName || row.id;
}

export default function FranchiseOrdersPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [ownerId, setOwnerId] = useState(searchParams.get("ownerId") ?? "");
  const [ownerSearch, setOwnerSearch] = useState("");
  const debouncedOwnerSearch = useDebouncedValue(ownerSearch, 350);

  useEffect(() => {
    const fromUrl = searchParams.get("ownerId") ?? "";
    setOwnerId((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [paidFilter, setPaidFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function selectOwner(id: string) {
    setOwnerId(id);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (id) next.set("ownerId", id);
    else next.delete("ownerId");
    setSearchParams(next, { replace: true });
  }

  const ownersQuery = useQuery({
    queryKey: ["storefront", "store-owners", "orders-picker", debouncedOwnerSearch],
    queryFn: async () => {
      const res = await getStoreOwners({
        PageSize: 50,
        PageNumber: 1,
        SearchString: debouncedOwnerSearch.trim() || undefined,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load store owners");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const ownerOptions = useMemo(() => {
    const list = ownersQuery.data ?? [];
    if (ownerId && !list.some((o) => o.id === ownerId)) {
      return [
        {
          id: ownerId,
          companyName: searchParams.get("company"),
          userName: searchParams.get("user"),
          firstName: searchParams.get("owner"),
          lastName: null,
          isCacVerified: true,
          cacVerifiedAt: null,
        } satisfies StorefrontStoreOwnerDto,
        ...list,
      ];
    }
    return list;
  }, [ownersQuery.data, ownerId, searchParams]);

  const ordersParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedKeyword.trim() || undefined,
    }),
    [pageSize, page, debouncedKeyword],
  );

  const ordersQuery = useQuery({
    queryKey: ["franchise-storefront-orders", ownerId, ordersParams],
    queryFn: async () => {
      const res = await getAdminStorefrontWalletOrders(ownerId, ordersParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront orders");
      return res.data;
    },
    enabled: !!ownerId,
  });

  useEffect(() => {
    if (ordersQuery.isError) {
      message.error(
        ordersQuery.error instanceof Error
          ? ordersQuery.error.message
          : "Unable to load storefront orders.",
      );
    }
  }, [ordersQuery.isError, ordersQuery.error, message]);

  const rows = useMemo(() => {
    const data = ordersQuery.data?.data ?? [];
    if (paidFilter === ALL) return data;
    const wantPaid = paidFilter === "true";
    return data.filter((row) => row.isPaid === wantPaid);
  }, [ordersQuery.data?.data, paidFilter]);

  const totalItems = Number(ordersQuery.data?.count ?? 0);
  const selectedOwner = ownerOptions.find((o) => o.id === ownerId);

  const columns: TableColumnsType<StorefrontWalletOrderDto> = [
    {
      title: "Date",
      dataIndex: "dateCreated",
      width: 140,
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    {
      title: "Order",
      dataIndex: "orderReference",
      render: (v, row) => (
        <Button
          type="link"
          className="!px-0"
          onClick={() => {
            setSelectedOrderId(row.orderId);
            setDetailOpen(true);
          }}
        >
          {v ?? row.externalOrderId ?? row.orderId.slice(0, 8)}
        </Button>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      render: (v) => v ?? "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => formatCurrency(Number(v ?? 0), "NGN"),
    },
    {
      title: "Owner commission",
      dataIndex: "storefrontOwnerCommissionAmount",
      align: "right",
      render: (_, row) =>
        formatCurrency(
          Number(
            row.storefrontOwnerCommissionAmount ??
              row.commission ??
              0,
          ),
          "NGN",
        ),
    },
    {
      title: "OEM commission",
      dataIndex: "storefrontOemCommissionAmount",
      align: "right",
      render: (_, row) =>
        formatCurrency(
          Number(
            row.storefrontOemCommissionAmount ?? 0,
          ),
          "NGN",
        ),
    },
    {
      title: "Commission status",
      dataIndex: "commissionStatus",
      render: (v) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "Paid",
      dataIndex: "isPaid",
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "warning"}>{v ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "orderStatus",
      render: (v) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedOrderId(row.orderId);
            setDetailOpen(true);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Franchise orders
          </Typography.Title>
          <Typography.Text type="secondary">
            View storefront orders by store owner (read-only).
          </Typography.Text>
        </div>
        {ownerId ? (
          <Button
            icon={<ShopOutlined />}
            onClick={() => navigate(`/franchise-store-owners/${ownerId}`)}
          >
            Owner detail
          </Button>
        ) : null}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Select
            className="md:col-span-5"
            showSearch
            allowClear
            placeholder="Select store owner…"
            value={ownerId || undefined}
            filterOption={false}
            onSearch={setOwnerSearch}
            onChange={(v) => selectOwner(v ?? "")}
            loading={ownersQuery.isLoading || ownersQuery.isFetching}
            notFoundContent={
              ownersQuery.isLoading ? "Loading…" : "No store owners found"
            }
            options={ownerOptions.map((o) => ({
              value: o.id,
              label: ownerLabel(o),
            }))}
            optionFilterProp="label"
          />
          <Input
            className="md:col-span-4"
            placeholder="Search order ref, customer…"
            value={keyword}
            allowClear
            disabled={!ownerId}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={paidFilter}
            disabled={!ownerId}
            onChange={(v) => {
              setPage(1);
              setPaidFilter(v);
            }}
            options={[
              { value: ALL, label: "All payment statuses" },
              { value: "true", label: "Paid" },
              { value: "false", label: "Unpaid" },
            ]}
          />
        </div>
        {selectedOwner ? (
          <div className="mt-3 text-sm text-muted-foreground">
            Showing orders for{" "}
            <Link
              className="text-[#800020] hover:underline"
              to={`/franchise-store-owners/${selectedOwner.id}`}
            >
              {ownerLabel(selectedOwner)}
            </Link>
          </div>
        ) : null}
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        {!ownerId ? (
          <div className="p-10">
            <Empty description="Select a store owner to load storefront orders." />
          </div>
        ) : (
          <Table<StorefrontWalletOrderDto>
            rowKey="orderId"
            dataSource={rows}
            columns={columns}
            loading={ordersQuery.isLoading || ordersQuery.isFetching}
            pagination={{
              current: page,
              pageSize,
              total: totalItems,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            scroll={{ x: 1000 }}
            locale={{ emptyText: "No storefront orders for this owner." }}
          />
        )}
      </Card>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedOrderId(null);
        }}
        onUpdated={() => ordersQuery.refetch()}
      />
    </div>
  );
}
