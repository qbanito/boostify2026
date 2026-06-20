import { Link } from "wouter";
import { ReactNode } from "react";
import { MusicIcon, LayoutDashboard, Users, Settings, Activity, FileText, Music, Grid } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

/**
 * Componente de Layout principal para la aplicación
 * 
 * Proporciona una estructura consistente con navegación lateral 
 * para todas las páginas de la aplicación.
 */
export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Barra lateral */}
      <div className="w-64 bg-background border-r hidden lg:block">
        <div className="h-full flex flex-col">
          {/* Logo y título */}
          <div className="p-6 border-b">
            <Link href="/" className="flex items-center space-x-2">
              <MusicIcon className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">Boostify</span>
            </Link>
          </div>
          
          {/* Navegación */}
          <nav className="flex-1 p-4 space-y-1">
            <Link href="/dashboard" className="flex items-center px-3 py-2 rounded-md hover:bg-accent">
              <LayoutDashboard className="mr-2 h-5 w-5" />
              Dashboard
            </Link>
            
            <div className="pt-4 pb-2">
              <p className="px-3 text-sm font-medium text-muted-foreground">Herramientas</p>
            </div>
            
            <Link href="/music-generator" className="flex items-center px-3 py-2 rounded-md hover:bg-accent bg-accent/50">
              <Music className="mr-2 h-5 w-5" />
              Generador de Música
            </Link>
            
            <Link href="/producer-tools" className="flex items-center px-3 py-2 rounded-md hover:bg-accent">
              <Grid className="mr-2 h-5 w-5" />
              Herramientas de Producción
            </Link>
            
            <Link href="/analytics" className="flex items-center px-3 py-2 rounded-md hover:bg-accent">
              <Activity className="mr-2 h-5 w-5" />
              Analytics
            </Link>
            
            <div className="pt-4 pb-2">
              <p className="px-3 text-sm font-medium text-muted-foreground">Gestión</p>
            </div>
            
            <Link href="/profile" className="flex items-center px-3 py-2 rounded-md hover:bg-accent">
              <Users className="mr-2 h-5 w-5" />
              Perfil
            </Link>
            
            <Link href="/settings" className="flex items-center px-3 py-2 rounded-md hover:bg-accent">
              <Settings className="mr-2 h-5 w-5" />
              Configuración
            </Link>
            
            <Link href="/documentation" className="flex items-center px-3 py-2 rounded-md hover:bg-accent">
              <FileText className="mr-2 h-5 w-5" />
              Documentación
            </Link>
          </nav>
          
          {/* Información del usuario */}
          <div className="p-4 border-t">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-medium">U</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">Usuario</p>
                <p className="text-xs text-muted-foreground">usuario@boostify.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Encabezado móvil */}
        <header
          className="border-b p-4 flex items-center justify-between lg:hidden"
          style={{
            paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))',
            paddingLeft: 'max(1rem, calc(env(safe-area-inset-left, 0px) + 1rem))',
            paddingRight: 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))',
          }}
        >
          <Link href="/" className="flex items-center space-x-2">
            <MusicIcon className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Boostify</span>
          </Link>
          
          {/* Menú móvil - simplificado para este ejemplo */}
          <button className="p-2 rounded-md hover:bg-accent">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
        
        {/* Área de contenido */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}