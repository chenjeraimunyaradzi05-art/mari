import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { postId } = await req.json();

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // Record the view
    await prisma.videoView.create({
      data: {
        postId,
        userId: session?.user?.id || null,
      },
    });

    // Increment the post view count
    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        viewsCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ success: true, views: post.viewsCount });
  } catch (error) {
    console.error("Error recording view:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
