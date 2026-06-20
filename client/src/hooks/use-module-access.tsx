/**
 * useModuleAccess — resolves whether the current user can access a platform
 * module, combining the THREE sources of truth:
 *   1) admin override, 2) subscription tier, 3) one-time module unlocks.
 *
 * A subscription that covers the module's tier unlocks it. A one-time unlock
 * (or the all-access pass) unlocks it for life. Admins get everything.
 */
import { useQuery } from '@tanstack/react-query';
import { useSubscription } from '../lib/context/subscription-context';
import { resolveModuleAccess, ALL_ACCESS_KEY } from '../../../shared/module-catalog';

interface ModuleAccessResponse {
  unlockedKeys: string[];
  allAccess: boolean;
  isAdmin: boolean;
}

export function useModuleAccess() {
  const { currentPlan, isAdmin, isLoading: subLoading } = useSubscription();

  const { data, isLoading: accessLoading, refetch } = useQuery<ModuleAccessResponse>({
    queryKey: ['module-access'],
    queryFn: async () => {
      const res = await fetch('/api/modules/access', { credentials: 'include' });
      if (!res.ok) return { unlockedKeys: [], allAccess: false, isAdmin: false };
      return res.json();
    },
    staleTime: 60_000,
  });

  const unlockedKeys = data?.unlockedKeys || [];
  const adminAccess = isAdmin() || !!data?.isAdmin;

  const hasModuleAccess = (moduleKey: string): boolean =>
    resolveModuleAccess(moduleKey, currentPlan, unlockedKeys, adminAccess);

  return {
    // Wait for BOTH subscription and unlock state so subscribers never see a
    // paywall flash before their plan resolves.
    isLoading: subLoading || accessLoading,
    unlockedKeys,
    allAccess: unlockedKeys.includes(ALL_ACCESS_KEY),
    isAdmin: adminAccess,
    currentPlan,
    hasModuleAccess,
    refetch,
  };
}

export default useModuleAccess;
