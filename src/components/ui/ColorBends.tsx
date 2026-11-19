import { useEffect, useRef } from "react";

/**
 * ColorBends — fundo de faixas de luz em WebGL (padrão EFCsys / React Bits).
 * Uso pontual: login, hero do dashboard, cards especiais.
 * Desempenho: resolução reduzida no mobile, pausa fora da tela/aba oculta,
 * quadro estático com prefers-reduced-motion e fallback em CSS sem WebGL.
 */
export interface ColorBendsProps {
  color?: string; speed?: number; frequency?: number; noise?: number; bandWidth?: number;
  rotation?: number; fadeTop?: number; iterations?: number; intensity?: number; className?: string;
}

/** Preset dourado do padrão EFCsys (luxo/premium) — cor da marca Técnica */
export const PRESET_DOURADO: ColorBendsProps = {
  color: "#D4AF37", speed: 0.18, frequency: 1.25, noise: 0.08, bandWidth: 0.32, rotation: 55, fadeTop: 0.88, iterations: 2, intensity: 1.2,
};

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 c;uniform float fr,nz,bw,rot,ft,it,inten;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
void main(){
 vec2 uv=gl_FragCoord.xy/r;vec2 q=uv-.5;q.x*=r.x/r.y;
 float a=radians(rot);q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;
 float acc=0.;
 for(int k=0;k<4;k++){ if(float(k)>=it) break;
  float fk=float(k)+1.;
  float w=sin(q.y*fr*3.1*fk + t*(.6+.25*fk) + n(q*2.2*fk + t*.15)*nz*12.);
  float band=q.x + .22*w/fk + .18*float(k) - .2;
  acc+= smoothstep(bw,0.,abs(band))*(1./fk);
 }
 float fade=smoothstep(1.-ft,1.,1.-uv.y)*.85+.15*(1.-uv.y);
 vec3 col=c*acc*inten*fade + c*.04;
 gl_FragColor=vec4(col, clamp(acc*fade*inten,0.,1.)*.9);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = parseInt(m.length === 3 ? m.split("").map((x) => x + x).join("") : m, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function ColorBends(props: ColorBendsProps) {
  const { color = "#D4AF37", speed = 0.2, frequency = 1.2, noise = 0.1, bandWidth = 0.3, rotation = 55, fadeTop = 0.85,
    iterations = 2, intensity = 1.1, className } = props;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) { canvas.dataset.fallback = "1"; return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [cr, cg, cb] = hexToRgb(color);
    gl.uniform3f(u("c"), cr, cg, cb);
    gl.uniform1f(u("fr"), frequency); gl.uniform1f(u("nz"), mobile ? noise * 0.6 : noise); gl.uniform1f(u("bw"), bandWidth);
    gl.uniform1f(u("rot"), rotation); gl.uniform1f(u("ft"), fadeTop); gl.uniform1f(u("it"), mobile ? Math.min(iterations, 1) : iterations);
    gl.uniform1f(u("inten"), mobile ? intensity * 0.85 : intensity);

    const scale = (mobile ? 0.5 : 0.75) * Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale)), h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(u("r"), w, h); }
    };
    let raf = 0, visible = true, t0 = performance.now();
    const frame = (now: number) => {
      resize();
      gl.uniform1f(u("t"), reduce ? 8 : ((now - t0) / 1000) * speed * 2);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    const vis = () => { cancelAnimationFrame(raf); if (document.visibilityState === "visible" && visible) { t0 = performance.now() - 1; raf = requestAnimationFrame(frame); } };
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(() => { if (reduce) frame(performance.now()); });
    ro.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  }, [color, speed, frequency, noise, bandWidth, rotation, fadeTop, iterations, intensity]);

  return (
    <canvas ref={ref} aria-hidden className={className}
      style={{ width: "100%", height: "100%", display: "block", background: "radial-gradient(60% 80% at 70% 20%, rgb(214 172 66 / .12), transparent 70%)" }} />
  );
}
