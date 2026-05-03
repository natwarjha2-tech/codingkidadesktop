export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  enrolledCourses: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  isFree: boolean;
  thumbnail: string;
  modules: Module[];
  rating: number;
  totalStudents: number;
}

export interface Module {
  id: string;
  title: string;
  videos: Video[];
}

export interface Video {
  id: string;
  title: string;
  duration: string;
  isFree: boolean;
  url: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
}

export interface LiveClass {
  id: string;
  title: string;
  instructor: string;
  scheduledAt: string;
  joinUrl: string;
}

export type Page =
  | 'login'
  | 'signup'
  | 'dashboard'
  | 'courses'
  | 'course-detail'
  | 'video-player'
  | 'quiz'
  | 'exercise'
  | 'chat'
  | 'ai-assistant'
  | 'live-class'
  | 'downloads'
  | 'profile';
