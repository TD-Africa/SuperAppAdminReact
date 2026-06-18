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
    <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
      {/* Splash side — photo with burgundy overlay */}
      <div className="relative hidden overflow-hidden lg:block">
        {/* Background photo */}
        <img
          src="/login-bg.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Burgundy brand tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3f0010]/85 via-[#550016]/55 to-[#800020]/40" />
        {/* Bottom vignette for tagline legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {/* Subtle radial sheen */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.18),transparent_55%)]" />

        {/* Content */}
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <img
            src="/logo.png"
            alt="TDAfrica SuperApp"
            className="h-20 w-auto object-contain brightness-20"
          />

          <img
              src="/TDAsuperapptxt.png"
              alt="One platform. One purpose."
              className="h-96 max-w-3xl -mt-96 object-contain"
            />


          <div className="max-w-3xl -mt-96 space-y-6">

            {/* <Typography.Title
              level={1}
              className="!m-0 !text-white"
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: 44,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              Run the business
              <br />
              from one dashboard.
            </Typography.Title> */}
            
            <p className="max-w-md text-xl text-white/80">
              SuperApp Admin Dashboard; Products, Orders, Promos, Customers, Tickets — everything your team
              needs, in one place.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/60">
            <span className="inline-block h-px w-8 bg-white/40" />
            One platform · One purpose · Powered by innovation
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex items-center justify-center bg-gradient-to-br from-white via-[#fbf0f2]/40 to-white px-6 py-12">
        <Card
          variant="borderless"
          className="w-full max-w-[400px] !rounded-2xl !shadow-[0_10px_40px_-12px_rgba(128,0,32,0.18)]"
          styles={{ body: { padding: 40 } }}
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src="/logolight.png"
              alt="TDAfrica SuperApp"
              className="mb-6 h-20 w-auto object-contain"
            />
            <Typography.Title level={3} className="!m-0">
              Welcome back
            </Typography.Title>
            <Typography.Text type="secondary" className="!mt-1">
              Sign in to your account to continue
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
              label="Username or Email"
              rules={[{ required: true, message: "Username is required" }]}
            >
              <Input
                prefix={<MailOutlined className="text-muted-foreground" />}
                placeholder="admin or name@tdafrica.com"
                autoComplete="username"
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
            <Form.Item className="!mb-0 !mt-8">
              <Button type="primary" htmlType="submit" block size="large">
                Sign in
              </Button>
            </Form.Item>
          </Form>

          <div className="mt-8 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} TDAfrica
          </div>
        </Card>
      </div>
    </div>
  );
}
