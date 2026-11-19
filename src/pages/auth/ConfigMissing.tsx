export function ConfigMissing() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0D12", color: "#ECEFF3", fontFamily: "system-ui", padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Configuração pendente</h1>
        <p style={{ color: "#8A94A3", lineHeight: 1.6 }}>
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> (veja <code>.env.example</code>) e gere o build novamente.
        </p>
      </div>
    </div>
  );
}
