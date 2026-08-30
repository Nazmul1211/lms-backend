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

      // 2. Check and seed test users with provider: 'local'
      const testUsers = [
        { username: 'admin_user', email: 'admin@lms.com', password: 'Password123!', role: roles['Admin']?.id },
        { username: 'content_manager', email: 'manager@lms.com', password: 'Password123!', role: roles['Content Manager']?.id },
        { username: 'instructor_alex', email: 'instructor@lms.com', password: 'Password123!', role: roles['Instructor']?.id },
        { username: 'student_sarah', email: 'student@lms.com', password: 'Password123!', role: roles['Student']?.id },
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
          });
          createdLessons.push(lesson);
        }

        // Course 2
        await strapi.documents('api::course.course').create({
          data: {
            title: 'Headless CMS Architecture with Strapi 5 & PostgreSQL',
            slug: 'headless-cms-strapi-5',
            description: 'Build enterprise-grade REST APIs, custom controllers, role-based access control, and deploy on Railway.',
            coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
            level: 'beginner',
            category: 'Backend Development',
            instructor: instructor.id,
          } as any,
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
