/**
 * ATHENA Platform - Authentic Data Seed
 * Populates the database with real Australian private & public institutions,
 * authentic job listings, accredited courses, and realistic community content.
 */

import { PrismaClient, Persona, UserRole, JobType, JobStatus, PostType, NotificationType, SubscriptionTier, ApplicationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==========================================
// HELPERS
// ==========================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function refCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==========================================
// AUTHENTIC AUSTRALIAN DATA
// ==========================================

const SKILLS_DATA = [
  // Technical
  { name: 'JavaScript', category: 'Technical' },
  { name: 'TypeScript', category: 'Technical' },
  { name: 'Python', category: 'Technical' },
  { name: 'React', category: 'Technical' },
  { name: 'Node.js', category: 'Technical' },
  { name: 'SQL', category: 'Technical' },
  { name: 'AWS', category: 'Technical' },
  { name: 'Data Analysis', category: 'Technical' },
  { name: 'Cybersecurity', category: 'Technical' },
  { name: 'Machine Learning', category: 'Technical' },
  { name: 'Cloud Computing', category: 'Technical' },
  { name: 'DevOps', category: 'Technical' },
  // Soft Skills
  { name: 'Leadership', category: 'Soft Skills' },
  { name: 'Communication', category: 'Soft Skills' },
  { name: 'Problem Solving', category: 'Soft Skills' },
  { name: 'Project Management', category: 'Soft Skills' },
  { name: 'Stakeholder Management', category: 'Soft Skills' },
  { name: 'Critical Thinking', category: 'Soft Skills' },
  // Industry
  { name: 'Digital Marketing', category: 'Industry' },
  { name: 'UX Research', category: 'Industry' },
  { name: 'Agile Methodology', category: 'Industry' },
  { name: 'Financial Modelling', category: 'Industry' },
  { name: 'Regulatory Compliance', category: 'Industry' },
  { name: 'Supply Chain Management', category: 'Industry' },
];

// Real Australian organisations — private & public
const ORGANISATIONS = [
  // --- PRIVATE SECTOR ---
  { name: 'Commonwealth Bank of Australia', type: 'company', industry: 'Finance', size: '10000+', city: 'Sydney', state: 'NSW', website: 'https://www.commbank.com.au', verified: true, description: 'One of Australia\'s leading financial institutions, providing banking, insurance, and wealth management services to millions of Australians.' },
  { name: 'BHP', type: 'company', industry: 'Mining & Resources', size: '10000+', city: 'Melbourne', state: 'VIC', website: 'https://www.bhp.com', verified: true, description: 'Global resources company producing iron ore, copper, nickel, and metallurgical coal across operations in Australia and worldwide.' },
  { name: 'Telstra', type: 'company', industry: 'Telecommunications', size: '10000+', city: 'Melbourne', state: 'VIC', website: 'https://www.telstra.com.au', verified: true, description: 'Australia\'s largest telecommunications and technology company, providing mobile, internet, and enterprise connectivity solutions.' },
  { name: 'Woolworths Group', type: 'company', industry: 'Retail', size: '10000+', city: 'Sydney', state: 'NSW', website: 'https://www.woolworthsgroup.com.au', verified: true, description: 'Major Australian retail group operating supermarkets, department stores, and e-commerce platforms nationwide.' },
  { name: 'Canva', type: 'company', industry: 'Technology', size: '1001-5000', city: 'Sydney', state: 'NSW', website: 'https://www.canva.com', verified: true, description: 'Australian-founded global design platform empowering millions to create professional visual content with an intuitive online tool.' },
  { name: 'Atlassian', type: 'company', industry: 'Technology', size: '5001-10000', city: 'Sydney', state: 'NSW', website: 'https://www.atlassian.com', verified: true, description: 'Enterprise software company building collaboration tools including Jira, Confluence, and Trello used by teams worldwide.' },
  { name: 'Macquarie Group', type: 'company', industry: 'Finance', size: '5001-10000', city: 'Sydney', state: 'NSW', website: 'https://www.macquarie.com', verified: true, description: 'Global financial services group providing asset management, banking, advisory, and risk solutions across multiple markets.' },
  { name: 'Rio Tinto', type: 'company', industry: 'Mining & Resources', size: '10000+', city: 'Melbourne', state: 'VIC', website: 'https://www.riotinto.com', verified: true, description: 'Leading global mining and metals company with major Australian operations in iron ore, aluminium, copper, and minerals.' },
  { name: 'Qantas Airways', type: 'company', industry: 'Aviation', size: '10000+', city: 'Sydney', state: 'NSW', website: 'https://www.qantas.com', verified: true, description: 'Australia\'s flag carrier airline and one of the world\'s longest-running airlines, operating domestic and international services.' },
  { name: 'CSL Limited', type: 'company', industry: 'Healthcare', size: '10000+', city: 'Melbourne', state: 'VIC', website: 'https://www.csl.com', verified: true, description: 'Global biotechnology leader developing and delivering innovative biotherapies, vaccines, and plasma-derived products.' },
  { name: 'Fortescue', type: 'company', industry: 'Mining & Resources', size: '5001-10000', city: 'Perth', state: 'WA', website: 'https://www.fmgl.com.au', verified: true, description: 'Major iron ore producer and green energy company operating large-scale mining and renewable energy projects in Western Australia.' },
  { name: 'National Australia Bank', type: 'company', industry: 'Finance', size: '10000+', city: 'Melbourne', state: 'VIC', website: 'https://www.nab.com.au', verified: true, description: 'One of Australia\'s four major banks, providing personal banking, business banking, and wealth management services.' },

  // --- PUBLIC SECTOR / GOVERNMENT ---
  { name: 'Department of Education', type: 'government', industry: 'Government', size: '1001-5000', city: 'Canberra', state: 'ACT', website: 'https://www.education.gov.au', verified: true, description: 'Australian Government department responsible for national education and training policies, funding, and programs.' },
  { name: 'Services Australia', type: 'government', industry: 'Government', size: '10000+', city: 'Canberra', state: 'ACT', website: 'https://www.servicesaustralia.gov.au', verified: true, description: 'Delivers social, health, and child support payments and services to Australians through Centrelink, Medicare, and My Aged Care.' },
  { name: 'Australian Taxation Office', type: 'government', industry: 'Government', size: '10000+', city: 'Canberra', state: 'ACT', website: 'https://www.ato.gov.au', verified: true, description: 'Australia\'s principal revenue collection body, administering the tax and superannuation systems for the Australian Government.' },
  { name: 'NSW Health', type: 'government', industry: 'Healthcare', size: '10000+', city: 'Sydney', state: 'NSW', website: 'https://www.health.nsw.gov.au', verified: true, description: 'New South Wales public health system delivering hospital, community health, mental health, and population health services.' },

  // --- UNIVERSITIES ---
  { name: 'University of Melbourne', type: 'university', industry: 'Education', size: '5001-10000', city: 'Melbourne', state: 'VIC', website: 'https://www.unimelb.edu.au', verified: true, description: 'Australia\'s leading research-intensive university, ranked among the top universities globally, offering undergraduate and postgraduate programs.' },
  { name: 'University of Sydney', type: 'university', industry: 'Education', size: '5001-10000', city: 'Sydney', state: 'NSW', website: 'https://www.sydney.edu.au', verified: true, description: 'Australia\'s first university, a world-leading institution offering a broad range of disciplines and research opportunities.' },
  { name: 'UNSW Sydney', type: 'university', industry: 'Education', size: '5001-10000', city: 'Sydney', state: 'NSW', website: 'https://www.unsw.edu.au', verified: true, description: 'Global university with strengths in engineering, science, business, and law, known for innovation and industry partnerships.' },
  { name: 'Monash University', type: 'university', industry: 'Education', size: '5001-10000', city: 'Melbourne', state: 'VIC', website: 'https://www.monash.edu', verified: true, description: 'One of Australia\'s largest universities with a strong global presence, research impact, and comprehensive course offerings.' },
  { name: 'University of Queensland', type: 'university', industry: 'Education', size: '5001-10000', city: 'Brisbane', state: 'QLD', website: 'https://www.uq.edu.au', verified: true, description: 'Top-50 global university delivering world-class teaching and research across science, health, engineering, humanities, and business.' },

  // --- TAFE / RTOs ---
  { name: 'TAFE NSW', type: 'tafe', industry: 'Education', size: '5001-10000', city: 'Sydney', state: 'NSW', website: 'https://www.tafensw.edu.au', verified: true, description: 'Australia\'s largest vocational education and training provider, delivering practical, job-ready skills across hundreds of courses.' },
  { name: 'TAFE Queensland', type: 'tafe', industry: 'Education', size: '1001-5000', city: 'Brisbane', state: 'QLD', website: 'https://tafeqld.edu.au', verified: true, description: 'Queensland\'s largest and most experienced provider of vocational education and training, serving communities statewide.' },
  { name: 'RMIT University', type: 'tafe', industry: 'Education', size: '5001-10000', city: 'Melbourne', state: 'VIC', website: 'https://www.rmit.edu.au', verified: true, description: 'Dual-sector university offering vocational and higher education with a focus on technology, design, and enterprise.' },

  // --- NGOs ---
  { name: 'Salvation Army Australia', type: 'ngo', industry: 'Community Services', size: '5001-10000', city: 'Melbourne', state: 'VIC', website: 'https://www.salvationarmy.org.au', verified: true, description: 'National community services organisation providing crisis support, housing assistance, employment services, and family programs.' },
  { name: 'Red Cross Australia', type: 'ngo', industry: 'Community Services', size: '1001-5000', city: 'Melbourne', state: 'VIC', website: 'https://www.redcross.org.au', verified: true, description: 'Humanitarian organisation delivering disaster relief, migration support, community programs, and international aid across Australia.' },
];

// Authentic job listings from real sectors
const JOBS_DATA: Array<{
  title: string; orgIndex: number; description: string;
  city: string; state: string; type: JobType; salaryMin: number; salaryMax: number; remote: boolean;
  expMin: number; expMax: number;
}> = [
  // CBA
  { title: 'Graduate Analyst - Risk & Compliance', orgIndex: 0, description: 'Join our graduate program in risk and compliance. Analyse regulatory requirements, support risk assessments, and develop frameworks to protect our customers and business.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 70000, salaryMax: 85000, remote: false, expMin: 0, expMax: 2 },
  { title: 'Senior Software Engineer - Digital Banking', orgIndex: 0, description: 'Build and scale digital banking experiences for millions of Australians. Work with modern cloud-native architectures, microservices, and event-driven systems.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 140000, salaryMax: 180000, remote: true, expMin: 5, expMax: 10 },
  // BHP
  { title: 'Graduate Mining Engineer', orgIndex: 1, description: 'Two-year rotational graduate program across open-cut and underground mining operations. Develop technical skills in mine planning, ventilation, and geotechnical engineering.', city: 'Perth', state: 'WA', type: JobType.FULL_TIME, salaryMin: 85000, salaryMax: 105000, remote: false, expMin: 0, expMax: 1 },
  { title: 'Process Plant Operator', orgIndex: 1, description: 'Operate and monitor mineral processing plant equipment. Conduct routine checks, adjust settings for optimal throughput, and follow safety procedures on a FIFO roster.', city: 'Newman', state: 'WA', type: JobType.FULL_TIME, salaryMin: 100000, salaryMax: 130000, remote: false, expMin: 2, expMax: 5 },
  // Telstra
  { title: 'Cyber Security Analyst', orgIndex: 2, description: 'Monitor and respond to security incidents across Telstra\'s network infrastructure. Perform threat hunting, vulnerability assessments, and incident response using SIEM tools.', city: 'Melbourne', state: 'VIC', type: JobType.FULL_TIME, salaryMin: 95000, salaryMax: 125000, remote: true, expMin: 2, expMax: 5 },
  { title: 'Network Engineer - 5G', orgIndex: 2, description: 'Design and deploy next-generation 5G network infrastructure across urban and regional Australia. Collaborate with vendors and internal teams on network architecture.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 110000, salaryMax: 145000, remote: false, expMin: 3, expMax: 7 },
  // Woolworths
  { title: 'Supply Chain Analyst', orgIndex: 3, description: 'Analyse end-to-end supply chain performance, identify cost and efficiency improvements, and support demand planning across our national distribution network.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 75000, salaryMax: 95000, remote: true, expMin: 1, expMax: 4 },
  { title: 'Store Manager - Regional', orgIndex: 3, description: 'Lead a team of 50+ in a high-volume supermarket. Drive sales performance, customer experience, and operational excellence in a regional community.', city: 'Dubbo', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 85000, salaryMax: 110000, remote: false, expMin: 3, expMax: 8 },
  // Canva
  { title: 'Product Designer', orgIndex: 4, description: 'Shape the future of visual communication by designing intuitive experiences for millions of creators. Work closely with engineering, product, and research teams.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 120000, salaryMax: 160000, remote: true, expMin: 3, expMax: 7 },
  { title: 'Machine Learning Engineer', orgIndex: 4, description: 'Build ML models powering Canva\'s content recommendation, image generation, and design intelligence features at scale using Python, PyTorch, and cloud infrastructure.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 150000, salaryMax: 200000, remote: true, expMin: 4, expMax: 8 },
  // Atlassian
  { title: 'Site Reliability Engineer', orgIndex: 5, description: 'Ensure the reliability and performance of Atlassian\'s cloud platform serving millions of users. Build automation, improve observability, and respond to incidents.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 140000, salaryMax: 185000, remote: true, expMin: 3, expMax: 8 },
  { title: 'Data Analyst - Growth', orgIndex: 5, description: 'Analyse user behaviour and growth metrics to identify opportunities. Build dashboards, run experiments, and provide insights that drive product and marketing decisions.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 100000, salaryMax: 130000, remote: true, expMin: 2, expMax: 5 },
  // Macquarie Group
  { title: 'Investment Analyst - Infrastructure', orgIndex: 6, description: 'Support the infrastructure investment team with financial modelling, due diligence, and market analysis for renewable energy and transport assets globally.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 90000, salaryMax: 120000, remote: false, expMin: 1, expMax: 4 },
  // Rio Tinto
  { title: 'Environmental Scientist', orgIndex: 7, description: 'Manage environmental monitoring programs, conduct impact assessments, and ensure compliance with environmental regulations across mining operations in the Pilbara.', city: 'Perth', state: 'WA', type: JobType.FULL_TIME, salaryMin: 95000, salaryMax: 120000, remote: false, expMin: 2, expMax: 6 },
  // Qantas
  { title: 'Customer Experience Designer', orgIndex: 8, description: 'Design seamless travel experiences across digital and physical touchpoints. Conduct user research, prototype solutions, and collaborate with engineering teams.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 100000, salaryMax: 135000, remote: true, expMin: 3, expMax: 7 },
  // CSL
  { title: 'Clinical Research Associate', orgIndex: 9, description: 'Manage clinical trial sites across Australia, monitor protocol compliance, ensure data quality, and liaise with investigators for plasma-derived therapy studies.', city: 'Melbourne', state: 'VIC', type: JobType.FULL_TIME, salaryMin: 85000, salaryMax: 110000, remote: false, expMin: 2, expMax: 5 },
  // Fortescue
  { title: 'Renewable Energy Engineer', orgIndex: 10, description: 'Design and commission large-scale green hydrogen and solar projects. Join Fortescue\'s energy transition team working on world-first decarbonisation initiatives.', city: 'Perth', state: 'WA', type: JobType.FULL_TIME, salaryMin: 120000, salaryMax: 160000, remote: false, expMin: 3, expMax: 8 },
  // NAB
  { title: 'Business Banking Relationship Manager', orgIndex: 11, description: 'Manage a portfolio of small-to-medium business clients. Provide tailored financial solutions, credit assessments, and strategic advice to support business growth.', city: 'Melbourne', state: 'VIC', type: JobType.FULL_TIME, salaryMin: 90000, salaryMax: 120000, remote: false, expMin: 3, expMax: 7 },
  // Department of Education
  { title: 'Policy Analyst - Higher Education', orgIndex: 12, description: 'Analyse policy proposals and prepare briefings on higher education funding, student outcomes, and regulatory frameworks for the Minister and senior executives.', city: 'Canberra', state: 'ACT', type: JobType.FULL_TIME, salaryMin: 85000, salaryMax: 105000, remote: true, expMin: 2, expMax: 5 },
  // Services Australia
  { title: 'Digital Service Designer', orgIndex: 13, description: 'Design accessible digital services for Australians interacting with Centrelink, Medicare, and My Aged Care. Apply human-centred design in a government context.', city: 'Canberra', state: 'ACT', type: JobType.FULL_TIME, salaryMin: 95000, salaryMax: 120000, remote: true, expMin: 3, expMax: 6 },
  // ATO
  { title: 'Data Engineer', orgIndex: 14, description: 'Build data pipelines and analytics platforms that support compliance analytics, fraud detection, and tax administration across the Australian Taxation Office.', city: 'Canberra', state: 'ACT', type: JobType.FULL_TIME, salaryMin: 105000, salaryMax: 135000, remote: true, expMin: 3, expMax: 7 },
  // NSW Health
  { title: 'Registered Nurse - Emergency', orgIndex: 15, description: 'Provide acute nursing care in a high-volume emergency department. Triage patients, administer treatments, and collaborate with multidisciplinary clinical teams.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 75000, salaryMax: 95000, remote: false, expMin: 1, expMax: 5 },
  // University of Melbourne
  { title: 'Research Fellow - AI & Ethics', orgIndex: 16, description: 'Conduct postdoctoral research on responsible AI governance, algorithmic fairness, and the societal impacts of emerging technologies at a world-leading research centre.', city: 'Melbourne', state: 'VIC', type: JobType.CONTRACT, salaryMin: 100000, salaryMax: 120000, remote: true, expMin: 2, expMax: 5 },
  // University of Sydney
  { title: 'Lecturer - Computer Science', orgIndex: 17, description: 'Deliver undergraduate and postgraduate teaching in software engineering, algorithms, and systems programming. Contribute to research and curriculum development.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 110000, salaryMax: 140000, remote: false, expMin: 3, expMax: 8 },
  // UNSW
  { title: 'Student Experience Coordinator', orgIndex: 18, description: 'Develop and deliver programs that enhance student wellbeing, employability, and engagement. Collaborate with faculties, student societies, and external partners.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 75000, salaryMax: 90000, remote: false, expMin: 2, expMax: 5 },
  // TAFE NSW
  { title: 'Teacher - Cybersecurity', orgIndex: 21, description: 'Deliver Certificate IV and Diploma-level cybersecurity courses. Develop industry-relevant curriculum and support students in obtaining vendor certifications.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 80000, salaryMax: 100000, remote: false, expMin: 3, expMax: 8 },
  // TAFE QLD
  { title: 'Apprenticeship Coordinator', orgIndex: 22, description: 'Manage apprenticeship pathways in trades including electrical, plumbing, and carpentry. Liaise with employers, students, and regulatory bodies.', city: 'Brisbane', state: 'QLD', type: JobType.FULL_TIME, salaryMin: 72000, salaryMax: 88000, remote: false, expMin: 2, expMax: 5 },
  // Salvation Army
  { title: 'Case Worker - Family Services', orgIndex: 24, description: 'Provide case management, referrals, and crisis support to families experiencing hardship. Work with community partners to improve outcomes for vulnerable children and adults.', city: 'Melbourne', state: 'VIC', type: JobType.FULL_TIME, salaryMin: 68000, salaryMax: 82000, remote: false, expMin: 1, expMax: 4 },
  // Red Cross
  { title: 'Program Officer - Disaster Preparedness', orgIndex: 25, description: 'Coordinate community resilience programs, develop training materials, and support emergency response planning in disaster-prone regions of Australia.', city: 'Melbourne', state: 'VIC', type: JobType.FULL_TIME, salaryMin: 72000, salaryMax: 90000, remote: true, expMin: 2, expMax: 5 },
  // Additional roles
  { title: 'Junior Frontend Developer', orgIndex: 4, description: 'Build beautiful, accessible interfaces for Canva\'s web platform. Collaborate with designers and backend engineers to ship features using React and TypeScript.', city: 'Sydney', state: 'NSW', type: JobType.FULL_TIME, salaryMin: 80000, salaryMax: 105000, remote: true, expMin: 0, expMax: 2 },
  { title: 'Intern - Software Engineering', orgIndex: 5, description: 'Twelve-week paid internship working on real Atlassian products. Pair with senior engineers, attend tech talks, and contribute code to production systems.', city: 'Sydney', state: 'NSW', type: JobType.INTERNSHIP, salaryMin: 50000, salaryMax: 60000, remote: true, expMin: 0, expMax: 0 },
];

// Authentic users representing diverse professionals
const USERS_DATA = [
  { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@athena.com', persona: Persona.EARLY_CAREER, city: 'Sydney', state: 'NSW', headline: 'Graduate Data Analyst at CBA', bio: 'Passionate about using data to drive better outcomes. Recently completed my Master of Data Science at UNSW.', currentJobTitle: 'Graduate Data Analyst', currentCompany: 'Commonwealth Bank of Australia', years: 1 },
  { firstName: 'James', lastName: 'Mitchell', email: 'james.mitchell@athena.com', persona: Persona.MID_CAREER, city: 'Melbourne', state: 'VIC', headline: 'Engineering Manager at Telstra', bio: 'Leading network engineering teams building Australia\'s 5G infrastructure. Previously at Optus and Ericsson.', currentJobTitle: 'Engineering Manager', currentCompany: 'Telstra', years: 12 },
  { firstName: 'Mei', lastName: 'Chen', email: 'mei.chen@athena.com', persona: Persona.ENTREPRENEUR, city: 'Melbourne', state: 'VIC', headline: 'Founder & CEO at GreenTech Solutions', bio: 'Building climate-tech solutions for Australian agriculture. Y Combinator W23 alumna.', currentJobTitle: 'CEO', currentCompany: 'GreenTech Solutions', years: 6 },
  { firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@athena.com', persona: Persona.CREATOR, city: 'Brisbane', state: 'QLD', headline: 'Career Coach & Content Creator', bio: 'Helping women navigate career transitions through practical advice and community support. 50K+ followers.', currentJobTitle: 'Career Coach', currentCompany: 'Self-employed', years: 8 },
  { firstName: 'David', lastName: 'Nguyen', email: 'david.nguyen@athena.com', persona: Persona.MENTOR, city: 'Sydney', state: 'NSW', headline: 'VP Engineering at Canva | Mentor', bio: 'Mentoring the next generation of tech leaders. 20 years in software engineering across startups and enterprises.', currentJobTitle: 'VP Engineering', currentCompany: 'Canva', years: 20 },
  { firstName: 'Aisha', lastName: 'Hassan', email: 'aisha.hassan@athena.com', persona: Persona.EARLY_CAREER, city: 'Perth', state: 'WA', headline: 'Junior Mining Engineer at Fortescue', bio: 'First-generation university graduate. Passionate about sustainable mining and renewable energy transition.', currentJobTitle: 'Junior Mining Engineer', currentCompany: 'Fortescue', years: 1 },
  { firstName: 'Tom', lastName: 'O\'Brien', email: 'tom.obrien@athena.com', persona: Persona.EMPLOYER, city: 'Sydney', state: 'NSW', headline: 'Head of Talent Acquisition at Atlassian', bio: 'Building diverse, high-performing teams at scale. Focused on inclusive hiring practices and employer brand.', currentJobTitle: 'Head of Talent Acquisition', currentCompany: 'Atlassian', years: 10 },
  { firstName: 'Lauren', lastName: 'Taylor', email: 'lauren.taylor@athena.com', persona: Persona.EDUCATION_PROVIDER, city: 'Sydney', state: 'NSW', headline: 'Head of Digital Learning at TAFE NSW', bio: 'Transforming vocational education through technology. Leading the development of micro-credentials and online delivery.', currentJobTitle: 'Head of Digital Learning', currentCompany: 'TAFE NSW', years: 14 },
  { firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@athena.com', persona: Persona.MID_CAREER, city: 'Canberra', state: 'ACT', headline: 'Senior Policy Adviser at ATO', bio: 'Specialising in digital economy taxation policy. Former management consultant at Deloitte.', currentJobTitle: 'Senior Policy Adviser', currentCompany: 'Australian Taxation Office', years: 9 },
  { firstName: 'Emily', lastName: 'Zhang', email: 'emily.zhang@athena.com', persona: Persona.EARLY_CAREER, city: 'Melbourne', state: 'VIC', headline: 'UX Researcher at CSL', bio: 'Applying human-centred design to healthcare products. Background in psychology and interaction design from Monash.', currentJobTitle: 'UX Researcher', currentCompany: 'CSL Limited', years: 2 },
  { firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@athena.com', persona: Persona.MID_CAREER, city: 'Sydney', state: 'NSW', headline: 'Investment Director at Macquarie', bio: 'Leading infrastructure investments across renewable energy and transport. CFA charterholder.', currentJobTitle: 'Investment Director', currentCompany: 'Macquarie Group', years: 15 },
  { firstName: 'Jessica', lastName: 'Lee', email: 'jessica.lee@athena.com', persona: Persona.ENTREPRENEUR, city: 'Sydney', state: 'NSW', headline: 'Co-founder at HealthBridge AI', bio: 'Using AI to improve mental health access in regional Australia. Previously product lead at Google Health.', currentJobTitle: 'Co-founder', currentCompany: 'HealthBridge AI', years: 4 },
  { firstName: 'Daniel', lastName: 'Cooper', email: 'daniel.cooper@athena.com', persona: Persona.GOVERNMENT_NGO, city: 'Canberra', state: 'ACT', headline: 'Director, Digital Transformation at Services Australia', bio: 'Leading the modernisation of government digital services for 25 million Australians.', currentJobTitle: 'Director, Digital Transformation', currentCompany: 'Services Australia', years: 18 },
  { firstName: 'Olivia', lastName: 'Martin', email: 'olivia.martin@athena.com', persona: Persona.REAL_ESTATE, city: 'Melbourne', state: 'VIC', headline: 'Property Investment Analyst', bio: 'Helping women build wealth through strategic property investment. Licensed buyer\'s agent.', currentJobTitle: 'Senior Analyst', currentCompany: 'Domain Group', years: 7 },
  { firstName: 'Sophie', lastName: 'Anderson', email: 'sophie.anderson@athena.com', persona: Persona.EARLY_CAREER, city: 'Adelaide', state: 'SA', headline: 'Graduate Nurse at SA Health', bio: 'New grad nurse passionate about emergency medicine and rural health. Volunteered with Red Cross during bushfires.', currentJobTitle: 'Registered Nurse', currentCompany: 'Royal Adelaide Hospital', years: 1 },
];

// Authentic courses from real Australian institutions
const COURSES_DATA = [
  { title: 'Graduate Certificate in Data Science', providerIdx: 16, type: 'certificate', duration: 6, mode: ['part-time', 'online'], cost: 16000, funding: ['FEE-HELP'], employment: 94, salary: 95000, description: 'Develop skills in statistical modelling, machine learning, and data visualisation using Python and R. Designed for working professionals transitioning into data roles.' },
  { title: 'Master of Cybersecurity', providerIdx: 18, type: 'degree', duration: 24, mode: ['full-time', 'part-time'], cost: 46000, funding: ['HECS-HELP', 'CSP'], employment: 97, salary: 110000, description: 'Comprehensive cybersecurity program covering threat intelligence, incident response, secure software development, and governance. Industry placements included.' },
  { title: 'Diploma of Nursing', providerIdx: 21, type: 'diploma', duration: 18, mode: ['full-time'], cost: 0, funding: ['Smart and Skilled', 'VET Student Loans'], employment: 96, salary: 65000, description: 'Nationally recognised nursing qualification preparing graduates for enrolled nurse registration. Includes clinical placements in hospitals and aged care facilities.' },
  { title: 'Certificate IV in Cybersecurity', providerIdx: 21, type: 'certificate', duration: 12, mode: ['full-time', 'online'], cost: 0, funding: ['Smart and Skilled'], employment: 89, salary: 72000, description: 'Hands-on training in network security, ethical hacking, and incident response. Aligned with CompTIA Security+ and industry frameworks.' },
  { title: 'Bachelor of Commerce', providerIdx: 19, type: 'degree', duration: 36, mode: ['full-time'], cost: 44000, funding: ['HECS-HELP', 'CSP'], employment: 91, salary: 68000, description: 'Comprehensive business degree with majors in accounting, finance, marketing, and management. Includes industry internship opportunities with leading firms.' },
  { title: 'Certificate III in Electrotechnology', providerIdx: 22, type: 'certificate', duration: 48, mode: ['apprenticeship'], cost: 0, funding: ['Australian Apprenticeships'], employment: 98, salary: 75000, description: 'Trade apprenticeship to become a licensed electrician. Covers installation, maintenance, and fault-finding in electrical systems for residential and commercial applications.' },
  { title: 'Master of Business Administration', providerIdx: 20, type: 'degree', duration: 18, mode: ['full-time', 'part-time', 'online'], cost: 72000, funding: ['FEE-HELP'], employment: 95, salary: 130000, description: 'Internationally accredited MBA with specialisations in strategy, innovation, and leadership. Includes global study tour and consulting project with industry partners.' },
  { title: 'Diploma of Project Management', providerIdx: 23, type: 'diploma', duration: 12, mode: ['part-time', 'online'], cost: 8500, funding: ['VET Student Loans'], employment: 88, salary: 82000, description: 'Practical project management qualification covering Agile, Waterfall, and hybrid methodologies. Prepare for PMP and PRINCE2 certifications.' },
  { title: 'Graduate Diploma in Public Health', providerIdx: 16, type: 'diploma', duration: 12, mode: ['full-time', 'online'], cost: 32000, funding: ['FEE-HELP'], employment: 90, salary: 85000, description: 'Develop expertise in epidemiology, health promotion, and population health policy. Designed for health professionals seeking leadership roles in public health.' },
  { title: 'Certificate III in Individual Support (Disability)', providerIdx: 22, type: 'certificate', duration: 6, mode: ['full-time', 'part-time'], cost: 0, funding: ['Smart and Skilled', 'Fee-Free TAFE'], employment: 94, salary: 56000, description: 'Prepare for NDIS support worker roles. Covers person-centred care, community participation support, and working with people with diverse needs.' },
  { title: 'Short Course: AI for Business Leaders', providerIdx: 17, type: 'short_course', duration: 1, mode: ['online'], cost: 2500, funding: [], employment: 92, salary: 120000, description: 'Executive education program covering AI strategy, ethical considerations, and practical applications of machine learning in business decision-making.' },
  { title: 'Certificate IV in Information Technology', providerIdx: 23, type: 'certificate', duration: 12, mode: ['full-time', 'online'], cost: 5200, funding: ['VET Student Loans', 'Skills First'], employment: 87, salary: 62000, description: 'Build IT skills in networking, cloud computing, and system administration. Includes vendor certifications in Microsoft Azure and AWS.' },
];

// Social posts with authentic professional content
const POSTS_DATA = [
  { content: 'Thrilled to share that I\'ve been accepted into the CBA Graduate Program! After months of applications and interviews, it finally happened. Grateful to everyone who supported me along the way. #GradLife #Finance #CareerWins', type: PostType.TEXT },
  { content: 'Just completed my Certificate IV in Cybersecurity at TAFE NSW. The hands-on labs were incredible - we simulated real incident response scenarios. If you\'re thinking about a career in cyber, this is a great starting point.', type: PostType.TEXT },
  { content: 'Attended the Women in STEM conference at the University of Melbourne today. The panel on closing the gender pay gap was eye-opening. We need more women in leadership roles across Australian tech companies.', type: PostType.IMAGE },
  { content: 'Six months into my role at Fortescue and I\'m already working on green hydrogen projects that could transform Australia\'s energy landscape. The mining industry is changing fast - and it\'s exciting to be part of it.', type: PostType.TEXT },
  { content: 'Hot take: The best career advice I ever received was to prioritise learning over title. Early in my career, I took a lateral move that seemed like a step back, but it gave me skills that accelerated everything after.', type: PostType.TEXT },
  { content: 'Proud to announce that our team at Services Australia just launched the redesigned myGov portal. Months of user research, accessibility testing, and iterative design. Making government services work better for everyone.', type: PostType.TEXT },
  { content: 'Mentoring session today with three amazing early-career engineers. Their questions about navigating big tech culture, imposter syndrome, and work-life balance reminded me how important this work is. Always learning from my mentees too.', type: PostType.TEXT },
  { content: 'TAFE NSW just announced fee-free places for 2025 in cybersecurity, aged care, and early childhood education. If you know anyone considering a career change, this is an incredible opportunity. Link in comments.', type: PostType.TEXT },
  { content: 'Finished my first week as a registered nurse at Royal Adelaide Hospital ED. Nothing could have fully prepared me for the pace, but the support from senior staff has been amazing. Proud to be part of this team.', type: PostType.TEXT },
  { content: 'The gap between what universities teach and what employers need is real, but it\'s closing. Partnerships between industry and education providers like the one we\'re building at RMIT are key. Let\'s keep pushing.', type: PostType.TEXT },
  { content: 'Quarterly reflection: This year I helped three mentees land their first tech roles - at Canva, Atlassian, and a promising startup. Mentoring is the highest-leverage activity in my week. Who else is mentoring?', type: PostType.TEXT },
  { content: 'The Macquarie Infrastructure team just closed a major renewable energy investment. Working on deals that will power Australian communities for decades is incredibly rewarding. Sustainability and returns can coexist.', type: PostType.TEXT },
];

const POST_IMAGES = [
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop',
];

// ==========================================
// MAIN SEED FUNCTION
// ==========================================

async function main() {
  console.log('========================================');
  console.log('  ATHENA Platform - Authentic Data Seed');
  console.log('========================================\n');

  const passwordHash = await bcrypt.hash('Demo123!', 10);

  // ------------------------------------------------------------------
  // 1. SKILLS
  // ------------------------------------------------------------------
  console.log('1/9  Creating skills...');
  const skills = await Promise.all(
    SKILLS_DATA.map(s =>
      prisma.skill.upsert({
        where: { name: s.name },
        update: {},
        create: { name: s.name, category: s.category },
      })
    )
  );
  console.log(`     ${skills.length} skills ready`);

  // ------------------------------------------------------------------
  // 2. ADMIN & DEMO USERS
  // ------------------------------------------------------------------
  console.log('2/9  Creating admin & demo users...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@athena.com' },
    update: {},
    create: {
      email: 'admin@athena.com', passwordHash,
      firstName: 'Admin', lastName: 'User', displayName: 'Admin',
      role: UserRole.ADMIN, persona: Persona.EMPLOYER,
      emailVerified: true, emailVerifiedAt: new Date(),
      city: 'Sydney', state: 'NSW', country: 'Australia',
      headline: 'Platform Administrator',
      bio: 'Managing the ATHENA platform operations and community.',
      referralCode: 'ADMIN001',
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@athena.com' },
    update: {},
    create: {
      email: 'demo@athena.com', passwordHash,
      firstName: 'Sarah', lastName: 'Demo', displayName: 'Sarah D.',
      role: UserRole.USER, persona: Persona.EARLY_CAREER,
      emailVerified: true, emailVerifiedAt: new Date(),
      city: 'Melbourne', state: 'VIC', country: 'Australia',
      headline: 'Aspiring Product Manager | Melbourne',
      bio: 'Career changer moving from teaching into product management. Passionate about EdTech and accessibility.',
      currentJobTitle: 'Junior Product Analyst', currentCompany: 'Canva',
      yearsExperience: 2, referralCode: 'DEMO001',
    },
  });

  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: { userId: demoUser.id, tier: SubscriptionTier.PREMIUM_CAREER, status: 'ACTIVE' },
  });

  // ------------------------------------------------------------------
  // 3. AUTHENTIC PROFESSIONAL USERS
  // ------------------------------------------------------------------
  console.log('3/9  Creating authentic professional users...');
  const users = [adminUser, demoUser];

  for (const u of USERS_DATA) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email, passwordHash,
        firstName: u.firstName, lastName: u.lastName,
        displayName: `${u.firstName} ${u.lastName.charAt(0)}.`,
        role: UserRole.USER, persona: u.persona,
        emailVerified: true, emailVerifiedAt: new Date(),
        city: u.city, state: u.state, country: 'Australia',
        headline: u.headline, bio: u.bio,
        currentJobTitle: u.currentJobTitle, currentCompany: u.currentCompany,
        yearsExperience: u.years, referralCode: refCode(),
      },
    });
    users.push(user);
  }
  console.log(`     ${users.length} users ready`);

  // Assign skills
  for (const user of users) {
    const userSkills = randomElements(skills, randomInt(3, 7));
    for (const skill of userSkills) {
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: user.id, skillId: skill.id } },
        update: {},
        create: { userId: user.id, skillId: skill.id, level: randomInt(1, 5), endorsed: randomInt(0, 25) },
      });
    }
  }

  // ------------------------------------------------------------------
  // 4. ORGANISATIONS (Private, Public, Universities, TAFEs, NGOs)
  // ------------------------------------------------------------------
  console.log('4/9  Creating organisations...');
  const orgs = [];
  for (const o of ORGANISATIONS) {
    const org = await prisma.organization.upsert({
      where: { slug: slug(o.name) },
      update: {},
      create: {
        name: o.name, slug: slug(o.name),
        description: o.description, website: o.website,
        city: o.city, state: o.state, country: 'Australia',
        type: o.type, industry: o.industry, size: o.size,
        isVerified: o.verified, safetyScore: randomInt(80, 100),
      },
    });
    orgs.push(org);
  }
  console.log(`     ${orgs.length} organisations ready (companies, government, universities, TAFEs, NGOs)`);

  // ------------------------------------------------------------------
  // 5. JOB LISTINGS
  // ------------------------------------------------------------------
  console.log('5/9  Creating job listings...');
  const poster = users.find(u => u.email === 'tom.obrien@athena.com') || adminUser;
  for (const j of JOBS_DATA) {
    const jobSlug = `${slug(j.title)}-${slug(ORGANISATIONS[j.orgIndex].name)}-${Date.now()}`;
    await prisma.job.upsert({
      where: { slug: jobSlug },
      update: {},
      create: {
        title: j.title, slug: jobSlug,
        description: j.description,
        organizationId: orgs[j.orgIndex].id,
        postedById: poster.id,
        type: j.type, status: JobStatus.ACTIVE,
        city: j.city, state: j.state, country: 'Australia',
        isRemote: j.remote,
        salaryMin: j.salaryMin, salaryMax: j.salaryMax,
        salaryType: 'annual', showSalary: true,
        experienceMin: j.expMin, experienceMax: j.expMax,
        viewCount: randomInt(50, 800),
        publishedAt: new Date(),
      },
    });
  }
  console.log(`     ${JOBS_DATA.length} authentic job listings ready`);

  // ------------------------------------------------------------------
  // 6. COURSES
  // ------------------------------------------------------------------
  console.log('6/9  Creating courses...');
  const courseCount = await prisma.course.count();
  if (courseCount === 0) {
    for (const c of COURSES_DATA) {
      const courseSlug = slug(c.title);
      await prisma.course.create({
        data: {
          title: c.title, slug: courseSlug,
          description: c.description,
          organizationId: orgs[c.providerIdx].id,
          providerName: ORGANISATIONS[c.providerIdx].name,
          type: c.type, durationMonths: c.duration,
          studyMode: c.mode, cost: c.cost,
          fundingOptions: c.funding,
          employmentRate: c.employment,
          avgStartingSalary: c.salary,
          intakeDates: [
            new Date(Date.now() + 30 * 86400000).toISOString(),
            new Date(Date.now() + 120 * 86400000).toISOString(),
          ],
          isActive: true,
        },
      });
    }
    console.log(`     ${COURSES_DATA.length} authentic courses ready`);
  } else {
    console.log(`     Skipped (already have ${courseCount} courses)`);
  }

  // ------------------------------------------------------------------
  // 7. SOCIAL POSTS
  // ------------------------------------------------------------------
  console.log('7/9  Creating social posts...');
  const postCount = await prisma.post.count();
  if (postCount === 0) {
    for (let i = 0; i < POSTS_DATA.length; i++) {
      const p = POSTS_DATA[i];
      const author = users[Math.min(i + 2, users.length - 1)];
      await prisma.post.create({
        data: {
          authorId: author.id,
          type: p.type,
          content: p.content,
          mediaUrls: p.type === PostType.IMAGE ? [randomElement(POST_IMAGES)] : undefined,
          likeCount: randomInt(5, 80),
          commentCount: randomInt(1, 15),
          viewCount: randomInt(50, 500),
          isPublic: true,
        },
      });
    }
    console.log(`     ${POSTS_DATA.length} posts ready`);
  } else {
    console.log(`     Skipped (already have ${postCount} posts)`);
  }

  // ------------------------------------------------------------------
  // 8. GROUPS & EVENTS
  // ------------------------------------------------------------------
  console.log('8/9  Creating groups & events...');
  const groupCount = await prisma.group.count();
  if (groupCount === 0) {
    const groups = [
      { name: 'Women in Tech Australia', description: 'Supporting women building careers in technology across Australia. Share resources, job leads, and mentorship opportunities.' },
      { name: 'Career Changers Hub', description: 'For professionals navigating career transitions. Share experiences, advice, and encouragement as you reinvent your career.' },
      { name: 'First Nations Professionals Network', description: 'Connecting Aboriginal and Torres Strait Islander professionals across industries for mentorship, networking, and career development.' },
      { name: 'Founders & Entrepreneurs Circle', description: 'For Australian founders at every stage. Discuss fundraising, product-market fit, hiring, and scaling your business.' },
      { name: 'Public Sector Innovators', description: 'Government professionals driving digital transformation and innovation in the Australian public service.' },
      { name: 'Regional & Remote Careers', description: 'Job opportunities, remote work tips, and community for professionals living and working outside capital cities.' },
    ];
    for (const g of groups) {
      const group = await prisma.group.create({
        data: { name: g.name, description: g.description, privacy: 'PUBLIC', createdById: adminUser.id },
      });
      await prisma.groupMember.create({
        data: { groupId: group.id, userId: adminUser.id, role: 'ADMIN' },
      });
    }
    console.log(`     ${groups.length} groups ready`);
  } else {
    console.log(`     Skipped groups (already have ${groupCount})`);
  }

  const eventCount = await prisma.event.count();
  if (eventCount === 0) {
    await prisma.event.createMany({
      data: [
        {
          title: 'Women in Tech Leadership Summit 2025',
          description: 'Australia\'s premier conference for women in technology. Hear from leaders at Canva, Atlassian, CBA, and Telstra on navigating career growth, building teams, and driving innovation.',
          type: 'CONFERENCE', format: 'HYBRID',
          date: new Date(Date.now() + 14 * 86400000),
          startTime: '9:00 AM', endTime: '5:00 PM',
          location: 'International Convention Centre, Sydney',
          link: 'https://athena.com/events/wit-summit-2025',
          image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600',
          hostName: 'ATHENA Events', hostTitle: 'Community Team', hostAvatar: '',
          baseAttendees: 450, maxAttendees: 800, price: 0,
          tags: ['Leadership', 'Technology', 'Women', 'Conference'],
        },
        {
          title: 'Salary Negotiation Masterclass',
          description: 'Practical workshop on researching market rates, framing your value, and confidently negotiating compensation packages. Includes role-play exercises with feedback from HR leaders.',
          type: 'WORKSHOP', format: 'VIRTUAL',
          date: new Date(Date.now() + 5 * 86400000),
          startTime: '12:00 PM', endTime: '1:30 PM',
          link: 'https://zoom.us/j/athena-salary-workshop',
          image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600',
          hostName: 'Sarah Williams', hostTitle: 'Career Coach', hostAvatar: '',
          baseAttendees: 68, maxAttendees: 100, price: 29,
          tags: ['Salary', 'Negotiation', 'Career Growth'],
        },
        {
          title: 'Melbourne Tech Networking Night',
          description: 'Casual networking event for tech professionals in Melbourne. Meet engineers, designers, PMs, and founders over drinks at a CBD rooftop bar.',
          type: 'NETWORKING', format: 'IN_PERSON',
          date: new Date(Date.now() + 9 * 86400000),
          startTime: '6:00 PM', endTime: '9:00 PM',
          location: 'Rooftop Bar, Curtin House, Melbourne',
          image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600',
          hostName: 'ATHENA Melbourne', hostTitle: 'Local Chapter', hostAvatar: '',
          baseAttendees: 120, maxAttendees: 200, price: 15,
          tags: ['Networking', 'Melbourne', 'Tech', 'In-Person'],
        },
        {
          title: 'Resume & Portfolio Review Session',
          description: 'Get your resume and portfolio reviewed by hiring managers from top Australian employers. One-on-one 15-minute sessions with actionable feedback.',
          type: 'WORKSHOP', format: 'VIRTUAL',
          date: new Date(Date.now() + 21 * 86400000),
          startTime: '10:00 AM', endTime: '3:00 PM',
          link: 'https://athena.com/events/resume-review',
          image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600',
          hostName: 'Tom O\'Brien', hostTitle: 'Head of Talent, Atlassian', hostAvatar: '',
          baseAttendees: 85, maxAttendees: 150, price: 0,
          tags: ['Resume', 'Portfolio', 'Job Search', 'Free'],
        },
        {
          title: 'Public Sector Digital Transformation Forum',
          description: 'Senior leaders from ATO, Services Australia, and Defence share lessons on modernising government digital services at scale.',
          type: 'WEBINAR', format: 'VIRTUAL',
          date: new Date(Date.now() + 12 * 86400000),
          startTime: '2:00 PM', endTime: '3:30 PM',
          link: 'https://athena.com/events/govtech-forum',
          image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600',
          hostName: 'Daniel Cooper', hostTitle: 'Director, Services Australia', hostAvatar: '',
          baseAttendees: 210, price: 0,
          tags: ['Government', 'Digital', 'Public Sector', 'Webinar'],
        },
      ],
      skipDuplicates: true,
    });
    console.log('     5 events ready');
  } else {
    console.log(`     Skipped events (already have ${eventCount})`);
  }

  // ------------------------------------------------------------------
  // 9. NOTIFICATIONS
  // ------------------------------------------------------------------
  console.log('9/9  Creating notifications...');
  const notifCount = await prisma.notification.count({ where: { userId: demoUser.id } });
  if (notifCount === 0) {
    const notifs = [
      { type: NotificationType.JOB_MATCH, title: 'New job match', message: 'Product Designer at Canva matches your profile', link: '/jobs' },
      { type: NotificationType.APPLICATION_UPDATE, title: 'Application update', message: 'Your application to CBA Graduate Program has been reviewed', link: '/applications' },
      { type: NotificationType.FOLLOW, title: 'New follower', message: 'David Nguyen started following you', link: '/network' },
      { type: NotificationType.MENTOR_SESSION, title: 'Session reminder', message: 'Mentoring session with David N. tomorrow at 10am', link: '/mentoring' },
      { type: NotificationType.SYSTEM, title: 'Profile tip', message: 'Add your skills to improve job match accuracy by 40%', link: '/profile/edit' },
    ];
    for (let i = 0; i < notifs.length; i++) {
      await prisma.notification.create({
        data: { userId: demoUser.id, type: notifs[i].type, title: notifs[i].title, message: notifs[i].message, link: notifs[i].link, isRead: i < 2 },
      });
    }
    console.log('     5 notifications ready');
  } else {
    console.log(`     Skipped (already have ${notifCount} notifications)`);
  }

  // ------------------------------------------------------------------
  // DONE
  // ------------------------------------------------------------------
  console.log('\n========================================');
  console.log('  Seed Complete!');
  console.log('========================================');
  console.log('');
  console.log('Demo Accounts:');
  console.log('  Admin:  admin@athena.com / Demo123!');
  console.log('  User:   demo@athena.com / Demo123!');
  console.log('');
  console.log(`Organisations: ${orgs.length} (${ORGANISATIONS.filter(o => o.type === 'company').length} companies, ${ORGANISATIONS.filter(o => o.type === 'government').length} government, ${ORGANISATIONS.filter(o => o.type === 'university').length} universities, ${ORGANISATIONS.filter(o => o.type === 'tafe').length} TAFEs, ${ORGANISATIONS.filter(o => o.type === 'ngo').length} NGOs)`);
  console.log(`Jobs: ${JOBS_DATA.length}`);
  console.log(`Courses: ${COURSES_DATA.length}`);
  console.log(`Users: ${users.length}`);
  console.log(`Skills: ${skills.length}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
