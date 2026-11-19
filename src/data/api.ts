import type { Role, Row } from "./types";
import { IS_DEMO } from "@/lib/env";

export interface ListOpts {
  embed?: string[];
  eq?: Record<string, unknown>;
  neq?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  gte?: Record<string, unknown>;
  lte?: Record<string, unknown>;
  lt?: Record<string, unknown>;
  isNull?: string[];
  search?: { cols: string[]; term: string };
  order?: { col: string; asc?: boolean }[];
  limit?: number;
}

export interface SessionUser { id: string; email: string }
export interface AuthSnapshot { user: SessionUser | null; recovery?: boolean }

export interface Api {
  // dados
  list<T = Row>(table: string, opts?: ListOpts): Promise<T[]>;
  get<T = Row>(table: string, id: string, embed?: string[], key?: string): Promise<T | null>;
  insert<T = Row>(table: string, row: Row): Promise<T>;
  update<T = Row>(table: string, id: string, patch: Row, key?: string): Promise<T>;
  remove(table: string, id: string, key?: string): Promise<void>;
  removeWhere(table: string, eq: Record<string, unknown>): Promise<void>;
  rpc<T = unknown>(fn: string, args?: Row): Promise<T>;
  invoke<T = unknown>(fn: string, body: Row): Promise<T>;
  // arquivos
  upload(bucket: string, path: string, file: File | Blob): Promise<string>;
  fileUrl(bucket: string, path: string): Promise<string>;
  removeFile(bucket: string, path: string): Promise<void>;
  // auth
  getSession(): Promise<AuthSnapshot>;
  onAuthChange(cb: (s: AuthSnapshot, event: string) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  loadAccess(userId: string): Promise<{ profile: Row | null; role: Role | null }>;
  watchAccess(userId: string, cb: () => void): () => void;
}

let impl: Api | null = null;
export async function loadApi(): Promise<Api> {
  if (impl) return impl;
  impl = IS_DEMO ? (await import("./demoApi")).demoApi : (await import("./supabaseApi")).supabaseApi;
  return impl;
}
export function api(): Api {
  if (!impl) throw new Error("API não inicializada");
  return impl;
}
