import { BookOpen, FileText, Headphones, Image, Video } from 'lucide-react';

export interface LessonData {
  id: string;
  title: string;
  contentType: 'video' | 'document' | 'audio' | 'quiz' | 'interactive';
  duration: number;
  description: string;
  generatedContent?: string;
}

export interface ModuleData {
  id: string;
  title: string;
  description: string;
  lessons: LessonData[];
}

export interface CourseData {
  title: string;
  description: string;
  shortDescription: string;
  modules: ModuleData[];
  tags: string[];
  suggestedCategory: string;
}

/** Generation settings chosen in step 1 and reused when publishing. */
export interface GenerationOptions {
  difficulty: string;
  duration: string;
  audience: string;
  courseType: string;
}

export const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
export const durationOptions = ['30 minutes', '1-2 hours', '2-4 hours', '4-8 hours', '8+ hours'];
export const audienceOptions = ['Beginners', 'Professionals', 'Managers', 'Students', 'General audience'];
export const courseTypeOptions = ['Self-Paced', 'Instructor-Led', 'Blended'];
export const categoryOptions = ['Compliance', 'Management', 'Technical', 'Sales', 'Soft Skills', 'Business'];
export const contentTypeList = ['video', 'document', 'audio', 'quiz', 'interactive'] as const;

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

export function totalLessonCount(course: CourseData): number {
  return course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
}

export function totalCourseDuration(course: CourseData): number {
  return course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0),
    0
  );
}
