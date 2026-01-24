import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ===========================================
// COMMUNITY SUPPORT PROGRAMS
// ===========================================

// GET /api/community-support/programs - List support programs
router.get('/programs', async (req: Request, res: Response) => {
  try {
    const { communityType, region, active } = req.query;

    const where: Record<string, unknown> = {};
    if (communityType) where.communityType = communityType;
    if (region) where.region = region;
    if (active !== 'false') where.isActive = true;

    const programs = await prisma.communitySupportProgram.findMany({
      where,
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: programs });
  } catch (error) {
    logger.error('Error fetching support programs', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch support programs' });
  }
});

// GET /api/community-support/programs/:id - Get specific program
router.get('/programs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const program = await prisma.communitySupportProgram.findUnique({
      where: { id },
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    res.json({ success: true, data: program });
  } catch (error) {
    logger.error('Error fetching support program', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch support program' });
  }
});

// POST /api/community-support/programs/:id/enroll - Enroll in a program
router.post('/programs/:id/enroll', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { goalsSet } = req.body;

    // Check if program exists and has capacity
    const program = await prisma.communitySupportProgram.findUnique({
      where: { id },
    });

    if (!program || !program.isActive) {
      return res.status(404).json({ success: false, error: 'Program not found or inactive' });
    }

    if (program.maxParticipants && program.currentParticipants >= program.maxParticipants) {
      return res.status(400).json({ success: false, error: 'Program is at capacity' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.programEnrollment.findUnique({
      where: { programId_userId: { programId: id, userId } },
    });

    if (existingEnrollment) {
      return res.status(400).json({ success: false, error: 'Already enrolled in this program' });
    }

    // Create enrollment
    const enrollment = await prisma.programEnrollment.create({
      data: {
        programId: id,
        userId,
        goalsSet,
      },
      include: {
        program: true,
      },
    });

    // Update participant count
    await prisma.communitySupportProgram.update({
      where: { id },
      data: { currentParticipants: { increment: 1 } },
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    logger.error('Error enrolling in program', { error });
    res.status(500).json({ success: false, error: 'Failed to enroll in program' });
  }
});

// GET /api/community-support/my/enrollments - Get user's enrollments
router.get('/my/enrollments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const enrollments = await prisma.programEnrollment.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            milestones: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        milestoneProgress: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json({ success: true, data: enrollments });
  } catch (error) {
    logger.error('Error fetching enrollments', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch enrollments' });
  }
});

// PATCH /api/community-support/enrollments/:id/milestone - Update milestone progress
router.patch('/enrollments/:id/milestone', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { milestoneId, isCompleted, evidence } = req.body;

    // Verify enrollment belongs to user
    const enrollment = await prisma.programEnrollment.findFirst({
      where: { id, userId },
    });

    if (!enrollment) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }

    const progress = await prisma.milestoneProgress.upsert({
      where: {
        enrollmentId_milestoneId: { enrollmentId: id, milestoneId },
      },
      create: {
        enrollmentId: id,
        milestoneId,
        isCompleted: isCompleted ?? false,
        completedAt: isCompleted ? new Date() : null,
        evidence,
      },
      update: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        evidence,
      },
    });

    res.json({ success: true, data: progress });
  } catch (error) {
    logger.error('Error updating milestone progress', { error });
    res.status(500).json({ success: false, error: 'Failed to update milestone progress' });
  }
});

// ===========================================
// INDIGENOUS COMMUNITIES
// ===========================================

// GET /api/community-support/indigenous/communities - List indigenous communities
router.get('/indigenous/communities', async (req: Request, res: Response) => {
  try {
    const { region, womenOnly, verified } = req.query;

    const where: Record<string, unknown> = {};
    if (region) where.region = region;
    if (womenOnly === 'true') where.isWomenOnly = true;
    if (verified === 'true') where.isVerified = true;

    const communities = await prisma.indigenousCommunityPage.findMany({
      where,
      orderBy: { membersCount: 'desc' },
    });

    res.json({ success: true, data: communities });
  } catch (error) {
    logger.error('Error fetching indigenous communities', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch communities' });
  }
});

// GET /api/community-support/indigenous/communities/:id - Get specific community
router.get('/indigenous/communities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const community = await prisma.indigenousCommunityPage.findUnique({
      where: { id },
      include: {
        resources: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    res.json({ success: true, data: community });
  } catch (error) {
    logger.error('Error fetching indigenous community', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch community' });
  }
});

// POST /api/community-support/indigenous/communities/:id/join - Join community
router.post('/indigenous/communities/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const community = await prisma.indigenousCommunityPage.findUnique({
      where: { id },
    });

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    const membership = await prisma.indigenousCommunityMember.create({
      data: {
        communityId: id,
        userId,
      },
    });

    // Update member count
    await prisma.indigenousCommunityPage.update({
      where: { id },
      data: { membersCount: { increment: 1 } },
    });

    res.status(201).json({ success: true, data: membership });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Already a member' });
    }
    logger.error('Error joining community', { error });
    res.status(500).json({ success: false, error: 'Failed to join community' });
  }
});

// GET /api/community-support/indigenous/resources - List indigenous resources
router.get('/indigenous/resources', async (req: Request, res: Response) => {
  try {
    const { type, national } = req.query;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (national === 'true') where.isNational = true;

    const resources = await prisma.indigenousResource.findMany({
      where,
      orderBy: [{ isNational: 'desc' }, { title: 'asc' }],
    });

    res.json({ success: true, data: resources });
  } catch (error) {
    logger.error('Error fetching indigenous resources', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch resources' });
  }
});

// ===========================================
// REFUGEE & IMMIGRANT INTEGRATION
// ===========================================

// GET /api/community-support/language-profile - Get user's language profile
router.get('/language-profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const profile = await prisma.languageProfile.findUnique({
      where: { userId },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error fetching language profile', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch language profile' });
  }
});

// POST /api/community-support/language-profile - Create/update language profile
router.post('/language-profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      primaryLanguage,
      primaryProficiency,
      englishProficiency,
      otherLanguages,
      needsInterpreter,
      preferredInterpreterLang,
    } = req.body;

    if (!primaryLanguage) {
      return res.status(400).json({ success: false, error: 'Primary language is required' });
    }

    const profile = await prisma.languageProfile.upsert({
      where: { userId },
      create: {
        userId,
        primaryLanguage,
        primaryProficiency: primaryProficiency || 'NATIVE',
        englishProficiency: englishProficiency || 'INTERMEDIATE',
        otherLanguages,
        needsInterpreter: needsInterpreter ?? false,
        preferredInterpreterLang,
      },
      update: {
        primaryLanguage,
        primaryProficiency,
        englishProficiency,
        otherLanguages,
        needsInterpreter,
        preferredInterpreterLang,
      },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error saving language profile', { error });
    res.status(500).json({ success: false, error: 'Failed to save language profile' });
  }
});

// GET /api/community-support/credentials - Get user's international credentials
router.get('/credentials', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const credentials = await prisma.internationalCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: credentials });
  } catch (error) {
    logger.error('Error fetching credentials', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch credentials' });
  }
});

// POST /api/community-support/credentials - Add international credential
router.post('/credentials', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      originalCountry,
      credentialType,
      credentialName,
      institution,
      yearObtained,
      fieldOfStudy,
      documentUrl,
    } = req.body;

    if (!originalCountry || !credentialType || !credentialName || !institution) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const credential = await prisma.internationalCredential.create({
      data: {
        userId,
        originalCountry,
        credentialType,
        credentialName,
        institution,
        yearObtained: yearObtained ? parseInt(yearObtained) : null,
        fieldOfStudy,
        documentUrl,
      },
    });

    res.status(201).json({ success: true, data: credential });
  } catch (error) {
    logger.error('Error adding credential', { error });
    res.status(500).json({ success: false, error: 'Failed to add credential' });
  }
});

// GET /api/community-support/bridging-programs - List bridging programs
router.get('/bridging-programs', async (req: Request, res: Response) => {
  try {
    const { profession, region, fundingAvailable } = req.query;

    const where: Record<string, unknown> = { isActive: true };
    if (profession) where.profession = profession;
    if (region) where.region = region;
    if (fundingAvailable === 'true') where.fundingAvailable = true;

    const programs = await prisma.bridgingProgram.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: programs });
  } catch (error) {
    logger.error('Error fetching bridging programs', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch bridging programs' });
  }
});

// POST /api/community-support/bridging-programs/:id/enroll - Enroll in bridging program
router.post('/bridging-programs/:id/enroll', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { credentialId } = req.body;

    const program = await prisma.bridgingProgram.findUnique({
      where: { id },
    });

    if (!program || !program.isActive) {
      return res.status(404).json({ success: false, error: 'Program not found or inactive' });
    }

    const enrollment = await prisma.bridgingEnrollment.create({
      data: {
        programId: id,
        userId,
        credentialId,
      },
      include: {
        program: true,
      },
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Already enrolled' });
    }
    logger.error('Error enrolling in bridging program', { error });
    res.status(500).json({ success: false, error: 'Failed to enroll' });
  }
});

// GET /api/community-support/my/bridging-enrollments - Get user's bridging enrollments
router.get('/my/bridging-enrollments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const enrollments = await prisma.bridgingEnrollment.findMany({
      where: { userId },
      include: {
        program: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json({ success: true, data: enrollments });
  } catch (error) {
    logger.error('Error fetching bridging enrollments', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch enrollments' });
  }
});

export default router;
