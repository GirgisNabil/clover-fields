import { toast } from "sonner";
import { FEATURE_LEVEL } from "@/domain";
import { useGame } from "../store/gameStore";
import { useUi } from "../store/uiStore";

/** Vehicles tool: pick the first owned vehicle, or send the player to the market for one. */
export function openVehicles() {
  const farm = useGame.getState().farm;
  if (farm.progress.level < FEATURE_LEVEL.vehicles) {
    toast(`Farm vehicles unlock at level ${FEATURE_LEVEL.vehicles}.`);
    return;
  }
  const owned = Object.values(farm.objects).filter((o) => o.kind === "vehicle");
  const ui = useUi.getState();
  if (owned.length === 0) {
    ui.openMarket("vehicles");
    return;
  }
  const current = owned.find((o) => o.id === ui.vehicleId) ?? owned[0];
  useUi.setState({ tool: "drive", vehicleId: current?.id ?? null, placing: null });
}
