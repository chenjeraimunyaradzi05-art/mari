'use client';

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { socketClient } from '@/lib/socket';

/**
 * The current socket, and whether it is connected right now.
 *
 * The socket is created after the session is restored and replaced whenever
 * the token changes, so a page that read it once during render could be
 * holding an instance that was thrown away a moment later. Anything that
 * joins a room keys its effect on the values returned here, so it
 * re-registers and re-joins when the instance changes or reconnects.
 */
export function useSocket(): { socket: Socket | null; connected: boolean } {
  const [state, setState] = useState(() => ({
    socket: socketClient.getSocket(),
    connected: socketClient.isConnected(),
  }));

  useEffect(() => {
    const sync = () => setState({ socket: socketClient.getSocket(), connected: socketClient.isConnected() });
    sync();
    return socketClient.onChange(sync);
  }, []);

  return state;
}
