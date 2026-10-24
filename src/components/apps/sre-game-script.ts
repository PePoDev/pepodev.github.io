// The SRE game's script: the boot log and the five alerts, each of whose
// mitigations fails.

export interface BootLine {
  text: string;
  /** Extra class on the line (sre-dim, sre-info, sre-warn). */
  cls: string;
  /** Wait before the line appears, in ms. */
  delay: number;
}

export interface SreAlert {
  severity: "warning" | "critical" | "catastrophic";
  title: string;
  desc: string;
  /** Seconds to respond. */
  timer: number;
  /** Health lost, whatever the response. */
  damage: number;
  actions: { text: string; result: string }[];
}

export const BOOT_LINES: BootLine[] = [
  { text: "$ ssh production-cluster.prod.internal", cls: "", delay: 300 },
  { text: "Connecting to 10.0.42.1...", cls: "sre-dim", delay: 500 },
  { text: "Authenticated. Welcome to prod.", cls: "sre-info", delay: 400 },
  { text: "", cls: "", delay: 200 },
  { text: "$ kubectl get nodes", cls: "", delay: 600 },
  { text: "NAME           STATUS   ROLES           AGE   VERSION", cls: "sre-dim", delay: 300 },
  { text: "prod-node-01   Ready    control-plane   45d   v1.36.0", cls: "", delay: 200 },
  { text: "prod-node-02   Ready    worker          45d   v1.36.0", cls: "", delay: 200 },
  { text: "prod-node-03   Ready    worker          45d   v1.36.0", cls: "", delay: 200 },
  { text: "", cls: "", delay: 200 },
  { text: "$ systemctl status monitoring", cls: "", delay: 500 },
  { text: "prometheus.service - Prometheus Monitoring", cls: "", delay: 200 },
  { text: "Active: active (running)", cls: "", delay: 200 },
  { text: "", cls: "", delay: 200 },
  { text: "All systems nominal. No alerts.", cls: "sre-info", delay: 400 },
  { text: "", cls: "", delay: 200 },
  { text: "You're on call. The dashboard is green.", cls: "", delay: 600 },
  { text: "For now...", cls: "sre-warn", delay: 800 },
];

export const ALERTS: SreAlert[] = [
  {
    severity: "warning",
    title: "High Memory Usage Detected",
    desc: "prod-node-02 memory at 87%. Pod evictions imminent.",
    timer: 15,
    damage: 8,
    actions: [
      { text: "Restart pods", result: "Pods restarted. Memory dropped, then spiked higher." },
      {
        text: "Scale horizontally",
        result: "New pods scheduled. The node is now at 94% with scheduling overhead.",
      },
      { text: "Kill top consumer", result: "Killed the memory-heavy process. It was a critical cache." },
    ],
  },
  {
    severity: "warning",
    title: "Latency Spike on API Gateway",
    desc: "p99 latency jumped from 120ms to 2.4s. Users reporting slow responses.",
    timer: 14,
    damage: 10,
    actions: [
      { text: "Enable circuit breaker", result: "Circuit breaker tripped. Now 40% of requests fail outright." },
      {
        text: "Rollback last deploy",
        result: "Rollback complete. The latency was infrastructure-level, not code.",
      },
      { text: "Add rate limiting", result: "Rate limiter engaged. Legitimate traffic is throttled too." },
    ],
  },
  {
    severity: "critical",
    title: "Disk I/O Saturation",
    desc: "prod-node-03 disk utilization at 100%. Write operations queueing.",
    timer: 12,
    damage: 12,
    actions: [
      { text: "Clear old logs", result: "Logs cleared. Application started writing audit logs at 10x rate." },
      { text: "Move to faster storage", result: "Storage migration started. I/O spiked during the transition." },
      { text: "Enable write coalescing", result: "Writes coalesced. Data consistency checks now fail." },
    ],
  },
  {
    severity: "critical",
    title: "Database Connection Pool Exhausted",
    desc: "PostgreSQL primary: 450/450 connections used. New connections rejected.",
    timer: 10,
    damage: 14,
    actions: [
      { text: "Increase pool size", result: "Pool expanded to 600. Server ran out of shared memory." },
      { text: "Kill idle connections", result: "Killed 200 connections. Replication lag monitors fired." },
      { text: "Enable PgBouncer", result: "PgBouncer deployed. Transaction retry storms began." },
    ],
  },
  {
    severity: "catastrophic",
    title: "Cascading Failure Detected",
    desc: "Service mesh sidecars crashing. Error propagation across all zones.",
    timer: 8,
    damage: 18,
    actions: [
      { text: "Emergency rollback all", result: "Rollback triggered dependency conflicts. More services down." },
      {
        text: "Isolate zones",
        result: "Zones isolated. Cross-zone replication broke. Data divergence detected.",
      },
      { text: "Full cluster restart", result: "Restart initiated. Boot storm caused DNS resolution failures." },
    ],
  },
];
