import type { ReactNode } from "react";
import { Card, Col } from "antd";

export function StatCard({ children }: { children: ReactNode }) {
  return (
    <Col xs={24} sm={12} xl={6}>
      <Card className="analytics-stat h-full">{children}</Card>
    </Col>
  );
}
