import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyName, industry, website } = await req.json();

    if (!companyName) {
      return NextResponse.json({ error: "Company Name is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.organizationId) {
      return NextResponse.json({ error: "User already belongs to an organization" }, { status: 400 });
    }

    // Create Organization
    const organization = await prisma.organization.create({
      data: {
        name: companyName,
        type: "BUSINESS",
        website: website || null,
        metadata: JSON.stringify({ industry }),
        users: {
            connect: { id: user.id }
        }
      },
    });

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    console.error("Error creating business profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
