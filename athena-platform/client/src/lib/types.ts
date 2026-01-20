// ===========================================
// ATHENA - Type Definitions
// ===========================================

// User & Auth
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  headline?: string;
  role: UserRole;
  persona: Persona;
  city?: string;
  state?: string;
  country: string;
  preferredLocale?: string;
  preferredCurrency?: string;
  timezone?: string;
  region?: 'ANZ' | 'US' | 'SEA' | 'MEA' | 'UK' | 'EU';
  consentMarketing?: boolean;
  consentDataProcessing?: boolean;
  consentCookies?: boolean;
  consentDoNotSell?: boolean;
  consentUpdatedAt?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  yearsExperience?: number;
  isPublic: boolean;
  allowMessages: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  subscriptionTier?: SubscriptionTier;
  profile?: UserProfile;
  referralCode?: string;
  referralCredits?: number;
}

export type UserRole =
  | 'USER'
  | 'CREATOR'
  | 'MENTOR'
  | 'EMPLOYER'
  | 'EDUCATION_PROVIDER'
  | 'ADMIN';

export type Persona =
  | 'EARLY_CAREER'
  | 'MID_CAREER'
  | 'ENTREPRENEUR'
  | 'CREATOR'
  | 'MENTOR'
  | 'EDUCATION_PROVIDER'
  | 'EMPLOYER'
  | 'REAL_ESTATE'
  | 'GOVERNMENT_NGO';

export type SubscriptionTier =
  | 'FREE'
  | 'PREMIUM_CAREER'
  | 'PREMIUM_PROFESSIONAL'
  | 'PREMIUM_ENTREPRENEUR'
  | 'PREMIUM_CREATOR'
  | 'ENTERPRISE';

export interface UserProfile {
  id: string;
  userId: string;
  aboutMe?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  openToWork: boolean;
  preferredJobTypes: JobType[];
  salaryMin?: number;
  salaryMax?: number;
  remotePreference?: 'remote' | 'hybrid' | 'onsite';
  isSafeMode: boolean;
  hideFromSearch: boolean;
}

// Jobs
export interface Job {
  id: string;
  title: string;
  slug: string;
  description: string;
  organizationId?: string;
  organization?: Organization;
  postedById: string;
  postedBy?: User;
  type: JobType;
  status: JobStatus;
  city?: string;
  state?: string;
  country: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: 'annual' | 'hourly';
  showSalary: boolean;
  experienceMin?: number;
  experienceMax?: number;
  deadline?: string;
  publishedAt?: string;
  closedAt?: string;
  viewCount: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
  skills?: JobSkill[];
  hasApplied?: boolean;
  isSaved?: boolean;
  savedAt?: string;
}

export type JobType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'CASUAL'
  | 'INTERNSHIP'
  | 'APPRENTICESHIP';

export type JobStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED';

export interface JobSkill {
  id: string;
  jobId: string;
  skillId: string;
  skill: Skill;
  required: boolean;
}

export interface Skill {
  id: string;
  name: string;
  category?: string;
}

// Applications
export interface JobApplication {
  id: string;
  jobId: string;
  job?: Job;
  userId: string;
  user?: User;
  status: ApplicationStatus;
  coverLetter?: string;
  resumeUrl?: string;
  appliedAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | 'PENDING'
  | 'REVIEWED'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'OFFERED'
  | 'REJECTED'
  | 'WITHDRAWN';

// Organizations
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  website?: string;
  industry?: string;
  size?: string;
  founded?: number;
  city?: string;
  state?: string;
  country: string;
  isVerified: boolean;
  safetyScore?: number;
  employeeCount?: number;
}

// Posts & Social
export interface Post {
  id: string;
  authorId: string;
  author?: User;
  type: PostType;
  content: string;
  mediaUrls?: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  isPublic: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  likes?: Like[];
  isLiked?: boolean;
}

export type PostType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'ARTICLE'
  | 'JOB_SHARE'
  | 'COURSE_SHARE';

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  content: string;
  parentId?: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
  isLiked?: boolean;
}

export interface Like {
  id: string;
  userId: string;
  postId?: string;
  commentId?: string;
  createdAt: string;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export type NotificationType =
  | 'LIKE'
  | 'COMMENT'
  | 'FOLLOW'
  | 'MENTION'
  | 'JOB_MATCH'
  | 'APPLICATION_UPDATE'
  | 'MESSAGE'
  | 'SYSTEM';

// Messages
export interface Message {
  id: string;
  senderId: string;
  sender?: User;
  receiverId: string;
  receiver?: User;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message;
  unreadCount: number;
}

// Courses
export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  thumbnail?: string;
  providerId: string;
  provider?: Organization;
  instructorId?: string;
  instructor?: User;
  price: number;
  originalPrice?: number;
  currency: string;
  duration?: number;
  level: CourseLevel;
  category?: string;
  tags?: string[];
  isPublished: boolean;
  isFeatured: boolean;
  enrollmentCount: number;
  rating?: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  lessons?: Lesson[];
  isEnrolled?: boolean;
  progress?: number;
}

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ';
  duration?: number;
  order: number;
  isPreview: boolean;
}

// Mentors
export interface MentorProfile {
  id: string;
  userId: string;
  user?: User;
  title: string;
  expertise: string[];
  hourlyRate?: number;
  availability?: Record<string, string[]>;
  bio: string;
  rating?: number;
  reviewCount: number;
  sessionsCompleted: number;
  isAvailable: boolean;
}

export interface MentorSession {
  id: string;
  mentorId: string;
  mentor?: MentorProfile;
  menteeId: string;
  mentee?: User;
  scheduledAt: string;
  duration: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  meetingLink?: string;
}

// Events
export interface Event {
  id: string;
  title: string;
  description: string;
  type: 'WEBINAR' | 'WORKSHOP' | 'NETWORKING' | 'CONFERENCE';
  startDate: string;
  endDate?: string;
  timezone: string;
  location?: string;
  isVirtual: boolean;
  virtualLink?: string;
  thumbnail?: string;
  organizerId: string;
  organizer?: User | Organization;
  attendeeCount: number;
  maxAttendees?: number;
  price?: number;
  isRegistered?: boolean;
}

// Subscriptions
export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// AI Types
export interface OpportunityRadarResult {
  opportunities: {
    id: string;
    type: 'JOB' | 'COURSE' | 'EVENT' | 'MENTOR';
    title: string;
    match: number;
    reason: string;
    data: Job | Course | Event | MentorProfile;
  }[];
}

export interface ResumeOptimizeResult {
  score: number;
  improvements: {
    section: string;
    current: string;
    suggested: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  keywords: {
    missing: string[];
    present: string[];
  };
}

export interface InterviewCoachResult {
  questions: {
    question: string;
    category: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    tips: string[];
    sampleAnswer: string;
  }[];
}

export interface CareerPathResult {
  currentRole: string;
  targetRole: string;
  milestones: {
    title: string;
    timeframe: string;
    skills: string[];
    salary: { min: number; max: number };
    steps: string[];
  }[];
}

export interface IdeaValidatorResult {
  viability: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  nextSteps: string[];
  potentialRevenue: { min: number; max: number };
}

export interface ContentGeneratorResult {
  content: string;
  hashtags: string[];
  bestTimeToPost: string;
  estimatedEngagement: string;
}
