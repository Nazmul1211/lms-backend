import type { Schema, Struct } from '@strapi/strapi';

export interface QuizQuestion extends Struct.ComponentSchema {
  collectionName: 'components_quiz_questions';
  info: {
    description: 'MCQ Question component for Quizzes';
    displayName: 'Question';
    icon: 'question';
  };
  attributes: {
    correctAnswerIndex: Schema.Attribute.Integer & Schema.Attribute.Required;
    explanation: Schema.Attribute.Text;
    options: Schema.Attribute.JSON & Schema.Attribute.Required;
    questionText: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'quiz.question': QuizQuestion;
    }
  }
}
