import { expect, test } from "@playwright/test";

test("household operations connect maintenance, stock, projects, and insurance", async ({
  page,
}) => {
  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const homes = (
    (await homesResponse.json()) as { homes: Array<{ id: string; name: string }> }
  ).homes;
  const home = homes[0]!;
  const suffix = crypto.randomUUID().slice(0, 8);

  const createAsset = async (name: string) => {
    const response = await page.request.post("/api/assets", {
      data: {
        homeId: home.id,
        name,
        category: "Heating",
        brand: "Homi Operations",
        purchasePrice: "2500.00",
        purchaseCurrency: "EUR",
        purchaseDate: "2026-08-04",
        installationDate: "2026-08-04",
        expectedLifetimeYears: 15,
        status: "ACTIVE",
      },
    });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { asset: { id: string } }).asset.id;
  };

  const oldAssetId = await createAsset(`Old heat pump ${suffix}`);
  const newAssetId = await createAsset(`New heat pump ${suffix}`);

  const taskResponse = await page.request.post("/api/tasks", {
    data: {
      homeId: home.id,
      assetId: oldAssetId,
      title: `Operations service ${suffix}`,
      description: "Validate the complete operations workflow.",
      frequencyType: "YEARLY",
      frequencyInterval: 1,
      nextDueAt: "2099-01-15",
      priority: "HIGH",
      checklist: [
        { title: "Check pressure", required: true },
        { title: "Photograph installation", required: false },
      ],
      recurrenceRule: {
        season: "AUTUMN",
        weekdays: [1],
      },
    },
  });
  expect(taskResponse.status()).toBe(201);
  const taskId = ((await taskResponse.json()) as { task: { id: string } }).task
    .id;

  const initialOperations = await page.request.get(
    `/api/operations?homeId=${home.id}`,
  );
  expect(initialOperations.status()).toBe(200);
  const initialPayload = (await initialOperations.json()) as {
    tasks: Array<{
      id: string;
      checklist: Array<{ id: string; title: string }>;
      recurrenceRule: { season?: string } | null;
    }>;
  };
  const task = initialPayload.tasks.find((entry) => entry.id === taskId)!;
  expect(task.checklist).toHaveLength(2);
  expect(task.recurrenceRule).toMatchObject({ season: "AUTUMN" });

  const checklistResponse = await page.request.post("/api/operations", {
    data: {
      action: "checklist.toggle",
      homeId: home.id,
      itemId: task.checklist[0]!.id,
      completed: true,
    },
  });
  expect(checklistResponse.status()).toBe(200);

  const scheduleResponse = await page.request.post("/api/operations", {
    data: {
      action: "schedule.change",
      homeId: home.id,
      taskId,
      scheduleAction: "RESCHEDULE",
      newDueAt: "2099-02-15",
      reason: "Coordinate the annual technician visit",
    },
  });
  expect(scheduleResponse.status()).toBe(200);

  const providerResponse = await page.request.post("/api/operations", {
    data: {
      action: "provider.create",
      homeId: home.id,
      name: `Heat Pro ${suffix}`,
      company: "Homi Service Test",
      email: `provider-${suffix}@example.test`,
      specialties: ["Heating", "Heat pumps"],
      rating: 5,
    },
  });
  expect(providerResponse.status()).toBe(200);
  const providerId = (
    (await providerResponse.json()) as { provider: { id: string } }
  ).provider.id;

  const inventoryResponse = await page.request.post("/api/operations", {
    data: {
      action: "inventory.create",
      homeId: home.id,
      assetId: newAssetId,
      name: `Heat pump filter ${suffix}`,
      sku: `FILTER-${suffix}`,
      quantity: 1,
      unit: "piece",
      reorderThreshold: 1,
      location: "Utility room",
      unitCost: "29.90",
      currency: "EUR",
    },
  });
  expect(inventoryResponse.status()).toBe(200);

  const budgetResponse = await page.request.post("/api/operations", {
    data: {
      action: "budget.upsert",
      homeId: home.id,
      year: 2099,
      currency: "EUR",
      maintenanceBudget: "800.00",
      repairBudget: "1500.00",
      replacementBudget: "6000.00",
    },
  });
  expect(budgetResponse.status()).toBe(200);

  const replacementResponse = await page.request.post("/api/operations", {
    data: {
      action: "replacement.link",
      homeId: home.id,
      predecessorAssetId: oldAssetId,
      successorAssetId: newAssetId,
      replacedAt: "2099-01-10",
      notes: "Keep the complete asset timeline.",
    },
  });
  expect(replacementResponse.status()).toBe(200);

  const renovationResponse = await page.request.post("/api/operations", {
    data: {
      action: "renovation.create",
      homeId: home.id,
      name: `Utility room refresh ${suffix}`,
      description: "Coordinate the heat pump replacement area.",
      status: "PLANNING",
      targetEndDate: "2099-06-30",
      budget: "10000.00",
      currency: "EUR",
    },
  });
  expect(renovationResponse.status()).toBe(200);
  const projectId = (
    (await renovationResponse.json()) as { project: { id: string } }
  ).project.id;

  expect(
    (
      await page.request.post("/api/operations", {
        data: {
          action: "renovation.task",
          homeId: home.id,
          projectId,
          title: "Approve final layout",
          dueDate: "2099-03-01",
          assignedTo: null,
        },
      })
    ).status(),
  ).toBe(200);

  expect(
    (
      await page.request.post("/api/operations", {
        data: {
          action: "renovation.quote",
          homeId: home.id,
          projectId,
          providerId,
          description: "Complete utility room work",
          amount: "7800.00",
          currency: "EUR",
          status: "SHORTLISTED",
          documentId: null,
        },
      })
    ).status(),
  ).toBe(200);

  const insuranceResponse = await page.request.post("/api/operations", {
    data: {
      action: "insurance.create",
      homeId: home.id,
      assetId: newAssetId,
      roomId: null,
      documentId: null,
      name: `Insured heat pump ${suffix}`,
      category: "Heating",
      quantity: 1,
      unitValue: "4800.00",
      currency: "EUR",
      purchaseDate: "2099-01-10",
      notes: "Replacement value for household insurance.",
    },
  });
  expect(insuranceResponse.status()).toBe(200);

  const pdfResponse = await page.request.get(
    `/api/operations/insurance/pdf?homeId=${home.id}`,
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

  const finalOperations = await page.request.get(
    `/api/operations?homeId=${home.id}`,
  );
  expect(finalOperations.status()).toBe(200);
  const finalPayload = (await finalOperations.json()) as {
    scheduleHistory: Array<{ taskId: string; reason: string }>;
    providers: Array<{ id: string }>;
    inventory: Array<{ name: string }>;
    replacements: Array<{ predecessorAssetId: string }>;
    budgets: Array<{ year: number }>;
    renovations: Array<{ id: string }>;
    insuranceItems: Array<{ name: string }>;
  };
  expect(finalPayload.scheduleHistory).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        taskId,
        reason: "Coordinate the annual technician visit",
      }),
    ]),
  );
  expect(finalPayload.providers).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: providerId })]),
  );
  expect(finalPayload.inventory).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: `Heat pump filter ${suffix}` }),
    ]),
  );
  expect(finalPayload.replacements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ predecessorAssetId: oldAssetId }),
    ]),
  );
  expect(finalPayload.budgets).toEqual(
    expect.arrayContaining([expect.objectContaining({ year: 2099 })]),
  );
  expect(finalPayload.renovations).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: projectId })]),
  );
  expect(finalPayload.insuranceItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: `Insured heat pump ${suffix}` }),
    ]),
  );

  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Stock" })).toBeVisible();
  await page.getByRole("tab", { name: "Stock" }).click();
  await expect(page.getByText(`Heat pump filter ${suffix}`, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Renovations" }).click();
  await expect(
    page.getByRole("heading", { name: `Utility room refresh ${suffix}` }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Insurance" }).click();
  await expect(page.getByText(`Insured heat pump ${suffix}`, { exact: true })).toBeVisible();
});
