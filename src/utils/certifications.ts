import type { Certification } from "../types/data";

export interface CertificationWithStatus extends Certification {
  statusPriority: number;
  daysUntilExpiry: number;
}

export function sortCertificationsByStatus(
  certifications: Certification[],
): CertificationWithStatus[] {
  const today = new Date();

  return certifications
    .map((cert) => {
      const expiry = new Date(cert.expirationDate);
      const daysUntilExpiry = Math.floor(
        (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      let statusPriority: number;
      if (daysUntilExpiry < 0) {
        statusPriority = 3; // Expired
      } else if (daysUntilExpiry < 90) {
        statusPriority = 2; // Expiring Soon
      } else {
        statusPriority = 1; // Active
      }

      return { ...cert, statusPriority, daysUntilExpiry };
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

export const EXPIRY_THRESHOLDS = {
  EXPIRING_SOON_DAYS: 90,
} as const;
