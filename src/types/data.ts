// Type definitions for data files

export interface Project {
  name: string;
  description: string;
  stars: number;
  tags: string[];
  archived: boolean;
  link: string;
  github: string;
}

export interface Experience {
  company: string;
  role: string;
  period: string;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface Skill {
  category: string;
  items: string[];
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
