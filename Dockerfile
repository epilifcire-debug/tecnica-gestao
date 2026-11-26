# Técnica Engenharia — build estático + Nginx (Shard Cloud)
# Variáveis no painel: SUPABASE_URL, SUPABASE_ANON_KEY (e PORT, se a plataforma definir)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ENV PORT=80
# a imagem oficial processa /etc/nginx/templates/*.template com envsubst (só ${PORT} é usada)
ENV NGINX_ENVSUBST_FILTER=^PORT$
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
