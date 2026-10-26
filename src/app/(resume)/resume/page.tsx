// /resume/: the resume as a standalone HTML page, rendered at build time
// from experiences.json, skills.json, education.json and
// certifications.json. A static page (runtime "none"): Download PDF builds the
// PDF in the browser from the same data (ResumeDownloadScript.tsx,
// resume-pdf.ts). GitHub Pages redirects /resume to /resume/, so link to it
// with the slash.
import "./resume.css";
import certifications from "@data/certifications.json";
import education from "@data/education.json";
import experiences from "@data/experiences.json";
import skills from "@data/skills.json";
import { buildMetadata } from "@lib/head";
import { formatDegree, formatEducationYears } from "@utils/education";
import type { ResumePdfData } from "./resume-pdf";
import { ResumeDownloadScript } from "./ResumeDownloadScript";

const contactLinks = [
  { label: "Bangkok, Thailand" },
  { label: "pepo@pepo.dev", href: "mailto:pepo@pepo.dev" },
  { label: "github.com/pepodev", href: "https://github.com/pepodev" },
  { label: "linkedin.com/in/pepodev", href: "https://linkedin.com/in/pepodev" },
];

// Listed as earned history so lapsed certifications never read as current.
const earnedCertifications = certifications.map((certification) => ({
  ...certification,
  earnedYear: certification.issueDate.slice(0, 4),
}));

const resumePdfData: ResumePdfData = {
  name: "Thiwanon Chomcharoen (PePo)",
  title: "Site Reliability Engineer",
  contact: contactLinks,
  summary:
    "Site Reliability Engineer specializing in cloud infrastructure, Kubernetes platforms, observability, infrastructure as code, GitOps delivery, and reliability practices for production systems.",
  education: [formatDegree(education), education.school, formatEducationYears(education)],
  experiences,
  skills: skills.map((skill) => `${skill.name} - ${skill.level}%`),
  certifications: earnedCertifications.map(({ name, earnedYear, credlyUrl }) => ({
    text: `${name}, earned ${earnedYear}`,
    href: credlyUrl,
  })),
};

export const generateMetadata = () =>
  buildMetadata({
    title: `Resume - ${resumePdfData.name}`,
    description:
      "Resume of Thiwanon Chomcharoen (PePo), a Site Reliability Engineer in Bangkok: experience, technical skills, education, and certifications, with a PDF download.",
    path: "/resume/",
  });

export default function ResumePage() {
  const [degree, school, educationPeriod] = resumePdfData.education;
  const currentYear = new Date().getFullYear();
  return (
    <>
      <div className="resume-page">
        <a className="resume-skip-link" href="#resume-main">
          Skip to content
        </a>{" "}
        <header className="resume-header">
          <div className="resume-header-inner">
            <a className="resume-brand" href="/">
              PePoDev
            </a>
          </div>
        </header>{" "}
        <main id="resume-main" className="resume-main">
          <header className="resume-intro">
            <p className="resume-eyebrow">Resume</p> <h1>{resumePdfData.name}</h1>{" "}
            <p className="resume-title">{resumePdfData.title}</p>{" "}
            <ul className="resume-contact" aria-label="Contact">
              {contactLinks.map(({ label, href }) => (
                <li key={label}>{href ? <a href={href}>{label}</a> : label}</li>
              ))}
            </ul>{" "}
            <p className="resume-summary">{resumePdfData.summary}</p>{" "}
            <div className="resume-actions">
              <button
                type="button"
                className="resume-button resume-download"
                data-resume-download=""
                hidden
                suppressHydrationWarning
              >
                Download PDF
              </button>{" "}
              <p className="resume-download-status" role="status" data-resume-download-status="" />
            </div>
          </header>{" "}
          <section className="resume-section" aria-labelledby="resume-experience">
            <h2 id="resume-experience">Experience</h2>{" "}
            <div className="resume-entries">
              {experiences.map((experience) => (
                <article key={`${experience.company} ${experience.period}`} className="resume-entry">
                  <div className="resume-entry-heading">
                    <h3>{experience.role}</h3> <p className="resume-period">{experience.period}</p>
                  </div>{" "}
                  <p className="resume-org">{experience.company}</p>{" "}
                  <ul>
                    {experience.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>{" "}
          <section className="resume-section" aria-labelledby="resume-skills">
            <h2 id="resume-skills">Technical Skills</h2>{" "}
            <ul className="resume-skills">
              {skills.map((skill) => (
                <li key={skill.name}>{skill.name}</li>
              ))}
            </ul>
          </section>{" "}
          <section className="resume-section" aria-labelledby="resume-education">
            <h2 id="resume-education">Education</h2>{" "}
            <div className="resume-entry">
              <div className="resume-entry-heading">
                <h3>{degree}</h3> <p className="resume-period">{educationPeriod}</p>
              </div>{" "}
              <p className="resume-org">{school}</p>
            </div>
          </section>{" "}
          <section className="resume-section" aria-labelledby="resume-certifications">
            <h2 id="resume-certifications">Certifications</h2>{" "}
            <ul className="resume-certifications">
              {earnedCertifications.map((certification) => (
                <li key={certification.credlyUrl}>
                  <a href={certification.credlyUrl} target="_blank" rel="noopener noreferrer">
                    {certification.name}
                  </a>
                  <span className="resume-earned">{`, earned ${certification.earnedYear}`}</span>{" "}
                  <span className="resume-provider">{certification.provider}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>{" "}
        <footer className="resume-footer">
          <p>{`© ${currentYear} PePoDev. Built as a static Next.js site.`}</p>
        </footer>
      </div>
      <ResumeDownloadScript data={resumePdfData} />
    </>
  );
}
