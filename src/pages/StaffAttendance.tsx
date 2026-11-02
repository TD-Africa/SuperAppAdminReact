import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AimOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  PaginationResponse,
  StaffAttendanceResponse,
  StaffOfficeRequest,
  StaffOfficeResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";

// The API rejects register ranges longer than this.
const MAX_RANGE_DAYS = 92;

function formatDistance(metres: number | null | undefined) {
  if (metres === null || metres === undefined) return "-";
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ---- Offices ----

const EMPTY_OFFICE: StaffOfficeRequest = {
  name: "",
  address: null,
  latitude: 0,
  longitude: 0,
  radiusMetres: 150,
  isActive: true,
};

function toRequest(o: StaffOfficeResponse): StaffOfficeRequest {
  return {
    name: o.name,
    address: o.address,
    latitude: o.latitude,
    longitude: o.longitude,
    radiusMetres: o.radiusMetres,
    isActive: o.isActive,
  };
}

function OfficeModal({
  open,
  office,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null to create. */
  office: StaffOfficeResponse | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<StaffOfficeRequest>();
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Google Maps copies "6.4281, 3.4219" on right-click; accept that pasted into Latitude.
  function onLatitudePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const m = e.clipboardData.getData("text").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return;
    e.preventDefault();
    form.setFieldsValue({ latitude: Number(m[1]), longitude: Number(m[2]) });
  }

  function fillFromMyLocation() {
    if (!("geolocation" in navigator)) {
      message.error("This browser can't share its location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        form.setFieldsValue({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
        message.info(`Location accurate to about ${Math.round(pos.coords.accuracy)} m`);
      },
      () => {
        setLocating(false);
        message.error("Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function save() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const body: StaffOfficeRequest = { ...values, address: values.address?.trim() || null };
      const res = office
        ? await apiPut<StaffOfficeResponse>(`StaffAttendance/UpdateOffice/${office.id}`, body)
        : await apiPost<StaffOfficeResponse>("StaffAttendance/CreateOffice", body);
      if (!res.status) {
        message.error(res.message ?? "Couldn't save the office");
        return;
      }
      message.success(office ? "Office updated" : "Office added");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={office ? `Edit ${office.name}` : "Add office"}
      okText={office ? "Save" : "Add office"}
      confirmLoading={saving}
      onOk={() => void save()}
      onCancel={onClose}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) form.setFieldsValue(office ? toRequest(office) : EMPTY_OFFICE);
      }}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={office ? toRequest(office) : EMPTY_OFFICE}>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input placeholder="e.g. Lagos HQ" />
        </Form.Item>
        <Form.Item name="address" label="Address" rules={[{ max: 500 }]}>
          <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
        </Form.Item>
        <div className="flex items-end justify-between gap-2">
          <Typography.Text type="secondary" className="text-xs">
            Paste "lat, lng" from Google Maps into Latitude, or stand in the office and use your location.
          </Typography.Text>
          <Button size="small" icon={<AimOutlined />} loading={locating} onClick={fillFromMyLocation}>
            Use my location
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Form.Item name="latitude" label="Latitude" rules={[{ required: true, type: "number", min: -90, max: 90 }]}>
            <InputNumber className="!w-full" step={0.000001} onPaste={onLatitudePaste} />
          </Form.Item>
          <Form.Item
            name="longitude"
            label="Longitude"
            rules={[{ required: true, type: "number", min: -180, max: 180 }]}
          >
            <InputNumber className="!w-full" step={0.000001} />
          </Form.Item>
        </div>
        <Form.Item
          name="radiusMetres"
          label="Radius"
          extra="How far from the point still counts as in the office."
          rules={[{ required: true, type: "number", min: 25, max: 5000 }]}
        >
          <InputNumber className="!w-full" min={25} max={5000} step={25} addonAfter="metres" />
        </Form.Item>
        <Form.Item name="isActive" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function OfficesTab() {
  const queryClient = useQueryClient();
  const { message, modal } = AntdApp.useApp();
  const canManage = useAuthStore((s) => s.hasPermission(Permission.CanManageStaff));
  const [editing, setEditing] = useState<StaffOfficeResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["staff-attendance", "offices"],
    queryFn: async () => {
      const res = await apiGet<StaffOfficeResponse[]>("StaffAttendance/Offices");
      if (!res.status) throw new Error(res.message ?? "Failed to load offices");
      return res.data ?? [];
    },
  });

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["staff-attendance", "offices"] });
  }

  async function toggleActive(o: StaffOfficeResponse, value: boolean) {
    const res = await apiPut<StaffOfficeResponse>(`StaffAttendance/UpdateOffice/${o.id}`, {
      ...toRequest(o),
      isActive: value,
    });
    if (!res.status) message.error(res.message ?? "Update failed");
    else message.success(value ? "Office activated" : "Office deactivated");
    await refresh();
  }

  function remove(o: StaffOfficeResponse) {
    modal.confirm({
      title: `Remove ${o.name}?`,
      content: "Staff will no longer be matched to this office. Past attendance keeps it.",
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await apiDelete<boolean>(`StaffAttendance/DeleteOffice/${o.id}`);
        if (!res.status) message.error(res.message ?? "Couldn't remove the office");
        else message.success("Office removed");
        await refresh();
      },
    });
  }

  const columns: TableColumnsType<StaffOfficeResponse> = [
    { title: "Name", dataIndex: "name", render: (v) => <span className="font-medium">{v}</span> },
    {
      title: "Address",
      dataIndex: "address",
      render: (v) => <span className="block max-w-[320px] truncate text-muted-foreground">{v ?? "-"}</span>,
    },
    {
      title: "Location",
      key: "location",
      render: (_, r) => (
        <a href={mapsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="text-xs">
          <EnvironmentOutlined /> {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
        </a>
      ),
    },
    { title: "Radius", dataIndex: "radiusMetres", width: 100, render: (v: number) => `${v} m` },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 90,
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canManage} onChange={(val) => void toggleActive(r, val)} />
      ),
    },
    ...(canManage
      ? [
          {
            title: "",
            key: "actions",
            width: 100,
            render: (_: unknown, r: StaffOfficeResponse) => (
              <div className="flex gap-1">
                <Tooltip title="Edit">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                  />
                </Tooltip>
                <Tooltip title="Remove">
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
                </Tooltip>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Text type="secondary">
          Sign-ins within an active office's radius count as at the office. Anywhere else, staff must say why.
        </Typography.Text>
        {canManage && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Add office
          </Button>
        )}
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table<StaffOfficeResponse>
          rowKey="id"
          dataSource={data ?? []}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={false}
          locale={{
            emptyText: error
              ? (error as Error).message
              : "No offices yet. Until one is added, every sign-in counts as away.",
          }}
        />
      </Card>
      <OfficeModal
        open={modalOpen}
        office={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

// ---- Register ----

function RegisterTab() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().subtract(6, "day"), dayjs()]);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [awayOnly, setAwayOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("From", range[0].format("YYYY-MM-DD"));
    params.set("To", range[1].format("YYYY-MM-DD"));
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (awayOnly) params.set("AwayOnly", "true");
    return params;
  }, [range, pageSize, page, debouncedKeyword, awayOnly]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["staff-attendance", "register", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<StaffAttendanceResponse>>(
        `StaffAttendance/Query?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load attendance");
      return res.data;
    },
  });

  const columns: TableColumnsType<StaffAttendanceResponse> = [
    {
      title: "Date",
      dataIndex: "attendanceDate",
      width: 150,
      render: (v: string) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "Staff",
      key: "staff",
      render: (_, r) => (
        <div className="leading-tight">
          <div className="font-medium">{r.staffName ?? "-"}</div>
          <div className="text-xs text-muted-foreground">{r.staffEmail}</div>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 100,
      render: (v: string) =>
        v === "SignIn" ? <Tag color="blue">Sign in</Tag> : v === "SignOut" ? <Tag color="purple">Sign out</Tag> : <Tag>{v}</Tag>,
    },
    { title: "Time", dataIndex: "time", width: 90, render: (v: string) => formatTime(v) },
    {
      title: "Where",
      key: "where",
      render: (_, r) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {r.isAtOffice ? <Tag color="success">At office</Tag> : <Tag color="warning">Away</Tag>}
            {r.officeName && (
              <span className="text-xs">
                {r.officeName}
                {!r.isAtOffice && ` · ${formatDistance(r.distanceToOfficeMetres)}`}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {r.latitude !== null && r.longitude !== null ? (
              <a href={mapsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer">
                {r.address ?? ([r.locality, r.state, r.country].filter(Boolean).join(", ") || "View on map")}
              </a>
            ) : (
              "No location shared"
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Message",
      dataIndex: "message",
      render: (v: string | null) => <span className="text-xs text-muted-foreground">{v ?? "-"}</span>,
    },
    {
      title: "IP",
      key: "ip",
      width: 140,
      render: (_, r) => (
        <span className="text-xs text-muted-foreground">
          {r.ipAddress ?? "-"}
          {r.ipCountryCode && ` (${r.ipCountryCode})`}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <DatePicker.RangePicker
            className="md:col-span-4"
            allowClear={false}
            value={range}
            disabledDate={(d, info) =>
              d.isAfter(dayjs(), "day") ||
              (!!info?.from && Math.abs(d.diff(info.from, "day")) >= MAX_RANGE_DAYS)
            }
            onChange={(v) => {
              if (!v?.[0] || !v[1]) return;
              setPage(1);
              setRange([v[0], v[1]]);
            }}
          />
          <Input
            className="md:col-span-5"
            placeholder="Search staff by name or email…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <Switch
              size="small"
              checked={awayOnly}
              onChange={(v) => {
                setPage(1);
                setAwayOnly(v);
              }}
            />
            Away only
          </label>
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StaffAttendanceResponse>
          rowKey="id"
          dataSource={data?.data ?? []}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 1100 }}
          locale={{ emptyText: error ? (error as Error).message : "No attendance in this range." }}
          pagination={{
            current: page,
            pageSize,
            total: Number(data?.count ?? 0),
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
}

export default function StaffAttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Staff Attendance
        </Typography.Title>
        <Typography.Text type="secondary">
          Where staff signed in and out from the staff portal, and the offices those sign-ins are checked against.
        </Typography.Text>
      </div>
      <Tabs
        defaultActiveKey="register"
        items={[
          { key: "register", label: "Register", children: <RegisterTab /> },
          { key: "offices", label: "Offices", children: <OfficesTab /> },
        ]}
      />
    </div>
  );
}
