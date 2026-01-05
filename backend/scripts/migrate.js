const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ifilm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Run migrations in order

  console.log(`Found ${files.length} migration files`);

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const file of files) {
    const version = file.replace('.sql', '');
    
    // Check if migration already applied
    const result = await pool.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version]
    );

    if (result.rows.length > 0) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`🔄 Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      await pool.query('COMMIT');
      console.log(`✅ Applied migration: ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`❌ Error applying ${file}:`, error.message);
      throw error;
    }
  }

  console.log('✅ All migrations completed');
  await pool.end();
}

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});

