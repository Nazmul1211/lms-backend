import type { Core } from '@strapi/strapi';

export default {
    /**
     * 1. GET /api/admin-dashboard/stats
     * Returns high-level platform statistics
     */
    async getStats(ctx: any) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('Authentication required');
        }

        try {
            // 1. Fetch total courses, lessons, enrollments, submissions
            const totalCourses = await strapi.documents('api::course.course').count({});
            const totalLessons = await strapi.documents('api::lesson.lesson').count({});
            const totalEnrollments = await strapi.documents('api::enrollment.enrollment').count({});
            const totalSubmissions = await strapi.documents('api::quiz-submission.quiz-submission').count({});
            const totalBlogPosts = await strapi.documents('api::blog-post.blog-post').count({});

            // 2. Fetch all users to compute role breakdown
            const allUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
                populate: ['role'],
            });

            const usersByRole: Record<string, number> = {
                Admin: 0,
                'Content Manager': 0,
                Instructor: 0,
                Student: 0,
            };

            (allUsers || []).forEach((u: any) => {
                const roleName = u.role?.name || 'Student';
                if (usersByRole[roleName] !== undefined) {
                    usersByRole[roleName]++;
                } else {
                    usersByRole[roleName] = 1;
                }
            });

            // 3. Fetch recent 5 enrollments
            const recentEnrollments = await strapi.documents('api::enrollment.enrollment').findMany({
                limit: 5,
                sort: 'enrolledAt:desc',
                populate: ['student', 'course'] as any,
            });

            return ctx.send({
                data: {
                    totalUsers: allUsers.length,
                    usersByRole,
                    totalCourses,
                    totalLessons,
                    totalEnrollments,
                    totalSubmissions,
                    totalBlogPosts,
                    recentEnrollments,
                },
            });
        } catch (error: any) {
            return ctx.internalServerError(`Failed to fetch stats: ${error.message}`);
        }
    },

    /**
     * 2. GET /api/admin-dashboard/users
     * Lists all users with their roles
     */
    async getUsers(ctx: any) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('Authentication required');
        }

        try {
            const users = await strapi.db.query('plugin::users-permissions.user').findMany({
                select: ['id', 'username', 'email', 'confirmed', 'blocked', 'createdAt'],
                populate: ['role'],
                orderBy: { createdAt: 'desc' },
            });

            const availableRoles = await strapi.db.query('plugin::users-permissions.role').findMany({
                select: ['id', 'name', 'type', 'description'],
            });

            return ctx.send({
                data: {
                    users,
                    availableRoles,
                },
            });
        } catch (error: any) {
            return ctx.internalServerError(`Failed to fetch users: ${error.message}`);
        }
    },

    /**
     * 3. PUT /api/admin-dashboard/users/:id/role
     * Updates a user's role (promote/demote)
     */
    async updateUserRole(ctx: any) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('Authentication required');
        }

        const { id } = ctx.params;
        const { roleId } = ctx.request.body;

        if (!roleId) {
            return ctx.badRequest('roleId is required');
        }

        // Verify role exists
        const targetRole = await strapi.db.query('plugin::users-permissions.role').findOne({
            where: { id: roleId },
        });

        if (!targetRole) {
            return ctx.notFound('Target role not found');
        }

        // Update user's role
        const updatedUser = await strapi.db.query('plugin::users-permissions.user').update({
            where: { id },
            data: { role: roleId },
            populate: ['role'],
        });

        if (!updatedUser) {
            return ctx.notFound('User not found');
        }

        return ctx.send({
            message: `User role successfully changed to ${targetRole.name}`,
            data: {
                userId: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
            },
        });
    },
};