/** Ilustrações vetoriais de obra usadas no preview (demo) e como fallback sem foto. */
const PALETTES = [
  ["#1b2430", "#2b3644", "#d6ac42"], ["#182029", "#33404f", "#9fb4c8"], ["#1d2228", "#3a4350", "#e2c27a"],
  ["#15202a", "#2a3a48", "#7fa7c4"], ["#20252c", "#3b434d", "#c9a34a"],
];
export function buildingArt(seed = 0, w = 640, h = 420) {
  const [bg, mid, accent] = PALETTES[Math.abs(seed) % PALETTES.length];
  const floors = 5 + (seed % 4) * 2;
  const bw = 180 + (seed % 3) * 50;
  const x = (w - bw) / 2 + ((seed % 2) * 60 - 30);
  const fh = (h * 0.62) / floors;
  let win = "";
  for (let f = 0; f < floors; f++)
    for (let c = 0; c < 5; c++)
      win += `<rect x="${x + 14 + c * ((bw - 28) / 5)}" y="${h * 0.3 + f * fh + 6}" width="${(bw - 28) / 5 - 8}" height="${fh - 12}" rx="2" fill="${(f + c + seed) % 3 === 0 ? accent : "#0e141b"}" opacity="${(f + c) % 3 === 0 ? 0.85 : 0.65}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#s)"/>
  <circle cx="${w * 0.82}" cy="${h * 0.18}" r="38" fill="${accent}" opacity=".18"/>
  <rect x="${x - 70}" y="${h * 0.52}" width="80" height="${h * 0.48}" fill="#0f151c" opacity=".7"/>
  <rect x="${x + bw - 10}" y="${h * 0.45}" width="110" height="${h * 0.55}" fill="#111820" opacity=".8"/>
  <rect x="${x}" y="${h * 0.28}" width="${bw}" height="${h * 0.72}" fill="#18212b" stroke="${accent}" stroke-opacity=".25"/>
  ${win}
  <line x1="${x + bw + 30}" y1="${h * 0.05}" x2="${x + bw + 30}" y2="${h}" stroke="${accent}" stroke-width="5" opacity=".55"/>
  <line x1="${x - 40}" y1="${h * 0.07}" x2="${x + bw + 90}" y2="${h * 0.07}" stroke="${accent}" stroke-width="4" opacity=".55"/>
  <rect y="${h * 0.93}" width="${w}" height="${h * 0.07}" fill="#0b1016"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export function resolveDemoUrl(u: string | undefined | null) {
  if (!u) return null;
  const m = u.match(/^demo:\/\/(capa|foto)\/(\d+)/);
  if (m) return buildingArt(Number(m[2]) + (m[1] === "foto" ? 7 : 0));
  if (u === "demo://arquivo") return null;
  return u;
}
