export type MaintenanceTemplateDefinition = {
  id: string;
  source: "SYSTEM" | "HOME";
  title: string;
  description: string | null;
  category: string;
  frequencyType:
    | "ONCE"
    | "DAILY"
    | "WEEKLY"
    | "MONTHLY"
    | "YEARLY"
    | "CUSTOM";
  frequencyInterval: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedDurationMinutes: number | null;
};

const system = (
  slug: string,
  template: Omit<MaintenanceTemplateDefinition, "id" | "source">,
): MaintenanceTemplateDefinition => ({
  id: `system:${slug}`,
  source: "SYSTEM",
  ...template,
});

export const systemMaintenanceTemplates: MaintenanceTemplateDefinition[] = [
  system("smoke-alarm-test", {
    title: "Test smoke and carbon monoxide alarms",
    description:
      "Test every alarm, confirm the audible signal, inspect the indicator light, and replace weak batteries.",
    category: "Safety",
    frequencyType: "MONTHLY",
    frequencyInterval: 1,
    priority: "HIGH",
    estimatedDurationMinutes: 20,
  }),
  system("hvac-filter", {
    title: "Replace HVAC or ventilation filter",
    description:
      "Inspect the filter condition, replace it when dirty, and record the installed size and date.",
    category: "Heating & air",
    frequencyType: "CUSTOM",
    frequencyInterval: 90,
    priority: "MEDIUM",
    estimatedDurationMinutes: 20,
  }),
  system("boiler-service", {
    title: "Schedule annual boiler service",
    description:
      "Book a qualified technician, retain the service report, and update any recommended follow-up work.",
    category: "Heating & air",
    frequencyType: "YEARLY",
    frequencyInterval: 1,
    priority: "HIGH",
    estimatedDurationMinutes: 90,
  }),
  system("gutter-cleaning", {
    title: "Clean gutters and downpipes",
    description:
      "Remove debris, verify water flow, inspect joints, and check that downpipes discharge away from foundations.",
    category: "Exterior",
    frequencyType: "CUSTOM",
    frequencyInterval: 180,
    priority: "MEDIUM",
    estimatedDurationMinutes: 120,
  }),
  system("water-leak-check", {
    title: "Inspect for water leaks",
    description:
      "Check visible pipes, taps, toilets, appliance hoses, ceilings, and meter movement for signs of leakage.",
    category: "Plumbing",
    frequencyType: "MONTHLY",
    frequencyInterval: 1,
    priority: "HIGH",
    estimatedDurationMinutes: 30,
  }),
  system("water-heater", {
    title: "Inspect the water heater",
    description:
      "Check for corrosion or leaks, verify the pressure relief area is clear, and follow the manufacturer service guidance.",
    category: "Plumbing",
    frequencyType: "YEARLY",
    frequencyInterval: 1,
    priority: "HIGH",
    estimatedDurationMinutes: 45,
  }),
  system("dishwasher-filter", {
    title: "Clean dishwasher filter",
    description:
      "Remove food residue, rinse the filter, inspect spray arms, and run a cleaning cycle when needed.",
    category: "Appliances",
    frequencyType: "MONTHLY",
    frequencyInterval: 1,
    priority: "LOW",
    estimatedDurationMinutes: 20,
  }),
  system("washing-machine", {
    title: "Clean washing machine and inspect hoses",
    description:
      "Run a maintenance cycle, clean the seal and detergent drawer, and inspect inlet hoses for cracks or swelling.",
    category: "Appliances",
    frequencyType: "CUSTOM",
    frequencyInterval: 90,
    priority: "MEDIUM",
    estimatedDurationMinutes: 35,
  }),
  system("dryer-vent", {
    title: "Clean dryer vent",
    description:
      "Remove lint from the full vent path, verify airflow, and inspect the hose for crushing or damage.",
    category: "Appliances",
    frequencyType: "CUSTOM",
    frequencyInterval: 180,
    priority: "HIGH",
    estimatedDurationMinutes: 45,
  }),
  system("roof-inspection", {
    title: "Inspect roof and flashing",
    description:
      "Visually check tiles, flashing, seals, moss growth, and signs of moisture after severe weather.",
    category: "Exterior",
    frequencyType: "YEARLY",
    frequencyInterval: 1,
    priority: "HIGH",
    estimatedDurationMinutes: 60,
  }),
  system("electrical-rcd", {
    title: "Test residual-current devices",
    description:
      "Use the test button on each RCD/GFCI according to the manufacturer guidance and record any failure immediately.",
    category: "Electrical",
    frequencyType: "CUSTOM",
    frequencyInterval: 90,
    priority: "HIGH",
    estimatedDurationMinutes: 15,
  }),
  system("seasonal-home-review", {
    title: "Seasonal home health review",
    description:
      "Review overdue work, warranties, open repairs, exterior condition, emergency supplies, and upcoming seasonal needs.",
    category: "Whole home",
    frequencyType: "CUSTOM",
    frequencyInterval: 90,
    priority: "MEDIUM",
    estimatedDurationMinutes: 60,
  }),
];

export function findSystemMaintenanceTemplate(id: string) {
  return systemMaintenanceTemplates.find((template) => template.id === id);
}
