'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Clock,
  Users,
  Star,
  Award,
  BookOpen,
  CheckCircle2,
  Lock,
  PlayCircle,
  FileText,
  Download,
  Share2,
  Heart,
  ChevronDown,
  ChevronUp,
  Globe,
  BarChart,
  MessageSquare,
} from 'lucide-react';
import { useCourse, useEnrollCourse, useAuthStore } from '@/lib/hooks';
import { cn, formatCurrency } from '@/lib/utils';

interface Module {
  id: string;
  title: string;
  duration: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'quiz' | 'reading' | 'exercise';
  completed?: boolean;
  locked?: boolean;
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { data: course, isLoading } = useCourse(courseId);
  const { mutate: enroll, isPending: isEnrolling } = useEnrollCourse();
  const { user } = useAuthStore();
  
  const [expandedModules, setExpandedModules] = useState<string[]>(['1']);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock course data
  const mockCourse = {
    id: courseId,
    title: 'Product Management Fundamentals',
    description: 'Master the essential skills of product management. Learn how to identify customer needs, define product strategy, and lead cross-functional teams to deliver successful products.',
    instructor: {
      id: '1',
      name: 'Sarah Chen',
      avatar: null,
      title: 'VP of Product at TechCorp',
      bio: 'Former product leader at Google and Airbnb with 15+ years of experience.',
      students: 12500,
      courses: 8,
      rating: 4.9,
    },
    thumbnail: null,
    price: 199,
    discountedPrice: 149,
    duration: '12 hours',
    level: 'INTERMEDIATE',
    category: 'PRODUCT_MANAGEMENT',
    language: 'English',
    lastUpdated: '2024-01-15',
    totalLessons: 42,
    totalModules: 8,
    enrolled: 4532,
    rating: 4.8,
    reviewCount: 876,
    skills: ['Product Strategy', 'User Research', 'Roadmapping', 'Stakeholder Management', 'Agile', 'Analytics'],
    includes: [
      '12 hours of video content',
      '42 lessons across 8 modules',
      '15 downloadable resources',
      'Certificate of completion',
      'Lifetime access',
      'Community access',
    ],
    isEnrolled: false,
    progress: 0,
  };

  const mockModules: Module[] = [
    {
      id: '1',
      title: 'Introduction to Product Management',
      duration: '1h 20m',
      lessons: [
        { id: '1-1', title: 'What is Product Management?', duration: '15:00', type: 'video' },
        { id: '1-2', title: 'The PM Role Across Companies', duration: '20:00', type: 'video' },
        { id: '1-3', title: 'PM vs Other Roles', duration: '15:00', type: 'reading' },
        { id: '1-4', title: 'Module Quiz', duration: '10:00', type: 'quiz' },
      ],
    },
    {
      id: '2',
      title: 'Understanding Your Users',
      duration: '2h 15m',
      lessons: [
        { id: '2-1', title: 'User Research Methods', duration: '25:00', type: 'video', locked: true },
        { id: '2-2', title: 'Conducting User Interviews', duration: '30:00', type: 'video', locked: true },
        { id: '2-3', title: 'Creating User Personas', duration: '20:00', type: 'video', locked: true },
        { id: '2-4', title: 'Interview Exercise', duration: '45:00', type: 'exercise', locked: true },
        { id: '2-5', title: 'Module Quiz', duration: '15:00', type: 'quiz', locked: true },
      ],
    },
    {
      id: '3',
      title: 'Product Strategy & Vision',
      duration: '2h 30m',
      lessons: [
        { id: '3-1', title: 'Defining Product Vision', duration: '30:00', type: 'video', locked: true },
        { id: '3-2', title: 'Market Analysis', duration: '25:00', type: 'video', locked: true },
        { id: '3-3', title: 'Competitive Analysis', duration: '25:00', type: 'video', locked: true },
        { id: '3-4', title: 'Strategy Frameworks', duration: '35:00', type: 'reading', locked: true },
        { id: '3-5', title: 'Building Your Strategy', duration: '35:00', type: 'exercise', locked: true },
      ],
    },
  ];

  const displayCourse = course || mockCourse;

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleEnroll = () => {
    enroll(courseId);
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return PlayCircle;
      case 'quiz':
        return BarChart;
      case 'reading':
        return FileText;
      case 'exercise':
        return BookOpen;
      default:
        return PlayCircle;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Link
        href="/dashboard/learn"
        className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Courses
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Course Header */}
          <div className="card">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-xs font-medium px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full">
                {displayCourse.category?.replace('_', ' ')}
              </span>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                {displayCourse.level}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {displayCourse.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {displayCourse.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center">
                <Star className="w-4 h-4 text-yellow-500 mr-1" />
                {displayCourse.rating} ({displayCourse.reviewCount} reviews)
              </span>
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {displayCourse.enrolled?.toLocaleString()} students
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {displayCourse.duration}
              </span>
              <span className="flex items-center">
                <Globe className="w-4 h-4 mr-1" />
                {displayCourse.language}
              </span>
            </div>
          </div>

          {/* Video Preview */}
          <div className="card p-0 overflow-hidden">
            <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button className="w-20 h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition z-10">
                <Play className="w-10 h-10 text-primary-600 ml-1" />
              </button>
              <span className="absolute bottom-4 left-4 text-white font-medium">
                Preview this course
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              {['overview', 'curriculum', 'instructor', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'py-4 px-1 border-b-2 font-medium text-sm transition',
                    activeTab === tab
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* What You'll Learn */}
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  What You'll Learn
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {displayCourse.skills?.map((skill: string, i: number) => (
                    <div key={i} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Course Includes */}
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  This Course Includes
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {displayCourse.includes?.map((item: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-primary-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'curriculum' && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Course Curriculum
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {displayCourse.totalModules} modules • {displayCourse.totalLessons} lessons • {displayCourse.duration}
                </span>
              </div>

              <div className="space-y-4">
                {mockModules.map((module) => (
                  <div
                    key={module.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750"
                    >
                      <div className="flex items-center space-x-3">
                        {expandedModules.includes(module.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {module.title}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {module.lessons.length} lessons • {module.duration}
                      </span>
                    </button>

                    {expandedModules.includes(module.id) && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {module.lessons.map((lesson) => {
                          const LessonIcon = getLessonIcon(lesson.type);
                          return (
                            <div
                              key={lesson.id}
                              className={cn(
                                'flex items-center justify-between p-4',
                                lesson.locked && 'opacity-60'
                              )}
                            >
                              <div className="flex items-center space-x-3">
                                <LessonIcon className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-700 dark:text-gray-300">
                                  {lesson.title}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {lesson.duration}
                                </span>
                                {lesson.locked ? (
                                  <Lock className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <PlayCircle className="w-4 h-4 text-primary-500" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'instructor' && (
            <div className="card">
              <div className="flex items-start space-x-4">
                <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-2xl font-bold text-primary-600">
                  {displayCourse.instructor?.name?.charAt(0) || 'I'}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {displayCourse.instructor?.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {displayCourse.instructor?.title}
                  </p>
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 mr-1" />
                      {displayCourse.instructor?.rating} rating
                    </span>
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {displayCourse.instructor?.students?.toLocaleString()} students
                    </span>
                    <span className="flex items-center">
                      <BookOpen className="w-4 h-4 mr-1" />
                      {displayCourse.instructor?.courses} courses
                    </span>
                  </div>
                  <p className="mt-4 text-gray-600 dark:text-gray-300">
                    {displayCourse.instructor?.bio}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Student Reviews
              </h2>
              <div className="flex items-center space-x-6 mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {displayCourse.rating}
                  </div>
                  <div className="flex items-center justify-center mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'w-4 h-4',
                          star <= Math.floor(displayCourse.rating)
                            ? 'text-yellow-500 fill-current'
                            : 'text-gray-300'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {displayCourse.reviewCount} reviews
                  </p>
                </div>
              </div>

              {/* Sample Reviews */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-t border-gray-100 dark:border-gray-700 pt-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            Student {i}
                          </span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className="w-3 h-3 text-yellow-500 fill-current"
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          Excellent course! The instructor explains concepts clearly and the
                          practical exercises really helped me apply what I learned.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            {/* Price */}
            <div className="mb-6">
              {displayCourse.discountedPrice ? (
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(displayCourse.discountedPrice)}
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    {formatCurrency(displayCourse.price)}
                  </span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {Math.round((1 - displayCourse.discountedPrice / displayCourse.price) * 100)}% off
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(displayCourse.price)}
                </span>
              )}
            </div>

            {/* CTA Buttons */}
            {displayCourse.isEnrolled ? (
              <button className="w-full btn-primary py-3 flex items-center justify-center space-x-2">
                <Play className="w-5 h-5" />
                <span>Continue Learning</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
                >
                  <Award className="w-5 h-5" />
                  <span>{isEnrolling ? 'Enrolling...' : 'Enroll Now'}</span>
                </button>
                <button className="w-full btn-outline py-3 mt-3 flex items-center justify-center space-x-2">
                  <Heart className="w-5 h-5" />
                  <span>Add to Wishlist</span>
                </button>
              </>
            )}

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              30-day money-back guarantee
            </p>

            {/* Share */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
