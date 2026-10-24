"use client";
// About Me (port of AboutApp.astro).
import type { AppProps } from "@components/desktop/app-api";

export default function AboutApp({ data }: AppProps<"me">) {
  return (
    <div className="app-content">
      <div className="terminal-heading">
        <span className="prompt">~/about $</span> whoami
      </div>
      <div className="profile-header">
        <div className="profile-avatar">T</div>
        <div className="profile-info">
          <h2>Thiwanon Chomcharoen (PePoDev)</h2>
          <div className="profile-role">{data.role}</div>
          <div className="profile-location">Bangkok, Thailand</div>
          {data.currentCompany && (
            <div style={{ marginTop: 8 }}>
              <span className="status-badge online">{`Currently at ${data.currentCompany}`}</span>
            </div>
          )}
        </div>
      </div>
      <h3>Who Am I</h3>
      <p>
        {`Experienced and energetic ${data.role} with over ${data.yearsInWords} years of experience ` +
          "effectively managing infrastructure projects from conception to completion. I specialize in " +
          "using Kubernetes, Terraform, and many open-source technologies to deliver an efficient and " +
          "reliable platform."}
      </p>
      <p>
        I&apos;m passionate about being part of the open-source community to create freedom of technology. When
        I&apos;m not optimizing cloud costs or implementing chaos engineering, I&apos;m building tools that help
        teams ship faster and sleep better.
      </p>
      <div className="section-divider" />
      <h3>Skills &amp; Expertise</h3>
      <div className="skill-boxes">
        {data.skills.map((skill) => (
          <div key={skill} className="skill-box">
            <span className="skill-name">{skill}</span>
          </div>
        ))}
      </div>
      <div className="section-divider" />
      <h3>Education</h3>
      <div style={{ marginTop: "1rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.5rem",
          }}
        >
          <strong style={{ fontSize: "1rem" }}>{data.degree}</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{data.educationYears}</span>
        </div>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>{data.school}</p>
      </div>
    </div>
  );
}
