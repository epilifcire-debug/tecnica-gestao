import clsx from "clsx";
import { useFileUrl } from "@/lib/hooks";
import { buildingArt } from "@/lib/demoArt";

export function ObraCover({ o, className }: { o: { capa_path?: string | null; codigo?: number | null }; className?: string }) {
  const u = useFileUrl("obras", o.capa_path);
  const src = u.data ?? buildingArt(o.codigo ?? 0);
  return <img src={src} alt="" loading="lazy" className={clsx("object-cover", className)} onError={(e) => { (e.target as HTMLImageElement).src = buildingArt(o.codigo ?? 0); }} />;
}
