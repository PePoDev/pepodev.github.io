// Type definitions for data files

export interface Project {
  name: string;
  description: string;
  /** Edited one-line copy for website mode; falls back to `description`. */
  summary?: string;
  stars: number;
  tags: string[];
  archived: boolean;
  link: string;
  github: string;
}

export interface Experience {
  company: string;
  role: string;
  /** "February 2024 - Present"; parsed by src/utils/experience.ts. */
  period: string;
  details: string[];
}

export interface Education {
  degree: string;
  degreeShort: string;
  field: string;
  school: string;
  schoolShort: string;
  startYear: number;
  endYear: number;
}

export interface SocialLink {
  label: string;
  href: string;
  icon: string;
}

export interface WorkMetric {
  label: string;
  value: string;
}

export interface Certification {
  name: string;
  provider: string;
  issueDate: string;
  expirationDate: string;
  credlyUrl: string;
}
