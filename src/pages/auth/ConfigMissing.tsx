export function ConfigMissing() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0D12", color: "#ECEFF3", fontFamily: "system-ui", padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Configuração pendente</h1>
        <p style={{ color: "#8A94A3", lineHeight: 1.6 }}>
          Cadastre <code>SUPABASE_URL</code> (ex.: https://xxxx.supabase.co) e <code>SUPABASE_ANON_KEY</code> nas variáveis da aplicação e reinicie.
          <br /><span style={{ fontSize: 13 }}>Em desenvolvimento local: <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code>.</span>
        </p>
        <p style={{ marginTop: 24, fontSize: 11, color: "#6b6b72" }}>v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
