import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::course.course', ({ strapi }) => ({
    /**
     * 1. POST /api/courses/:id/enroll
     * Enrolls the authenticated student into a course
     */
    async enrollCourse(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to enroll');
        }

        const { id } = ctx.params;

        // Verify course exists
        const course = await strapi.documents('api::course.course').findOne({
            documentId: id,
        });

        if (!course) {
            return ctx.notFound('Course not found');
        }

        // Check if already enrolled
        const existingEnrollments = await strapi.documents('api::enrollment.enrollment').findMany({
            filters: {
                student: { id: user.id },
                course: { documentId: id },
            } as any,
        });

        if (existingEnrollments && existingEnrollments.length > 0) {
            return ctx.badRequest('You are already enrolled in this course');
        }

        // Create new enrollment
        const enrollment = await strapi.documents('api::enrollment.enrollment').create({
            data: {
                student: user.id,
                course: course.documentId,
                enrolledAt: new Date().toISOString(),
                progressPercentage: 0,
                enrollmentStatus: 'active',
            } as any,
        });

        return ctx.send({
            message: 'Successfully enrolled in course',
            data: enrollment,
        });
    },

    /**
     * 2. GET /api/my-courses
     * Returns all enrolled courses for the logged-in student with progress
     */
    async getMyCourses(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to view your courses');
        }

        const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
            filters: {
                student: { id: user.id },
            } as any,
            populate: ['course', 'course.lessons'] as any,
        });

        const myCourses = (enrollments || []).map((enrollment: any) => ({
            enrollmentId: enrollment.documentId,
            enrolledAt: enrollment.enrolledAt,
            progressPercentage: enrollment.progressPercentage,
            status: enrollment.enrollmentStatus,
            course: enrollment.course,
        }));

        return ctx.send({
            data: myCourses,
        });
    },

    /**
     * 3. POST /api/courses/:id/progress
     * Marks a lesson complete/incomplete and recalculates course progress %
     */
    async updateLessonProgress(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to update progress');
        }

        const { id } = ctx.params;
        const { lessonId, isCompleted = true } = ctx.request.body;

        if (!lessonId) {
            return ctx.badRequest('lessonId is required');
        }

        // 1. Fetch course with all lessons to know the total count
        const course = await strapi.documents('api::course.course').findOne({
            documentId: id,
            populate: ['lessons'] as any,
        });

        if (!course) {
            return ctx.notFound('Course not found');
        }

        const anyCourse = course as any;
        const totalLessons = anyCourse.lessons ? anyCourse.lessons.length : 0;

        // 2. Check if a progress record exists for this student + course + lesson
        const existingProgress = await strapi.documents('api::lesson-progress.lesson-progress').findMany({
            filters: {
                student: { id: user.id },
                course: { documentId: id },
                lesson: { documentId: lessonId },
            } as any,
        });

        if (existingProgress && existingProgress.length > 0) {
            // Update existing record
            await strapi.documents('api::lesson-progress.lesson-progress').update({
                documentId: existingProgress[0].documentId,
                data: {
                    isCompleted,
                    completedAt: isCompleted ? new Date().toISOString() : null,
                } as any,
            });
        } else {
            // Create new record
            await strapi.documents('api::lesson-progress.lesson-progress').create({
                data: {
                    student: user.id,
                    course: anyCourse.documentId,
                    lesson: lessonId,
                    isCompleted,
                    completedAt: isCompleted ? new Date().toISOString() : null,
                } as any,
            });
        }

        // 3. Count all completed lessons for this student in this course
        const allCompletedRecords = await strapi.documents('api::lesson-progress.lesson-progress').findMany({
            filters: {
                student: { id: user.id },
                course: { documentId: id },
                isCompleted: true,
            } as any,
        });

        const completedCount = allCompletedRecords ? allCompletedRecords.length : 0;

        // 4. Calculate progress percentage
        const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
        const isCourseCompleted = progressPercentage === 100;

        // 5. Update the student's Enrollment record with the new percentage
        const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
            filters: {
                student: { id: user.id },
                course: { documentId: id },
            } as any,
        });

        if (enrollments && enrollments.length > 0) {
            await strapi.documents('api::enrollment.enrollment').update({
                documentId: enrollments[0].documentId,
                data: {
                    progressPercentage,
                    enrollmentStatus: isCourseCompleted ? 'completed' : 'active',
                } as any,
            });
        }

        return ctx.send({
            message: 'Progress updated successfully',
            data: {
                courseId: anyCourse.documentId,
                progressPercentage,
                completedLessonsCount: completedCount,
                totalLessonsCount: totalLessons,
                isCourseCompleted,
            },
        });
    },

    /**
     * 4. GET /api/courses/:id/progress
     * Returns student's progress and list of completed lesson IDs for this course
     */
    async getCourseProgress(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to view progress');
        }

        const { id } = ctx.params;

        const completedRecords = await strapi.documents('api::lesson-progress.lesson-progress').findMany({
            filters: {
                student: { id: user.id },
                course: { documentId: id },
                isCompleted: true,
            } as any,
            populate: ['lesson'] as any,
        });

        const completedLessonIds = (completedRecords || [])
            .map((r: any) => (r.lesson ? r.lesson.documentId : null))
            .filter(Boolean);

        // Get enrollment for cached percentage
        const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
            filters: {
                student: { id: user.id },
                course: { documentId: id },
            } as any,
        });

        const progressPercentage = enrollments && enrollments.length > 0 ? enrollments[0].progressPercentage : 0;

        return ctx.send({
            data: {
                courseId: id,
                progressPercentage,
                completedLessonIds,
                completedCount: completedLessonIds.length,
            },
        });
    },



    /**
     * 5. GET /api/instructor/courses
     * Returns all courses created by this instructor with enrolled students and progress
     */
    async getInstructorCourses(ctx: any) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in');
        }

        // Fetch courses where instructor is user, or if admin/fallback fetch all
        let courses = await strapi.documents('api::course.course').findMany({
            filters: {
                instructor: { id: user.id },
            } as any,
            populate: ['lessons', 'quizzes', 'enrollments', 'enrollments.student', 'instructor'] as any,
        });

        if (!courses || courses.length === 0) {
            courses = await strapi.documents('api::course.course').findMany({
                populate: ['lessons', 'quizzes', 'enrollments', 'enrollments.student', 'instructor'] as any,
            });
        }

        const detailedCourses = (courses || []).map((c: any) => {
            const rawEnrollments = c.enrollments || [];
            const enrolledStudents = rawEnrollments.map((e: any) => {
                const sName = e.student?.username || e.student?.email?.split('@')[0] || 'Student';
                return {
                    id: e.student?.id || 1,
                    enrollmentId: e.documentId,
                    studentId: e.student?.id,
                    name: sName,
                    username: e.student?.username || sName.toLowerCase(),
                    email: e.student?.email || 'student@lms.com',
                    progressPercentage: e.progressPercentage || 0,
                    completedLessonsCount: Math.round(((e.progressPercentage || 0) / 100) * (c.lessons?.length || 1)),
                    totalLessons: c.lessons?.length || 1,
                    enrolledAt: e.enrolledAt ? new Date(e.enrolledAt).toISOString().split('T')[0] : '2026-08-20',
                    status: e.enrollmentStatus || 'active',
                };
            });

            const totalProg = enrolledStudents.reduce((sum: number, s: any) => sum + s.progressPercentage, 0);
            const averageProgress = enrolledStudents.length > 0 ? Math.round(totalProg / enrolledStudents.length) : 0;

            return {
                id: c.documentId || c.id,
                title: c.title,
                slug: c.slug,
                coverImage: c.coverImageUrl || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60',
                level: c.level,
                category: c.category,
                totalLessons: c.lessons ? c.lessons.length : 0,
                totalQuizzes: c.quizzes ? c.quizzes.length : 0,
                totalStudents: enrolledStudents.length,
                averageProgress,
                enrolledStudents,
            };
        });

        return ctx.send({
            data: detailedCourses,
        });
    },

    /**
     * 6. POST /api/courses
     * Overrides course creation to auto-assign instructor if created by an Instructor
     */
    async create(ctx: any) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('Authentication required');
        }

        const { data } = ctx.request.body;

        const newCourse = await strapi.documents('api::course.course').create({
            data: {
                ...data,
                instructor: user.id,
            } as any,
        });

        return ctx.send({
            message: 'Course created successfully',
            data: newCourse,
        });
    }
}));
