# SuperApp Admin (React)

Modern React admin UI that mirrors the existing Blazor WebAssembly app at
`../SuperApp/SuperAppAdminWeb/`. Talks to the same `TDSuperApp.WEB` API with no
backend changes.

## Stack

- **Vite** + **React 18** + **TypeScript** (strict)
- **Tailwind CSS** + **shadcn/ui** (Radix primitives, owned components in `src/components/ui/`)
- **React Router v6** (lazy-loaded routes, protected routes with permission gates)
- **TanStack Query** for server state
- **Zustand** for auth state
- **Axios** for HTTP (bearer-token interceptor, 401 bounce-to-login)
- **React Hook Form** + **Zod** for forms
- **Recharts** for dashboard charts
- **Sonner** for toasts
- **lucide-react** for icons

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable                 | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `VITE_API_BASE_URL`      | Base URL of the TDSuperApp.WEB API (must end in `/`). |
| `VITE_AUTH_STORAGE_KEY`  | `localStorage` key the JWT is persisted under.        |

The default points at the same test API the Blazor app uses.

## Architecture

```
src/
├── App.tsx              # QueryClient, Router, Toaster
├── main.tsx             # Entry
├── routes.tsx           # Route table (lazy + permission-gated)
├── index.css            # Tailwind + shadcn CSS vars
├── lib/
│   ├── api.ts           # axios client + apiGet/Post/Put/Patch/Delete, FormData helper
│   ├── types.ts         # DTOs mirrored from TDSuperApp.DTOs
│   ├── permissions.ts   # PermissionEnum (string values matching C# names)
│   └── utils.ts         # cn, number/currency/date formatters
├── stores/
│   └── auth.ts          # Zustand: user, isLoggedIn, hasPermission, login, logout
├── components/
│   ├── ui/              # shadcn primitives (Button, Card, Input, Label, Table, ...)
│   ├── layout/
│   │   ├── MainLayout.tsx   # Sidebar + topbar + <Outlet />
│   │   └── NavMenu.tsx      # Permission-gated nav (mirror of NavMenu.razor)
│   └── ProtectedRoute.tsx   # Redirects to /login if not authed, /forbidden if no perm
└── pages/
    ├── Login.tsx        # Split-screen sign-in
    ├── Dashboard.tsx    # KPIs, pie charts, top products, last 5 orders
    ├── Forbidden.tsx
    └── Placeholder.tsx  # Stub for not-yet-ported pages
```

## Mapping to the Blazor app

| Blazor                                                | React                                              |
| ----------------------------------------------------- | -------------------------------------------------- |
| `SuperAppAdminWeb/Services/HttpService.cs`            | `src/lib/api.ts`                                   |
| `SuperAppAdminWeb/Services/AuthenticationService.cs`  | `src/stores/auth.ts`                               |
| `SuperAppAdminWeb/Layout/MainLayout.razor`            | `src/components/layout/MainLayout.tsx`             |
| `SuperAppAdminWeb/Layout/NavMenu.razor`               | `src/components/layout/NavMenu.tsx`                |
| `SuperAppAdminWeb/Helpers/AppRouteView.cs`            | `src/components/ProtectedRoute.tsx`                |
| `Pages/Account/Login.razor`                           | `src/pages/Login.tsx`                              |
| `Pages/Dashboard/Home.razor`                          | `src/pages/Dashboard.tsx`                          |

## Porting the remaining pages

Each placeholder route (`/products`, `/orders`, `/brands`, etc.) corresponds to
a folder under `SuperAppAdminWeb/Pages/`. To port one:

1. Replace `src/pages/Placeholder.tsx` usage in `src/routes.tsx` with a real page
   component.
2. Use `apiGet/apiPost/...` from `@/lib/api` — they return the same
   `{ status, message, data }` shape as the Blazor `Result<T>`.
3. Wrap protected routes with `<ProtectedRoute permission={Permission.Can...}>`.
4. Reuse shadcn primitives in `@/components/ui/` (add more with
   `npx shadcn@latest add <component>` if needed).

## Scripts

| Script           | What it does                                  |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Start Vite dev server on :5173                |
| `npm run build`  | Type-check + production build to `dist/`      |
| `npm run preview`| Preview the production build locally          |
