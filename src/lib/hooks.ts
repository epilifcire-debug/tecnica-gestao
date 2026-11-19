import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type ListOpts } from "@/data/api";
import type { Row } from "@/data/types";
import { friendlyError } from "./errors";
import { resolveDemoUrl } from "./demoArt";

export function useList<T = Row>(table: string, opts?: ListOpts, enabled = true) {
  return useQuery({ queryKey: [table, "list", opts ?? {}], queryFn: () => api().list<T>(table, opts), enabled });
}
export function useGet<T = Row>(table: string, id: string | undefined, embed?: string[]) {
  return useQuery({ queryKey: [table, "get", id, embed ?? []], queryFn: () => api().get<T>(table, id!, embed), enabled: !!id });
}
export function useRpc<T = unknown>(fn: string, args: Row, key: QueryKey = [], enabled = true) {
  return useQuery({ queryKey: ["rpc", fn, args, ...key], queryFn: () => api().rpc<T>(fn, args), enabled });
}

/** Mutação com feedback padrão (toast de sucesso/erro) e invalidação das tabelas afetadas */
export function useSave<A, R = unknown>(fn: (a: A) => Promise<R>, opts: { invalidate: string[]; success?: string | ((r: R) => string); onDone?: (r: R) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      opts.invalidate.forEach((t) => qc.invalidateQueries({ queryKey: [t] }));
      qc.invalidateQueries({ queryKey: ["rpc"] });
      const msg = typeof opts.success === "function" ? opts.success(r) : opts.success;
      if (msg) toast.success(msg);
      opts.onDone?.(r);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, [q]);
  return m;
}

/** URL assinada / pública de um arquivo do Storage */
export function useFileUrl(bucket: string, path: string | null | undefined) {
  return useQuery({ queryKey: ["file", bucket, path], queryFn: async () => resolveDemoUrl(await api().fileUrl(bucket, path!)), enabled: !!path, staleTime: 20 * 60_000 });
}
