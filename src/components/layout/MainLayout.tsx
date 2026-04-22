import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Layout,
  Button,
  Avatar,
  Dropdown,
  Typography,
  Drawer,
  Grid,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { NavMenu } from "./NavMenu";
import { useAuthStore } from "@/stores/auth";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export function MainLayout() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isDesktop = !!screens.lg;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const fullName =
    [user?.userDTO.firstName, user?.userDTO.lastName].filter(Boolean).join(" ") ||
    user?.userDTO.userName ||
    "Admin";

  const initial = (
    user?.userDTO.firstName?.[0] ??
    user?.userDTO.userName?.[0] ??
    "?"
  ).toUpperCase();

  return (
    <Layout className="min-h-screen">
      {isDesktop && (
        <Sider
          theme="dark"
          width={256}
          collapsedWidth={72}
          collapsed={collapsed}
          trigger={null}
          className="sticky top-0 h-screen overflow-auto"
        >
          <NavMenu collapsed={collapsed} />
        </Sider>
      )}

      {!isDesktop && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={260}
          closable={false}
          styles={{ body: { padding: 0, background: "#1a0a0e" } }}
        >
          <NavMenu collapsed={false} onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      <Layout>
        <Header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-3">
            {isDesktop ? (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((v) => !v)}
              />
            ) : (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            <Typography.Text type="secondary" className="text-sm">
              Welcome back
            </Typography.Text>
          </div>
          <Dropdown
            menu={{
              items: [
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "Sign out",
                  onClick: handleLogout,
                },
              ],
            }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-accent"
            >
              <Avatar
                size={36}
                className="bg-primary font-semibold text-primary-foreground"
              >
                {initial}
              </Avatar>
              <div className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-sm font-medium text-foreground">
                  {fullName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.userDTO.role?.name ?? user?.userDTO.userName}
                </span>
              </div>
            </button>
          </Dropdown>
        </Header>

        <Content>
          <div className="mx-auto w-full max-w-[1400px] p-6">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
