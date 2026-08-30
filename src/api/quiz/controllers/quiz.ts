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

        // Try find quiz by documentId
        let quiz: any = await strapi.documents('api::quiz.quiz').findOne({
            documentId: id,
            populate: ['questions', 'course'] as any,
        });

        // Fallback: try finding by numeric id or by associated course documentId/slug
        if (!quiz) {
            const allQuizzes = await strapi.documents('api::quiz.quiz').findMany({
                populate: ['questions', 'course'] as any,
            });

            quiz = (allQuizzes || []).find((q: any) => 
                q.documentId === id ||
                String(q.id) === String(id) ||
                q.course?.documentId === id ||
                String(q.course?.id) === String(id) ||
                q.course?.slug === id
            );
        }

        if (!quiz) {
            return ctx.notFound('Quiz not found for this course');
        }

        const questions = quiz.questions || [];

        // Sanitize questions: strip correctAnswerIndex and explanation
        const sanitizedQuestions = questions.map((q: any, index: number) => ({
            id: q.id || index + 1,
            questionIndex: index,
            question: q.questionText || q.question || '',
            questionText: q.questionText || q.question || '',
            options: q.options || [],
        }));

        return ctx.send({
            id: quiz.documentId,
            quizId: quiz.documentId,
            courseId: quiz.course?.documentId || id,
            title: quiz.title,
            description: quiz.description,
            passingScorePercentage: quiz.passingScore || 70,
            passingScore: quiz.passingScore || 70,
            totalQuestions: sanitizedQuestions.length,
            questions: sanitizedQuestions,
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
        const body = ctx.request.body || {};
        const rawAnswers = body.answers;

        if (!rawAnswers) {
            return ctx.badRequest('Answers payload is required');
        }

        // Fetch full quiz from DB with correct answers
        let quiz: any = await strapi.documents('api::quiz.quiz').findOne({
            documentId: id,
            populate: ['questions', 'course'] as any,
        });

        if (!quiz) {
            const allQuizzes = await strapi.documents('api::quiz.quiz').findMany({
                populate: ['questions', 'course'] as any,
            });

            quiz = (allQuizzes || []).find((q: any) => 
                q.documentId === id ||
                String(q.id) === String(id) ||
                q.course?.documentId === id ||
                String(q.course?.id) === String(id) ||
                q.course?.slug === id
            );
        }

        if (!quiz) {
            return ctx.notFound('Quiz not found');
        }

        const questions = quiz.questions || [];
        const totalQuestions = questions.length;

        if (totalQuestions === 0) {
            return ctx.badRequest('This quiz has no questions');
        }

        let correctCount = 0;
        const gradedBreakdown = questions.map((q: any, index: number) => {
            let selectedOptionIndex: number | null = null;

            if (Array.isArray(rawAnswers)) {
                const found = rawAnswers.find((a: any) => a.questionIndex === index || a.questionId === q.id);
                selectedOptionIndex = found ? found.selectedOptionIndex : null;
            } else if (typeof rawAnswers === 'object') {
                // Object map: { [questionId or index]: selectedOptionIndex }
                const val = rawAnswers[q.id] !== undefined ? rawAnswers[q.id] : rawAnswers[index];
                selectedOptionIndex = val !== undefined ? Number(val) : null;
            }

            const correctAnswerIndex = q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : 0;
            const isCorrect = selectedOptionIndex === correctAnswerIndex;

            if (isCorrect) {
                correctCount++;
            }

            return {
                questionId: q.id || index + 1,
                questionIndex: index,
                question: q.questionText || q.question || '',
                questionText: q.questionText || q.question || '',
                options: q.options || [],
                selectedOption: selectedOptionIndex !== null ? selectedOptionIndex : -1,
                selectedOptionIndex,
                correctOption: correctAnswerIndex,
                correctAnswerIndex,
                isCorrect,
                explanation: q.explanation || '',
            };
        });

        // Calculate score percentage
        const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
        const passingScore = quiz.passingScore || 70;
        const passed = scorePercentage >= passingScore;

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
                quiz: quiz.documentId,
                course: quiz.course ? quiz.course.documentId : null,
            } as any,
        });

        return ctx.send({
            message: passed ? 'Congratulations! You passed the quiz.' : 'You did not pass. Keep practicing!',
            quizId: quiz.documentId,
            courseId: quiz.course ? quiz.course.documentId : null,
            scorePercentage,
            score: scorePercentage,
            correctCount,
            totalQuestions,
            passed,
            passingScorePercentage: passingScore,
            passingScore,
            submittedAt: new Date().toISOString(),
            results: gradedBreakdown,
            breakdown: gradedBreakdown,
        });
    },
}));
