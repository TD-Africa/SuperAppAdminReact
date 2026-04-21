import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Access denied</h1>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view this page.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
