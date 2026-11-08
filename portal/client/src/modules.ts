import { useEffect, useState } from "react";
import { api } from "./api";

export type FieldType = "text" | "longtext" | "url" | "date" | "select" | "number" | "rating" | "checkbox" | "tags";
export type FieldDef = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; hint?: string; wide?: boolean; group?: string; max?: number };
export type Tone = "neutral" | "info" | "warn" | "ok" | "bad";
export type StatusDef = { key: string; label: string; tone: Tone };
export type ModuleDef = {
  key: string;
  label: string;
  singular: string;
  route: string;
  client: "required" | "optional";
  titleLabel: string;
  statuses?: StatusDef[];
  open?: string[];
  dateLabel?: string;
  amountLabel?: string;
  amountRequired?: boolean;
  fields: FieldDef[];
  columns: string[];
  board?: boolean;
  actions?: { key: string; label: string }[];
  summary?: { label: string; kind: "count" | "amount" }[];
  calendar?: boolean;
  scores?: { keys: string[]; max: number };
  empty: string;
};
export type RecordRow = {
  id: string;
  module: string;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  title: string;
  status: string | null;
  date: string | null;
  amount: number | null;
  data: Record<string, any>;
  overdue: boolean;
};

let cache: Promise<ModuleDef[]> | null = null;
export function useModules(): ModuleDef[] | null {
  const [mods, setMods] = useState<ModuleDef[] | null>(null);
  useEffect(() => {
    cache ??= api.get<ModuleDef[]>("/api/admin/records/modules").catch((e) => {
      cache = null;
      throw e;
    });
    let live = true;
    cache.then((m) => live && setMods(m)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return mods;
}

export const money = (n: number) => "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
export const stripUnit = (s: string) => s.replace(/\s*\(.*\)$/, "");
