import { createServer, type Server } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ClamAvVirusScanner } from "@/src/server/security/virus-scanner";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((socket) => {
    let input = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      input = Buffer.concat([input, chunk]);
      if (input.subarray(0, 6).toString() === "zPING\0") {
        socket.end("PONG\0");
        return;
      }
      const command = Buffer.from("zINSTREAM\0");
      if (input.length < command.length || !input.subarray(0, command.length).equals(command))
        return;

      let offset = command.length;
      const payload: Buffer[] = [];
      while (input.length >= offset + 4) {
        const length = input.readUInt32BE(offset);
        if (length === 0) {
          const bytes = Buffer.concat(payload);
          socket.end(
            bytes.includes("EICAR")
              ? "stream: Win.Test.EICAR_HDB-1 FOUND\0"
              : "stream: OK\0",
          );
          return;
        }
        if (input.length < offset + 4 + length) return;
        payload.push(input.subarray(offset + 4, offset + 4 + length));
        offset += 4 + length;
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  port = address.port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("ClamAvVirusScanner", () => {
  it("checks daemon health and streams clean files", async () => {
    const scanner = new ClamAvVirusScanner({
      host: "127.0.0.1",
      port,
      timeoutMs: 1_000,
    });

    await expect(scanner.check()).resolves.toBe(true);
    await expect(scanner.scan(new TextEncoder().encode("safe file"))).resolves.toEqual({
      clean: true,
    });
  });

  it("returns the ClamAV signature for infected files", async () => {
    const scanner = new ClamAvVirusScanner({
      host: "127.0.0.1",
      port,
      timeoutMs: 1_000,
    });

    await expect(scanner.scan(new TextEncoder().encode("EICAR"))).resolves.toEqual({
      clean: false,
      reason: "Win.Test.EICAR_HDB-1",
    });
  });
});
