import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: 0.0, // Start with 0 if just viewing
        },
      });
    }

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: { firstName: true, lastName: true, profileImage: true },
        },
        receiver: {
          select: { firstName: true, lastName: true, profileImage: true },
        },
      },
    });

    return NextResponse.json({
      wallet,
      transactions,
    });

  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount } = await req.json();
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const userId = session.user.id;

    // Perform Deposit
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount },
      });

      const transaction = await tx.transaction.create({
        data: {
          amount,
          type: "DEPOSIT",
          status: "COMPLETED",
          senderId: userId, // Self-deposit
          receiverId: userId,
          currency: "USD",
        },
      });

      return { wallet, transaction };
    });

    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error("Error depositing funds:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
