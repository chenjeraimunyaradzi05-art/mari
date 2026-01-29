/**
 * Shared Types for ATHENA Platform
 * Used by server, client, and mobile apps
 */

// Export utilities
export * from './utils';

// Export hooks
export * from './hooks';

// ==========================================
// ENUMS
// ==========================================

export enum UserRole {
  USER = 'USER',
  EMPLOYER = 'EMPLOYER',
  MENTOR = 'MENTOR',
  ADMIN = 'ADMIN',
}

export enum Persona {
  EARLY_CAREER = 'EARLY_CAREER',
  CAREER_CHANGER = 'CAREER_CHANGER',
  RETURNING_PROFESSIONAL = 'RETURNING_PROFESSIONAL',
  STUDENT = 'STUDENT',
  EMPLOYER = 'EMPLOYER',
  MENTOR = 'MENTOR',
}

export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  CASUAL = 'CASUAL',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  EXPIRED = 'EXPIRED',
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum NotificationType {
  JOB_MATCH = 'JOB_MATCH',
  APPLICATION_UPDATE = 'APPLICATION_UPDATE',
  MESSAGE = 'MESSAGE',
  CONNECTION_REQUEST = 'CONNECTION_REQUEST',
  POST_LIKE = 'POST_LIKE',
  POST_COMMENT = 'POST_COMMENT',
  SYSTEM = 'SYSTEM',
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PREMIUM_CAREER = 'PREMIUM_CAREER',
  EMPLOYER_BASIC = 'EMPLOYER_BASIC',
  EMPLOYER_PRO = 'EMPLOYER_PRO',
}

// ==========================================
// USER TYPES
// ==========================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  persona: Persona;
  headline?: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  yearsExperience?: number;
  emailVerified: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  skills: UserSkill[];
  experience: Experience[];
  education: Education[];
  subscription?: Subscription;
}

export interface UserSkill {
  id: string;
  skill: Skill;
  level: number;
  endorsed: number;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
}

// ==========================================
// JOB TYPES
// ==========================================

export interface Job {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: JobType;
  status: JobStatus;
  city?: string;
  state?: string;
  country?: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  showSalary: boolean;
  experienceMin?: number;
  experienceMax?: number;
  viewCount: number;
  organization: Organization;
  postedBy: User;
  skills: Skill[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  job: Job;
  user: User;
  status: ApplicationStatus;
  coverLetter?: string;
  resumeUrl?: string;
  appliedAt: string;
  updatedAt: string;
}

// ==========================================
// ORGANIZATION TYPES
// ==========================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: string;
  city?: string;
  state?: string;
  country?: string;
  isVerified: boolean;
  safetyScore?: number;
}

// ==========================================
// POST TYPES
// ==========================================

export interface Post {
  id: string;
  content: string;
  type: string;
  author: User;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  author: User;
  createdAt: string;
}

// ==========================================
// MESSAGING TYPES
// ==========================================

export interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  sender: User;
  conversationId: string;
  isRead: boolean;
  createdAt: string;
}

// ==========================================
// NOTIFICATION TYPES
// ==========================================

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// ==========================================
// SUBSCRIPTION TYPES
// ==========================================

export interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: string;
  startDate: string;
  endDate?: string;
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ==========================================
// SOCKET.IO EVENT TYPES
// ==========================================

export interface SocketEvents {
  // Client -> Server
  'notification:subscribe': () => void;
  'notification:mark_read': (data: { notificationId: string }) => void;
  'notification:mark_all_read': () => void;
  'message:join_conversation': (data: { conversationId: string }) => void;
  'message:leave_conversation': (data: { conversationId: string }) => void;
  'message:send': (data: { conversationId: string; content: string }) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;

  // Server -> Client
  'notification:new': (notification: Notification) => void;
  'notification:read': (data: { notificationId: string }) => void;
  'message:new': (message: Message) => void;
  'message:read': (data: { messageId: string }) => void;
  'typing:update': (data: { userId: string; isTyping: boolean }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  'job:application_update': (data: { applicationId: string; status: ApplicationStatus }) => void;
  'job:new_match': (data: { job: Job }) => void;
}
