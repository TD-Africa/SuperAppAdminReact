import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Form, Input, Typography, App as AntdApp } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";

interface FormValues {
  userName: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";
  const { message } = AntdApp.useApp();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  const login = useAuthStore((s) => s.login);
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (isLoggedIn) navigate(returnUrl, { replace: true });
  }, [isLoggedIn, navigate, returnUrl]);

  async function onFinish(values: FormValues) {
    const result = await login(values);
    if (result.status) {
      message.success("Signed in");
      navigate(returnUrl, { replace: true });
    } else {
      message.error(result.message ?? "Sign-in failed");
    }
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#3f0010] via-[#550016] to-[#800020] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <img
            src="/logo.png"
            alt="TDAfrica SuperApp"
            className="h-20 w-auto object-contain brightness-20"
          />
          <div className="space-y-3">
            <Typography.Title
              level={1}
              className="!m-0 !max-w-md !text-white"
              style={{ color: "#fff", fontWeight: 700, fontSize: 40, lineHeight: 1.15 }}
            >
              Run the business from one dashboard.
            </Typography.Title>
            <p className="max-w-md text-white/75">
              Products, orders, promos, customers, tickets — everything your team
              needs, in one place.
            </p>
          </div>
          <div className="text-xs text-white/50">
            ...One Platform, One Purpose, Powered by Innovation
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <Card
          variant="borderless"
          className="w-full max-w-sm sm:border sm:shadow-sm"
          styles={{ body: { padding: 32 } }}
        >
          <div className="mb-6 flex flex-col items-center">
            <img
              src="/logolight.png"
              alt="TDAfrica SuperApp"
              className="h-24 w-auto object-contain"
            />
          </div>
          <div className="mb-6 space-y-1 text-center">
            <Typography.Title level={4} className="!m-0">
              Sign in
            </Typography.Title>
            <Typography.Text type="secondary">
              Enter your credentials to continue
            </Typography.Text>
          </div>
          <Form<FormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="userName"
              label="Email"
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-muted-foreground" />}
                placeholder="name@tdafrica.com"
                autoComplete="email"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Password is required" }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-muted-foreground" />}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item className="!mb-0 !mt-6">
              <Button type="primary" htmlType="submit" block size="large">
                Sign in
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}
