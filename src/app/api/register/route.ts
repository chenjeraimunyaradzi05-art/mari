import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password, role, firstName, lastName, profileData } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Use a transaction to ensure both User and Profile are created or neither
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          firstName,
          lastName,
        },
      });

      if (role === 'MEMBER') {
        await tx.member.create({
          data: {
            userId: user.id,
            profileData: profileData || {},
          },
        });
      } else if (role === 'MENTOR') {
        await tx.mentor.create({
          data: {
            userId: user.id,
          },
        });
      } else if (role === 'COMPANY') {
        // Company requires a unique companyName. Using a placeholder for now.
        // In a real app, we should ask for Company Name in the registration form.
        await tx.company.create({
          data: {
            userId: user.id,
            companyName: `${firstName} ${lastName}'s Company`, 
          },
        });
      }

      return user;
    });

    return NextResponse.json({ user: { id: result.id, email: result.email, role: result.role } });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
