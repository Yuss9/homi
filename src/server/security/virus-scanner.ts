import "server-only";

import { createConnection, type Socket } from "node:net";
import { AppError } from "@/src/server/errors";
import { getEnv } from "@/src/server/env";

export interface VirusScanResult {
  clean: boolean;
  reason?: string;
}

export interface VirusScanner {
  scan(bytes: Uint8Array): Promise<VirusScanResult>;
  check(): Promise<boolean>;
}

interface ClamAvOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

const streamChunkBytes = 64 * 1024;

function write(socket: Socket, data: Uint8Array | string) {
  return new Promise<void>((resolve, reject) => {
    socket.write(data, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function responseEnd(buffer: Buffer) {
  const nullIndex = buffer.indexOf(0);
  const newlineIndex = buffer.indexOf(10);
  if (nullIndex === -1) return newlineIndex;
  if (newlineIndex === -1) return nullIndex;
  return Math.min(nullIndex, newlineIndex);
}

export class ClamAvVirusScanner implements VirusScanner {
  constructor(private readonly options: ClamAvOptions) {}

  private command(send: (socket: Socket) => Promise<void>) {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = createConnection({
        host: this.options.host,
        port: this.options.port,
      });
      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };
      const succeed = (response: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        const trimmed = response.trim();
        if (!trimmed) fail(new Error("ClamAV returned an empty response."));
        else resolve(trimmed);
      };

      socket.setTimeout(this.options.timeoutMs);
      socket.once("connect", () => {
        void send(socket).catch((error: unknown) =>
          fail(error instanceof Error ? error : new Error(String(error))),
        );
      });
      socket.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        const response = Buffer.concat(chunks);
        const end = responseEnd(response);
        if (end >= 0) succeed(response.subarray(0, end).toString("utf8"));
      });
      socket.once("timeout", () =>
        fail(new Error("ClamAV did not respond before the timeout.")),
      );
      socket.once("error", fail);
      socket.once("end", () => {
        if (!settled) succeed(Buffer.concat(chunks).toString("utf8"));
      });
      socket.once("close", (hadError) => {
        if (!settled && !hadError)
          succeed(Buffer.concat(chunks).toString("utf8"));
      });
    });
  }

  async scan(bytes: Uint8Array): Promise<VirusScanResult> {
    const response = await this.command(async (socket) => {
      await write(socket, "zINSTREAM\0");
      for (let offset = 0; offset < bytes.byteLength; offset += streamChunkBytes) {
        const chunk = bytes.subarray(
          offset,
          Math.min(offset + streamChunkBytes, bytes.byteLength),
        );
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.byteLength, 0);
        await write(socket, length);
        await write(socket, chunk);
      }
      await write(socket, Buffer.alloc(4));
    });

    if (/:\s*OK$/u.test(response)) return { clean: true };
    const infected = response.match(/:\s*(.+?)\s+FOUND$/u);
    if (infected) return { clean: false, reason: infected[1] };
    throw new Error(`ClamAV scan failed: ${response}`);
  }

  async check() {
    try {
      const response = await this.command((socket) => write(socket, "zPING\0"));
      return response === "PONG";
    } catch {
      return false;
    }
  }
}

const noOpVirusScanner: VirusScanner = {
  async scan() {
    return { clean: true };
  },
  async check() {
    return true;
  },
};

const unavailableVirusScanner: VirusScanner = {
  async scan() {
    throw new Error("ClamAV is required but not configured.");
  },
  async check() {
    return false;
  },
};

let scanner: VirusScanner | undefined;

export function getVirusScanner(): VirusScanner {
  if (scanner) return scanner;
  const env = getEnv();
  if (env.CLAMAV_ENABLED === "true") {
    scanner = new ClamAvVirusScanner({
      host: env.CLAMAV_HOST,
      port: env.CLAMAV_PORT,
      timeoutMs: env.CLAMAV_TIMEOUT_MS,
    });
  } else {
    scanner =
      env.NODE_ENV === "production"
        ? unavailableVirusScanner
        : noOpVirusScanner;
  }
  return scanner;
}

export async function assertUploadIsClean(
  bytes: Uint8Array,
  subject = "file",
) {
  try {
    const result = await getVirusScanner().scan(bytes);
    if (!result.clean)
      throw new AppError(
        "VALIDATION_ERROR",
        `The ${subject} was rejected because malware was detected.`,
        400,
      );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "File security scanning is temporarily unavailable. Please try again.",
      503,
    );
  }
}

export async function virusScannerHealth() {
  const env = getEnv();
  const enabled = env.CLAMAV_ENABLED === "true";
  return {
    enabled,
    healthy: enabled
      ? await getVirusScanner().check()
      : env.NODE_ENV !== "production",
  };
}
