/** Dashboard sections and the signed-in user, shared by the shell and the section pages. */
import { createContext, useContext } from "react";
import type { Me } from "./api";

export const SECTIONS = [
  { id: "team", label: "Team" },
  { id: "achievements", label: "Achievements" },
  { id: "placements", label: "Placements" },
  { id: "alumni", label: "Alumni" },
  { id: "submissions", label: "Submissions", needsSubmissions: true },
  { id: "settings", label: "Settings" },
  { id: "admins", label: "Admins", adminOnly: true },
  { id: "activity", label: "Activity" },
] as const;

export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);
