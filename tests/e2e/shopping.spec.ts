import { expect, test } from "@playwright/test";

test("household shopping lists persist, edit and clear purchased items", async ({
  page,
}) => {
  const homeResponse = await page.request.get("/api/homes");
  const { selectedHomeId: homeId } = await homeResponse.json();
  const name = `Groceries ${crypto.randomUUID().slice(0, 8)}`;
  const response = await page.request.post("/api/shopping-lists", {
    data: { homeId, name },
  });
  expect(response.status()).toBe(201);
  const { list } = await response.json();
  try {
    await page.goto(`/shopping?list=${list.id}`);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page.getByLabel("Item", { exact: true }).fill("Oat milk");
    await page.getByLabel("Quantity", { exact: true }).fill("2 bottles");
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /Oat milk/ }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText("2 bottles", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /Oat milk/ }).check();
    await expect(page.getByText("1 of 1 picked up")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear picked-up items" }).click();
    await expect(page.getByRole("checkbox", { name: /Oat milk/ })).toHaveCount(
      0,
    );
    const exportResponse = await page.request.get("/api/export/account");
    expect(exportResponse.status()).toBe(200);
    const exported = await exportResponse.json();
    expect(
      exported.homes
        .find((entry: { home: { id: string } }) => entry.home.id === homeId)
        .shopping.some((entry: { id: string }) => entry.id === list.id),
    ).toBe(true);
  } finally {
    await page.request.delete(`/api/shopping-lists/${list.id}`);
  }
});

test("an anonymous request cannot read shopping data", async ({
  playwright,
}) => {
  const anonymous = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    storageState: { cookies: [], origins: [] },
  });
  try {
    const response = await anonymous.get(
      "/api/shopping-lists?homeId=11111111-1111-4111-8111-111111111111",
    );
    expect(response.status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
});

test("items cannot be modified through another shopping list", async ({
  page,
}) => {
  const { selectedHomeId: homeId } = await (
    await page.request.get("/api/homes")
  ).json();
  const first = (
    await (
      await page.request.post("/api/shopping-lists", {
        data: { homeId, name: "Boundary first" },
      })
    ).json()
  ).list;
  const second = (
    await (
      await page.request.post("/api/shopping-lists", {
        data: { homeId, name: "Boundary second" },
      })
    ).json()
  ).list;
  try {
    const { item } = await (
      await page.request.post(`/api/shopping-lists/${first.id}/items`, {
        data: { name: "Private item", quantity: "3" },
      })
    ).json();
    const wrong = await page.request.patch(
      `/api/shopping-lists/${second.id}/items/${item.id}`,
      { data: { checked: true } },
    );
    expect(wrong.status()).toBe(404);
    const correct = await page.request.patch(
      `/api/shopping-lists/${first.id}/items/${item.id}`,
      { data: { checked: true } },
    );
    expect(correct.status()).toBe(200);
    expect((await correct.json()).item.quantity).toBe("3");
    const search = await page.request.get(
      `/api/search?homeId=${homeId}&q=Private%20item`,
    );
    expect(
      (await search.json()).results.some(
        (result: { href: string }) =>
          result.href === `/shopping?list=${first.id}`,
      ),
    ).toBe(true);
  } finally {
    await page.request.delete(`/api/shopping-lists/${first.id}`);
    await page.request.delete(`/api/shopping-lists/${second.id}`);
  }
});

test("equipment photos stay private and upcoming warranties use saved data", async ({
  page,
  playwright,
}) => {
  const { selectedHomeId: homeId } = await (
    await page.request.get("/api/homes")
  ).json();
  const name = `Warranty appliance ${crypto.randomUUID().slice(0, 8)}`;
  const warrantyEndDate = new Date(Date.now() + 10 * 86400000)
    .toISOString()
    .slice(0, 10);
  const assetResponse = await page.request.post("/api/assets", {
    data: { homeId, name, category: "Kitchen appliance", warrantyEndDate },
  });
  expect(assetResponse.status()).toBe(201);
  const { asset } = await assetResponse.json();
  let documentId: string | undefined;
  try {
    const upload = await page.request.post("/api/uploads", {
      multipart: {
        homeId,
        assetId: asset.id,
        type: "PHOTO",
        title: "Appliance photo",
        file: {
          name: "appliance.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1kAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    });
    expect(upload.status()).toBe(201);
    const { document } = await upload.json();
    documentId = document.id;
    await page.goto(`/assets/${asset.id}`);
    await expect(
      page.getByRole("img", { name: "Appliance photo" }),
    ).toBeVisible();
    const anonymous = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      storageState: { cookies: [], origins: [] },
    });
    try {
      expect(
        (
          await anonymous.get(`/api/files/${document.fileId}?preview=1`)
        ).status(),
      ).toBe(401);
    } finally {
      await anonymous.dispose();
    }
    await page.goto("/dashboard");
    const warranties = page
      .getByRole("heading", { name: "Warranties ending soon" })
      .locator("..")
      .locator("..");
    await expect(warranties.getByText(name, { exact: true })).toBeVisible();
    await expect(
      warranties.getByText(warrantyEndDate, { exact: true }),
    ).toBeVisible();
  } finally {
    if (documentId) await page.request.delete(`/api/documents/${documentId}`);
    await page.request.delete(`/api/assets/${asset.id}`);
  }
});
