import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { Skeleton, Card, Row, Col } from "antd";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Permission } from "@/lib/permissions";

const LoginPage = lazy(() => import("@/pages/Login"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const ProductsPage = lazy(() => import("@/pages/Products"));
const OrdersPage = lazy(() => import("@/pages/Orders"));
const BrandsPage = lazy(() => import("@/pages/Brands"));
const WarehousesPage = lazy(() => import("@/pages/Warehouses"));
const TicketsPage = lazy(() => import("@/pages/Tickets"));
const CustomersPage = lazy(() => import("@/pages/Customers"));
const EmployeesPage = lazy(() => import("@/pages/Employees"));
const CacDataPage = lazy(() => import("@/pages/CacData"));
const KycPage = lazy(() => import("@/pages/Kyc"));
const ProductGroupsPage = lazy(() => import("@/pages/ProductGroups"));
const PromosPage = lazy(() => import("@/pages/Promos"));
const DealsPage = lazy(() => import("@/pages/Deals"));
const PromosAuditLogsPage = lazy(() => import("@/pages/PromosAuditLogs"));
const DealsAuditLogsPage = lazy(() => import("@/pages/DealsAuditLogs"));
const RatingsPage = lazy(() => import("@/pages/Ratings"));
const EmailChangeRequestsPage = lazy(() => import("@/pages/EmailChangeRequests"));
const RequestAppealsPage = lazy(() => import("@/pages/RequestAppeals"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsers"));
const RolesPage = lazy(() => import("@/pages/Roles"));
const DebtCollectionPage = lazy(() => import("@/pages/DebtCollection"));
const ForbiddenPage = lazy(() => import("@/pages/Forbidden"));

const pageLoader = (
  <div className="p-6">
    <Skeleton active title paragraph={{ rows: 1 }} />
    <Row gutter={[16, 16]} className="mt-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Col key={i} xs={24} sm={12} xl={6}>
          <Card>
            <Skeleton active paragraph={{ rows: 1 }} />
          </Card>
        </Col>
      ))}
    </Row>
  </div>
);

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={pageLoader}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute permission={Permission.CanViewDashboard}>
            {withSuspense(<DashboardPage />)}
          </ProtectedRoute>
        ),
      },
      { path: "forbidden", element: withSuspense(<ForbiddenPage />) },
      {
        path: "products",
        element: (
          <ProtectedRoute permission={Permission.CanViewProducts}>
            {withSuspense(<ProductsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "orders",
        element: (
          <ProtectedRoute permission={Permission.CanViewOrders}>
            {withSuspense(<OrdersPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "debt-collection",
        element: (
          <ProtectedRoute permission={Permission.CanViewOrders}>
            {withSuspense(<DebtCollectionPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "customers",
        element: (
          <ProtectedRoute permission={Permission.CanViewUser}>
            {withSuspense(<CustomersPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "employees",
        element: (
          <ProtectedRoute permission={Permission.CanViewDashboard}>
            {withSuspense(<EmployeesPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "cac-data",
        element: (
          <ProtectedRoute permission={Permission.CanViewUser}>
            {withSuspense(<CacDataPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "kyc",
        element: (
          <ProtectedRoute permission={Permission.CanEditUser}>
            {withSuspense(<KycPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "promos",
        element: (
          <ProtectedRoute permission={Permission.CanViewPromos}>
            {withSuspense(<PromosPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "promos-audit-logs",
        element: (
          <ProtectedRoute permission={Permission.CanViewPromos}>
            {withSuspense(<PromosAuditLogsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "product-groups",
        element: (
          <ProtectedRoute permission={Permission.CanViewProductGroup}>
            {withSuspense(<ProductGroupsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "brands",
        element: (
          <ProtectedRoute permission={Permission.CanViewBrands}>
            {withSuspense(<BrandsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "deals",
        element: (
          <ProtectedRoute permission={Permission.CanViewBrands}>
            {withSuspense(<DealsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "deals-audit-logs",
        element: (
          <ProtectedRoute permission={Permission.CanViewBrands}>
            {withSuspense(<DealsAuditLogsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "warehouses",
        element: (
          <ProtectedRoute permission={Permission.CanViewWarehouses}>
            {withSuspense(<WarehousesPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets",
        element: (
          <ProtectedRoute permission={Permission.CanViewTicket}>
            {withSuspense(<TicketsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "ratings",
        element: (
          <ProtectedRoute permission={Permission.CanViewRatings}>
            {withSuspense(<RatingsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "email-requests",
        element: (
          <ProtectedRoute permission={Permission.CanViewEmailChangeRequests}>
            {withSuspense(<EmailChangeRequestsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "request-appeals",
        element: (
          <ProtectedRoute permission={Permission.CanViewRequestAppeals}>
            {withSuspense(<RequestAppealsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "admin-users",
        element: (
          <ProtectedRoute permission={Permission.CanViewSubUser}>
            {withSuspense(<AdminUsersPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "roles",
        element: (
          <ProtectedRoute permission={Permission.CanViewRoles}>
            {withSuspense(<RolesPage />)}
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
