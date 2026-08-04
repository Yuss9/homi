export const selectedHomeCookie = "homi-selected-home";

export type SelectableHome = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  role: string;
};

export function resolveSelectedHomeId(
  homes: readonly Pick<SelectableHome, "id">[],
  requestedHomeId?: string | null,
) {
  if (requestedHomeId && homes.some((home) => home.id === requestedHomeId)) {
    return requestedHomeId;
  }
  return homes[0]?.id ?? "";
}
