"use client";

import { useEffect, useState } from "react";

/**
 * @names for a set of addresses, so pages can say "@kofi" rather than
 * "0x1B17…F55e". Looked up once per address per page load and shared.
 */
const cache = new Map<string, Promise<string | null>>();

function lookup(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  if (!cache.has(key))
    cache.set(key, fetch(`/api/tags?address=${address}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ found?: boolean; tag?: string }>) : null))
      .then((d) => (d?.found && d.tag ? d.tag : null))
      .catch(() => null));
  return cache.get(key)!;
}

export function useNames(addresses: readonly string[]): Record<string, string | null> {
  const [names, setNames] = useState<Record<string, string | null>>({});
  const key = addresses.map((a) => a.toLowerCase()).join(",");
  useEffect(() => {
    let active = true;
    const list = key ? key.split(",") : [];
    void Promise.all(list.map(async (a) => [a, await lookup(a)] as const))
      .then((entries) => { if (active) setNames(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [key]);
  return names;
}
