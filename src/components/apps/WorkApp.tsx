"use client";
// The Work - Experience app.
import type { AppProps } from "@components/desktop/app-api";

export default function WorkApp({ data }: AppProps<"work">) {
  return (
    <div className="app-content">
      <div className="terminal-heading">
        <span className="prompt">~/work $</span> cat career_history.md
      </div>
      <h2>Career Timeline</h2>
      <p className="app-subtitle">My journey through infrastructure and reliability</p>
      <div className="work-metrics">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="work-metric">
            <div className="work-metric-value">{metric.value}</div>
            <div className="work-metric-label">{metric.label}</div>
          </div>
        ))}
      </div>
      <div className="timeline">
        {data.experiences.map((experience) => (
          <div key={`${experience.company} ${experience.period}`} className="timeline-item">
            <div className="timeline-date">{experience.period}</div>
            <div className="timeline-title">{experience.role}</div>
            <div className="timeline-company">{experience.company}</div>
            <ul className="timeline-desc">
              {experience.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
