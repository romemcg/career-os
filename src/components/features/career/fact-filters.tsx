"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { FACT_TYPE_LABELS, STATUS_LABELS } from "@/modules/career/presentation";

export function FactFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(next: Record<string, string>) {
    const query = new URLSearchParams(params);
    query.delete("cursor");
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    router.push(`${pathname}?${query.toString()}`);
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ q: String(new FormData(event.currentTarget).get("q") ?? "") });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-3 md:flex-row md:items-center">
      <form onSubmit={onSearch} className="flex flex-1 gap-2" role="search">
        <label htmlFor="fact-search" className="sr-only">
          Search facts
        </label>
        <Input id="fact-search" name="q" placeholder="Search facts…" defaultValue={params.get("q") ?? ""} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="flex gap-2">
        <label htmlFor="filter-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="filter-status"
          value={params.get("status") ?? ""}
          onChange={(e) => apply({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label htmlFor="filter-type" className="sr-only">
          Filter by type
        </label>
        <Select id="filter-type" value={params.get("type") ?? ""} onChange={(e) => apply({ type: e.target.value })}>
          <option value="">All types</option>
          {Object.entries(FACT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
