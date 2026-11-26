#!/bin/sh
# Gera /config.js com as variáveis PÚBLICAS do app (nunca a service_role).
set -eu
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
: "${SUPABASE_URL:=}"
: "${SUPABASE_ANON_KEY:=}"
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "[tecnica] AVISO: defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis do painel." >&2
fi
cat > /usr/share/nginx/html/config.js <<JS
window.__ENV__ = { SUPABASE_URL: "$(esc "$SUPABASE_URL")", SUPABASE_ANON_KEY: "$(esc "$SUPABASE_ANON_KEY")" };
JS
echo "[tecnica] config.js gerado (porta ${PORT:-80})."
