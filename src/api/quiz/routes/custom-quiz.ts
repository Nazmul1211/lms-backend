export default {
    routes: [
        {
            method: 'GET',
            path: '/quizzes/:id/student-view',
            handler: 'api::quiz.quiz.getStudentQuiz',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'POST',
            path: '/quizzes/:id/submit',
            handler: 'api::quiz.quiz.submitQuiz',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};