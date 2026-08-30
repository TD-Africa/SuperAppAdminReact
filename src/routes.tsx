import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Permission } from "@/lib/permissions";
import { Card, Col, Row, Skeleton } from "antd";
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";

const LoginPage = lazy(() => import("@/pages/Login"));

function LegacyCommissionDetailRedirect() {
  const { brandId } = useParams();
  return <Navigate to={brandId ? `/franchise-brands/${brandId}` : "/franchise-brands"} replace />;
}
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const ProductsPage = lazy(() => import("@/pages/Products"));
const FranchiseProductsPage = lazy(() => import("@/pages/FranchiseProducts"));
const OrdersPage = lazy(() => import("@/pages/Orders"));
const FranchiseOrdersPage = lazy(() => import("@/pages/FranchiseOrders"));
const BrandsPage = lazy(() => import("@/pages/Brands"));
const FranchiseBrandsPage = lazy(() => import("@/pages/FranchiseBrands"));
const FranchiseBrandDetailPage = lazy(() => import("@/pages/FranchiseBrandDetail"));
const FranchiseStoreOwnersPage = lazy(() => import("@/pages/FranchiseStoreOwners"));
const FranchiseStoreOwnerDetailPage = lazy(() => import("@/pages/FranchiseStoreOwnerDetail"));
const WarehousesPage = lazy(() => import("@/pages/Warehouses"));
const TicketsPage = lazy(() => import("@/pages/Tickets"));
const CustomersPage = lazy(() => import("@/pages/Customers"));
const EmployeesPage = lazy(() => import("@/pages/Employees"));
const CacDataPage = lazy(() => import("@/pages/CacData"));
const KycPage = lazy(() => import("@/pages/Kyc"));
const ProductGroupsPage = lazy(() => import("@/pages/ProductGroups"));
const PromosPage = lazy(() => import("@/pages/Promos"));
const CouponsPage = lazy(() => import("@/pages/Coupons"));
const DealsPage = lazy(() => import("@/pages/Deals"));
const PromosAuditLogsPage = lazy(() => import("@/pages/PromosAuditLogs"));
const DealsAuditLogsPage = lazy(() => import("@/pages/DealsAuditLogs"));
const RatingsPage = lazy(() => import("@/pages/Ratings"));
const EmailChangeRequestsPage = lazy(() => import("@/pages/EmailChangeRequests"));
const RequestAppealsPage = lazy(() => import("@/pages/RequestAppeals"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsers"));
const RolesPage = lazy(() => import("@/pages/Roles"));
const DebtCollectionPage = lazy(() => import("@/pages/DebtCollection"));
const TransactionSettingsPage = lazy(() => import("@/pages/TransactionSettings"));
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

// Mirrors the Login page layout so the fallback doesn't jump to a different shape.
const loginLoader = (
  <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
    <div className="relative hidden overflow-hidden lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-[#3f0010] via-[#550016] to-[#800020]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.18),transparent_55%)]" />
    </div>
    <div className="relative flex items-center justify-center bg-gradient-to-br from-white via-[#fbf0f2]/40 to-white px-6 py-12">
      <Card
        variant="borderless"
        className="w-full max-w-[400px] !rounded-2xl !shadow-[0_10px_40px_-12px_rgba(128,0,32,0.18)]"
        styles={{ body: { padding: 40 } }}
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <Skeleton.Node active className="!mb-3 !h-20 !w-40" />
          <Skeleton active title={false} paragraph={{ rows: 2, width: ["60%", "85%"] }} />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton.Input active block size="large" />
          <Skeleton.Input active block size="large" />
          <Skeleton.Button active block size="large" className="!mt-2" />
        </div>
      </Card>
    </div>
  </div>
);

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={pageLoader}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Suspense fallback={loginLoader}><LoginPage /></Suspense>,
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
        path: "franchise-products",
        element: (
          <ProtectedRoute permission={Permission.CanViewProducts}>
            {withSuspense(<FranchiseProductsPage />)}
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
        path: "franchise-orders",
        element: (
          <ProtectedRoute permission={Permission.CanViewOrders}>
            {withSuspense(<FranchiseOrdersPage />)}
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
        path: "coupons",
        element: (
          <ProtectedRoute permission={Permission.CanViewPromos}>
            {withSuspense(<CouponsPage />)}
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
        path: "franchise-brands",
        element: (
          <ProtectedRoute permission={Permission.CanViewBrands}>
            {withSuspense(<FranchiseBrandsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "franchise-brands/:storefrontBrandId",
        element: (
          <ProtectedRoute permission={Permission.CanViewBrands}>
            {withSuspense(<FranchiseBrandDetailPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "franchise-store-owners",
        element: (
          <ProtectedRoute permission={Permission.CanViewUser}>
            {withSuspense(<FranchiseStoreOwnersPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "franchise-store-owners/:storeOwnerId",
        element: (
          <ProtectedRoute permission={Permission.CanViewUser}>
            {withSuspense(<FranchiseStoreOwnerDetailPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "franchise-brand-commissions",
        element: <Navigate to="/franchise-brands" replace />,
      },
      {
        path: "franchise-brand-commissions/:brandId",
        element: <LegacyCommissionDetailRedirect />,
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
      {
        path: "transaction-settings",
        element: (
          <ProtectedRoute permission={Permission.CanChangeSettings}>
            {withSuspense(<TransactionSettingsPage />)}
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
