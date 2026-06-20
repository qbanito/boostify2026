import { t, type Lang } from '../../lib/videoservice-i18n';

export interface BudgetInputs {
  needsRealVideo: boolean;
  needsLipSync: boolean;
  resolution: '1080p' | '4k';
  videoDuration: string;
  locations: string;
}

export interface BudgetResult {
  base: number;
  lipSync: number;
  resolution4k: number;
  realVideo: number;
  total: number;
  /** Reservation locks the slot — paid up-front, only $99 */
  reservationFee: number;
  /** 50% of the project, paid after script approval (already discounts the reservation) */
  scriptPayment: number;
  /** Final 50% paid before delivery */
  finalPayment: number;
  /** Premium tier (≥ $5,000) → 1 year of Boostify Premium ($7,000 value) + 35% off AI video */
  qualifiesForPremium: boolean;
  premiumAccessValue: number;
  aiVideoDiscountPct: number;
  /** Legacy: keep for any remaining UI calling .deposit; mirrors reservationFee */
  deposit: number;
}

export const RESERVATION_FEE = 99;
export const PREMIUM_THRESHOLD = 5000;
export const PREMIUM_ACCESS_VALUE = 7000;
export const AI_VIDEO_DISCOUNT_PCT = 35;
export const PRICE_FLOOR = 2500;
export const PRICE_CEILING = 25000;

export function calculateBudget(inputs: BudgetInputs): BudgetResult {
  // Base tiers
  const base = inputs.needsRealVideo ? 5000 : 2500;
  const lipSync = inputs.needsLipSync ? 500 : 0;
  const resolution4k = inputs.resolution === '4k' ? 1500 : 0;

  // Extra locations only count for real shoots, $2,500 per additional location beyond first
  const locationCount = (inputs.locations || '').split(',').map(s => s.trim()).filter(Boolean).length;
  const extraLocations = inputs.needsRealVideo ? Math.max(0, locationCount - 1) : 0;
  const realVideo = extraLocations * 2500;

  // Long-form duration premium (over ~4 min)
  const dur = parseFloat(inputs.videoDuration || '0');
  const durationPremium = dur > 4 ? Math.min(5000, Math.ceil((dur - 4) / 1) * 1000) : 0;

  let total = base + lipSync + resolution4k + realVideo + durationPremium;
  total = Math.max(PRICE_FLOOR, Math.min(PRICE_CEILING, total));

  const qualifiesForPremium = total >= PREMIUM_THRESHOLD;
  const reservationFee = RESERVATION_FEE;
  // After script approval: pay up to 50% of total, minus the reservation already paid
  const scriptPayment = Math.max(0, Math.round(total * 0.5) - reservationFee);
  const finalPayment = total - reservationFee - scriptPayment;

  return {
    base,
    lipSync,
    resolution4k,
    realVideo: realVideo + durationPremium,
    total,
    reservationFee,
    scriptPayment,
    finalPayment,
    qualifiesForPremium,
    premiumAccessValue: qualifiesForPremium ? PREMIUM_ACCESS_VALUE : 0,
    aiVideoDiscountPct: qualifiesForPremium ? AI_VIDEO_DISCOUNT_PCT : 0,
    deposit: reservationFee,
  };
}

interface Props {
  inputs: BudgetInputs;
  lang: Lang;
}

export function BudgetCalculator({ inputs, lang }: Props) {
  const budget = calculateBudget(inputs);
  const isEs = lang === 'es';

  const lines: { label: string; value: number }[] = [
    { label: t('budgetBase', lang) as string, value: budget.base },
  ];
  if (budget.lipSync > 0) lines.push({ label: t('budgetLipSync', lang) as string, value: budget.lipSync });
  if (budget.resolution4k > 0) lines.push({ label: t('budget4k', lang) as string, value: budget.resolution4k });
  if (budget.realVideo > 0) lines.push({ label: t('budgetLocations', lang) as string, value: budget.realVideo });

  return (
    <div className="space-y-4">
      <div className="bg-black/40 rounded-xl p-5 border border-white/10 space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{l.label}</span>
            <span className="text-white font-mono">${l.value.toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
          <span className="font-semibold text-white">{t('budgetTotal', lang)}</span>
          <span className="text-xl font-bold text-orange-400 font-mono">${budget.total.toLocaleString()}</span>
        </div>
      </div>

      {/* Reservation fee — $99 unlocks the project */}
      <div className="bg-gradient-to-br from-orange-500/15 to-red-500/10 border border-orange-500/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-orange-300">
            {isEs ? 'Reserva tu cupo hoy' : 'Lock your slot today'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEs
              ? 'Solo $99 ahora. El 50% se paga al aprobar el guión.'
              : 'Only $99 now. The 50% is paid after script approval.'}
          </p>
        </div>
        <span className="text-2xl font-black text-orange-400 font-mono">${budget.reservationFee}</span>
      </div>

      {/* Payment schedule preview */}
      <div className="bg-black/30 rounded-xl p-4 border border-white/10 space-y-2 text-xs">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
          {isEs ? 'Cronograma de pagos' : 'Payment schedule'}
        </p>
        <div className="flex items-center justify-between text-gray-400">
          <span>1. {isEs ? 'Reserva (hoy)' : 'Reservation (today)'}</span>
          <span className="text-orange-300 font-mono">${budget.reservationFee}</span>
        </div>
        <div className="flex items-center justify-between text-gray-400">
          <span>2. {isEs ? 'Después del guión (50%)' : 'After script approval (50%)'}</span>
          <span className="text-white font-mono">${budget.scriptPayment.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-gray-400">
          <span>3. {isEs ? 'Antes de entrega (50%)' : 'Before delivery (50%)'}</span>
          <span className="text-white font-mono">${budget.finalPayment.toLocaleString()}</span>
        </div>
      </div>

      {/* Premium perk banner — 1 year free Boostify + 35% off AI video */}
      {budget.qualifiesForPremium && (
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/20 via-fuchsia-500/15 to-orange-500/15 border border-purple-400/40 rounded-xl p-4">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40 mb-2 uppercase tracking-wider">
              ✨ {isEs ? 'Premium incluido' : 'Premium included'}
            </div>
            <p className="text-sm font-bold text-white mb-1.5">
              {isEs
                ? '1 año GRATIS de Boostify Premium'
                : '1 year FREE of Boostify Premium'}
              <span className="ml-1.5 text-xs text-purple-300 font-normal">
                ({isEs ? 'valor' : 'worth'} ${budget.premiumAccessValue.toLocaleString()})
              </span>
            </p>
            <ul className="text-xs text-gray-300 space-y-1 mb-1.5">
              <li>• {isEs ? 'Acceso premium a todas las herramientas' : 'Premium access to every tool'}</li>
              <li>• {isEs ? `${budget.aiVideoDiscountPct}% de descuento en el generador de videos AI` : `${budget.aiVideoDiscountPct}% off the AI video generator`}</li>
              <li>• {isEs ? 'Tu landing page activa todo el año' : 'Your landing page live all year'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
