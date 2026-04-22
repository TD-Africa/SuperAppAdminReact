import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import { router } from "./routes";
import { antdTheme } from "./theme/antd";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
