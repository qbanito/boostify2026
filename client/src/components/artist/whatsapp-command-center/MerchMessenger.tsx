import { ShoppingBag, Package } from 'lucide-react';
import type { WhatsAppCenter } from '../../../hooks/use-whatsapp-center';
import { GlassCard, PanelHeader, StatTile, ConciergeComposer } from './shared';

/**
 * Merch Store Messenger — send catalog items (image + price + pay link),
 * confirm orders and share tracking, all over WhatsApp.
 */
export function MerchMessenger({ center }: { center: WhatsAppCenter }) {
  const template =
    '🛍️ ¡Nuevo drop disponible!\n\n• Producto: Hoodie Edición Limitada\n• Precio: $54.99\n\nCompra aquí 👉 https://boostify.app/store/…\n\nEnvío a todo el país 📦';

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<ShoppingBag className="h-5 w-5" />}
        title="Merch Store Messenger"
        subtitle="Comparte catálogo, precios y link de pago; confirma órdenes y tracking."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Merch vendido" value={center.analytics?.merchSold ?? 0} />
        <StatTile label="Conversión" value={`${center.analytics?.conversionRate ?? 0}%`} accent="sky" />
        <StatTile label="Ingresos" value={`$${(center.analytics?.revenue ?? 0).toFixed(0)}`} accent="amber" />
      </div>
      <GlassCard className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
          <Package className="h-4 w-4 text-emerald-300" /> Ficha de producto (incluye una imagen para mayor conversión)
        </div>
        <ConciergeComposer center={center} placeholder="Descripción del producto + link de pago…" defaultMessage={template} ctaLabel="Enviar producto" />
      </GlassCard>
    </div>
  );
}
