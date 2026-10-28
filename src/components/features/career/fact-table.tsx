import Link from "next/link";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  FACT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  type StatusName,
  factPeriod,
  factTitle,
} from "@/modules/career/presentation";
import type { FactTypeName } from "@/modules/career/schemas";

export type FactRow = {
  id: string;
  factType: FactTypeName;
  content: Record<string, unknown>;
  status: StatusName;
  sourceTitle: string | null;
  updatedAt: string;
};

export function FactTable({ facts, filtered }: { facts: FactRow[]; filtered: boolean }) {
  if (facts.length === 0) {
    return filtered ? (
      <EmptyState title="No matching facts" description="Try a different search or clear the filters." />
    ) : (
      <EmptyState
        title="No career facts yet"
        description="Record your employment history, qualifications, skills and achievements. Each fact needs a source before it can be verified."
        action={
          <Link href="/career/facts/new" className={buttonClasses("secondary")}>
            Add your first fact
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Fact
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Source
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {facts.map((fact) => {
            const period = factPeriod(fact.content);
            return (
              <tr key={fact.id} className="hover:bg-surface-muted/60">
                <td className="max-w-md px-5 py-3">
                  <Link href={`/career/facts/${fact.id}`} className="font-medium hover:text-accent hover:underline">
                    <span className="line-clamp-2">{factTitle(fact.factType, fact.content)}</span>
                  </Link>
                  {period && <p className="mt-0.5 text-xs text-fg-muted">{period}</p>}
                </td>
                <td className="px-3 py-3 text-fg-muted">{FACT_TYPE_LABELS[fact.factType]}</td>
                <td className="px-3 py-3">
                  {fact.sourceTitle ?? <span className="text-xs text-warning">No source</span>}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={STATUS_TONES[fact.status]}>{STATUS_LABELS[fact.status]}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
