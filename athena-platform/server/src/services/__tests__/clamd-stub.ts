/**
 * A stand-in for clamd, the ClamAV daemon, that speaks its INSTREAM protocol
 * over a real TCP socket. Shared by the suites that exercise the malware scan,
 * so each of them runs the real service against the real wire format.
 *
 * Nothing between the service and the socket is mocked: the bytes the service
 * sends are parsed here as clamd parses them (a NUL-ended command, then chunks
 * each led by a 4-byte big-endian length, then a zero length), and what this
 * says back is what the service reads.
 *
 * The test virus is the industry's EICAR string. It is assembled at run time
 * from pieces by whoever needs it: written out whole in a source file it is what
 * an antivirus on a developer's machine quarantines the file for.
 */

import net from 'net';

/** The marker the default reply looks for. A suite builds the whole string from pieces around it. */
export const EICAR_MARKER = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

/** The industry test string, assembled here so no source file holds it whole. */
export const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', EICAR_MARKER, '!$H+H*'].join('');

export interface Stub {
  port: number;
  /** The bodies the stand-in reassembled from the chunks it was sent, one per scan. */
  bodies: Buffer[];
  /** The commands it was sent. */
  commands: string[];
  /** How many connections it accepted. */
  connections: number;
  /** The sizes of the chunks of the most recent scan, in the order they came. */
  chunkSizes: number[];
  close: () => Promise<void>;
}

/**
 * A clamd that reads INSTREAM the way the real one does.
 *
 * `reply` decides the answer from the reassembled body; returning null means
 * never answering (a hung scanner).
 */
export async function startClamd(
  options: {
    reply?: (body: Buffer) => string | null;
    ping?: string;
    version?: string;
  } = {}
): Promise<Stub> {
  const reply =
    options.reply ??
    ((body: Buffer) => (body.includes(EICAR_MARKER) ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0'));

  const sockets = new Set<net.Socket>();
  const stub: Stub = { port: 0, bodies: [], commands: [], connections: 0, chunkSizes: [], close: async () => undefined };

  const server = net.createServer((socket) => {
    stub.connections += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);

    let pending = Buffer.alloc(0);
    let command: string | null = null;
    const body: Buffer[] = [];
    const chunkSizes: number[] = [];

    socket.on('data', (data) => {
      pending = Buffer.concat([pending, data]);

      if (command === null) {
        const end = pending.indexOf(0);
        if (end === -1) return;
        command = pending.subarray(0, end).toString('utf8');
        pending = pending.subarray(end + 1);
        stub.commands.push(command);
        if (command === 'zPING') return void socket.end(options.ping ?? 'PONG\0');
        if (command === 'zVERSION') return void socket.end(options.version ?? 'ClamAV 1.4.1/27500/Wed Sep 30 07:25:00 2026\0');
        if (command !== 'zINSTREAM') return void socket.end('UNKNOWN COMMAND\0');
      }

      for (;;) {
        if (pending.length < 4) return;
        const length = pending.readUInt32BE(0);
        if (length === 0) {
          const whole = Buffer.concat(body);
          stub.bodies.push(whole);
          stub.chunkSizes = chunkSizes;
          const answer = reply(whole);
          if (answer !== null) socket.end(answer);
          return;
        }
        if (pending.length < 4 + length) return;
        body.push(pending.subarray(4, 4 + length));
        chunkSizes.push(length);
        pending = pending.subarray(4 + length);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  stub.port = (server.address() as net.AddressInfo).port;
  stub.close = () =>
    new Promise<void>((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    });
  return stub;
}


/** A port nothing is listening on. */
export async function closedPort(): Promise<number> {
  const stub = await startClamd();
  const { port } = stub;
  await stub.close();
  return port;
}
