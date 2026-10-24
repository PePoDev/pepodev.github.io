// Build-time data of the About app: the current role, years of experience
// and current company are computed from experiences.json when the site is
// built (README, Content and Apps).
import education from "@data/education.json";
import experiences from "@data/experiences.json";
import skills from "@data/skills.json";
import { formatDegree, formatEducationYears } from "@utils/education";
import { getCareerSummary, numberToWords } from "@utils/experience";

export default async function loadAboutData() {
  const { years, current } = getCareerSummary(experiences);
  return {
    role: experiences[0].role,
    yearsInWords: numberToWords(years),
    currentCompany: current?.companyName ?? null,
    skills: skills.map((skill) => skill.name),
    degree: formatDegree(education),
    educationYears: formatEducationYears(education),
    school: education.school,
  };
}
