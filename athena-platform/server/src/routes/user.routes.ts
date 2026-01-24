import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { indexDocument, deleteDocument, IndexNames } from '../utils/opensearch';
import { getRegionConfig, normalizeRegion } from '../utils/region';
import { logger } from '../utils/logger';

const router = Router();

const REGION_KEYS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU', 'ROW'] as const;
const CONSENT_FIELDS = [
  'consentMarketing',
  'consentDataProcessing',
  'consentCookies',
  'consentDoNotSell',
] as const;

// Helper to sync user data to OpenSearch
const syncUserToIndex = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        headline: true,
        bio: true,
        role: true,
        city: true,
        country: true,
        avatar: true,
        isPublic: true,
      },
    });

    if (!user) return;
    if (!user.isPublic) {
      // If user became private, ensure they are removed from index
      await deleteDocument(IndexNames.USERS, user.id);
      return;
    }

    const startSkills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });

    const doc = {
      ...user,
      skills: startSkills.map(s => s.skill.name),
    };

    await indexDocument(IndexNames.USERS, user.id, doc);
  } catch (error) {
    logger.error(`Failed to sync user ${userId} to OpenSearch`, { error });
  }
};

// ===========================================
// DOWNLOAD MY DATA (DSAR Export)
// ===========================================
router.get('/me/export', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const [
      user,
      profile,
      skills,
      education,
      experience,
      posts,
      comments,
      likes,
      followers,
      following,
      jobApplications,
      savedJobs,
      courseEnrollments,
      mentorSessions,
      educationApplications,
      organizationMemberships,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          bio: true,
          headline: true,
          role: true,
          persona: true,
          city: true,
          state: true,
          country: true,
          preferredLocale: true,
          preferredCurrency: true,
          timezone: true,
          region: true,
          consentMarketing: true,
          consentDataProcessing: true,
          consentCookies: true,
          consentDoNotSell: true,
          consentUpdatedAt: true,
          currentJobTitle: true,
          currentCompany: true,
          yearsExperience: true,
          isPublic: true,
          allowMessages: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          referralCode: true,
          referralCredits: true,
        },
      }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.userSkill.findMany({
        where: { userId },
        include: { skill: true },
        orderBy: { endorsed: 'desc' },
      }),
      prisma.education.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      prisma.workExperience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.like.findMany({
        where: { userId },
        include: {
          post: {
            select: { id: true, authorId: true, content: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobApplication.findMany({
        where: { userId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
              organizationId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
      }),
      prisma.savedJob.findMany({
        where: { userId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
              organizationId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { savedAt: 'desc' },
      }),
      prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              organizationId: true,
              providerName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mentorSession.findMany({
        where: { menteeId: userId },
        include: {
          mentorProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.educationApplication.findMany({
        where: { userId },
        include: {
          organization: { select: { id: true, name: true, slug: true, type: true } },
          course: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.organizationMember.findMany({
        where: { userId },
        include: {
          organization: { select: { id: true, name: true, slug: true, type: true } },
        },
        orderBy: { invitedAt: 'desc' },
      }),
    ]);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    await prisma.auditLog.create({
      data: {
        action: 'DSAR_EXPORT',
        actorUserId: userId,
        targetUserId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          exportedAt: new Date().toISOString(),
        },
      },
    });

    res.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        user,
        profile,
        skills,
        education,
        experience,
        posts,
        comments,
        likes,
        followers,
        following,
        jobApplications,
        savedJobs,
        courseEnrollments,
        mentorSessions,
        educationApplications,
        organizationMemberships,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE ACCOUNT (Minimal anonymization)
// ===========================================
router.delete(
  '/me',
  authenticate,
  [body('confirm').isBoolean().custom((v) => v === true).withMessage('Confirmation required')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // We avoid hard-deleting the User row because some models reference userId
      // with required relations (e.g. jobs posted). Instead we revoke access and
      // anonymize PII while keeping referential integrity intact.
      const tombstoneEmail = `deleted+${userId}+${Date.now()}@example.invalid`;

      await prisma.$transaction([
        prisma.auditLog.create({
          data: {
            action: 'ACCOUNT_DELETE',
            actorUserId: userId,
            targetUserId: userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
              deletedAt: new Date().toISOString(),
            },
          },
        }),
        prisma.session.deleteMany({ where: { userId } }),
        prisma.verificationToken.deleteMany({ where: { userId } }),
        prisma.subscription.deleteMany({ where: { userId } }),
        prisma.profile.deleteMany({ where: { userId } }),
        prisma.userSkill.deleteMany({ where: { userId } }),
        prisma.education.deleteMany({ where: { userId } }),
        prisma.workExperience.deleteMany({ where: { userId } }),
        prisma.courseEnrollment.deleteMany({ where: { userId } }),
        prisma.savedJob.deleteMany({ where: { userId } }),
        prisma.educationApplication.deleteMany({ where: { userId } }),
        prisma.jobApplication.deleteMany({ where: { userId } }),
        prisma.user.update({
          where: { id: userId },
          data: {
            email: tombstoneEmail,
            passwordHash: null,
            emailVerified: false,
            emailVerifiedAt: null,
            firstName: 'Deleted',
            lastName: 'User',
            displayName: 'Deleted User',
            avatar: null,
            bio: null,
            headline: null,
            city: null,
            state: null,
            currentJobTitle: null,
            currentCompany: null,
            yearsExperience: null,
            isPublic: false,
            allowMessages: false,
            isSuspended: true,
            lastLoginAt: null,
            referralCode: null,
            referralCredits: 0,
          },
        }),
      ]);

      res.json({
        success: true,
        message: 'Account deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET USER PROFILE (PUBLIC)
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        bio: true,
        headline: true,
        role: true,
        persona: true,
        city: true,
        state: true,
        country: true,
        currentJobTitle: true,
        currentCompany: true,
        yearsExperience: true,
        isPublic: true,
        createdAt: true,
        profile: {
          select: {
            aboutMe: true,
            linkedinUrl: true,
            websiteUrl: true,
            openToWork: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        education: {
          orderBy: { startDate: 'desc' },
        },
        experience: {
          orderBy: { startDate: 'desc' },
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if profile is private and viewer is not the owner
    if (!user.isPublic && req.user?.id !== id) {
      throw new ApiError(403, 'This profile is private');
    }

    // Check if current user follows this user
    let isFollowing = false;
    if (req.user && req.user.id !== id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: id,
          },
        },
      });
      isFollowing = !!follow;
    }

    res.json({
      success: true,
      data: {
        ...user,
        isFollowing,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE CURRENT USER PROFILE
// ===========================================
router.patch(
  '/me',
  authenticate,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('displayName').optional().trim(),
    body('bio').optional().trim(),
    body('headline').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('country').optional().trim(),
    body('currentJobTitle').optional().trim(),
    body('currentCompany').optional().trim(),
    body('yearsExperience').optional().isInt({ min: 0 }),
    body('persona').optional().isIn([
      'EARLY_CAREER', 'MID_CAREER', 'ENTREPRENEUR', 'CREATOR',
      'MENTOR', 'EDUCATION_PROVIDER', 'EMPLOYER', 'REAL_ESTATE', 'GOVERNMENT_NGO'
    ]),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const allowedFields = [
        'firstName', 'lastName', 'displayName', 'bio', 'headline',
        'city', 'state', 'country', 'currentJobTitle', 'currentCompany',
        'yearsExperience', 'persona', 'isPublic', 'allowMessages'
      ];

      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          bio: true,
          headline: true,
          role: true,
          persona: true,
          city: true,
          state: true,
          country: true,
          currentJobTitle: true,
          currentCompany: true,
          yearsExperience: true,
          isPublic: true,
        },
      });

      await syncUserToIndex(user.id);

      res.json({
        success: true,
        message: 'Profile updated',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET USER PREFERENCES
// ===========================================
router.get('/me/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        preferredLocale: true,
        preferredCurrency: true,
        timezone: true,
        region: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE USER PREFERENCES
// ===========================================
router.patch(
  '/me/preferences',
  authenticate,
  [
    body('preferredLocale').optional().isString().isLength({ min: 2, max: 15 }),
    body('preferredCurrency').optional().isString().isLength({ min: 3, max: 3 }),
    body('timezone').optional().isString().notEmpty(),
    body('region').optional().isIn(REGION_KEYS as unknown as string[]),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const existing = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { region: true },
      });

      const regionKey = normalizeRegion(req.body.region || existing?.region || 'ANZ');
      const regionConfig = getRegionConfig(regionKey);

      if (req.body.preferredLocale && !regionConfig.supportedLocales.includes(req.body.preferredLocale)) {
        throw new ApiError(400, 'Locale not supported for selected region');
      }

      if (
        req.body.preferredCurrency &&
        !regionConfig.supportedCurrencies.includes(String(req.body.preferredCurrency).toUpperCase())
      ) {
        throw new ApiError(400, 'Currency not supported for selected region');
      }

      const allowedFields = ['preferredLocale', 'preferredCurrency', 'timezone', 'region'];
      const updateData: Record<string, any> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (req.body.region && !req.body.preferredLocale) {
        updateData.preferredLocale = regionConfig.defaultLocale;
      }

      if (req.body.region && !req.body.preferredCurrency) {
        updateData.preferredCurrency = regionConfig.defaultCurrency;
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updateData,
        select: {
          id: true,
          preferredLocale: true,
          preferredCurrency: true,
          timezone: true,
          region: true,
        },
      });

      res.json({
        success: true,
        message: 'Preferences updated',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET USER CONSENTS
// ===========================================
router.get('/me/consents', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        consentMarketing: true,
        consentDataProcessing: true,
        consentCookies: true,
        consentDoNotSell: true,
        consentUpdatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE USER CONSENTS
// ===========================================
router.patch(
  '/me/consents',
  authenticate,
  [
    body('consentMarketing').optional().isBoolean(),
    body('consentDataProcessing').optional().isBoolean(),
    body('consentCookies').optional().isBoolean(),
    body('consentDoNotSell').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const updateData: Record<string, any> = {};
      for (const field of CONSENT_FIELDS) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No consent updates provided');
      }

      updateData.consentUpdatedAt = new Date();

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updateData,
        select: {
          id: true,
          consentMarketing: true,
          consentDataProcessing: true,
          consentCookies: true,
          consentDoNotSell: true,
          consentUpdatedAt: true,
        },
      });

      res.json({
        success: true,
        message: 'Consents updated',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE EXTENDED PROFILE
// ===========================================
router.patch(
  '/me/profile',
  authenticate,
  [
    body('aboutMe').optional().trim(),
    body('linkedinUrl').optional().isURL(),
    body('websiteUrl').optional().isURL(),
    body('twitterUrl').optional().isURL(),
    body('openToWork').optional().isBoolean(),
    body('salaryMin').optional().isInt({ min: 0 }),
    body('salaryMax').optional().isInt({ min: 0 }),
    body('remotePreference').optional().isIn(['remote', 'hybrid', 'onsite']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const profile = await prisma.profile.upsert({
        where: { userId: req.user!.id },
        update: req.body,
        create: {
          userId: req.user!.id,
          ...req.body,
        },
      });

      res.json({
        success: true,
        message: 'Profile updated',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADD SKILL
// ===========================================
router.get('/me/skills', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const skills = await prisma.userSkill.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        skillId: true,
        level: true,
        endorsed: true,
        skill: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { skill: { name: 'asc' } },
    });

    res.json({
      success: true,
      data: skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        name: s.skill.name,
        level: s.level,
        endorsed: s.endorsed,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/me/skills',
  authenticate,
  [
    body('skillName').notEmpty().trim(),
    body('level').optional().isInt({ min: 1, max: 5 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { skillName, level } = req.body;

      // Find or create skill
      let skill = await prisma.skill.findUnique({
        where: { name: skillName.toLowerCase() },
      });

      if (!skill) {
        skill = await prisma.skill.create({
          data: { name: skillName.toLowerCase() },
        });
      }

      // Add to user
      const userSkill = await prisma.userSkill.upsert({
        where: {
          userId_skillId: {
            userId: req.user!.id,
            skillId: skill.id,
          },
        },
        update: { level },
        create: {
          userId: req.user!.id,
          skillId: skill.id,
          level,
        },
        include: { skill: true },
      });

      await syncUserToIndex(req.user!.id);

      res.status(201).json({
        success: true,
        data: userSkill,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REMOVE SKILL
// ===========================================
router.delete('/me/skills/:skillId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.userSkill.deleteMany({
      where: {
        userId: req.user!.id,
        skillId: req.params.skillId,
      },
    });

    await syncUserToIndex(req.user!.id);

    res.json({
      success: true,
      message: 'Skill removed',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ADD WORK EXPERIENCE
// ===========================================
router.post(
  '/me/experience',
  authenticate,
  [
    body('company').notEmpty().trim(),
    body('title').notEmpty().trim(),
    body('startDate').isISO8601(),
    body('endDate').optional().isISO8601(),
    body('current').optional().isBoolean(),
    body('description').optional().trim(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const experience = await prisma.workExperience.create({
        data: {
          userId: req.user!.id,
          ...req.body,
          startDate: new Date(req.body.startDate),
          endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        },
      });

      res.status(201).json({
        success: true,
        data: experience,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADD EDUCATION
// ===========================================
router.post(
  '/me/education',
  authenticate,
  [
    body('institution').notEmpty().trim(),
    body('degree').optional().trim(),
    body('fieldOfStudy').optional().trim(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('current').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const education = await prisma.education.create({
        data: {
          userId: req.user!.id,
          ...req.body,
          startDate: req.body.startDate ? new Date(req.body.startDate) : null,
          endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        },
      });

      res.status(201).json({
        success: true,
        data: education,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// FOLLOW USER
// ===========================================
router.post('/:id/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      throw new ApiError(400, 'Cannot follow yourself');
    }

    // Check if user exists
    const userToFollow = await prisma.user.findUnique({ where: { id } });
    if (!userToFollow) {
      throw new ApiError(404, 'User not found');
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user!.id,
          followingId: id,
        },
      },
    });

    if (existingFollow) {
      throw new ApiError(400, 'Already following this user');
    }

    await prisma.follow.create({
      data: {
        followerId: req.user!.id,
        followingId: id,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: id,
        type: 'FOLLOW',
        title: 'New follower',
        message: `${req.user!.email} started following you`,
        link: `/users/${req.user!.id}`,
      },
    });

    res.json({
      success: true,
      message: 'Following user',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UNFOLLOW USER
// ===========================================
router.delete('/:id/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.follow.deleteMany({
      where: {
        followerId: req.user!.id,
        followingId: id,
      },
    });

    res.json({
      success: true,
      message: 'Unfollowed user',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET USER'S FOLLOWERS
// ===========================================
router.get('/:id/followers', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const followers = await prisma.follow.findMany({
      where: { followingId: id },
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatar: true,
            headline: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.follow.count({ where: { followingId: id } });

    res.json({
      success: true,
      data: followers.map((f) => f.follower),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET USER'S FOLLOWING
// ===========================================
router.get('/:id/following', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const following = await prisma.follow.findMany({
      where: { followerId: id },
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatar: true,
            headline: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.follow.count({ where: { followerId: id } });

    res.json({
      success: true,
      data: following.map((f) => f.following),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
