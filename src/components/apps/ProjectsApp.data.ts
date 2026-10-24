// Build-time data of the Projects app: projects.json, without the
// website-mode copy it does not show.
import type { Project } from "@app-types/data";
import projects from "@data/projects.json";

export default async function loadProjectsData() {
  return (projects as Project[]).map(({ name, description, stars, tags, archived, link }) => ({
    name,
    description,
    stars,
    tags,
    archived,
    link,
  }));
}
