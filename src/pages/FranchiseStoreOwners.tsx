import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DollarOutlined,
  EyeOutlined,
  ShopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { getStorefrontOwners, getStorefrontOwnerDashboard } from "@/lib/storefrontApi";
import type { StorefrontOwnerDetailDto, StorefrontDashboardDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency } from "@/lib/utils";

type OwnerRow = {
  id: string;
  companyName: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  isSuspended: boolean;
  userStatus: string | null;
  isActive: boolean;
  primaryStorefrontBrandId: string | null;
};

type OwnerWithStats = OwnerRow & {
  totalOrders?: number;
  grossSales?: number;
  currency?: string;
};

function ownerDisplayName(row: { firstName: string | null; lastName: string | null }) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function detailToRow(d: StorefrontOwnerDetailDto): OwnerRow {
  return {
    id: d.id ?? "",
    companyName: d.companyName,
    userName: d.userName,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    isSuspended: d.isSuspended,
    userStatus: d.userStatus,
    isActive: d.isActive,
    primaryStorefrontBrandId: d.primaryStorefrontBrandId ?? null,
  };
}

function openOwnerPath(row: {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
}) {
  const params = new URLSearchParams();
  if (row.companyName?.trim()) params.set("company", row.companyName.trim());
  const name = ownerDisplayName(row);
  if (name) params.set("owner", name);
  if (row.userName?.trim()) params.set("user", row.userName.trim());
  const qs = params.toString();
  return `/franchise-store-owners/${row.id}${qs ? `?${qs}` : ""}`;
}

export default function FranchiseStoreOwnersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  // Fetch all accepted store owners
  const ownersQuery = useQuery({
    queryKey: ["storefront", "accepted-owners"],
    queryFn: async () => {
      const res = await getStorefrontOwners({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load store owners");
      return (res.data?.data ?? [])
        .filter((o) => o.isInvitationAccepted === true)
        .map(detailToRow);
    },
    staleTime: 60_000,
  });

  // Fetch dashboard data for each owner (in parallel)
  const dashboardsQuery = useQuery({
    queryKey: ["storefront", "owner-dashboards", ownersQuery.data?.map((o) => o.id)],
    queryFn: async () => {
      const owners = ownersQuery.data ?? [];
      if (owners.length === 0) return {};
      
      const results = await Promise.allSettled(
        owners.map((owner) => getStorefrontOwnerDashboard(owner.id))
      );

      const dashboardMap: Record<string, StorefrontDashboardDto | null> = {};
      owners.forEach((owner, idx) => {
        const result = results[idx];
        if (result.status === "fulfilled" && result.value.status && result.value.data) {
          dashboardMap[owner.id] = result.value.data;
        } else {
          dashboardMap[owner.id] = null;
        }
      });

      return dashboardMap;
    },
    enabled: !!ownersQuery.data && ownersQuery.data.length > 0,
    staleTime: 60_000,
  });

  const ownersWithStats = useMemo<OwnerWithStats[]>(() => {
    const owners = ownersQuery.data ?? [];
    const dashboards = dashboardsQuery.data ?? {};

    return owners.map((owner) => {
      const dashboard = dashboards[owner.id];
      return {
        ...owner,
        totalOrders: dashboard?.totalOrders ?? 0,
        grossSales: dashboard?.grossSales ?? 0,
        currency: dashboard?.currency ?? "NGN",
      };
    });
  }, [ownersQuery.data, dashboardsQuery.data]);

  const searchedOwners = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return ownersWithStats;
    return ownersWithStats.filter((r) =>
      [r.companyName, r.userName, r.firstName, r.lastName, r.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [ownersWithStats, debouncedSearch]);

  // Calculate aggregate statistics
  const aggregates = useMemo(() => {
    const totalOwners = ownersWithStats.length;
    const activeOwners = ownersWithStats.filter((o) => o.isActive && !o.isSuspended).length;
    const totalRevenue = ownersWithStats.reduce((sum, o) => sum + (o.grossSales ?? 0), 0);
    const totalOrders = ownersWithStats.reduce((sum, o) => sum + (o.totalOrders ?? 0), 0);

    return {
      totalOwners,
      activeOwners,
      totalRevenue,
      totalOrders,
    };
  }, [ownersWithStats]);

  const columns: TableColumnsType<OwnerWithStats> = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v: string | null, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-[#800020] hover:underline"
          onClick={() => navigate(openOwnerPath(row))}
        >
          {v?.trim() || "—"}
        </button>
      ),
    },
    {
      title: "Owner",
      key: "owner",
      render: (_, row) => ownerDisplayName(row) || "—",
    },
    {
      title: "Total Orders",
      dataIndex: "totalOrders",
      align: "right",
      render: (v: number | undefined) => v?.toLocaleString() ?? "—",
    },
    {
      title: "Revenue",
      dataIndex: "grossSales",
      align: "right",
      render: (v: number | undefined, row) => 
        v !== undefined ? formatCurrency(v, (row.currency === "USD" || row.currency === "NGN") ? row.currency : "NGN") : "—",
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, row) => {
        if (row.isSuspended) return <Tag color="error">Suspended</Tag>;
        if (row.isActive) return <Tag color="success">Active</Tag>;
        return <Tag color="default">Inactive</Tag>;
      },
    },
    {
      title: "",
      key: "actions",
      width: 80,
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(openOwnerPath(row))}
          title="View details"
        />
      ),
    },
  ];

  const isLoading = ownersQuery.isLoading || dashboardsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Store owners
          </Typography.Title>
          <Typography.Text type="secondary">
            Active store owners with performance metrics
          </Typography.Text>
        </div>
        <Space>
          <Button
            icon={<TeamOutlined />}
            onClick={() => navigate("/franchise-store-owner-invites")}
          >
            Manage invites
          </Button>
        </Space>
      </div>

      {/* Aggregate Statistics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Store Owners"
              value={aggregates.totalOwners}
              prefix={<TeamOutlined />}
              suffix={
                <span className="text-sm text-muted-foreground">
                  ({aggregates.activeOwners} active)
                </span>
              }
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={aggregates.totalRevenue}
              prefix={<DollarOutlined />}
              formatter={(value) => formatCurrency(Number(value), "NGN")}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Orders"
              value={aggregates.totalOrders}
              prefix={<ShopOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search by company, name, username, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<ShopOutlined className="text-muted-foreground" />}
        />
      </Card>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<OwnerWithStats>
          rowKey={(row) => row.id}
          columns={columns}
          dataSource={searchedOwners}
          loading={isLoading}
          locale={{ emptyText: <Empty description="No store owners" /> }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${total} store owner${total === 1 ? "" : "s"}`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
