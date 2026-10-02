import toast from 'react-hot-toast';
import { safetyApi } from '@/lib/api';

/**
 * Block the other person in a thread. The confirmation says what blocking does
 * and where to undo it, because in a conversation it is one tap away from a
 * message she may be shaking over, and a block she did not understand is one she
 * will not know how to reverse. Returns whether the member is now blocked, so
 * the caller can leave the thread.
 *
 * Shared by the thread's header menu and the details pane, which are on screen
 * at different widths and have to behave the same.
 */
export async function blockMemberFromThread(memberId: string, name: string): Promise<boolean> {
  if (
    !window.confirm(
      `Block ${name}? They will not be able to message you, and you will not see each other's posts. You can undo this in Settings > Privacy.`
    )
  ) {
    return false;
  }
  try {
    await safetyApi.blockUser({ blockedUserId: memberId });
    toast.success(`${name} is blocked. Undo it any time in Settings > Privacy.`);
    return true;
  } catch (error) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
    toast.error(message || 'Could not block this member');
    return false;
  }
}
