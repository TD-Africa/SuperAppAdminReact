import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  CreditCard,
  FileCheck2,
  Package,
  ShoppingBag,
  Ticket as TicketIcon,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { apiGet } from "@/lib/api";
import type { AdminDashboardResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

function buildUrl(startDate: string, endDate: string) {
  const qs = new URLSearchParams();
  if (startDate) qs.set("startDate", new Date(startDate).toISOString());
  if (endDate) qs.set("endDate", new Date(endDate).toISOString());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `Component/GetAdminDashboard${suffix}`;
}

function KpiCard({
  title,
  value,
  icon: Icon,
  accent = "text-primary",
  onClick,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
    >
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-full bg-muted ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

const TRANSACTION_COLORS = ["#f43f5e", "#3b82f6", "#f59e0b"];
const STATUS_COLORS = [
  "#f43f5e",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#fb7185",
];
const TICKET_COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ s: string; e: string }>({
    s: "",
    e: "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-dashboard", appliedRange.s, appliedRange.e],
    queryFn: async () => {
      const res = await apiGet<AdminDashboardResponse>(
        buildUrl(appliedRange.s, appliedRange.e),
      );
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load dashboard");
      }
      return res.data;
    },
  });

  if (isError) toast.error((error as Error).message);

  const transactionData = useMemo(
    () =>
      data
        ? [
            { name: "POA", value: data.totalNumberOfPoaTransactions },
            { name: "Cash", value: data.totalNumberOfCashTransactions },
            { name: "Credit", value: data.totalNumberOfCreditTransactions },
          ]
        : [],
    [data],
  );

  const statusData = useMemo(
    () =>
      data
        ? [
            { name: "Pending", value: data.totalNumberOfPendingOrders },
            { name: "In progress", value: data.totalNumberOfInProgressOrders },
            { name: "Completed", value: data.totalNumberOfCompletedOrders },
            { name: "Unpaid", value: data.totalNumberOfUnpaidOrders },
            { name: "Failed", value: data.totalNumberOfFailedOrders },
            { name: "Cancelled", value: data.totalNumberOfCancelledOrders },
          ]
        : [],
    [data],
  );

  const ticketData = useMemo(
    () =>
      data
        ? [
            { name: "Open", value: data.totalNumberOfOpenTickets },
            { name: "Pending", value: data.totalNumberOfPendingTickets },
            { name: "Closed", value: data.totalNumberOfClosedTickets },
          ]
        : [],
    [data],
  );

  function applyFilter() {
    if (startDate && new Date(startDate) > new Date()) {
      toast.error("Start date cannot be in the future");
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setAppliedRange({ s: startDate, e: endDate });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of transactions, orders, customers, and support tickets.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>Apply</Button>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setAppliedRange({ s: "", e: "" });
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total transactions"
              value={formatCurrency(data.totalAmountForAllTransactions, "NGN")}
              icon={TrendingUp}
              accent="text-primary"
            />
            <KpiCard
              title="Cash transactions"
              value={formatCurrency(data.totalAmountForCashTransactions, "NGN")}
              icon={Banknote}
              accent="text-emerald-600"
            />
            <KpiCard
              title="Credit transactions"
              value={formatCurrency(data.totalAmountForCreditTransactions, "NGN")}
              icon={CreditCard}
              accent="text-sky-600"
            />
            <KpiCard
              title="POA transactions"
              value={formatCurrency(data.totalAmountForPoaTransactions, "NGN")}
              icon={Wallet}
              accent="text-amber-600"
            />

            <KpiCard
              title="Total orders"
              value={formatNumber(data.totalNumberOfOrders)}
              icon={ShoppingBag}
              onClick={() => navigate("/orders")}
            />
            <KpiCard
              title="Total customers"
              value={formatNumber(data.totalNumberOfCustomers)}
              icon={Users}
              onClick={() => navigate("/customers")}
            />
            <KpiCard
              title="Total tickets"
              value={formatNumber(data.totalNumberOfTickets)}
              icon={TicketIcon}
              onClick={() => navigate("/tickets")}
            />
            <KpiCard
              title="Available products"
              value={formatNumber(data.totalNumberOfAvailableProducts)}
              icon={Package}
              onClick={() => navigate("/products")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transaction mix</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={transactionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {transactionData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={TRANSACTION_COLORS[i % TRANSACTION_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order status</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                    >
                      {statusData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 5 selling products</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Units sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topFiveSellingProducts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No sales in this range
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.topFiveSellingProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.productName ?? "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(p.unitSold)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(p.totalRevenue, "NGN")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ticket status</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ticketData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                    >
                      {ticketData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={TICKET_COLORS[i % TICKET_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Last 5 orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                    <TableHead className="text-right">NGN</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>POA</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lastFiveOrders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No recent orders
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.lastFiveOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">
                          {o.companyName ?? "-"}
                        </TableCell>
                        <TableCell>{formatDate(o.orderDate)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(o.totalAmountInDollars, "USD")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(o.totalAmountInNaira, "NGN")}
                        </TableCell>
                        <TableCell>{o.paymentMethod}</TableCell>
                        <TableCell>
                          {o.isPoaTransaction ? (
                            <Badge variant="success">
                              <FileCheck2 className="mr-1 h-3 w-3" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{o.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
