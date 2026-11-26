// Servidor de produção (Shard Cloud): entrega o build do Vite (dist/), sem dependências.
// - /config.js gerado das variáveis SUPABASE_URL e SUPABASE_ANON_KEY (lidas ao iniciar)
// - /health para monitoramento
// - SPA: rotas desconhecidas caem no index.html
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
// Shard Cloud exige porta 80 em 0.0.0.0 (APP_PORT só para testes locais)
const PORT = Number(process.env.APP_PORT) || 80;
const HOST = "0.0.0.0";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
};
const SEC = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" };

// limpa espaços, aspas e barra final que costumam vir ao colar no painel
const clean = (v) => String(v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const rawUrl = clean(process.env.SUPABASE_URL);
// aproveita o primeiro endereço válido (corrige URL colada duas vezes, com /rest/v1, barra final etc.)
const url = (rawUrl.match(/https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/i)?.[0] ?? rawUrl.replace(/\/+(rest\/v1)?\/?$/, "")).toLowerCase();
if (url && url !== rawUrl) console.warn(`[tecnica] SUPABASE_URL ajustada de "${rawUrl}" para "${url}". Corrija no painel quando puder.`);
const key = clean(process.env.SUPABASE_ANON_KEY);
if (!url || !key) console.warn("[tecnica] AVISO: defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis da Aplicação.");
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) || /SEU-PROJETO/i.test(url))
  console.warn(`[tecnica] AVISO: SUPABASE_URL parece inválida: "${url}" (esperado https://xxxx.supabase.co).`);
else console.log(`[tecnica] Supabase: ${url} (chave anon com ${key.length} caracteres)`);
if (/COLE_AQUI/i.test(key)) console.warn("[tecnica] AVISO: SUPABASE_ANON_KEY ainda é o texto de exemplo.");
const CONFIG = `window.__ENV__ = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key })};\n`;

const cacheFor = (p) =>
  p.startsWith("/assets/") ? "public, max-age=31536000, immutable"
    : /^\/(index\.html|sw\.js|manifest\.webmanifest)$/.test(p) ? "no-cache" : "public, max-age=3600";

async function send(res, file, path) {
  const body = await readFile(file);
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": cacheFor(path), ...SEC });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
    if (path === "/health") { res.writeHead(200, { "Content-Type": "text/plain" }).end("ok\n"); return; }
    if (path === "/config.js") { res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store", "Cloudflare-CDN-Cache-Control": "no-store", ...SEC }).end(CONFIG); return; }
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const s = await stat(file).catch(() => null);
    if (s?.isFile()) return await send(res, file, path);
    if (extname(path)) { res.writeHead(404, SEC).end("Não encontrado"); return; } // arquivo inexistente
    await send(res, join(ROOT, "index.html"), "/index.html");                     // rota do app
  } catch (e) {
    console.error("[tecnica] erro:", e);
    if (!res.headersSent) res.writeHead(500).end("Erro interno");
  }
}).listen(PORT, HOST, () => console.log(`[tecnica] app no ar em http://${HOST}:${PORT}`));
