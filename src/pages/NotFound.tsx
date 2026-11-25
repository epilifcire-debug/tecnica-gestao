import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="font-display text-6xl font-bold text-pearl">404</p>
      <h1 className="mt-3 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">O endereço acessado não existe ou foi movido.</p>
      <Link to="/"><Button variant="secondary" className="mt-6">Voltar ao início</Button></Link>
    </div>
  );
}
