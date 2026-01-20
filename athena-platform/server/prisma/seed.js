"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seed...');
    // 1. Clean existing data (optional - be careful in prod)
    // await prisma.job.deleteMany();
    // await prisma.organization.deleteMany();
    // await prisma.user.deleteMany();
    // 2. Create Users
    const passwordHash = await bcryptjs_1.default.hash('password123', 10);
    const demoUser = await prisma.user.upsert({
        where: { email: 'demo@athena.com' },
        update: {},
        create: {
            email: 'demo@athena.com',
            passwordHash,
            firstName: 'Demo',
            lastName: 'User',
            displayName: 'Demo User',
            role: client_1.UserRole.USER,
            persona: client_1.Persona.EARLY_CAREER,
            emailVerified: true,
            headline: 'Aspiring Developer',
            city: 'Sydney',
            state: 'NSW',
            country: 'Australia',
            isPublic: true,
        },
    });
    const employerUser = await prisma.user.upsert({
        where: { email: 'hr@techcorp.com' },
        update: {},
        create: {
            email: 'hr@techcorp.com',
            passwordHash,
            firstName: 'Sarah',
            lastName: 'Recruiter',
            displayName: 'Sarah HR',
            role: client_1.UserRole.EMPLOYER,
            persona: client_1.Persona.EMPLOYER,
            emailVerified: true,
            headline: 'Talent Acquisition at TechCorp',
            city: 'Melbourne',
            state: 'VIC',
            country: 'Australia',
            isPublic: true,
        },
    });
    console.log('✅ Users seeded');
    // 3. Create Organizations
    const techCorp = await prisma.organization.upsert({
        where: { slug: 'tech-corp' },
        update: {},
        create: {
            name: 'Tech Corp',
            slug: 'tech-corp',
            description: 'Leading provider of enterprise software solutions.',
            industry: 'Technology',
            type: 'company',
            size: '1000+',
            city: 'Melbourne',
            state: 'VIC',
            country: 'Australia',
            isVerified: true,
            website: 'https://techcorp.example.com',
        },
    });
    const healthPlus = await prisma.organization.upsert({
        where: { slug: 'health-plus' },
        update: {},
        create: {
            name: 'Health Plus',
            slug: 'health-plus',
            description: 'Healthcare for everyone.',
            industry: 'Healthcare',
            type: 'company',
            size: '500-1000',
            city: 'Sydney',
            state: 'NSW',
            country: 'Australia',
            isVerified: true,
            website: 'https://healthplus.example.com',
        },
    });
    const startUpInc = await prisma.organization.upsert({
        where: { slug: 'startup-inc' },
        update: {},
        create: {
            name: 'Startup Inc',
            slug: 'startup-inc',
            description: 'Disrupting the market with AI.',
            industry: 'Technology',
            type: 'company',
            size: '1-10',
            city: 'Brisbane',
            state: 'QLD',
            country: 'Australia',
            isVerified: false,
            website: 'https://startup.example.com',
        },
    });
    console.log('✅ Organizations seeded');
    // 4. Create Jobs
    const jobs = [
        {
            title: 'Senior Frontend Engineer',
            slug: 'senior-frontend-engineer-tech-corp',
            description: 'We are looking for an experienced React developer to lead our frontend team. You will be working with Next.js, TypeScript, and TailwindCSS.',
            organizationId: techCorp.id,
            postedById: employerUser.id,
            type: client_1.JobType.FULL_TIME,
            status: client_1.JobStatus.ACTIVE,
            city: 'Melbourne',
            state: 'VIC',
            country: 'Australia',
            isRemote: true,
            salaryMin: 120000,
            salaryMax: 160000,
            salaryType: 'annual',
            experienceMin: 5,
            publishedAt: new Date(),
        },
        {
            title: 'Product Manager',
            slug: 'product-manager-tech-corp',
            description: 'Join our product team to define the future of our enterprise suite. You will work closely with engineering and design.',
            organizationId: techCorp.id,
            postedById: employerUser.id,
            type: client_1.JobType.FULL_TIME,
            status: client_1.JobStatus.ACTIVE,
            city: 'Melbourne',
            state: 'VIC',
            country: 'Australia',
            isRemote: false,
            salaryMin: 110000,
            salaryMax: 150000,
            salaryType: 'annual',
            experienceMin: 3,
            publishedAt: new Date(),
        },
        {
            title: 'Registered Nurse',
            slug: 'registered-nurse-health-plus',
            description: 'Health Plus is seeking a compassionate Registered Nurse to join our growing team.',
            organizationId: healthPlus.id,
            postedById: employerUser.id, // Reusing for simplicity
            type: client_1.JobType.FULL_TIME,
            status: client_1.JobStatus.ACTIVE,
            city: 'Sydney',
            state: 'NSW',
            country: 'Australia',
            isRemote: false,
            salaryMin: 80000,
            salaryMax: 110000,
            salaryType: 'annual',
            experienceMin: 2,
            publishedAt: new Date(),
        },
        {
            title: 'AI Researcher Intern',
            slug: 'ai-researcher-intern-startup-inc',
            description: 'Part-time internship for students studying AI/ML. Opportunity to work on cutting-edge models.',
            organizationId: startUpInc.id,
            postedById: employerUser.id,
            type: client_1.JobType.INTERNSHIP,
            status: client_1.JobStatus.ACTIVE,
            city: 'Remote',
            state: 'QLD', // Origin
            country: 'Australia',
            isRemote: true,
            salaryMin: 30, // Hourly
            salaryMax: 40,
            salaryType: 'hourly',
            experienceMin: 0,
            publishedAt: new Date(),
        },
    ];
    for (const job of jobs) {
        await prisma.job.upsert({
            where: { slug: job.slug },
            update: {},
            create: job,
        });
    }
    console.log('✅ Jobs seeded');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map