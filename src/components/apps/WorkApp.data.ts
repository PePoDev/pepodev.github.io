// Build-time data of the Work app: the career timeline and its headline
// numbers, computed from experiences.json when the site is built.
import experiences from "@data/experiences.json";
import { getCareerSummary, getWorkMetrics } from "@utils/experience";

export default async function loadWorkData() {
  return {
    metrics: getWorkMetrics(getCareerSummary(experiences)),
    experiences: experiences.map(({ company, role, period, details }) => ({ company, role, period, details })),
  };
}
