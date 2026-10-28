"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="danger">Something went wrong loading this page. Your data has not been changed.</Alert>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
