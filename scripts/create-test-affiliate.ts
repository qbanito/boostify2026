import { db } from '../db';
import { affiliates, affiliateLinks, affiliateBadges, affiliateMarketingMaterials } from '../db/schema';
import { eq } from 'drizzle-orm';

async function createTestAffiliate() {
  console.log('📝 Creando afiliado de prueba...');
  
  try {
    // User ID 2 is the admin user
    const userId = 2;

    // Check if already exists
    const [existing] = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
    
    if (existing) {
      console.log('✅ El afiliado ya existe, actualizando...');
      const [updated] = await db.update(affiliates)
        .set({
          level: 'Platino',
          status: 'approved',
          commissionRate: '25.00',
          totalClicks: 125,
          totalConversions: 8,
          totalEarnings: '240.50',
          pendingPayment: '120.25',
          paidAmount: '120.25',
          updatedAt: new Date()
        })
        .where(eq(affiliates.id, existing.id))
        .returning();
      
      console.log('✅ Afiliado actualizado:', updated);
      
      // Check if affiliate has links
      const links = await db.select().from(affiliateLinks)
        .where(eq(affiliateLinks.affiliateId, existing.id));
      
      if (links.length === 0) {
        // Create sample links
        await db.insert(affiliateLinks).values([
          {
            affiliateId: existing.id,
            uniqueCode: 'BOOST123',
            title: 'Suscripción Premium',
            description: 'Enlace de afiliado para suscripción premium',
            productType: 'subscription',
            productId: 'premium_monthly',
            clicks: 45,
            conversions: 3,
            earnings: '90.00',
            isActive: true
          },
          {
            affiliateId: existing.id,
            uniqueCode: 'VIDEO456',
            title: 'Music Video Bundle',
            description: 'Bundle de creación de videos musicales',
            productType: 'bundle',
            productId: 'video_bundle',
            clicks: 80,
            conversions: 5,
            earnings: '150.50',
            isActive: true
          }
        ]);
        console.log('✅ Enlaces de afiliado creados');
      }
      
      // Check if affiliate has badges
      const badges = await db.select().from(affiliateBadges)
        .where(eq(affiliateBadges.affiliateId, existing.id));
      
      if (badges.length === 0) {
        await db.insert(affiliateBadges).values([
          {
            affiliateId: existing.id,
            badgeType: 'first_sale',
            badgeName: 'Primera Venta',
            badgeDescription: 'Lograste tu primera venta como afiliado',
            iconUrl: null
          },
          {
            affiliateId: existing.id,
            badgeType: 'milestone_10',
            badgeName: '10 Conversiones',
            badgeDescription: 'Alcanzaste 10 conversiones exitosas',
            iconUrl: null
          }
        ]);
        console.log('✅ Insignias de afiliado creadas');
      }
    } else {
      // Create new affiliate
      const [newAffiliate] = await db.insert(affiliates).values({
        userId,
        fullName: 'Admin User',
        email: 'admin@boostify.com',
        website: 'https://boostify.com',
        socialMedia: JSON.stringify({
          instagram: '@boostify',
          twitter: '@boostify',
          youtube: 'boostify'
        }),
        audienceSize: '10000+',
        marketingExperience: 'Experto en marketing digital',
        promotionStrategy: 'Redes sociales, email marketing, contenido orgánico',
        level: 'Platino',
        commissionRate: '25.00',
        status: 'approved',
        totalClicks: 125,
        totalConversions: 8,
        totalEarnings: '240.50',
        pendingPayment: '120.25',
        paidAmount: '120.25'
      }).returning();

      console.log('✅ Afiliado creado:', newAffiliate);

      // Create sample links
      await db.insert(affiliateLinks).values([
        {
          affiliateId: newAffiliate.id,
          uniqueCode: 'BOOST123',
          title: 'Suscripción Premium',
          description: 'Enlace de afiliado para suscripción premium',
          productType: 'subscription',
          productId: 'premium_monthly',
          clicks: 45,
          conversions: 3,
          earnings: '90.00',
          isActive: true
        },
        {
          affiliateId: newAffiliate.id,
          uniqueCode: 'VIDEO456',
          title: 'Music Video Bundle',
          description: 'Bundle de creación de videos musicales',
          productType: 'bundle',
          productId: 'video_bundle',
          clicks: 80,
          conversions: 5,
          earnings: '150.50',
          isActive: true
        }
      ]);
      console.log('✅ Enlaces de afiliado creados');

      // Create badges
      await db.insert(affiliateBadges).values([
        {
          affiliateId: newAffiliate.id,
          badgeType: 'first_sale',
          badgeName: 'Primera Venta',
          badgeDescription: 'Lograste tu primera venta como afiliado',
          iconUrl: null
        },
        {
          affiliateId: newAffiliate.id,
          badgeType: 'milestone_10',
          badgeName: '10 Conversiones',
          badgeDescription: 'Alcanzaste 10 conversiones exitosas',
          iconUrl: null
        }
      ]);
      console.log('✅ Insignias creadas');
    }

    // Check if marketing materials exist
    const materials = await db.select().from(affiliateMarketingMaterials);
    if (materials.length === 0) {
      await db.insert(affiliateMarketingMaterials).values([
        {
          title: 'Banner Horizontal 728x90',
          description: 'Banner horizontal para sitios web',
          category: 'banner',
          fileUrl: '/assets/banners/horizontal_728x90.png',
          fileType: 'image/png',
          thumbnailUrl: '/assets/thumbnails/banner_horizontal.png',
          isActive: true
        },
        {
          title: 'Post Instagram - Promoción Premium',
          description: 'Plantilla de Instagram para promocionar suscripción premium',
          category: 'social_media',
          fileUrl: '/assets/social/instagram_premium.png',
          fileType: 'image/png',
          thumbnailUrl: '/assets/thumbnails/instagram_premium.png',
          isActive: true
        },
        {
          title: 'Email Template - Bienvenida',
          description: 'Plantilla de email para invitar a nuevos usuarios',
          category: 'email_template',
          fileUrl: '/assets/templates/email_welcome.html',
          fileType: 'text/html',
          thumbnailUrl: '/assets/thumbnails/email_template.png',
          isActive: true
        }
      ]);
      console.log('✅ Materiales de marketing creados');
    }

    console.log('🎉 ¡Afiliado de prueba configurado exitosamente!');
    console.log('Puedes acceder ahora a /affiliates o /affiliates-new');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTestAffiliate();
