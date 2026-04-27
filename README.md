# SuperApp Admin (React)

A modern, responsive admin dashboard for **TDAfrica SuperApp**. This React application mirrors the existing Blazor WebAssembly admin app (`SuperAppAdminWeb`) and talks to the same `TDSuperApp.WEB` backend API — requiring zero backend changes.

It provides a complete management interface for products, orders, customers, promos, deals, support tickets, KYC verification, CAC registrations, warehouse logistics, admin user roles, and more.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Project Structure](#project-structure)
- [Features & Pages](#features--pages)
- [Architecture](#architecture)
- [Authentication & Authorization](#authentication--authorization)
- [API Integration](#api-integration)
- [Theming](#theming)
- [Responsive Design](#responsive-design)
- [Available Scripts](#available-scripts)
- [Relationship to Blazor App](#relationship-to-blazor-app)
- [License](#license)

---

## Overview

SuperApp Admin (React) is a role-based administrative interface built to manage every aspect of the TDAfrica SuperApp ecosystem. It offers:

- **Real-time business intelligence** via the Dashboard with KPIs, charts, and date-range filtering.
- **Full CRUD operations** across products, brands, warehouses, promos, deals, product groups, and admin users.
- **Order & customer management** with transaction tracking in both NGN and USD.
- **KYC & CAC verification flows** for onboarding and compliance.
- **Support ticket handling** with escalation capabilities.
- **Audit logging** for promos and deals to track administrative changes.
- **Granular permission-based access control** synced with the backend role system.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Build Tool** | Vite 5 |
| **Framework** | React 18 |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS 3 |
| **UI Components** | Ant Design 6 |
| **State Management (Server)** | TanStack Query (React Query) |
| **State Management (Client)** | Zustand |
| **HTTP Client** | Axios |
| **Charts** | Recharts |
| **Routing** | React Router v6 |
| **Date Handling** | dayjs |
| **Icons** | `@ant-design/icons` |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- npm (comes with Node.js)

### Installation

```bash
# Clone or navigate into the project directory
cd SuperAppAdminReact

# Install dependencies
npm install
```

### Running the Development Server

```bash
npm run dev
```

The dev server starts on [http://localhost:5173](http://localhost:5173) by default.

### Building for Production

```bash
npm run build
```

This type-checks the project and outputs a production bundle to the `dist/` folder.

### Previewing the Production Build

```bash
npm run preview
```

---

## Environment Configuration

Create a `.env` file in the project root (you can copy from `.env.example` if available):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | Yes | — | Base URL of the `TDSuperApp.WEB` API. **Must end with a trailing slash** (e.g., `https://api.example.com/`). |
| `VITE_AUTH_STORAGE_KEY` | No | `SuperAppAdminReact__Authentication` | The `localStorage` key used to persist the JWT authentication object. |

### Example `.env`

```env
VITE_API_BASE_URL=https://tdsuperapp-web-api-staging.azurewebsites.net/
VITE_AUTH_STORAGE_KEY=SuperAppAdminReact__Authentication
```

---

## Project Structure

```
SuperAppAdminReact/
├── public/                     # Static assets (logos, login background image)
│   ├── logo.png
│   ├── logolight.png
│   ├── TDAsuperapptxt.png
│   └── login-bg.jpg
├── src/
│   ├── App.tsx                 # Root component: QueryClient, Ant Design ConfigProvider, Router
│   ├── main.tsx                # Application entry point
│   ├── routes.tsx              # Route definitions with lazy loading & permission guards
│   ├── index.css               # Tailwind directives + custom CSS variables
│   ├── vite-env.d.ts           # Vite client type declarations
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx  # Sidebar / topbar shell with collapsible nav & mobile drawer
│   │   │   └── NavMenu.tsx     # Permission-gated navigation menu (mirrors NavMenu.razor)
│   │   ├── ProtectedRoute.tsx  # Auth + permission gate wrapper
│   │   ├── AuditLogsView.tsx   # Reusable audit log viewer
│   │   ├── ConfirmDialog.tsx   # Confirmation dialog utility
│   │   ├── PromptDialog.tsx    # Prompt dialog utility
│   │   ├── ImageViewerModal.tsx# Image preview modal
│   │   ├── MultiSelect.tsx     # Multi-select dropdown component
│   │   ├── ProductSearchMultiSelect.tsx
│   │   ├── cac/
│   │   │   └── CacDataDetailModal.tsx
│   │   ├── customers/
│   │   │   ├── CreateCustomerModal.tsx
│   │   │   └── EditCustomerModal.tsx
│   │   ├── kyc/
│   │   │   ├── DynamicsAccountModal.tsx
│   │   │   └── KycReviewModal.tsx
│   │   ├── orders/
│   │   │   └── OrderDetailModal.tsx
│   │   ├── products/
│   │   │   └── ProductDetailModal.tsx
│   │   └── tickets/
│   │       └── TicketDetailModal.tsx
│   ├── hooks/
│   │   └── useDebouncedValue.ts
│   ├── lib/
│   │   ├── api.ts              # Axios instance, interceptors, apiGet/Post/Put/Patch/Delete helpers
│   │   ├── types.ts            # TypeScript DTOs mirrored from TDSuperApp.DTOs
│   │   ├── permissions.ts      # PermissionEnum constants matching C# backend
│   │   ├── permissionGroups.ts # Grouped permissions for role management UI
│   │   ├── paymentMethods.ts   # Payment method constants
│   │   └── utils.ts            # Formatting utilities (currency, date, number)
│   ├── pages/
│   │   ├── Login.tsx           # Split-screen login page
│   │   ├── Dashboard.tsx       # Admin dashboard with KPIs & charts
│   │   ├── Products.tsx
│   │   ├── Orders.tsx
│   │   ├── Brands.tsx
│   │   ├── Warehouses.tsx
│   │   ├── Customers.tsx
│   │   ├── CacData.tsx
│   │   ├── Kyc.tsx
│   │   ├── ProductGroups.tsx
│   │   ├── Promos.tsx
│   │   ├── PromosAuditLogs.tsx
│   │   ├── Deals.tsx
│   │   ├── DealsAuditLogs.tsx
│   │   ├── Tickets.tsx
│   │   ├── Ratings.tsx
│   │   ├── EmailChangeRequests.tsx
│   │   ├── RequestAppeals.tsx
│   │   ├── AdminUsers.tsx
│   │   ├── Roles.tsx
│   │   └── Forbidden.tsx       # 403 access-denied page
│   ├── stores/
│   │   └── auth.ts             # Zustand store: auth state, login, logout, permission checks
│   └── theme/
│       └── antd.ts             # Custom burgundy Ant Design theme configuration
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## Features & Pages

| Page | Route | Required Permission | Description |
|------|-------|---------------------|-------------|
| **Dashboard** | `/` | `CanViewDashboard` | KPI cards, transaction/order/ticket pie charts, top 5 products, last 5 orders, date range filter |
| **Products** | `/products` | `CanViewProducts` | Product catalog management with images, pricing, warehouses |
| **Orders** | `/orders` | `CanViewOrders` | Order tracking, status updates, payment & delivery details |
| **Customers** | `/customers` | `CanViewUser` | Customer directory with company info, credit limits, order history |
| **CAC Data** | `/cac-data` | `CanViewUser` | Corporate Affairs Commission registration records |
| **KYC** | `/kyc` | `CanEditUser` | Know Your Customer review & Dynamics account creation |
| **Promos** | `/promos` | `CanViewPromos` | Promotional campaign management |
| **Promos Audit Logs** | `/promos-audit-logs` | `CanViewPromos` | Change history for promo records |
| **Product Groups** | `/product-groups` | `CanViewProductGroup` | Grouped product collections |
| **Brands** | `/brands` | `CanViewBrands` | Brand directory with logos and active status |
| **Deals** | `/deals` | `CanViewBrands` | Deal management (percentage/fixed/BOGOF) |
| **Deals Audit Logs** | `/deals-audit-logs` | `CanViewBrands` | Change history for deal records |
| **Warehouses** | `/warehouses` | `CanViewWarehouses` | Warehouse/location management |
| **Tickets** | `/tickets` | `CanViewTicket` | Customer support tickets with comments & escalation |
| **Ratings** | `/ratings` | `CanViewRatings` | Customer product ratings & reviews |
| **Email Change Requests** | `/email-requests` | `CanViewEmailChangeRequests` | Pending/approved/declined email change requests |
| **Request Appeals** | `/request-appeals` | `CanViewRequestAppeals` | General user appeal submissions |
| **Admin Users** | `/admin-users` | `CanViewSubUser` | Internal admin user accounts |
| **Roles** | `/roles` | `CanViewRoles` | Role & permission configuration |
| **Forbidden** | `/forbidden` | — | Access denied fallback page |
| **Login** | `/login` | — | Email/password authentication with return URL redirect |

---

## Architecture

### Lazy Loading & Code Splitting

All pages are loaded via `React.lazy()` to keep the initial bundle small. A shared skeleton loader is shown while page chunks are being fetched.

```tsx
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
```

### State Management

- **Server State**: TanStack Query handles all API caching, background refetching, and loading/error states. Default config: `staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`.
- **Client State**: Zustand manages the lightweight auth store (user profile, JWT, permission checks).

### Routing

React Router v6 with `createBrowserRouter`. Every protected route is wrapped in `ProtectedRoute`, which:

1. Redirects unauthenticated users to `/login` (preserving the intended return URL).
2. Redirects authenticated users without the required permission to `/forbidden`.

### Component Patterns

- **Modals**: Detail views (orders, products, tickets, KYC, CAC, customers) use inline modal components to avoid losing list context.
- **Forms**: Built with Ant Design `Form` components backed by DTO types from `@/lib/types`.
- **Tables**: Ant Design `Table` with server-side pagination where applicable.
- **Reusable UI**: `AuditLogsView`, `ConfirmDialog`, `ImageViewerModal`, and multi-select inputs are shared across multiple pages.

---

## Authentication & Authorization

### Login Flow

1. User submits credentials on the split-screen login page (`/login`).
2. `auth.ts` calls `POST authentication/login` and stores the `AdminAccessReturnDto` in `localStorage`.
3. The JWT `accessToken` is attached to every subsequent HTTP request via an Axios request interceptor.
4. On app reload, the store rehydrates auth state from `localStorage` automatically.

### Token Handling

- Tokens are decoded client-side (no crypto dependency) to check the `exp` claim.
- If a request returns `401 Unauthorized`, the token is cleared and the user is bounced to `/login` with a `returnUrl` parameter.

### Permissions

Permissions are string enums that match the C# `PermissionEnum` exactly (the backend uses `JsonStringEnumConverter`). The `hasPermission(permission)` helper in the auth store checks the current user's role permissions array.

Example permissions:
- `CanViewDashboard`
- `CanEditProducts`
- `CanViewOrders`
- `CanCreateSubUser`
- `CanEditRoles`

See `src/lib/permissions.ts` for the complete list.

---

## API Integration

All API calls go through `src/lib/api.ts`, which exposes:

```ts
apiGet<T>(url, config?)
apiPost<T>(url, data?, config?)
apiPut<T>(url, data?, config?)
apiPatch<T>(url, data?, config?)
apiDelete<T>(url, config?)
```

These helpers normalize the backend's `Result<T>` envelope (`{ status, message, data }`) and gracefully handle raw responses as well. Errors are captured and returned as uniform `ApiResult<T>` objects rather than throwing.

### Multipart Uploads

`toFormData(data, file?)` flattens an object into `FormData` for image/file uploads, matching the behavior of the Blazor `HttpService.PostFormAsync`.

### DTOs

All TypeScript interfaces in `src/lib/types.ts` are mirrored from `TDSuperApp.DTOs` namespaces to ensure type safety across the API boundary.

---

## Theming

The application uses a **custom burgundy** brand identity (`#800020`) applied globally through Ant Design's `ConfigProvider`.

Key theme tokens (`src/theme/antd.ts`):

| Token | Value |
|-------|-------|
| `colorPrimary` | `#800020` |
| `colorSuccess` | `#16a34a` |
| `colorWarning` | `#d97706` |
| `colorError` | `#dc2626` |
| `fontFamily` | Geist, system-ui, sans-serif |
| `borderRadius` | `8px` |

Tailwind CSS is configured with the same CSS custom properties so utility classes stay visually consistent with Ant Design components. Dark sidebar navigation uses a near-black burgundy tint (`#1a0a0e`).

---

## Responsive Design

- **Desktop (≥1024px)**: Collapsible sidebar (`Sider`) with persistent navigation.
- **Mobile (<1024px)**: Hamburger menu opens a left `Drawer` containing the full navigation menu.
- **Content**: Max content width is capped at `1400px` and centered. Tables and card grids adapt from multi-column layouts down to single column on small screens.

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | Start Vite dev server on `:5173` with HMR |
| Build | `npm run build` | Type-check and bundle for production to `dist/` |
| Preview | `npm run preview` | Serve the production build locally |
| Lint | `npm run lint` | Run ESLint across the project |

---

## Relationship to Blazor App

This React project is designed as a **drop-in replacement** for the Blazor WebAssembly admin UI (`SuperAppAdminWeb`). Both applications consume the identical `TDSuperApp.WEB` API.

| Blazor (Original) | React (This Project) |
|-------------------|----------------------|
| `Services/HttpService.cs` | `src/lib/api.ts` |
| `Services/AuthenticationService.cs` | `src/stores/auth.ts` |
| `Layout/MainLayout.razor` | `src/components/layout/MainLayout.tsx` |
| `Layout/NavMenu.razor` | `src/components/layout/NavMenu.tsx` |
| `Helpers/AppRouteView.cs` | `src/components/ProtectedRoute.tsx` |
| `Pages/Account/Login.razor` | `src/pages/Login.tsx` |
| `Pages/Dashboard/Home.razor` | `src/pages/Dashboard.tsx` |

### Porting Additional Pages

If you need to extend or port more Blazor pages:

1. Add a new page component under `src/pages/`.
2. Wire it into `src/routes.tsx` with `lazy()` and wrap it in `ProtectedRoute` with the appropriate permission.
3. Use `apiGet` / `apiPost` / etc. from `@/lib/api` — they return the same `{ status, message, data }` shape as the Blazor `Result<T>`.
4. Reuse existing DTOs in `@/lib/types.ts` or add new ones matching the backend contracts.

---

## License

&copy; TDAfrica. All rights reserved.

---

*One platform · One purpose · Powered by innovation*

