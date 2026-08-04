import { expect, test } from "@playwright/test";

test("liveness and readiness expose independent health probes", async ({
  request,
}) => {
  const live = await request.get("/health/live");
  expect(live.status()).toBe(200);
  await expect(live.json()).resolves.toMatchObject({
    status: "alive",
    service: "homi",
  });

  const ready = await request.get("/health/ready");
  expect(ready.status()).toBe(200);
  await expect(ready.json()).resolves.toMatchObject({
    status: "ready",
    checks: {
      database: true,
      storage: true,
      clamav: true,
    },
    antivirus: { enabled: true },
  });
});

test("ClamAV rejects infected document uploads before storage", async ({ page }) => {
  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const homes = (await homesResponse.json()) as {
    homes: Array<{ id: string }>;
  };
  const homeId = homes.homes[0]?.id;
  expect(homeId).toBeTruthy();

  const eicar = [
    "X5O!P%@AP[4",
    String.raw`\PZX54(P^)7CC)7}$`,
    "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
  ].join("");
  const response = await page.request.post("/api/uploads", {
    multipart: {
      homeId: homeId!,
      type: "OTHER",
      title: "Rejected antivirus test",
      file: {
        name: "antivirus-test.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(eicar),
      },
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: "VALIDATION_ERROR",
      message: "The file was rejected because malware was detected.",
    },
  });
});
