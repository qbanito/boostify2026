import { UsersRound } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { CommunityManager } from './CommunityManager';

/**
 * Group Manager — register Telegram VIP groups (community chat) and mint invite
 * links for your most engaged supporters.
 */
export function GroupManager({ center }: { center: TelegramCenter }) {
  return (
    <CommunityManager
      center={center}
      type="group"
      icon={<UsersRound className="h-5 w-5" />}
      title="Grupos VIP"
      subtitle="Comunidad cerrada para tus top fans: conversación directa, perks y acceso anticipado."
      kindLabel="grupo"
    />
  );
}
