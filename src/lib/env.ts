/**
 * Configuração em tempo de EXECUÇÃO: o container gera /config.js a partir das variáveis
 * SUPABASE_URL e SUPABASE_ANON_KEY do painel (Shard Cloud). Assim a mesma imagem serve
 * qualquer ambiente e trocar a chave não exige novo build. VITE_* fica como alternativa local.
 */
type RuntimeEnv = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
const rt: RuntimeEnv = (typeof window !== "undefined" && (window as unknown as { __ENV__?: RuntimeEnv }).__ENV__) || {};

export const SUPABASE_URL = (rt.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string | undefined;
export const SUPABASE_ANON_KEY = (rt.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
/** Modo demonstração: só existe no build "demo" (preview). Produção sempre usa o Supabase. */
export const IS_DEMO = import.meta.env.VITE_DEMO === "true";
export const CONFIG_OK = IS_DEMO || (!!SUPABASE_URL && !!SUPABASE_ANON_KEY);
