/**
 * Pre-start environment check script.
 * Logs which critical env vars are set (without revealing values)
 * and tests the database connection before Strapi boots.
 */

const { Client } = require('pg');

console.log('=== Environment Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV || '(not set)');
console.log('DATABASE_CLIENT:', process.env.DATABASE_CLIENT || '(not set)');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? `SET (${process.env.DATABASE_URL.length} chars)` : '*** NOT SET ***');
console.log('DATABASE_HOST:', process.env.DATABASE_HOST || '(not set)');
console.log('DATABASE_PORT:', process.env.DATABASE_PORT || '(not set)');
console.log('APP_KEYS:', process.env.APP_KEYS ? 'SET' : '*** NOT SET ***');
console.log('ADMIN_JWT_SECRET:', process.env.ADMIN_JWT_SECRET ? 'SET' : '*** NOT SET ***');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : '*** NOT SET ***');
console.log('PORT:', process.env.PORT || '(not set)');
console.log('HOST:', process.env.HOST || '(not set)');
console.log('=========================');

// If postgres, test the connection
if (process.env.DATABASE_CLIENT === 'postgres' && process.env.DATABASE_URL) {
  console.log('\nTesting PostgreSQL connection...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' 
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
    connectionTimeoutMillis: 10000,
  });

  client.connect()
    .then(() => {
      console.log('✅ PostgreSQL connection successful!');
      return client.query('SELECT version()');
    })
    .then((res) => {
      console.log('✅ PostgreSQL version:', res.rows[0].version);
      client.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ PostgreSQL connection FAILED:');
      console.error('   Error name:', err.name);
      console.error('   Error message:', err.message);
      console.error('   Error code:', err.code);
      if (err.errors) {
        err.errors.forEach((e, i) => {
          console.error(`   Sub-error ${i}:`, e.message, e.code);
        });
      }
      client.end().catch(() => {});
      process.exit(1);
    });
} else if (process.env.DATABASE_CLIENT === 'postgres') {
  console.error('❌ DATABASE_CLIENT is postgres but DATABASE_URL is not set!');
  process.exit(1);
} else {
  console.log('Database client is not postgres, skipping connection test.');
  process.exit(0);
}
