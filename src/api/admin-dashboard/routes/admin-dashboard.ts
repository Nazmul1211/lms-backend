export default {
    routes: [
        {
            method: 'GET',
            path: '/admin-dashboard/stats',
            handler: 'admin-dashboard.getStats',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'GET',
            path: '/admin-dashboard/users',
            handler: 'admin-dashboard.getUsers',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'PUT',
            path: '/admin-dashboard/users/:id/role',
            handler: 'admin-dashboard.updateUserRole',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};