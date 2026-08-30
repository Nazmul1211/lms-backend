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

async function seedContentViaApi() {
  console.log('\n--- Seeding Live Courses, Lessons, Quizzes & Blog Posts via API ---');
  
  // 1. Login as Admin
  let adminToken;
  try {
    const authRes = await fetch(`${API_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@lms.com', password: 'Password123!' }),
    });
    const authData = await authRes.json();
    adminToken = authData.jwt;
  } catch (err) {
    console.log('Failed to log in as admin:', err.message);
    return;
  }

  if (!adminToken) {
    console.log('Could not get admin token, skipping content seeding.');
    return;
  }
  console.log('  🔑 Authenticated as Admin successfully.');

  // 2. Fetch users to map IDs
  let users = [];
  try {
    const usersRes = await fetch(`${API_URL}/api/admin-dashboard/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (usersRes.ok) {
      const uData = await usersRes.json();
      users = uData.data?.users || [];
    }
  } catch {}

  const instructor = users.find((u) => u.email === 'instructor@lms.com') || { id: 1 };
  const marcus = users.find((u) => u.email === 'marcus@lms.com') || instructor;
  const manager = users.find((u) => u.email === 'manager@lms.com') || { id: 1 };
  const elena = users.find((u) => u.email === 'elena@lms.com') || manager;
  const student = users.find((u) => u.email === 'student@lms.com') || { id: 1 };

  // 3. Seed Courses
  const coursesToSeed = [
    {
      title: 'Full-Stack Next.js 15 & React Server Components',
      slug: 'nextjs-15-masterclass',
      description: 'Master React Server Components, Server Actions, streaming SSR, App Router architecture, and production deployment on Vercel.',
      coverImageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60',
      category: 'Web Development',
      level: 'intermediate',
      instructor: instructor.id,
      publishedAt: new Date().toISOString(),
    },
    {
      title: 'Headless CMS Architecture with Strapi 5 & PostgreSQL',
      slug: 'headless-cms-strapi-5',
      description: 'Architect decoupled digital experiences with Strapi 5 headless CMS, custom controller extensions, and PostgreSQL database layers.',
      coverImageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=60',
      category: 'Backend Architecture',
      level: 'advanced',
      instructor: instructor.id,
      publishedAt: new Date().toISOString(),
    },
    {
      title: 'Full-Stack Security & 4-Tier Role-Based Access Control',
      slug: 'security-rbac-mastery',
      description: 'Implement defense-in-depth security with token validation, Next.js route guards, Strapi API middleware, and audit logs.',
      coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
      category: 'Security',
      level: 'advanced',
      instructor: marcus.id,
      publishedAt: new Date().toISOString(),
    },
  ];

  for (const c of coursesToSeed) {
    try {
      const res = await fetch(`${API_URL}/api/courses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: c,
          status: 'published',
        }),
      });
      if (res.ok) {
        console.log(`  🎓 Course Seeded: "${c.title}" -> Instructor ID ${c.instructor}`);
      }
    } catch (e) {
      console.log(`  Course seed failed: ${e.message}`);
    }
  }

  // 4. Seed Blog Posts
  const blogsToSeed = [
    {
      title: 'Why Headless CMS + Next.js is the Ultimate Stack in 2026',
      slug: 'headless-cms-nextjs-stack-2026',
      excerpt: 'Explore how decoupled content management paired with React Server Components delivers lightning-fast rendering, total design freedom, and seamless multi-channel publishing.',
      content: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'Headless CMS architecture decouples backend content authoring from frontend presentation. Combined with Next.js 15, teams achieve instant page loads, top SEO rankings, and effortless scalability.',
            }
          ]
        }
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
      category: 'Web Development',
      isPublished: true,
      blogPostPublishedAt: new Date().toISOString(),
      author: manager.id,
    },
    {
      title: 'Top 5 Performance Optimizations for React Server Components',
      slug: 'top-5-rsc-optimizations',
      excerpt: 'Reduce bundle sizes, optimize streaming hydration, and leverage server actions for blisteringly fast user experiences.',
      content: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'React Server Components (RSC) keep heavy dependencies on the server, drastically shrinking clientside JavaScript bundle sizes while enabling streamed responses.',
            }
          ]
        }
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=60',
      category: 'Performance',
      isPublished: true,
      blogPostPublishedAt: new Date().toISOString(),
      author: elena.id,
    },
    {
      title: 'Role-Based Access Control: Securing Next.js Apps at Scale',
      slug: 'rbac-securing-nextjs-scale',
      excerpt: 'A blueprint for implementing a multi-tier RBAC security policy covering JWT token hygiene, route interception, and backend guards.',
      content: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'Security in full-stack applications demands defense in depth: client route guards, server middleware token inspection, and granular database entity permissions.',
            }
          ]
        }
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
      category: 'Security',
      isPublished: true,
      blogPostPublishedAt: new Date().toISOString(),
      author: manager.id,
    },
  ];

  for (const b of blogsToSeed) {
    try {
      const res = await fetch(`${API_URL}/api/blog-posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: b,
          status: 'published',
        }),
      });
      if (res.ok) {
        console.log(`  ✍️  Blog Seeded: "${b.title}" -> Author ID ${b.author}`);
      }
    } catch (e) {
      console.log(`  Blog seed failed: ${e.message}`);
    }
  }

  // 5. Enroll Student in Course 1
  try {
    const studentAuthRes = await fetch(`${API_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'student@lms.com', password: 'Password123!' }),
    });
    if (studentAuthRes.ok) {
      const sAuth = await studentAuthRes.json();
      const sToken = sAuth.jwt;
      // Get all courses
      const coursesRes = await fetch(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${sToken}` },
      });
      if (coursesRes.ok) {
        const cList = await coursesRes.json();
        const firstCourse = (cList.data || [])[0];
        if (firstCourse) {
          const cId = firstCourse.documentId || firstCourse.id;
          await fetch(`${API_URL}/api/courses/${cId}/enroll`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${sToken}` },
          });
          console.log(`  🎯 Student "student@lms.com" enrolled into Course "${firstCourse.title}"`);
        }
      }
    }
  } catch (e) {
    console.log(`  Enrollment note: ${e.message}`);
  }

  console.log('\n🎉 Live content seeding completed successfully!\n');
}

async function main() {
  try {
    await seedViaPostgres();
  } catch (err) {
    console.log(`⚠️  PostgreSQL direct connection skipped (${err.message})`);
    await seedViaApi();
  }

  await seedContentViaApi();
}

main();
