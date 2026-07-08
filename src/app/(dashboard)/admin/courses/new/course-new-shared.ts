import { BookOpen, FileText, Headphones, Image, Video } from 'lucide-react';

export type Lesson = {
  id: string;
  title: string;
  contentType: 'video' | 'document' | 'audio' | 'quiz' | 'interactive';
  duration: number;
  required: boolean;
};

export type DripType = 'immediate' | 'after_days' | 'on_date' | 'after_previous';

export type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
  dripType: DripType;
  dripDays: number;
  dripDate: string;
};

/** Step 1 fields (cover image is handled separately since it holds a File). */
export interface BasicInfo {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  courseType: string;
  difficulty: string;
  duration: number;
  tags: string[];
  learningObjectives: string;
  optimalAudience: string;
}

export interface Prerequisite {
  course_id: string;
  title: string;
  requirement_type: string;
  min_score: number | null;
}

/** Step 3 fields. */
export interface CourseSettings {
  enrollmentType: string;
  passingScore: number;
  maxAttempts: number;
  includeEvaluation: boolean;
  availableFrom: string;
  availableUntil: string;
  prerequisites: Prerequisite[];
  skills: string[];
}

export const typeOptions = ['Self-Paced', 'Instructor-Led', 'Blended'];
export const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
export const contentTypeOptions = ['video', 'document', 'audio', 'quiz', 'interactive'];
export const enrollmentTypes = ['Open', 'Approval Required', 'Assigned Only'];
export const requirementTypeLabels: Record<string, string> = {
  completion: 'Completion',
  min_score: 'Minimum Score',
  enrollment: 'Enrollment Only',
};
export const skillOptions = ['JavaScript', 'Python', 'React', 'SQL', 'Communication', 'Leadership', 'Problem Solving', 'Project Management', 'Data Analysis'];

export const dripTypeLabels: Record<DripType, string> = {
  immediate: 'Immediate',
  after_days: 'Days After Enrollment',
  on_date: 'On Specific Date',
  after_previous: 'After Previous Module',
};

// Default skeleton: a single starter module.
export const initialModules: Module[] = [
  {
    id: 'm1',
    title: 'Getting Started',
    dripType: 'immediate',
    dripDays: 0,
    dripDate: '',
    lessons: [
      { id: 'l1', title: 'Welcome & Course Overview', contentType: 'video', duration: 10, required: true },
      { id: 'l2', title: 'Setting Up Your Environment', contentType: 'document', duration: 15, required: true },
      { id: 'l3', title: 'Quick Start Exercise', contentType: 'interactive', duration: 20, required: false },
    ],
  },
];

export const contentTypeIcon: Record<string, typeof Video> = {
  video: Video,
  document: FileText,
  audio: Headphones,
  quiz: BookOpen,
  interactive: Image,
};

export const courseTypeMap: Record<string, string> = {
  'Self-Paced': 'self_paced',
  'Instructor-Led': 'instructor_led',
  'Blended': 'blended',
};

export const difficultyMap: Record<string, string> = {
  'Beginner': 'beginner',
  'Intermediate': 'intermediate',
  'Advanced': 'advanced',
};

export const enrollmentTypeMap: Record<string, string> = {
  'Open': 'open',
  'Approval Required': 'approval',
  'Assigned Only': 'assigned',
};

export function totalLessonCount(modules: Module[]): number {
  return modules.reduce((acc, m) => acc + m.lessons.length, 0);
}

export function totalModulesDuration(modules: Module[]): number {
  return modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0), 0);
}
