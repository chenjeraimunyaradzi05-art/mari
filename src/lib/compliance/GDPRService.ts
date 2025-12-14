import { prisma } from "@/lib/prisma";

export class GDPRService {
  /**
   * Export all data related to a user in a portable JSON format.
   */
  static async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: true,
        comments: true,
        likes: true,
        wallet: true,
        sentTransactions: true,
        receivedTransactions: true,
        notifications: true,
        creatorSubs: true,
        subscriberSubs: true,
      }
    });

    if (!user) throw new Error("User not found");

    // Sanitize sensitive fields (e.g., password hash)
    const { password, ...safeUser } = user;

    return {
      generatedAt: new Date().toISOString(),
      user: safeUser,
      summary: {
        postsCount: user.posts.length,
        commentsCount: user.comments.length,
        transactionsCount: user.sentTransactions.length + user.receivedTransactions.length,
      }
    };
  }

  /**
   * Permanently delete a user and their associated data.
   * This operation is irreversible.
   */
  static async deleteUserData(userId: string) {
    console.log(`[GDPR] Deleting user ${userId}`);
    
    // Transaction to ensure all or nothing
    return await prisma.$transaction(async (tx) => {
      // 1. Delete related data that might not cascade automatically or needs special handling
      // (Prisma cascade delete handles most, but good to be explicit for critical data)
      
      // 2. Delete the user
      const deletedUser = await tx.user.delete({
        where: { id: userId }
      });
      
      // 3. Log the deletion in an audit log (if we had one)
      // await tx.auditLog.create({ ... })
      
      return deletedUser;
    });
  }
}
