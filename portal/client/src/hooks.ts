import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const mine = ++seq.current;
    try {
      const res = await api.get<T>(path);
      if (mine === seq.current) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(path !== null);
    setData(null);
    void load();
  }, [load, path]);

  return { data, setData, error, loading, reload: load };
}

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Runs an action and tracks busy/error state for buttons and forms. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}
