const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ifilm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function createAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node create-admin.js <email> <username> <password>');
    console.log('Example: node create-admin.js admin@example.com admin MySecurePassword123');
    process.exit(1);
  }

  const [email, username, password] = args;

  try {
    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existing.rows.length > 0) {
      console.log('❌ User with this email or username already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role',
      [email, username, passwordHash, 'admin']
    );

    const user = result.rows[0];
    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdmin();

