export type QuestionType = 'likert' | 'multiple_choice' | 'short_answer';

export type SectionId = 'personality' | 'interests' | 'learning' | 'situational' | 'values';

export type Competency =
  | 'Logical Thinking'
  | 'Creativity'
  | 'Leadership'
  | 'Communication'
  | 'Empathy'
  | 'Curiosity'
  | 'Discipline'
  | 'Entrepreneurship'
  | 'Scientific Thinking'
  | 'Commercial Orientation'
  | 'Learning Agility'
  | 'Risk Taking'
  | 'Resilience'
  | 'Decision Making'
  | 'Analytical Ability';

export interface Section {
  id: SectionId;
  title: string;
  description: string;
}

export interface Question {
  id: number;
  section: SectionId;
  type: QuestionType;
  text: string;
  options: string[];
  competencies: Competency[];
  weight: number;
}

export interface Assessment {
  assessmentVersion: string;
  title: string;
  durationInMinutes: number;
  sections: Section[];
  questions: Question[];
}

export interface StudentInformation {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  grade: '9' | '10' | '11' | '12';
}

export interface Answer {
  questionId: number;
  answer: string | number;
}

export interface AssessmentSubmission {
  student: StudentInformation;
  assessment: {
    version: string;
    startedAt: string;
    completedAt: string;
    duration: number;
  };
  answers: Answer[];
}

export interface AssessmentProgress {
  currentQuestionIndex: number;
  answers: Answer[];
  startedAt: string;
  lastSavedAt: string;
  student?: StudentInformation;
}
