export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Modo demonstração: só existe no build "demo" (preview). Produção sempre usa o Supabase. */
export const IS_DEMO = import.meta.env.VITE_DEMO === "true";
export const CONFIG_OK = IS_DEMO || (!!SUPABASE_URL && !!SUPABASE_ANON_KEY);
