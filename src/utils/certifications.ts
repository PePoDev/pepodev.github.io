import type { Certification } from "../types/data";

export type CertificationStatus = "active" | "expiring" | "expired";

export interface CertificationWithStatus extends Certification {
  status: CertificationStatus;
  statusPriority: number;
  daysUntilExpiry: number;
}

export const EXPIRY_THRESHOLDS = {
  EXPIRING_SOON_DAYS: 90,
} as const;

export const CERTIFICATION_STATUS_LABELS: Record<CertificationStatus, string> =
  {
    active: "Active",
    expiring: "Expiring Soon",
    expired: "Expired",
  };

// Past tense once expired, so lapsed certifications read as earned history.
export const CERTIFICATION_EXPIRY_PREFIXES: Record<
  CertificationStatus,
  string
> = {
  active: "Valid until",
  expiring: "Expires",
  expired: "Expired",
};

const STATUS_PRIORITY: Record<CertificationStatus, number> = {
  active: 1,
  expiring: 2,
  expired: 3,
};

export function getDaysUntilExpiry(
  expirationDate: string,
  today = new Date(),
): number {
  const expiry = new Date(expirationDate);
  return Math.floor(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function getCertificationStatus(
  daysUntilExpiry: number,
): CertificationStatus {
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry < EXPIRY_THRESHOLDS.EXPIRING_SOON_DAYS) return "expiring";
  return "active";
}

// "2023-05-14" -> "May 2023". Dates are UTC midnight, so format in UTC.
export function formatCertificationMonth(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function sortCertificationsByStatus(
  certifications: Certification[],
): CertificationWithStatus[] {
  const today = new Date();

  return certifications
    .map((cert) => {
      const daysUntilExpiry = getDaysUntilExpiry(cert.expirationDate, today);
      const status = getCertificationStatus(daysUntilExpiry);

      return {
        ...cert,
        status,
        statusPriority: STATUS_PRIORITY[status],
        daysUntilExpiry,
      };
    })
    .sort((a, b) => {
      // Sort by status priority first (Active → Expiring Soon → Expired)
      if (a.statusPriority !== b.statusPriority) {
        return a.statusPriority - b.statusPriority;
      }
      // Within same status, sort by days until expiry
      return a.statusPriority === 3
        ? b.daysUntilExpiry - a.daysUntilExpiry
        : b.daysUntilExpiry - a.daysUntilExpiry;
    });
}
