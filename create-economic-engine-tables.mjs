import pg from 'pg';
import { config } from 'dotenv';
config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to Neon DB');

  // Check which tables already exist
  const existing = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'economic_engine_config', 'artist_economic_profile', 'artist_treasury_vault',
      'treasury_transactions', 'defi_positions', 'defi_agent_actions',
      'risk_engine_state', 'economic_engine_audit_log'
    )
  `);
  const existingTables = existing.rows.map(r => r.table_name);
  console.log('Existing tables:', existingTables);

  // Create enums (IF NOT EXISTS)
  const enums = [
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operating_mode') THEN CREATE TYPE operating_mode AS ENUM ('survival', 'stable', 'expansion', 'aggressive', 'defense'); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_tolerance') THEN CREATE TYPE risk_tolerance AS ENUM ('conservative', 'moderate', 'aggressive'); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'defi_agent_type') THEN CREATE TYPE defi_agent_type AS ENUM ('capital_keeper', 'flow_maker', 'alpha_hunter', 'shield_node'); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_bucket') THEN CREATE TYPE vault_bucket AS ENUM ('operation', 'reserve', 'growth', 'defi', 'boostify_fee'); END IF; END $$;`
  ];

  for (const sql of enums) {
    await client.query(sql);
  }
  console.log('✅ Enums created (or already exist)');

  // 1. economic_engine_config
  if (!existingTables.includes('economic_engine_config')) {
    await client.query(`
      CREATE TABLE economic_engine_config (
        id SERIAL PRIMARY KEY,
        is_globally_enabled BOOLEAN NOT NULL DEFAULT false,
        default_distribution JSON DEFAULT '{"operation":35,"reserve":20,"growth":20,"defi":20,"boostifyFee":5}',
        default_defi_split JSON DEFAULT '{"capitalKeeper":40,"flowMaker":30,"alphaHunter":10,"shieldNode":20}',
        profit_cascade JSON DEFAULT '{"reserve":40,"growth":30,"reinvestDefi":20,"performanceFee":10}',
        platform_fee_rate DECIMAL(5,4) DEFAULT 0.0500,
        performance_fee_rate DECIMAL(5,4) DEFAULT 0.1000,
        min_reserve_months INTEGER DEFAULT 3,
        max_drawdown_pct DECIMAL(5,2) DEFAULT 15.00,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Created economic_engine_config');
  }

  // 2. artist_economic_profile
  if (!existingTables.includes('artist_economic_profile')) {
    await client.query(`
      CREATE TABLE artist_economic_profile (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        enabled_by INTEGER REFERENCES users(id),
        enabled_at TIMESTAMP,
        operating_mode operating_mode NOT NULL DEFAULT 'stable',
        distribution_matrix JSON,
        defi_split JSON,
        defi_enabled BOOLEAN NOT NULL DEFAULT true,
        max_defi_exposure DECIMAL(12,2) DEFAULT 10000.00,
        risk_tolerance risk_tolerance NOT NULL DEFAULT 'moderate',
        auto_rebalance BOOLEAN NOT NULL DEFAULT true,
        monthly_operating_cost DECIMAL(12,2) DEFAULT 0.00,
        last_cycle_at TIMESTAMP,
        last_audit_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_artist_eco_profile_artist ON artist_economic_profile(artist_id)`);
    await client.query(`CREATE INDEX idx_artist_eco_profile_enabled ON artist_economic_profile(is_enabled)`);
    console.log('✅ Created artist_economic_profile');
  }

  // 3. artist_treasury_vault
  if (!existingTables.includes('artist_treasury_vault')) {
    await client.query(`
      CREATE TABLE artist_treasury_vault (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        operation_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        reserve_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        growth_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        defi_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        boostify_fee_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        total_deposited DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        total_defi_profit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        total_defi_loss DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        peak_defi_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        current_drawdown DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        last_rebalanced_at TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_treasury_vault_artist ON artist_treasury_vault(artist_id)`);
    console.log('✅ Created artist_treasury_vault');
  }

  // 4. treasury_transactions
  if (!existingTables.includes('treasury_transactions')) {
    await client.query(`
      CREATE TABLE treasury_transactions (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_type TEXT NOT NULL,
        from_bucket vault_bucket,
        to_bucket vault_bucket,
        amount DECIMAL(14,2) NOT NULL,
        balance_before JSON,
        balance_after JSON,
        description TEXT,
        triggered_by TEXT DEFAULT 'system',
        related_agent_type defi_agent_type,
        metadata JSON,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_treasury_tx_artist ON treasury_transactions(artist_id)`);
    await client.query(`CREATE INDEX idx_treasury_tx_type ON treasury_transactions(transaction_type)`);
    await client.query(`CREATE INDEX idx_treasury_tx_date ON treasury_transactions(created_at)`);
    console.log('✅ Created treasury_transactions');
  }

  // 5. defi_positions
  if (!existingTables.includes('defi_positions')) {
    await client.query(`
      CREATE TABLE defi_positions (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_type defi_agent_type NOT NULL,
        position_type TEXT NOT NULL,
        protocol TEXT,
        asset TEXT,
        amount_invested DECIMAL(14,2) NOT NULL,
        current_value DECIMAL(14,2) NOT NULL,
        unrealized_pnl DECIMAL(14,2) DEFAULT 0.00,
        apy DECIMAL(8,4),
        risk_score INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP,
        metadata JSON
      )
    `);
    await client.query(`CREATE INDEX idx_defi_pos_artist ON defi_positions(artist_id)`);
    await client.query(`CREATE INDEX idx_defi_pos_agent ON defi_positions(agent_type)`);
    await client.query(`CREATE INDEX idx_defi_pos_status ON defi_positions(status)`);
    console.log('✅ Created defi_positions');
  }

  // 6. defi_agent_actions
  if (!existingTables.includes('defi_agent_actions')) {
    await client.query(`
      CREATE TABLE defi_agent_actions (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_type defi_agent_type NOT NULL,
        action_type TEXT NOT NULL,
        position_id INTEGER REFERENCES defi_positions(id),
        amount DECIMAL(14,2),
        reason TEXT,
        risk_assessment JSON,
        outcome TEXT DEFAULT 'pending',
        vetoed_by TEXT,
        metadata JSON,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_defi_action_artist ON defi_agent_actions(artist_id)`);
    await client.query(`CREATE INDEX idx_defi_action_agent ON defi_agent_actions(agent_type)`);
    await client.query(`CREATE INDEX idx_defi_action_date ON defi_agent_actions(created_at)`);
    console.log('✅ Created defi_agent_actions');
  }

  // 7. risk_engine_state
  if (!existingTables.includes('risk_engine_state')) {
    await client.query(`
      CREATE TABLE risk_engine_state (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        current_mode operating_mode NOT NULL DEFAULT 'stable',
        previous_mode operating_mode,
        mode_changed_at TIMESTAMP,
        mode_change_reason TEXT,
        survival_score DECIMAL(5,2),
        health_score DECIMAL(5,2),
        reserve_months DECIMAL(5,1),
        total_exposure DECIMAL(14,2) DEFAULT 0.00,
        max_drawdown_hit DECIMAL(5,2) DEFAULT 0.00,
        shield_veto_active BOOLEAN NOT NULL DEFAULT false,
        shield_veto_reason TEXT,
        last_evaluation_at TIMESTAMP,
        evaluation_data JSON,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_risk_state_artist ON risk_engine_state(artist_id)`);
    console.log('✅ Created risk_engine_state');
  }

  // 8. economic_engine_audit_log
  if (!existingTables.includes('economic_engine_audit_log')) {
    await client.query(`
      CREATE TABLE economic_engine_audit_log (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER REFERENCES users(id),
        actor_id INTEGER REFERENCES users(id),
        actor_type TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_state JSON,
        new_state JSON,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_eco_audit_artist ON economic_engine_audit_log(artist_id)`);
    await client.query(`CREATE INDEX idx_eco_audit_date ON economic_engine_audit_log(created_at)`);
    console.log('✅ Created economic_engine_audit_log');
  }

  // Insert default config row if none exists
  const configCheck = await client.query(`SELECT COUNT(*) as cnt FROM economic_engine_config`);
  if (parseInt(configCheck.rows[0].cnt) === 0) {
    await client.query(`INSERT INTO economic_engine_config (is_globally_enabled) VALUES (false)`);
    console.log('✅ Inserted default config row (globally disabled)');
  }

  // Final verification
  const final = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'economic_engine_config', 'artist_economic_profile', 'artist_treasury_vault',
      'treasury_transactions', 'defi_positions', 'defi_agent_actions',
      'risk_engine_state', 'economic_engine_audit_log'
    )
    ORDER BY table_name
  `);
  console.log('\n📊 Economic Engine Tables:', final.rows.map(r => r.table_name));
  console.log(`\n✅ ALL ${final.rows.length}/8 Economic Engine tables ready!`);

  await client.end();
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
