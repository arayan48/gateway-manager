import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <div className="text-8xl font-extrabold text-accent-green/20 mb-4 font-mono">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Page introuvable</h1>
        <p className="text-slate-400 text-sm mb-8">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary flex items-center justify-center gap-2">
            <Home size={15} />
            Retour à l'accueil
          </Link>
          <button onClick={() => window.history.back()} className="btn-ghost flex items-center justify-center gap-2">
            <ArrowLeft size={15} />
            Page précédente
          </button>
        </div>
      </div>
    </div>
  )
}
