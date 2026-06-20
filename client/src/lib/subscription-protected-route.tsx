import { Route } from "wouter";
import React from "react";

interface SubscriptionProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  requiredPlan: string;
}

/**
 * SubscriptionProtectedRoute - SIMPLIFICADO
 * Siempre renderiza el componente directamente sin banner
 */
export function SubscriptionProtectedRoute({
  path,
  component: Component,
  requiredPlan
}: SubscriptionProtectedRouteProps) {
  return <Route path={path} component={Component} />;
}