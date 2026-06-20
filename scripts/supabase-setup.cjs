/**
 * 🗄️ SUPABASE SETUP - Crear tablas para gestión de leads
 * Ejecutar una sola vez para crear la estructura
 */

const { Pool } = require('pg');

// Supabase PostgreSQL connection (usando pooler con IPv4)
const pool = new Pool({
  connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('🗄️  SUPABASE SETUP - Creando tablas para leads');
  console.log('='.repeat(60));

  const client = await pool.connect();
  
  try {
    // 1. TABLA LEADS - Todos los leads extraídos
    console.log('\n📦 Creando tabla: leads...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        personal_email TEXT,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        job_title TEXT,
        company_name TEXT,
        company_website TEXT,
        company_description TEXT,
        industry TEXT,
        company_size INTEGER,
        city TEXT,
        state TEXT,
        country TEXT,
        linkedin TEXT,
        keywords TEXT,
        source TEXT DEFAULT 'apify',
        extracted_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ Tabla leads creada');

    // 2. TABLA LEAD_STATUS - Estado de cada lead en el flujo
    console.log('\n📊 Creando tabla: lead_status...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'new' CHECK (status IN ('new', 'warming', 'contacted', 'replied', 'converted', 'unsubscribed', 'bounced')),
        warmup_stage INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        emails_opened INTEGER DEFAULT 0,
        emails_clicked INTEGER DEFAULT 0,
        last_email_at TIMESTAMPTZ,
        next_email_at TIMESTAMPTZ,
        replied_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lead_id)
      );
    `);
    console.log('   ✅ Tabla lead_status creada');

    // 3. TABLA EMAIL_SENDS - Historial de cada email enviado
    console.log('\n📧 Creando tabla: email_sends...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_sends (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        resend_id TEXT,
        from_email TEXT,
        to_email TEXT,
        subject TEXT,
        body TEXT,
        email_type TEXT CHECK (email_type IN ('warmup_1', 'warmup_2', 'warmup_3', 'sequence_1', 'sequence_2', 'sequence_3', 'sequence_4', 'sequence_5', 'sequence_6', 'sequence_7', 'sequence_8', 'sequence_9', 'sequence_10', 'custom')),
        status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        delivered_at TIMESTAMPTZ,
        opened_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ Tabla email_sends creada');

    // 4. TABLA WARMUP_CONFIG - Control del warmup diario
    console.log('\n⚙️  Creando tabla: warmup_config...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS warmup_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain TEXT UNIQUE NOT NULL,
        daily_limit INTEGER DEFAULT 20,
        sent_today INTEGER DEFAULT 0,
        warmup_day INTEGER DEFAULT 1,
        warmup_week INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        last_reset DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ Tabla warmup_config creada');

    // 5. Insertar config inicial para boostifymusic.site
    console.log('\n🚀 Configurando dominio boostifymusic.site...');
    await client.query(`
      INSERT INTO warmup_config (domain, daily_limit, warmup_day, warmup_week)
      VALUES ('boostifymusic.site', 20, 1, 1)
      ON CONFLICT (domain) DO NOTHING;
    `);
    console.log('   ✅ Dominio configurado');

    // 6. Crear índices para mejor performance
    console.log('\n📈 Creando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON lead_status(status);
      CREATE INDEX IF NOT EXISTS idx_leads_next_email ON lead_status(next_email_at);
      CREATE INDEX IF NOT EXISTS idx_email_sends_lead ON email_sends(lead_id);
      CREATE INDEX IF NOT EXISTS idx_email_sends_resend ON email_sends(resend_id);
    `);
    console.log('   ✅ Índices creados');

    // 7. Crear función para actualizar updated_at automáticamente
    console.log('\n🔄 Creando trigger para updated_at...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS lead_status_updated_at ON lead_status;
      CREATE TRIGGER lead_status_updated_at
        BEFORE UPDATE ON lead_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

      DROP TRIGGER IF EXISTS warmup_config_updated_at ON warmup_config;
      CREATE TRIGGER warmup_config_updated_at
        BEFORE UPDATE ON warmup_config
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    console.log('   ✅ Triggers creados');

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETO!');
    console.log('='.repeat(60));
    console.log(`
📦 Tablas creadas:
   • leads          - Almacena datos de leads extraídos
   • lead_status    - Estado de cada lead en el flujo
   • email_sends    - Historial de emails enviados
   • warmup_config  - Control de límites diarios

🚀 Próximos pasos:
   1. Ejecutar apify-to-supabase.cjs para importar leads
   2. Ejecutar warmup-sender.cjs para enviar emails
`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
