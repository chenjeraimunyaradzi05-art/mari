import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberGender } from '@prisma/client';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        member: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Merge user data, member data, and profileData
    const profileData = (user.member?.profileData as Record<string, unknown>) || {};
    
    const profile = {
      // User fields
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      
      // Member fields
      dateOfBirth: user.member?.dateOfBirth ? user.member.dateOfBirth.toISOString().split('T')[0] : '',
      gender: user.member?.gender || '',
      educationLevel: user.member?.educationLevel || '',
      
      // Extended profile data
      ...profileData
    };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    
    // Extract fields that belong to User or Member columns
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      educationLevel,
      ...extendedData
    } = data;

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        firstName,
        lastName,
        phone,
        member: {
          upsert: {
            create: {
               dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
               gender: (gender as MemberGender) || undefined, 
               educationLevel,
               profileData: extendedData
            },
            update: {
               dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
               gender: (gender as MemberGender) || undefined,
               educationLevel,
               profileData: extendedData
            }
          }
        }
      },
      include: { member: true }
    });

    return NextResponse.json({ success: true, profile: user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
