"use client";
// Projects - Showcase (port of ProjectsApp.astro).
import type { AppProps } from "@components/desktop/app-api";

export default function ProjectsApp({ data: projects }: AppProps<"project">) {
  return (
    <div className="app-content">
      <div className="terminal-heading">
        <span className="prompt">~/projects $</span>
        {` gh repo list --limit ${projects.length}`}
      </div>
      <h2>Project Showcase</h2>
      <p className="app-subtitle">Tools, systems, and side projects I&apos;ve built</p>
      <div className="project-grid">
        {projects.map((project, index) => (
          <a key={index} href={project.link} target="_blank" rel="noopener noreferrer" className="project-card">
            <div className="project-card-header">
              <div className="project-card-name">{project.name}</div>
              <div className="project-card-meta">
                {project.archived && <span className="project-archived-badge">Archived</span>}
                <span className="project-stars">{`★ ${project.stars}`}</span>
              </div>
            </div>
            <div className="project-card-desc">{project.description}</div>
            <div className="project-tags">
              {project.tags.map((tag, index) => (
                <span key={index} className="project-tag">
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
