import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId, amount, currency = "USD" } = await req.json();

    if (!postId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.authorId === session.user.id) {
      return NextResponse.json({ error: "Cannot tip yourself" }, { status: 400 });
    }

    // Helper to get/create wallet
    const getWallet = async (userId: string) => {
      let wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: { userId, balance: 100.0 }, // Give 100 free credits for testing
        });
      }
      return wallet;
    };

    const senderWallet = await getWallet(session.user.id);
    // Ensure receiver has a wallet too
    await getWallet(post.authorId);

    if (senderWallet.balance < amount) {
      return NextResponse.json({ error: "Insufficient funds" }, { status: 400 });
    }

    // Perform Transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Deduct from sender
      await tx.wallet.update({
        where: { userId: session.user.id },
        data: { balance: { decrement: amount } },
      });

      // Add to receiver
      await tx.wallet.update({
        where: { userId: post.authorId },
        data: { balance: { increment: amount } },
      });

      // Record transaction
      return await tx.transaction.create({
        data: {
          amount,
          currency,
          type: "TIP",
          status: "COMPLETED",
          senderId: session.user.id,
          receiverId: post.authorId,
          postId,
        },
      });
    });

    return NextResponse.json({ success: true, transaction });

  } catch (error) {
    console.error("Error processing tip:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
