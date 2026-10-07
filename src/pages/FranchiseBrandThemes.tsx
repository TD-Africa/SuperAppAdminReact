import type { TableColumnsType } from "antd";
import { App as AntdApp, Empty, Table, Tag, Typography } from "antd";

type MockRow = { id: string; brandName: string };

const mockRows: MockRow[] = [
  // Mock-only: no backend fetch and no themeJson hardcoding yet.
  { id: "mock-storefront-brand-samsung", brandName: "SAMSUNG" },
];

export default function FranchiseBrandThemesPage() {
  const { message } = AntdApp.useApp();
  void message;

  const columns: TableColumnsType<MockRow> = [
    {
      title: "Brand",
      dataIndex: "brandName",
      render: (brandName: string) => (
        <div>
          <div className="font-medium">{brandName}</div>
      
        </div>
      ),
    },
    {
      title: "Theme",
      key: "theme",
      width: 160,
      render: () => <span>SAMSUNG</span>,
    },
    {
      title: "Theme status",
      key: "themeStatus",
      width: 180,
      render: () => <Tag color="success">Active</Tag>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Brand Themes
          </Typography.Title>
          <Typography.Text type="secondary">
          </Typography.Text>
        </div>
      </div>
      <Table<MockRow>
        rowKey={(row) => row.id}
        columns={columns}
        dataSource={mockRows}
        locale={{ emptyText: <Empty description="No storefront brands found" /> }}
        pagination={false}
        scroll={{ x: 700 }}
      />
    </div>
  );
}

