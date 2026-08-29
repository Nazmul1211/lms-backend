/**
 * quiz controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController('api::quiz.quiz', ({ strapi }) => ({
    /**
     * 1. GET /api/quizzes/:id/student-view
     * Returns quiz questions SANITIZED (without correct answers or explanations)
     */
    async getStudentQuiz(ctx) {
        const { id } = ctx.params;

        // Find quiz with questions populated
        const quiz = await strapi.documents('api::quiz.quiz').findOne({
            documentId: id,
            populate: ['questions', 'course'] as any,
        });

        if (!quiz) {
            return ctx.notFound('Quiz not found');
        }

        const anyQuiz = quiz as any;
        const questions = anyQuiz.questions || [];

        // Sanitize questions: strip correctAnswerIndex and explanation
        const sanitizedQuestions = questions.map((q: any, index: number) => ({
            questionIndex: index,
            questionText: q.questionText,
            options: q.options,
        }));

        return ctx.send({
            data: {
                id: anyQuiz.documentId,
                title: anyQuiz.title,
                description: anyQuiz.description,
                passingScore: anyQuiz.passingScore,
                totalQuestions: sanitizedQuestions.length,
                questions: sanitizedQuestions,
            },
        });
    },

    /**
     * 2. POST /api/quizzes/:id/submit
     * Auto-grades the quiz on the server and stores a QuizSubmission
     */
    async submitQuiz(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to submit a quiz');
        }

        const { id } = ctx.params;
        const { answers } = ctx.request.body; // Expects: [{ questionIndex: 0, selectedOptionIndex: 1 }, ...]

        if (!answers || !Array.isArray(answers)) {
            return ctx.badRequest('Answers array is required');
        }

        // Fetch full quiz from DB with correct answers
        const quiz = await strapi.documents('api::quiz.quiz').findOne({
            documentId: id,
            populate: ['questions', 'course'] as any,
        });

        if (!quiz) {
            return ctx.notFound('Quiz not found');
        }

        const anyQuiz = quiz as any;
        const questions = anyQuiz.questions || [];
        const totalQuestions = questions.length;

        if (totalQuestions === 0) {
            return ctx.badRequest('This quiz has no questions');
        }

        let correctCount = 0;
        const gradedBreakdown = questions.map((q: any, index: number) => {
            const studentSubmission = answers.find((a: any) => a.questionIndex === index);
            const selectedOptionIndex = studentSubmission ? studentSubmission.selectedOptionIndex : null;
            const isCorrect = selectedOptionIndex === q.correctAnswerIndex;

            if (isCorrect) {
                correctCount++;
            }

            return {
                questionIndex: index,
                questionText: q.questionText,
                options: q.options,
                selectedOptionIndex,
                correctAnswerIndex: q.correctAnswerIndex,
                isCorrect,
                explanation: q.explanation,
            };
        });

        // Calculate score percentage (e.g. 80%)
        const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
        const passed = scorePercentage >= (anyQuiz.passingScore || 70);

        // Save QuizSubmission record in database
        const submission = await strapi.documents('api::quiz-submission.quiz-submission').create({
            data: {
                score: scorePercentage,
                totalQuestions,
                correctAnswersCount: correctCount,
                passed,
                submittedAnswers: gradedBreakdown,
                submittedAt: new Date().toISOString(),
                student: user.id,
                quiz: anyQuiz.documentId,
                course: anyQuiz.course ? anyQuiz.course.documentId : null,
            } as any,
        });

        return ctx.send({
            message: passed ? 'Congratulations! You passed the quiz.' : 'You did not pass. Keep practicing!',
            data: {
                submissionId: (submission as any).documentId,
                score: scorePercentage,
                correctCount,
                totalQuestions,
                passed,
                passingScore: anyQuiz.passingScore,
                breakdown: gradedBreakdown,
            },
        });
    },
}));
