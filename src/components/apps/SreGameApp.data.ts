// Build-time data of the SRE game: the current job title for its closing
// screen (experiences.json[0].role, README Content and Apps).
import experiences from "@data/experiences.json";

export default async function loadSreGameData() {
  return { currentRole: experiences[0].role };
}
