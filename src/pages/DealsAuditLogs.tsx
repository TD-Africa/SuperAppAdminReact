import { AuditLogsView } from "@/components/AuditLogsView";
import type { DealAuditLogItem } from "@/lib/types";

export default function DealsAuditLogsPage() {
  return (
    <AuditLogsView<DealAuditLogItem>
      title="Deals audit log"
      description="Every create, edit, and delete action on deals."
      listUrl="AuditLog/GetAllDealAuditLog"
      byIdUrl="AuditLog/GetByIdDealAuditLog/"
      entityIdField="dealId"
      entityIdLabel="Deal ID"
    />
  );
}
