import type { Core } from '@strapi/strapi';
// @ts-ignore
import bcrypt from 'bcryptjs';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      // 1. Ensure Roles Exist (Admin, Content Manager, Instructor, Student)
      const roleNames = ['Admin', 'Content Manager', 'Instructor', 'Student'];
      const roles: Record<string, any> = {};

      for (const name of roleNames) {
        let role = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { name },
        });

        if (!role) {
          role = await strapi.db.query('plugin::users-permissions.role').create({
            data: {
              name,
              type: name.toLowerCase().replace(/\s+/g, '-'),
              description: `LMS ${name} Role`,
            },
          });
        }
        roles[name] = role;
      }

      // Fetch Public & Authenticated default roles
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });
      const authenticatedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });

      // 1.1 Automatically Grant API Permissions
      const publicActions = [
        'api::course.course.find',
        'api::course.course.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
        'api::lesson.lesson.find',
        'api::lesson.lesson.findOne',
        'api::quiz.quiz.find',
        'api::quiz.quiz.findOne',
        'api::quiz.quiz.getStudentQuiz',
        'plugin::users-permissions.auth.callback',
        'plugin::users-permissions.auth.register',
        'plugin::users-permissions.auth.connect',
      ];

      const authenticatedActions = [
        ...publicActions,
        'api::course.course.create',
        'api::course.course.update',
        'api::course.course.delete',
        'api::course.course.enrollCourse',
        'api::course.course.getMyCourses',
        'api::course.course.updateLessonProgress',
        'api::course.course.getCourseProgress',
        'api::course.course.getInstructorCourses',
        'api::quiz.quiz.create',
        'api::quiz.quiz.update',
        'api::quiz.quiz.delete',
        'api::quiz.quiz.getStudentQuiz',
        'api::quiz.quiz.submitQuiz',
        'api::lesson.lesson.create',
        'api::lesson.lesson.update',
        'api::lesson.lesson.delete',
        'api::blog-post.blog-post.create',
        'api::blog-post.blog-post.update',
        'api::blog-post.blog-post.delete',
        'api::admin-dashboard.admin-dashboard.getStats',
        'api::admin-dashboard.admin-dashboard.getUsers',
        'api::admin-dashboard.admin-dashboard.updateUserRole',
        'plugin::users-permissions.user.me',
        'plugin::users-permissions.user.find',
        'plugin::users-permissions.user.findOne',
      ];

      const grantRolePermissions = async (roleObj: any, actions: string[]) => {
        if (!roleObj || !roleObj.id) return;
        for (const action of actions) {
          const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
            where: { action, role: roleObj.id },
          });
          if (!existing) {
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: { action, role: roleObj.id },
            });
          }
        }
      };

      if (publicRole) await grantRolePermissions(publicRole, publicActions);
      if (authenticatedRole) await grantRolePermissions(authenticatedRole, authenticatedActions);
      for (const rName of roleNames) {
        if (roles[rName]) await grantRolePermissions(roles[rName], authenticatedActions);
      }

      // 2. Check and seed test users with provider: 'local'
      const testUsers = [
        // Super Admin
        { username: 'admin_user', email: 'admin@lms.com', password: 'Password123!', role: roles['Admin']?.id },
        
        // Content Managers
        { username: 'content_manager', email: 'manager@lms.com', password: 'Password123!', role: roles['Content Manager']?.id },
        { username: 'elena_editor', email: 'elena@lms.com', password: 'Password123!', role: roles['Content Manager']?.id },
        
        // Instructors
        { username: 'instructor_alex', email: 'instructor@lms.com', password: 'Password123!', role: roles['Instructor']?.id },
        { username: 'marcus_backend', email: 'marcus@lms.com', password: 'Password123!', role: roles['Instructor']?.id },
        
        // Students with different learning profiles
        { username: 'student_sarah', email: 'student@lms.com', password: 'Password123!', role: roles['Student']?.id },
        { username: 'john_doe', email: 'john@lms.com', password: 'Password123!', role: roles['Student']?.id },
        { username: 'emily_beginner', email: 'emily@lms.com', password: 'Password123!', role: roles['Student']?.id },
      ];

      const createdUsers: Record<string, any> = {};

      for (const u of testUsers) {
        let user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { email: u.email },
        });

        const hashedPassword = await bcrypt.hash(u.password, 10);

        if (!user) {
          user = await strapi.db.query('plugin::users-permissions.user').create({
            data: {
              username: u.username,
              email: u.email,
              password: hashedPassword,
              provider: 'local',
              role: u.role,
              confirmed: true,
              blocked: false,
            },
          });
          strapi.log.info(`👤 Created test user: ${u.email} (${u.username})`);
        } else {
          // Update user to ensure provider: 'local' and correct password
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: {
              password: hashedPassword,
              provider: 'local',
              role: u.role,
              confirmed: true,
              blocked: false,
            },
          });
        }
        createdUsers[u.email] = user;
      }

      // 3. Seed Sample Course if not exists
      const existingCourse = await strapi.documents('api::course.course').findFirst({
        filters: { slug: 'mastering-nextjs-15' } as any,
      });

      if (!existingCourse) {
        strapi.log.info('🌱 Seeding initial courses, lessons, quizzes, and blogs...');

        const instructor = createdUsers['instructor@lms.com'];

        // Course 1
        const course1 = await strapi.documents('api::course.course').create({
          data: {
            title: 'Mastering Next.js 15 & React Server Components',
            slug: 'mastering-nextjs-15',
            description: 'Learn modern full-stack development with Next.js 15 App Router, Server Actions, and Tailwind CSS.',
            coverImageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=60',
            level: 'intermediate',
            category: 'Frontend Development',
            instructor: instructor.id,
          } as any,
          status: 'published',
        });

        // Lessons for Course 1
        const course1Lessons = [
          {
            title: 'Introduction to Next.js App Router',
            slug: 'introduction-to-nextjs-app-router',
            order: 1,
            typeOfContent: 'text',
            durationMinutes: 10,
            course: (course1 as any).documentId,
          },
          {
            title: 'React Server Components Deep Dive',
            slug: 'react-server-components-deep-dive',
            order: 2,
            typeOfContent: 'video',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            durationMinutes: 15,
            course: (course1 as any).documentId,
          },
          {
            title: 'Server Actions & Data Mutations',
            slug: 'server-actions-and-mutations',
            order: 3,
            typeOfContent: 'text',
            durationMinutes: 12,
            course: (course1 as any).documentId,
          },
          {
            title: 'Deploying Next.js to Vercel',
            slug: 'deploying-nextjs-to-vercel',
            order: 4,
            typeOfContent: 'text',
            durationMinutes: 8,
            course: (course1 as any).documentId,
          },
        ];

        const createdLessons: any[] = [];
        for (const l of course1Lessons) {
          const lesson = await strapi.documents('api::lesson.lesson').create({
            data: l as any,
            status: 'published',
          });
          createdLessons.push(lesson);
        }

        // Course 2
        const course2 = await strapi.documents('api::course.course').create({
          data: {
            title: 'Headless CMS Architecture with Strapi 5 & PostgreSQL',
            slug: 'headless-cms-strapi-5',
            description: 'Build enterprise-grade REST APIs, custom controllers, role-based access control, and deploy on Railway.',
            coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
            level: 'beginner',
            category: 'Backend Development',
            instructor: instructor.id,
          } as any,
          status: 'published',
        });

        // Lessons for Course 2
        const course2Lessons = [
          {
            title: 'Content Modeling & Database Relations',
            slug: 'content-modeling-and-relations',
            order: 1,
            typeOfContent: 'text',
            durationMinutes: 15,
            course: (course2 as any).documentId,
          },
          {
            title: 'Custom Controllers & Core API Routes',
            slug: 'custom-controllers-and-routes',
            order: 2,
            typeOfContent: 'text',
            durationMinutes: 20,
            course: (course2 as any).documentId,
          },
          {
            title: 'Deploying Strapi on Railway with PostgreSQL',
            slug: 'deploying-strapi-on-railway',
            order: 3,
            typeOfContent: 'video',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            durationMinutes: 18,
            course: (course2 as any).documentId,
          },
        ];

        for (const l of course2Lessons) {
          await strapi.documents('api::lesson.lesson').create({
            data: l as any,
            status: 'published',
          });
        }

        // Course 3
        const course3 = await strapi.documents('api::course.course').create({
          data: {
            title: 'Full-Stack Security & Role-Based Access Control',
            slug: 'security-rbac-mastery',
            description: 'Implement defense-in-depth security with token validation, route guards, API middleware, and audit logs.',
            coverImageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=60',
            level: 'advanced',
            category: 'Security',
            instructor: instructor.id,
          } as any,
          status: 'published',
        });

        // Lessons for Course 3
        const course3Lessons = [
          {
            title: 'JWT Token Anatomy & Safe Storage',
            slug: 'jwt-token-anatomy',
            order: 1,
            typeOfContent: 'text',
            durationMinutes: 20,
            course: (course3 as any).documentId,
          },
          {
            title: 'Backend Policy Guards & Route Interceptors',
            slug: 'backend-policy-guards',
            order: 2,
            typeOfContent: 'text',
            durationMinutes: 25,
            course: (course3 as any).documentId,
          },
          {
            title: 'Building a 4-Tier RBAC Architecture',
            slug: 'building-4-tier-rbac',
            order: 3,
            typeOfContent: 'text',
            durationMinutes: 30,
            course: (course3 as any).documentId,
          },
        ];

        for (const l of course3Lessons) {
          await strapi.documents('api::lesson.lesson').create({
            data: l as any,
            status: 'published',
          });
        }

        // Course 4
        const course4 = await strapi.documents('api::course.course').create({
          data: {
            title: 'Modern Tailwind CSS v4 & Design Systems',
            slug: 'tailwind-design-systems',
            description: 'Build accessible, responsive UI component libraries with CSS-first configuration and dark mode tokens.',
            coverImageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=60',
            level: 'beginner',
            category: 'Design & UI',
            instructor: instructor.id,
          } as any,
          status: 'published',
        });

        // 4. Create Sample Quiz for Course 1
        await strapi.documents('api::quiz.quiz').create({
          data: {
            title: 'Next.js 15 Fundamentals Assessment',
            description: 'Test your understanding of React Server Components and App Router.',
            passingScore: 70,
            course: (course1 as any).documentId,
            questions: [
              {
                questionText: 'Where do React Server Components render by default in the Next.js App Router?',
                options: ['In the client browser', 'On the server', 'In a service worker', 'In the database engine'],
                correctAnswerIndex: 1,
                explanation: 'In Next.js App Router, all components inside the app directory are Server Components by default and execute exclusively on the server.',
              },
              {
                questionText: 'Which file convention defines a shared layout across routes in Next.js?',
                options: ['page.tsx', 'layout.tsx', 'route.ts', 'template.tsx'],
                correctAnswerIndex: 1,
                explanation: 'layout.tsx is used to wrap nested routes and share persistent UI elements across pages.',
              },
              {
                questionText: 'What HTTP header format is standard for sending JWT Bearer tokens to Strapi?',
                options: ['Cookie: jwt_token', 'Authorization: Bearer <token>', 'Token: <token>', 'Authentication: <token>'],
                correctAnswerIndex: 1,
                explanation: 'Standard token authentication uses the "Authorization: Bearer <token>" header.',
              },
            ],
          } as any,
          status: 'published',
        });

        // Sample Quiz for Course 2
        await strapi.documents('api::quiz.quiz').create({
          data: {
            title: 'Headless CMS Architecture Assessment',
            description: 'Validate your understanding of Strapi 5 APIs and controller customizations.',
            passingScore: 70,
            course: (course2 as any).documentId,
            questions: [
              {
                questionText: 'Which Strapi layer handles custom business logic before returning data to the client?',
                options: ['Vite Admin Build', 'Controller / Service layer', 'Database Schema migration', 'Nginx reverse proxy'],
                correctAnswerIndex: 1,
                explanation: 'Strapi controllers and services are designed to house business logic and data sanitization.',
              },
              {
                questionText: 'How are public API permissions granted in Strapi 5?',
                options: ['Hardcoded in .env only', 'Via Users & Permissions Plugin roles in up_permissions', 'In robots.txt', 'Through package.json scripts'],
                correctAnswerIndex: 1,
                explanation: 'Permissions are stored in the database up_permissions table and mapped to Public/Authenticated roles.',
              },
            ],
          } as any,
          status: 'published',
        });

        // 5. Create Sample Blog Posts (2 Published, 1 Draft)
        const manager = createdUsers['manager@lms.com'];
        const admin = createdUsers['admin@lms.com'];

        await strapi.documents('api::blog-post.blog-post').create({
          data: {
            title: 'Why Headless CMS + Next.js is the Ultimate Stack in 2026',
            slug: 'why-headless-cms-nextjs',
            excerpt: 'Exploring the decoupling of frontend and backend for ultra-fast, scalable web applications.',
            coverImageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60',
            isPublished: true,
            blogPostPublishedAt: new Date().toISOString(),
            author: manager.id,
          } as any,
          status: 'published',
        });

        await strapi.documents('api::blog-post.blog-post').create({
          data: {
            title: 'Top 5 Performance Optimizations for React Server Components',
            slug: 'top-5-performance-optimizations-rsc',
            excerpt: 'How to stream UI with Suspense, reduce bundle size, and optimize Server Action responses.',
            coverImageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop&q=60',
            isPublished: true,
            blogPostPublishedAt: new Date().toISOString(),
            author: admin.id,
          } as any,
          status: 'published',
        });

        // Draft blog post (hidden from public/students)
        await strapi.documents('api::blog-post.blog-post').create({
          data: {
            title: '[DRAFT] Upcoming LMS Features in Q4: AI Grading & Certificates',
            slug: 'upcoming-features-q4',
            excerpt: 'Sneak peek into our next generation LMS roadmap.',
            coverImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60',
            isPublished: false,
            author: manager.id,
          } as any,
          status: 'draft',
        });

        // 6. Create Initial Enrollment & 50% Progress for student_sarah
        const student = createdUsers['student@lms.com'];
        await strapi.documents('api::enrollment.enrollment').create({
          data: {
            student: student.id,
            course: (course1 as any).documentId,
            enrolledAt: new Date().toISOString(),
            progressPercentage: 50,
            enrollmentStatus: 'active',
          } as any,
        });

        // Mark 2 of 4 lessons as completed for student_sarah
        if (createdLessons.length >= 2) {
          await strapi.documents('api::lesson-progress.lesson-progress').create({
            data: {
              student: student.id,
              course: (course1 as any).documentId,
              lesson: createdLessons[0].documentId,
              isCompleted: true,
              completedAt: new Date().toISOString(),
            } as any,
          });

          await strapi.documents('api::lesson-progress.lesson-progress').create({
            data: {
              student: student.id,
              course: (course1 as any).documentId,
              lesson: createdLessons[1].documentId,
              isCompleted: true,
              completedAt: new Date().toISOString(),
            } as any,
          });
        }

        strapi.log.info('✅ LMS seed data created successfully!');
      }
    } catch (err: any) {
      strapi.log.error('Error during bootstrap seeding:', err);
    }
  },
};
