import { db, FieldValue } from '../firebase';

/**
 * Script para inicializar productos de afiliado en Firestore
 * Ejecutar una sola vez para crear productos de prueba
 */

const affiliateProducts = [
  {
    id: 'boostify-premium-monthly',
    name: 'Boostify Premium - Monthly',
    description: 'Access to all Boostify features including AI music video creation, unlimited exports, and premium templates',
    url: 'https://boostify.com/premium/monthly',
    category: 'subscription',
    price: 29.99,
    commissionRate: 0.30, // 30%
    imageUrl: '/assets/products/premium-monthly.png',
    features: ['Unlimited video exports', 'AI video generation', 'Premium templates', 'Priority support'],
    active: true
  },
  {
    id: 'boostify-premium-yearly',
    name: 'Boostify Premium - Yearly',
    description: 'Annual subscription with 2 months free. Full access to Boostify platform',
    url: 'https://boostify.com/premium/yearly',
    category: 'subscription',
    price: 299.99,
    commissionRate: 0.35, // 35%
    imageUrl: '/assets/products/premium-yearly.png',
    features: ['All Premium features', '2 months free', 'Extended cloud storage', 'Premium support'],
    active: true
  },
  {
    id: 'music-production-course',
    name: 'Complete Music Production Masterclass',
    description: 'Learn professional music production from industry experts',
    url: 'https://boostify.com/courses/music-production',
    category: 'course',
    price: 199.99,
    commissionRate: 0.25, // 25%
    imageUrl: '/assets/products/music-course.png',
    features: ['10+ hours of content', 'Certificate of completion', 'Lifetime access', 'Project files included'],
    active: true
  },
  {
    id: 'mastering-plugin-bundle',
    name: 'Professional Mastering Plugin Bundle',
    description: 'Complete set of mastering plugins for professional sound',
    url: 'https://boostify.com/products/mastering-bundle',
    category: 'product',
    price: 149.99,
    commissionRate: 0.20, // 20%
    imageUrl: '/assets/products/plugin-bundle.png',
    features: ['10 premium plugins', 'VST/AU compatible', 'Lifetime updates', 'Tutorial videos'],
    active: true
  },
  {
    id: 'music-distribution-package',
    name: 'Music Distribution Package',
    description: 'Distribute your music to all major streaming platforms',
    url: 'https://boostify.com/distribution',
    category: 'service',
    price: 79.99,
    commissionRate: 0.30, // 30%
    imageUrl: '/assets/products/distribution.png',
    features: ['All major platforms', 'Unlimited releases', 'Keep 100% royalties', 'Analytics dashboard'],
    active: true
  },
  {
    id: 'marketing-consultation',
    name: '1-on-1 Music Marketing Consultation',
    description: 'Personal consultation session with music marketing experts',
    url: 'https://boostify.com/services/consultation',
    category: 'service',
    price: 99.99,
    commissionRate: 0.40, // 40%
    imageUrl: '/assets/products/consultation.png',
    features: ['1 hour session', 'Personalized strategy', 'Action plan included', 'Email follow-up'],
    active: true
  },
  {
    id: 'sample-pack-collection',
    name: 'Ultimate Sample Pack Collection',
    description: 'Over 10,000 royalty-free samples for music production',
    url: 'https://boostify.com/products/sample-pack',
    category: 'product',
    price: 59.99,
    commissionRate: 0.25, // 25%
    imageUrl: '/assets/products/sample-pack.png',
    features: ['10,000+ samples', 'Royalty-free', 'Multiple genres', 'Instant download'],
    active: true
  },
  {
    id: 'mixing-masterclass',
    name: 'Advanced Mixing Techniques Course',
    description: 'Master the art of mixing with professional techniques',
    url: 'https://boostify.com/courses/mixing',
    category: 'course',
    price: 149.99,
    commissionRate: 0.25, // 25%
    imageUrl: '/assets/products/mixing-course.png',
    features: ['8+ hours content', 'Project files', 'Certificate', 'Private community access'],
    active: true
  }
];

async function initializeAffiliateProducts() {
  console.log('🚀 Inicializando productos de afiliado...\n');

  try {
    for (const product of affiliateProducts) {
      const { id, ...productData } = product;
      
      // Verificar si el producto ya existe
      const productRef = db.collection('affiliateProducts').doc(id);
      const productDoc = await productRef.get();
      
      if (productDoc.exists) {
        console.log(`⚠️  Producto "${product.name}" ya existe, actualizando...`);
        await productRef.update({
          ...productData,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        console.log(`✅ Creando producto "${product.name}"...`);
        await productRef.set({
          ...productData,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }

    console.log('\n✨ ¡Productos de afiliado inicializados correctamente!');
    console.log(`📦 Total de productos: ${affiliateProducts.length}`);
    
    // Listar productos creados
    console.log('\n📋 Productos disponibles:');
    affiliateProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - $${product.price} (${product.commissionRate * 100}% comisión)`);
    });

  } catch (error) {
    console.error('❌ Error inicializando productos:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  initializeAffiliateProducts()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script falló:', error);
      process.exit(1);
    });
}

export { initializeAffiliateProducts, affiliateProducts };
