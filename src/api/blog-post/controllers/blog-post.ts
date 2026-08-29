import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::blog-post.blog-post', ({ strapi }) => ({
    /**
     * 1. GET /api/blog-posts
     * Public & Students see ONLY published posts.
     * Admins & Content Managers see ALL posts (including drafts).
     */
    async find(ctx) {
        const user = ctx.state.user;

        // Check if user is Admin or Content Manager
        let isManager = false;
        if (user && user.id) {
            const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: user.id },
                populate: ['role'],
            });
            const roleName = userWithRole?.role?.name;
            isManager = roleName === 'Admin' || roleName === 'Content Manager';
        }

        // If not Admin or Content Manager, restrict to isPublished: true
        if (!isManager) {
            ctx.query = {
                ...ctx.query,
                filters: {
                    ...(ctx.query.filters as any),
                    isPublished: true,
                },
            };
        }

        // Call default Strapi find with populate author
        ctx.query = {
            ...ctx.query,
            populate: ['author'] as any,
        };

        return await super.find(ctx);
    },

    /**
     * 2. GET /api/blog-posts/:id
     * Public/Students cannot view a single post if it is a draft.
     */
    async findOne(ctx) {
        const { id } = ctx.params;
        const user = ctx.state.user;

        const post = await strapi.documents('api::blog-post.blog-post').findOne({
            documentId: id,
            populate: ['author'] as any,
        });

        if (!post) {
            return ctx.notFound('Blog post not found');
        }

        const anyPost = post as any;

        // Check if user is Admin or Content Manager
        let isManager = false;
        if (user && user.id) {
            const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: user.id },
                populate: ['role'],
            });
            const roleName = userWithRole?.role?.name;
            isManager = roleName === 'Admin' || roleName === 'Content Manager';
        }

        // If it's a draft and user is not a manager, block access
        if (!anyPost.isPublished && !isManager) {
            return ctx.forbidden('This blog post is a draft and is not published yet');
        }

        return ctx.send({ data: post });
    },

    /**
     * 3. POST /api/blog-posts
     * Automatically sets the author to the logged-in Admin / Content Manager
     */
    async create(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to create a blog post');
        }

        const { data } = ctx.request.body;

        const newPost = await strapi.documents('api::blog-post.blog-post').create({
            data: {
                ...data,
                author: user.id,
                blogPostPublishedAt: data?.isPublished ? new Date().toISOString() : null,
            } as any,
        });

        return ctx.send({
            message: 'Blog post created successfully',
            data: newPost,
        });
    },
}));