export default {
    routes: [
        {
            method: 'POST',
            path: '/courses/:id/enroll',
            handler: 'api::course.course.enrollCourse',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'GET',
            path: '/my-courses',
            handler: 'api::course.course.getMyCourses',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/courses/:id/progress',
            handler: 'api::course.course.updateLessonProgress',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'GET',
            path: '/courses/:id/progress',
            handler: 'api::course.course.getCourseProgress',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'GET',
            path: '/instructor/courses',
            handler: 'api::course.course.getInstructorCourses',
            config: { policies: [], middlewares: [] },
        },
    ],
};
