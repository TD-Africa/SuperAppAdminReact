import { AuditLogsView } from "@/components/AuditLogsView";
import type { PromoAuditLogItem } from "@/lib/types";

export default function PromosAuditLogsPage() {
  return (
    <AuditLogsView<PromoAuditLogItem>
      title="Promos audit log"
      description="Every create, edit, and delete action on promos."
      listUrl="AuditLog/GetAllPromoAuditLog"
      byIdUrl="AuditLog/GetByIdPromoAuditLog/"
      entityIdField="promoId"
      entityIdLabel="Promo ID"
    />
  );
}
