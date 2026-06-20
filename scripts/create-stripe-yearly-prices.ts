/**
 * Script para crear Price IDs anuales en Stripe
 * Ejecutar con: npx tsx scripts/create-stripe-yearly-prices.ts
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('❌ Error: STRIPE_SECRET_KEY o TESTING_STRIPE_SECRET_KEY no encontrado');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2025-01-27.acacia' as any,
});

const YEARLY_PLANS = [
  {
    name: 'Creator Yearly',
    tier: 'creator',
    price: 604.00, // $50.33/mes efectivo
    description: 'Creator plan - Billed annually',
    features: [
      '10 AI-generated music videos per month',
      'Basic analytics dashboard',
      'Community support',
      'Standard video quality'
    ]
  },
  {
    name: 'Professional Yearly',
    tier: 'professional',
    price: 1007.00, // $83.92/mes efectivo
    description: 'Professional plan - Billed annually',
    features: [
      '50 AI-generated music videos per month',
      'Advanced analytics & insights',
      'Priority support',
      'HD video quality',
      'Custom branding'
    ]
  },
  {
    name: 'Enterprise Yearly',
    tier: 'enterprise',
    price: 1511.00, // $125.92/mes efectivo
    description: 'Enterprise plan - Billed annually',
    features: [
      'Unlimited AI-generated music videos',
      'Advanced analytics & reporting',
      '24/7 dedicated support',
      '4K video quality',
      'Full white-label solution',
      'API access'
    ]
  }
];

async function createYearlyPrices() {
  console.log('🚀 Creando Price IDs anuales en Stripe...\n');

  const results: Array<{tier: string, priceId: string, productId: string}> = [];

  for (const plan of YEARLY_PLANS) {
    try {
      console.log(`📦 Procesando: ${plan.name} ($${plan.price}/año)`);

      // 1. Buscar si ya existe un producto con este nombre
      const existingProducts = await stripe.products.search({
        query: `name:'${plan.name}'`,
        limit: 1
      });

      let productId: string;

      if (existingProducts.data.length > 0) {
        productId = existingProducts.data[0].id;
        console.log(`   ✓ Producto existente encontrado: ${productId}`);
      } else {
        // 2. Crear el producto
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
          metadata: {
            tier: plan.tier,
            billing: 'yearly',
            plan_type: 'subscription'
          }
        });
        productId = product.id;
        console.log(`   ✓ Producto creado: ${productId}`);
      }

      // 3. Crear el precio anual
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(plan.price * 100), // Convertir a centavos
        currency: 'usd',
        recurring: {
          interval: 'year',
          interval_count: 1
        },
        metadata: {
          tier: plan.tier,
          billing: 'yearly',
          monthly_equivalent: (plan.price / 12).toFixed(2)
        }
      });

      console.log(`   ✓ Price ID creado: ${price.id}`);
      console.log(`   💰 Precio: $${plan.price}/año ($${(plan.price/12).toFixed(2)}/mes)\n`);

      results.push({
        tier: plan.tier,
        priceId: price.id,
        productId: productId
      });

    } catch (error: any) {
      console.error(`   ❌ Error creando ${plan.name}:`, error.message);
    }
  }

  // 4. Mostrar resumen
  console.log('\n' + '='.repeat(70));
  console.log('✅ PRICE IDs CREADOS - Actualizar en shared/pricing-config.ts:');
  console.log('='.repeat(70) + '\n');

  results.forEach(result => {
    console.log(`${result.tier.toUpperCase()}_YEARLY_PRICE_ID = "${result.priceId}"`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('📋 CONFIGURACIÓN COMPLETA:');
  console.log('='.repeat(70) + '\n');

  console.log('export const STRIPE_PRICE_IDS = {');
  results.forEach((result, index) => {
    const tierUpper = result.tier.charAt(0).toUpperCase() + result.tier.slice(1);
    console.log(`  ${result.tier}Yearly: '${result.priceId}',${index < results.length - 1 ? '' : ''}`);
  });
  console.log('};\n');

  console.log('🎉 ¡Listo! Copia los Price IDs arriba en pricing-config.ts');
}

createYearlyPrices().catch(console.error);
