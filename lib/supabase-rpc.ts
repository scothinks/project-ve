import type { Json } from "@/types/database";

export function nullableRpcText(value: string | null | undefined): string {
  return value as string;
}

export function asSupabaseJson(value: unknown): Json {
  return value as Json;
}
