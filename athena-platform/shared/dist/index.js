"use strict";
/**
 * Shared Types for ATHENA Platform
 * Used by server, client, and mobile apps
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionTier = exports.NotificationType = exports.ApplicationStatus = exports.JobStatus = exports.JobType = exports.Persona = exports.UserRole = void 0;
// Export utilities
__exportStar(require("./utils"), exports);
// Export hooks
__exportStar(require("./hooks"), exports);
// ==========================================
// ENUMS
// ==========================================
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "USER";
    UserRole["CREATOR"] = "CREATOR";
    UserRole["EMPLOYER"] = "EMPLOYER";
    UserRole["MENTOR"] = "MENTOR";
    UserRole["EDUCATION_PROVIDER"] = "EDUCATION_PROVIDER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var Persona;
(function (Persona) {
    Persona["EARLY_CAREER"] = "EARLY_CAREER";
    Persona["MID_CAREER"] = "MID_CAREER";
    Persona["CAREER_CHANGER"] = "MID_CAREER";
    Persona["RETURNING_PROFESSIONAL"] = "MID_CAREER";
    Persona["STUDENT"] = "EARLY_CAREER";
    Persona["ENTREPRENEUR"] = "ENTREPRENEUR";
    Persona["CREATOR"] = "CREATOR";
    Persona["EMPLOYER"] = "EMPLOYER";
    Persona["MENTOR"] = "MENTOR";
    Persona["EDUCATION_PROVIDER"] = "EDUCATION_PROVIDER";
    Persona["REAL_ESTATE"] = "REAL_ESTATE";
    Persona["GOVERNMENT_NGO"] = "GOVERNMENT_NGO";
})(Persona || (exports.Persona = Persona = {}));
var JobType;
(function (JobType) {
    JobType["FULL_TIME"] = "FULL_TIME";
    JobType["PART_TIME"] = "PART_TIME";
    JobType["CONTRACT"] = "CONTRACT";
    JobType["INTERNSHIP"] = "INTERNSHIP";
    JobType["CASUAL"] = "CASUAL";
})(JobType || (exports.JobType = JobType = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["DRAFT"] = "DRAFT";
    JobStatus["ACTIVE"] = "ACTIVE";
    JobStatus["PAUSED"] = "PAUSED";
    JobStatus["CLOSED"] = "CLOSED";
    JobStatus["EXPIRED"] = "EXPIRED";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["PENDING"] = "PENDING";
    ApplicationStatus["REVIEWING"] = "REVIEWING";
    ApplicationStatus["REVIEWED"] = "REVIEWED";
    ApplicationStatus["SHORTLISTED"] = "SHORTLISTED";
    ApplicationStatus["INTERVIEW"] = "INTERVIEW";
    ApplicationStatus["OFFER"] = "OFFER";
    ApplicationStatus["OFFERED"] = "OFFERED";
    ApplicationStatus["REJECTED"] = "REJECTED";
    ApplicationStatus["WITHDRAWN"] = "WITHDRAWN";
})(ApplicationStatus || (exports.ApplicationStatus = ApplicationStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["JOB_MATCH"] = "JOB_MATCH";
    NotificationType["APPLICATION_UPDATE"] = "APPLICATION_UPDATE";
    NotificationType["MESSAGE"] = "MESSAGE";
    NotificationType["CONNECTION_REQUEST"] = "CONNECTION_REQUEST";
    NotificationType["POST_LIKE"] = "POST_LIKE";
    NotificationType["POST_COMMENT"] = "POST_COMMENT";
    NotificationType["SYSTEM"] = "SYSTEM";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var SubscriptionTier;
(function (SubscriptionTier) {
    SubscriptionTier["FREE"] = "FREE";
    SubscriptionTier["PREMIUM_CAREER"] = "PREMIUM_CAREER";
    SubscriptionTier["PREMIUM_PROFESSIONAL"] = "PREMIUM_PROFESSIONAL";
    SubscriptionTier["PREMIUM_ENTREPRENEUR"] = "PREMIUM_ENTREPRENEUR";
    SubscriptionTier["PREMIUM_CREATOR"] = "PREMIUM_CREATOR";
    SubscriptionTier["ENTERPRISE"] = "ENTERPRISE";
    SubscriptionTier["EMPLOYER_BASIC"] = "EMPLOYER_BASIC";
    SubscriptionTier["EMPLOYER_PRO"] = "EMPLOYER_PRO";
})(SubscriptionTier || (exports.SubscriptionTier = SubscriptionTier = {}));
