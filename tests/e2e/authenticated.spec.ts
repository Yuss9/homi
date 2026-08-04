import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("seeded member can sign in, use private files, and remains tenant-isolated", async ({
  page,
  request,
  isMobile,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await expect(page.getByText("Cedar House is ready for the day.")).toBeVisible();

  await page.goto("/");
  const marketingHeader = page.locator("header");
  if (!isMobile) {
    await expect(
      marketingHeader.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
  }
  await expect(
    marketingHeader.getByRole("link", { name: "Open dashboard" }),
  ).toBeVisible();
  await expect(
    marketingHeader.getByRole("link", { name: "Sign in" }),
  ).toHaveCount(0);
  await expect(
    marketingHeader.getByRole("link", { name: "Create account" }),
  ).toHaveCount(0);

  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard$/);

  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const homesPayload = (await homesResponse.json()) as {
    homes: Array<{ id: string; name: string }>;
  };
  expect(homesPayload.homes.length).toBeGreaterThan(0);
  const seededHomeId =
    homesPayload.homes.find((home) => home.name === "Cedar House")?.id ??
    homesPayload.homes[0]!.id;

  const inaccessibleResponse = await page.request.get(
    `/api/assets?homeId=${crypto.randomUUID()}`,
  );
  expect(inaccessibleResponse.status()).toBe(404);

  const suffix = crypto.randomUUID().slice(0, 8);
  const homeResponse = await page.request.post("/api/homes", {
    data: {
      name: `E2E Home ${suffix}`,
      type: "HOUSE",
      timezone: "Europe/Paris",
    },
  });
  expect(homeResponse.status()).toBe(201);
  const homeId = ((await homeResponse.json()) as { home: { id: string } }).home
    .id;

  const roomResponse = await page.request.post("/api/rooms", {
    data: { homeId, name: `Utility ${suffix}`, floor: "Ground floor" },
  });
  expect(roomResponse.status()).toBe(201);
  const roomId = ((await roomResponse.json()) as { room: { id: string } }).room
    .id;

  const assetResponse = await page.request.post("/api/assets", {
    data: {
      homeId,
      roomId,
      name: `Heat pump ${suffix}`,
      category: "Heating",
      brand: "Demo",
      status: "ACTIVE",
    },
  });
  expect(assetResponse.status()).toBe(201);
  const assetId = ((await assetResponse.json()) as { asset: { id: string } })
    .asset.id;

  const taskResponse = await page.request.post("/api/tasks", {
    data: {
      homeId,
      assetId,
      title: `Check pressure ${suffix}`,
      frequencyType: "MONTHLY",
      frequencyInterval: 1,
      nextDueAt: new Date().toISOString(),
      priority: "MEDIUM",
    },
  });
  expect(taskResponse.status()).toBe(201);
  const taskId = ((await taskResponse.json()) as { task: { id: string } }).task
    .id;
  const idempotencyKey = crypto.randomUUID();
  const completion = await page.request.post(`/api/tasks/${taskId}/complete`, {
    data: { idempotencyKey, notes: "Pressure is steady." },
  });
  expect(completion.status()).toBe(200);
  expect(((await completion.json()) as { replayed: boolean }).replayed).toBe(
    false,
  );
  const replay = await page.request.post(`/api/tasks/${taskId}/complete`, {
    data: { idempotencyKey, notes: "Pressure is steady." },
  });
  expect(replay.status()).toBe(200);
  expect(((await replay.json()) as { replayed: boolean }).replayed).toBe(true);

  const uploadResponse = await page.request.post("/api/uploads", {
    multipart: {
      homeId,
      type: "MANUAL",
      title: "Playwright private manual",
      file: {
        name: "private-manual.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(
          "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
        ),
      },
    },
  });
  expect(uploadResponse.status()).toBe(201);
  const uploadPayload = (await uploadResponse.json()) as {
    stored: { id: string };
  };

  const privateDownload = await page.request.get(
    `/api/files/${uploadPayload.stored.id}`,
  );
  expect(privateDownload.status()).toBe(200);
  expect(privateDownload.headers()["cache-control"]).toContain("no-store");
  expect(privateDownload.headers()["content-disposition"]).toContain(
    "private-manual.pdf",
  );

  const anonymousDownload = await request.get(
    `/api/files/${uploadPayload.stored.id}`,
  );
  expect(anonymousDownload.status()).toBe(401);

  const invitation = await page.request.post("/api/invitations", {
    data: {
      homeId,
      email: `invite-${suffix}@example.test`,
      role: "VIEWER",
    },
  });
  expect(invitation.status()).toBe(201);

  const notices = await page.request.get("/api/notifications");
  expect(notices.status()).toBe(200);
  expect(
    ((await notices.json()) as { notifications: unknown[] }).notifications
      .length,
  ).toBeGreaterThan(0);

  const seededAssets = await page.request.get(
    `/api/assets?homeId=${seededHomeId}`,
  );
  expect(seededAssets.status()).toBe(200);

  await page.goto("/maintenance/history");
  await expect(page.getByText(`Check pressure ${suffix}`)).toBeVisible();

  const signOutStatus = await page.evaluate(async () => {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return response.status;
  });
  expect(signOutStatus).toBe(200);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});
