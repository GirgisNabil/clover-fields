// The farm's neighbours. Each one gives a few questlines and appears at the farm's edge
// while they have something to say.

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  /** Portrait emoji (the HUD draws it in a colored ring). */
  icon: string;
  color: string;
}

export const NPCS: readonly NpcDef[] = [
  {
    id: "marigold",
    name: "Auntie Marigold Fenn",
    role: "Your mentor",
    icon: "👵",
    color: "#4cb92c",
  },
  { id: "pip", name: "Pip Sprocket", role: "Mechanic", icon: "🧑‍🔧", color: "#3aa0ff" },
  { id: "barnaby", name: "Barnaby Quill", role: "Miller", icon: "👨‍🍳", color: "#e6a33a" },
  { id: "juniper", name: "Juniper Ashwood", role: "Collector", icon: "🧝", color: "#b56cff" },
  { id: "hollis", name: "Mayor Hollis Bramble", role: "Mayor", icon: "🎩", color: "#e05a47" },
  { id: "dot", name: "Dot", role: "The mail goose", icon: "🪿", color: "#f6c945" },
];

export const getNpc = (id: string) => NPCS.find((n) => n.id === id);
