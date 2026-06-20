import { Route } from "wouter";

/**
 * ProtectedRoute - SIMPLIFICADO
 * Siempre renderiza el componente inmediatamente sin banner
 */
export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  return <Route path={path} component={Component} />;
}