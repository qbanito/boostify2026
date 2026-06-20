import { db } from '../server/firebase';
import { FieldValue } from 'firebase-admin/firestore';

async function registerAdminAsAffiliate() {
  try {
    // Usuario admin ID (reemplazar con tu ID real)
    const adminUserId = "2"; // Tu ID de admin
    
    const affiliateRef = db.collection('affiliates').doc(adminUserId);
    
    // Verificar si ya existe
    const doc = await affiliateRef.get();
    if (doc.exists) {
      console.log('✅ Ya estás registrado como afiliado');
      console.log('📊 Datos actuales:', doc.data());
      return;
    }
    
    // Crear afiliado con status approved
    await affiliateRef.set({
      fullName: "Admin User",
      email: "admin@boostify.com",
      phone: "",
      website: "https://boostify.com",
      socialMedia: {
        instagram: "",
        youtube: "",
        tiktok: "",
        twitter: ""
      },
      audienceSize: "10,000 - 50,000",
      marketingExperience: "Admin access - full permissions",
      promotionStrategy: "Platform administration and testing",
      language: "es",
      userId: adminUserId,
      status: "approved", // ✅ Aprobado automáticamente
      createdAt: FieldValue.serverTimestamp(),
      stats: {
        totalClicks: 125,
        conversions: 8,
        earnings: 240.50,
        pendingPayment: 120.25,
      },
      level: "Platino", // Nivel premium
    });
    
    console.log('✅ Admin registrado exitosamente como afiliado Platino');
    console.log('🎉 Ahora puedes acceder a todas las funcionalidades del dashboard');
    console.log('📍 Visita /affiliates para ver el dashboard completo');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

registerAdminAsAffiliate();
