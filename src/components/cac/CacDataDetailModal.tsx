import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { apiGet } from "@/lib/api";
import type { CacPersonResponse, CacRegistrationResponse } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Props {
  cacId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CacDataDetailModal({ cacId, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["cac", cacId],
    queryFn: async () => {
      if (!cacId) return null;
      const res = await apiGet<CacRegistrationResponse>(
        `CacRegistration/GetCacRegistrationById/${cacId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load CAC record");
      return res.data;
    },
    enabled: !!cacId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data?.firstPreferredBusinessName ?? "CAC registration"}
          </DialogTitle>
          <DialogDescription>
            {data?.transactionReference ?? (cacId ? `#${cacId.slice(0, 8)}` : "Loading…")}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="First preferred business name"
                value={data.firstPreferredBusinessName ?? "—"}
              />
              <Field
                label="Second preferred business name"
                value={data.secondPreferredBusinessName ?? "—"}
              />
              <Field label="Date submitted" value={formatDate(data.dateCreated)} />
              <Field
                label="Transaction reference"
                value={data.transactionReference ?? "—"}
              />
            </div>
            {data.businessDescription && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Business description
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {data.businessDescription}
                </p>
              </div>
            )}

            <Separator />
            <PeopleTable
              title="Directors"
              count={data.directors?.length ?? 0}
              people={data.directors ?? []}
            />
            <PeopleTable
              title="Secretaries"
              count={data.secretaries?.length ?? 0}
              people={data.secretaries ?? []}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PeopleTable({
  title,
  count,
  people,
}: {
  title: string;
  count: number;
  people: CacPersonResponse[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">
        {title} ({count})
      </h4>
      {people.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          None listed.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date of birth</TableHead>
                <TableHead>Occupation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p, i) => (
                <TableRow key={`${p.email}-${i}`}>
                  <TableCell className="font-medium">
                    {[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDate(p.dateOfBirth)}</TableCell>
                  <TableCell>{p.occupation ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
