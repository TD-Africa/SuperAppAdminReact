import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";

const schema = z.object({
  userName: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  const login = useAuthStore((s) => s.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isLoggedIn) navigate(returnUrl, { replace: true });
  }, [isLoggedIn, navigate, returnUrl]);

  async function onSubmit(values: FormValues) {
    const result = await login(values);
    if (result.status) {
      toast.success("Signed in");
      navigate(returnUrl, { replace: true });
    } else {
      toast.error(result.message ?? "Sign-in failed");
    }
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-primary lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="text-lg font-semibold tracking-tight">TD SuperApp</div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              Run the business
              <br />
              from one dashboard.
            </h1>
            <p className="max-w-md text-white/70">
              Products, orders, promos, customers, tickets — everything your
              team needs, in one place.
            </p>
          </div>
          <div className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} TD Africa
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm border-0 shadow-none sm:border sm:shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8 space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Sign in
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to continue
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="userName">Email</Label>
                <Input
                  id="userName"
                  type="email"
                  autoComplete="email"
                  placeholder="name@tdafrica.com"
                  {...register("userName")}
                />
                {errors.userName && (
                  <p className="text-xs text-destructive">
                    {errors.userName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="********"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
