/**
 * Standalone Database Seeding Script for LMS
 * Can be executed locally or in CI/CD / Railway to seed test users, roles, and permissions.
 */

let Client;
try {
  Client = require('pg').Client;
} catch (e) {
  // pg will be available in production/docker
}

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  // optional
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:iEKWSbMNKYSVsHJVDKyTjeDrvWCwmgBC@postgres.railway.internal:5432/railway';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lms-backend-production-68cb.up.railway.app';

const TEST_USERS = [
  {
    username: 'admin_user',
    email: 'admin@lms.com',
    password: 'Password123!',
    roleName: 'Admin',
    roleType: 'admin',
    roleDesc: 'LMS Admin Role',
  },
  {
    username: 'content_manager',
    email: 'manager@lms.com',
    password: 'Password123!',
    roleName: 'Content Manager',
    roleType: 'content_manager',
    roleDesc: 'LMS Content Manager Role',
  },
  {
    username: 'elena_editor',
    email: 'elena@lms.com',
    password: 'Password123!',
    roleName: 'Content Manager',
    roleType: 'content_manager',
    roleDesc: 'LMS Content Manager Role',
  },
  {
    username: 'instructor_alex',
    email: 'instructor@lms.com',
    password: 'Password123!',
    roleName: 'Instructor',
    roleType: 'instructor',
    roleDesc: 'LMS Instructor Role',
  },
  {
    username: 'marcus_backend',
    email: 'marcus@lms.com',
    password: 'Password123!',
    roleName: 'Instructor',
    roleType: 'instructor',
    roleDesc: 'LMS Instructor Role',
  },
  {
    username: 'student_sarah',
    email: 'student@lms.com',
    password: 'Password123!',
    roleName: 'Student',
    roleType: 'student',
    roleDesc: 'LMS Student Role',
  },
  {
    username: 'john_doe',
    email: 'john@lms.com',
    password: 'Password123!',
    roleName: 'Student',
    roleType: 'student',
    roleDesc: 'LMS Student Role',
  },
  {
    username: 'emily_beginner',
    email: 'emily@lms.com',
    password: 'Password123!',
    roleName: 'Student',
    roleType: 'student',
    roleDesc: 'LMS Student Role',
  },
];

async function seedViaPostgres() {
  if (!Client || !bcrypt) {
    throw new Error('pg or bcryptjs module not available locally');
  }
  console.log('🔗 Attempting direct PostgreSQL connection to seed database...');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  await client.connect();
  console.log('✅ Connected to PostgreSQL database!');

  // 1. Ensure Roles exist
  console.log('\n--- Checking & Creating Roles ---');
  const roleMap = {};

  const roles = [
    { name: 'Admin', type: 'admin', description: 'LMS Admin Role' },
    { name: 'Content Manager', type: 'content_manager', description: 'LMS Content Manager Role' },
    { name: 'Instructor', type: 'instructor', description: 'LMS Instructor Role' },
    { name: 'Student', type: 'student', description: 'LMS Student Role' },
    { name: 'Authenticated', type: 'authenticated', description: 'Default authenticated role' },
    { name: 'Public', type: 'public', description: 'Default public role' },
  ];

  for (const r of roles) {
    const res = await client.query('SELECT id, name, type FROM up_roles WHERE name = $1 OR type = $2', [r.name, r.type]);
    if (res.rows.length > 0) {
      roleMap[r.name] = res.rows[0].id;
      console.log(`  ✓ Role "${r.name}" exists with ID ${res.rows[0].id}`);
    } else {
      const insert = await client.query(
        'INSERT INTO up_roles (name, type, description, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        [r.name, r.type, r.description]
      );
      roleMap[r.name] = insert.rows[0].id;
      console.log(`  + Created Role "${r.name}" with ID ${insert.rows[0].id}`);
    }
  }

  // 2. Ensure Users exist with correct password & role
  console.log('\n--- Checking & Seeding Users ---');
  for (const u of TEST_USERS) {
    const existing = await client.query('SELECT id, email, username FROM up_users WHERE email = $1', [u.email]);
    const hashedPassword = await bcrypt.hash(u.password, 10);
    const roleId = roleMap[u.roleName] || roleMap['Student'] || roleMap['Authenticated'];

    let userId;
    if (existing.rows.length === 0) {
      const insertUser = await client.query(
        `INSERT INTO up_users (username, email, password, provider, confirmed, blocked, created_at, updated_at)
         VALUES ($1, $2, $3, 'local', true, false, NOW(), NOW()) RETURNING id`,
        [u.username, u.email, hashedPassword]
      );
      userId = insertUser.rows[0].id;
      console.log(`  + Created User: ${u.email} (${u.username}) -> [${u.roleName}]`);
    } else {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE up_users SET password = $1, provider = 'local', confirmed = true, blocked = false, updated_at = NOW() WHERE id = $2`,
        [hashedPassword, userId]
      );
      console.log(`  ✓ Updated User: ${u.email} (${u.username}) -> [${u.roleName}]`);
    }

    // Link user to role
    try {
      // Check if up_users_role_links table exists (Strapi 5 relation table)
      const linkCheck = await client.query(
        'SELECT 1 FROM information_schema.tables WHERE table_name = $1',
        ['up_users_role_links']
      );

      if (linkCheck.rows.length > 0) {
        await client.query('DELETE FROM up_users_role_links WHERE user_id = $1', [userId]);
        await client.query(
          'INSERT INTO up_users_role_links (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, roleId]
        );
      }
    } catch (e) {
      // Fallback if role is directly on up_users
      try {
        await client.query('UPDATE up_users SET role_id = $1 WHERE id = $2', [roleId, userId]);
      } catch {}
    }
  }

  await client.end();
  console.log('\n🎉 Direct PostgreSQL user seeding completed successfully!\n');
}

async function seedViaApi() {
  console.log(`🌐 Direct DB unavailable from local environment. Seeding via live API endpoint (${API_URL})...`);

  for (const u of TEST_USERS) {
    try {
      const res = await fetch(`${API_URL}/api/auth/local/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u.username,
          email: u.email,
          password: u.password,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        console.log(`  ✅ Registered: ${u.email} (${u.username})`);
      } else {
        console.log(`  ℹ️  ${u.email}: ${data?.error?.message || 'Already registered or ready'}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to reach API for ${u.email}:`, err.message);
    }
  }

  console.log('\n💡 Tip: Once the backend git commit is pushed to Railway, Strapi bootstrap automatically ensures all role permissions and full profiles in PostgreSQL.');
}

async function main() {
  try {
    await seedViaPostgres();
  } catch (err) {
    console.log(`⚠️  PostgreSQL direct connection skipped (${err.message})`);
    await seedViaApi();
  }
}

main();
