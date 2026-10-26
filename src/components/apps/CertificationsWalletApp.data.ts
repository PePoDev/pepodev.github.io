// Build-time data of the Certifications wallet: certifications.json in the
// order of their status when the site is built (Active, Expiring Soon, then
// Expired; README, Interaction Invariants). The wallet refreshes each status
// against the visitor's clock.
import certifications from "@data/certifications.json";
import { sortCertificationsByStatus } from "@utils/certifications";

export default async function loadCertificationsWalletData() {
  return sortCertificationsByStatus(certifications).map(
    ({ name, provider, issueDate, expirationDate, credlyUrl }) => ({
      name,
      provider,
      issueDate,
      expirationDate,
      credlyUrl,
    }),
  );
}
