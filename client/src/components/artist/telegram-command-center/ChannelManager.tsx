import { Radio } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { CommunityManager } from './CommunityManager';

/**
 * Channel Manager — register Telegram channels (broadcast-style) and mint
 * invite links so fans can join your official channel.
 */
export function ChannelManager({ center }: { center: TelegramCenter }) {
  return (
    <CommunityManager
      center={center}
      type="channel"
      icon={<Radio className="h-5 w-5" />}
      title="Canales"
      subtitle="Tu canal oficial de difusión: anuncios, estrenos y novedades para todos tus fans."
      kindLabel="canal"
    />
  );
}
