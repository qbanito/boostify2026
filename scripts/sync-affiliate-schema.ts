import { db } from '../db';
import { sql } from 'drizzle-orm';

async function syncAffiliateSchema() {
  console.log('⏳ Creando tablas de afiliados en PostgreSQL...');
  
  try {
    // Create affiliates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        website TEXT,
        social_media TEXT,
        audience_size TEXT,
        marketing_experience TEXT,
        promotion_strategy TEXT,
        level TEXT NOT NULL DEFAULT 'Básico' CHECK (level IN ('Básico', 'Plata', 'Oro', 'Platino', 'Diamante')),
        commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
        payment_method TEXT DEFAULT 'paypal' CHECK (payment_method IN ('paypal', 'bank_transfer', 'stripe')),
        payment_email TEXT,
        bank_details JSONB,
        total_clicks INTEGER NOT NULL DEFAULT 0,
        total_conversions INTEGER NOT NULL DEFAULT 0,
        total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        pending_payment NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliates creada');

    // Create affiliate_links table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_links (
        id SERIAL PRIMARY KEY,
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        unique_code TEXT NOT NULL UNIQUE,
        product_type TEXT NOT NULL DEFAULT 'general' CHECK (product_type IN ('subscription', 'bundle', 'merchandise', 'course', 'general')),
        product_id TEXT,
        custom_path TEXT,
        title TEXT NOT NULL,
        description TEXT,
        clicks INTEGER NOT NULL DEFAULT 0,
        conversions INTEGER NOT NULL DEFAULT 0,
        earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_links creada');

    // Create affiliate_clicks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_clicks (
        id SERIAL PRIMARY KEY,
        link_id INTEGER NOT NULL REFERENCES affiliate_links(id),
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        country TEXT,
        device TEXT DEFAULT 'unknown' CHECK (device IN ('desktop', 'mobile', 'tablet', 'unknown')),
        clicked_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_clicks creada');

    // Create affiliate_conversions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_conversions (
        id SERIAL PRIMARY KEY,
        link_id INTEGER NOT NULL REFERENCES affiliate_links(id),
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        user_id INTEGER REFERENCES users(id),
        product_type TEXT NOT NULL,
        product_id TEXT NOT NULL,
        sale_amount NUMERIC(10,2) NOT NULL,
        commission_rate NUMERIC(5,2) NOT NULL,
        commission_amount NUMERIC(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
        stripe_payment_id TEXT,
        metadata JSONB,
        converted_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_conversions creada');

    // Create affiliate_earnings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_earnings (
        id SERIAL PRIMARY KEY,
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        amount NUMERIC(10,2) NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('commission', 'bonus', 'referral', 'adjustment')),
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
        conversion_id INTEGER REFERENCES affiliate_conversions(id),
        payment_id TEXT,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_earnings creada');

    // Create affiliate_coupons table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_coupons (
        id SERIAL PRIMARY KEY,
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        code TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
        discount_value NUMERIC(10,2) NOT NULL,
        minimum_purchase NUMERIC(10,2),
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        applicable_products TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_coupons creada');

    // Create affiliate_promotions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_promotions (
        id SERIAL PRIMARY KEY,
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        banner_url TEXT,
        landing_page_url TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        clicks INTEGER NOT NULL DEFAULT 0,
        impressions INTEGER NOT NULL DEFAULT 0,
        conversions INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_promotions creada');

    // Create affiliate_badges table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_badges (
        id SERIAL PRIMARY KEY,
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        badge_type TEXT NOT NULL CHECK (badge_type IN ('first_sale', 'milestone_10', 'milestone_50', 'milestone_100', 'top_performer', 'consistent_earner', 'viral_marketer', 'elite_affiliate')),
        badge_name TEXT NOT NULL,
        badge_description TEXT NOT NULL,
        icon_url TEXT,
        earned_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_badges creada');

    // Create affiliate_referrals table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES affiliates(id),
        referred_affiliate_id INTEGER REFERENCES affiliates(id),
        referred_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'approved', 'active')),
        level INTEGER NOT NULL DEFAULT 1,
        total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_referrals creada');

    // Create affiliate_marketing_materials table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_marketing_materials (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('banner', 'social_media', 'email_template', 'video', 'guide')),
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL,
        thumbnail_url TEXT,
        download_count INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla affiliate_marketing_materials creada');

    console.log('🎉 Todas las tablas de afiliados creadas exitosamente!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creando tablas de afiliados:', error.message);
    console.log('ℹ️  Si las tablas ya existen, esto es normal.');
    process.exit(0);
  }
}

syncAffiliateSchema();
