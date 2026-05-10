// App content data for the SRE Desktop Portfolio

export interface BlogPost {
  title: string;
  date: string;
  description: string;
  body: string;
}

export interface Project {
  name: string;
  description: string;
  tags: string[];
  link?: string;
}

export interface Experience {
  company: string;
  role: string;
  period: string;
  details: string[];
}

export interface Skill {
  name: string;
  level: number;
}

export const blogPosts: BlogPost[] = [
  {
    title: 'When Auto-Scaling Became a Death Spiral',
    date: '2025-03-15',
    description: 'How a misconfigured HPA turned into a cascading failure that took down our entire payment pipeline.',
    body: `<p>It started like any other Tuesday. A traffic spike during a flash sale triggered our horizontal pod autoscaler. Except the autoscaler was watching the wrong metric.</p>
<p>Instead of CPU, it was watching <code>requests_per_second</code>. Each new pod added more load to the API gateway, which generated more RPS, which triggered more pods. Within 90 seconds, we had 400 pods fighting for GPU memory.</p>
<p>The fix was a simple limit in the HPA config. The lesson was much harder to learn: always validate your autoscaling metrics against failure scenarios, not just happy paths.</p>
<pre><code>apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  maxReplicas: 50  # This was missing
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70</code></pre>
<p>Now every HPR review includes a "what if this metric goes to infinity" question. It saved us twice since then.</p>`
  },
  {
    title: 'Building a Runbook That Actually Runs',
    date: '2025-02-20',
    description: 'Most runbooks are fiction. Here\'s how I turned ours into executable playbooks with Terraform and Ansible.',
    body: `<p>Our incident response time was terrible. Not because engineers were slow — it was because every runbook was a Confluence page that hadn't been updated since 2022.</p>
<p>I decided to treat runbooks like code. Each mitigation step became an Ansible playbook, each infrastructure change became a Terraform apply. The "runbook" became a CLI tool you could execute during an incident.</p>
<p><code>$ sre-tool run mitigate-db-connection-pool-exhausted</code></p>
<p>The result: mean time to mitigation dropped from 47 minutes to 8 minutes. The catch? You need to test these playbooks as rigorously as production code. We run them against staging every night.</p>`
  },
  {
    title: 'The Chaos Engineering That Got Us Fired (Almost)',
    date: '2025-01-10',
    description: 'Blindly following Netflix\'s chaos monkey advice nearly cost us a production database. Here\'s what went wrong.',
    body: `<p>We read all the articles. Chaos engineering is great. Kill random instances. Build resilience. So we deployed a chaos monkey to our staging cluster.</p>
<p>The problem? Our "staging" cluster shared a database with production. The chaos monkey didn't know that. Neither did the intern who configured it.</p>
<p>For 12 minutes, our primary PostgreSQL was being restarted every 90 seconds. Replicas fell behind. Connection pools exhausted. The alerting system was part of the affected cluster, so it went down too.</p>
<p>Lesson: chaos engineering requires chaos <em>boundaries</em>. Now every chaos experiment needs a blast radius document signed off by two engineers. And staging gets its own database.</p>`
  }
];

export const projects: Project[] = [
  {
    name: 'AlertRouter',
    description: 'Smart alert routing engine that reduces pager fatigue by correlating events across services before notifying on-call engineers.',
    tags: ['Go', 'Kafka', 'Prometheus'],
    link: '#'
  },
  {
    name: 'InfraDrift',
    description: 'Continuous drift detection tool that compares actual cluster state against desired Terraform state and auto-generates PRs.',
    tags: ['Python', 'Terraform', 'GitHub Actions'],
    link: '#'
  },
  {
    name: 'CanaryBot',
    description: 'Slack bot for progressive deployment canaries. Type /canary deploy and it runs your analysis pipeline with real-time metrics.',
    tags: ['Rust', 'Slack API', 'Datadog'],
    link: '#'
  },
  {
    name: 'LogSum',
    description: 'Log aggregation dashboard that surfaces anomalies using statistical outlier detection instead of keyword matching.',
    tags: ['TypeScript', 'Elasticsearch', 'React'],
    link: '#'
  },
  {
    name: 'NetPulse',
    description: 'Synthetic monitoring framework that runs distributed health checks from 30+ global edge locations.',
    tags: ['Go', 'eBPF', 'gRPC'],
    link: '#'
  },
  {
    name: 'SRE-Game',
    description: 'Interactive chaos simulation game that teaches SRE fundamentals. Play it right on this portfolio!',
    tags: ['JavaScript', 'Canvas', 'Game Dev'],
    link: '/sre-game'
  }
];

export const experiences: Experience[] = [
  {
    company: 'Current Company',
    role: 'Senior Site Reliability Engineer',
    period: '2023 — Present',
    details: [
      'Lead on-call rotation for 12 microservices serving 2M+ daily active users',
      'Reduced MTTR from 45min to 12min through runbook automation and better observability',
      'Designed and implemented multi-region failover strategy with RTO < 5 minutes',
      'Mentored 3 junior SREs through incident command training programs'
    ]
  },
  {
    company: 'Previous Tech Co.',
    role: 'Site Reliability Engineer',
    period: '2021 — 2023',
    details: [
      'Migrated 40+ services from VMs to Kubernetes, reducing infrastructure cost by 35%',
      'Built custom Prometheus exporters for business-critical metrics not covered by standard integrations',
      'Implemented GitOps workflow with ArgoCD, achieving zero-downtime deployments',
      'Reduced weekly alert volume by 60% through SLO-based alerting redesign'
    ]
  },
  {
    company: 'Startup Inc.',
    role: 'DevOps Engineer',
    period: '2019 — 2021',
    details: [
      'Built CI/CD pipelines from scratch using GitHub Actions and Terraform',
      'Implemented infrastructure as code for AWS environment (ECS, RDS, CloudFront)',
      'Set up centralized logging with ELK stack and Grafana dashboards',
      'Achieved 99.95% uptime SLA for the first time in company history'
    ]
  }
];

export const skills: Skill[] = [
  { name: 'Kubernetes / Docker', level: 95 },
  { name: 'Terraform / IaC', level: 90 },
  { name: 'Linux Systems', level: 92 },
  { name: 'CI/CD Pipelines', level: 88 },
  { name: 'Observability (Prometheus, Grafana)', level: 93 },
  { name: 'Cloud (AWS, GCP)', level: 85 },
  { name: 'Scripting (Bash, Python, Go)', level: 87 },
  { name: 'Networking / DNS / TLS', level: 82 },
  { name: 'Incident Management', level: 90 },
  { name: 'Database (PostgreSQL, Redis)', level: 78 }
];

export const resumeContent = `
<resume-entry>
  <entry-header>
    <entry-title>PePoDev</entry-title>
    <entry-date>Senior Site Reliability Engineer</entry-date>
  </entry-header>
  <entry-subtitle>Infrastructure • Reliability • Automation</entry-subtitle>
</resume-entry>
`;
