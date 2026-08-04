import { expect, test } from "@playwright/test";

test("connected mobile platform shares one secure household workflow", async ({
  page,
}) => {
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as {
    display: string;
    shortcuts: Array<{ name: string; url: string }>;
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.shortcuts.map((shortcut) => shortcut.name)).toEqual(
    expect.arrayContaining([
      "Scan equipment",
      "Create maintenance",
      "Declare a repair",
      "Open calendar",
    ]),
  );

  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const homesPayload = (await homesResponse.json()) as {
    homes: Array<{ id: string; name: string }>;
  };
  const home = homesPayload.homes[0]!;
  const suffix = crypto.randomUUID().slice(0, 8);

  const assetResponse = await page.request.post("/api/assets", {
    data: {
      homeId: home.id,
      name: `Connected boiler ${suffix}`,
      category: "Heating",
      brand: "Homi Test",
      status: "ACTIVE",
    },
  });
  expect(assetResponse.status()).toBe(201);
  const assetId = ((await assetResponse.json()) as { asset: { id: string } })
    .asset.id;

  const barcode = `HOMI-${suffix.toUpperCase()}`;
  const identifierResponse = await page.request.post(
    "/api/assets/identifiers",
    {
      data: {
        homeId: home.id,
        assetId,
        barcode,
        format: "code_128",
      },
    },
  );
  expect(identifierResponse.status()).toBe(200);

  const lookupResponse = await page.request.get(
    `/api/assets/identifiers?homeId=${home.id}&code=${barcode}`,
  );
  expect(lookupResponse.status()).toBe(200);
  expect(
    ((await lookupResponse.json()) as { result: { asset: { id: string } } })
      .result.asset.id,
  ).toBe(assetId);

  const savedResponse = await page.request.post("/api/saved-searches", {
    data: {
      homeId: home.id,
      name: `Boiler ${suffix}`,
      query: barcode,
      filters: { types: ["Asset"] },
    },
  });
  expect(savedResponse.status()).toBe(201);
  const savedId = (
    (await savedResponse.json()) as { search: { id: string } }
  ).search.id;

  const searchResponse = await page.request.get(
    `/api/search?homeId=${home.id}&q=${barcode}&types=Asset`,
  );
  expect(searchResponse.status()).toBe(200);
  expect(
    ((await searchResponse.json()) as {
      results: Array<{ title: string; status: string }>;
    }).results,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: `Connected boiler ${suffix}`,
        status: "ACTIVE",
      }),
    ]),
  );

  const keyResponse = await page.request.post("/api/api-keys", {
    data: {
      name: `Connected platform ${suffix}`,
      scopes: ["home:read", "widgets:read", "assets:read"],
      expiresInDays: 30,
    },
  });
  expect(keyResponse.status()).toBe(201);
  const keyPayload = (await keyResponse.json()) as {
    token: string;
    key: { id: string };
  };
  expect(keyPayload.token).toMatch(/^homi_api_/u);
  const authorization = { Authorization: `Bearer ${keyPayload.token}` };

  const summaryResponse = await page.request.get(
    `/api/v1/home/summary?homeId=${home.id}`,
    { headers: authorization },
  );
  expect(summaryResponse.status()).toBe(200);
  const summary = (
    (await summaryResponse.json()) as {
      summary: { home: { id: string }; metrics: { assets: number } };
    }
  ).summary;
  expect(summary.home.id).toBe(home.id);
  expect(summary.metrics.assets).toBeGreaterThan(0);

  const experienceResponse = await page.request.patch(
    "/api/preferences/experience",
    {
      data: {
        locale: "en",
        dashboardWidgets: ["health", "upcoming", "summary", "repairs", "costs"],
        mobileWidget: {
          kind: "HOME_HEALTH",
          homeId: home.id,
        },
      },
    },
  );
  expect(experienceResponse.status()).toBe(200);

  const widgetResponse = await page.request.get(
    `/api/v1/widgets/summary?homeId=${home.id}&kind=HOME_HEALTH`,
    { headers: authorization },
  );
  expect(widgetResponse.status()).toBe(200);
  expect(
    (await widgetResponse.json()) as {
      widget: { kind: string; data: { url: string } };
    },
  ).toMatchObject({
    widget: { kind: "HOME_HEALTH", data: { url: "/dashboard" } },
  });

  const feedResponse = await page.request.post("/api/calendar-feeds", {
    data: { homeId: home.id },
  });
  expect(feedResponse.status()).toBe(201);
  const feed = (await feedResponse.json()) as { url: string };
  const calendarResponse = await page.request.get(feed.url);
  expect(calendarResponse.status()).toBe(200);
  expect(calendarResponse.headers()["content-type"]).toContain("text/calendar");
  expect(await calendarResponse.text()).toContain("BEGIN:VCALENDAR");

  await page.goto("/install");
  await expect(
    page.getByRole("heading", { name: "Keep Homi one tap away." }),
  ).toBeVisible();
  await expect(
    page.getByText("Offline mode is intentionally disabled"),
  ).toBeVisible();

  await page.goto("/scan");
  await expect(
    page.getByRole("heading", { name: "Scan equipment" }),
  ).toBeVisible();
  await page.getByLabel("Barcode, serial or product reference").fill(barcode);
  await page.getByRole("button", { name: "Search Homi" }).last().click();
  await expect(
    page
      .locator(".scanner-match")
      .getByText(`Connected boiler ${suffix}`, { exact: true }),
  ).toBeVisible();

  expect(
    (
      await page.request.delete(`/api/api-keys/${keyPayload.key.id}`)
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.delete(`/api/saved-searches/${savedId}`)
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.delete("/api/calendar-feeds", {
        data: { homeId: home.id },
      })
    ).status(),
  ).toBe(200);
});
