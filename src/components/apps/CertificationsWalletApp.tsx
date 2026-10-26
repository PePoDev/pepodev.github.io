"use client";
// The Certifications wallet. The cards keep the build's order
// (CertificationsWalletApp.data.ts); each status is worked out against the
// visitor's clock when the app mounts and again every hour, so a
// certification that lapses while the page is open turns into quiet history:
// "Expired <Month YYYY>" and no badge.
import { useEffect, useState } from "react";
import type { AppProps } from "@components/desktop/app-api";
import {
  CERTIFICATION_EXPIRY_PREFIXES,
  CERTIFICATION_STATUS_LABELS,
  formatCertificationMonth,
  getCertificationStatus,
  getDaysUntilExpiry,
  getProviderBadge,
} from "@utils/certifications";
import "./CertificationsWalletApp.css";

const REFRESH_MS = 3_600_000;

export default function CertificationsWalletApp({ data: certifications }: AppProps<"certs">) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-content ops-app cert-wallet-app">
      <div className="cert-wallet-header">
        <strong>{`${certifications.length} certifications earned`}</strong>
      </div>
      <div className="cert-grid">
        {certifications.map((certification) => {
          const status = getCertificationStatus(getDaysUntilExpiry(certification.expirationDate, now));
          return (
            <a
              key={certification.credlyUrl}
              href={certification.credlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cert-card"
              data-expiry={certification.expirationDate}
              data-status={status}
            >
              <div className="cert-mark">{getProviderBadge(certification.provider)}</div>
              <div className="cert-content">
                <h3>{certification.name}</h3>
                <p className="cert-provider">{certification.provider}</p>
                <div className="cert-dates">
                  <p className="cert-earned">
                    Earned <time dateTime={certification.issueDate}>{formatCertificationMonth(certification.issueDate)}</time>
                  </p>
                  <p className="cert-expiry">
                    <span data-cert-expiry-label="">{CERTIFICATION_EXPIRY_PREFIXES[status]}</span>{" "}
                    <time dateTime={certification.expirationDate}>
                      {formatCertificationMonth(certification.expirationDate)}
                    </time>
                  </p>
                </div>
                {/* Expired certifications stay as quiet history: no badge. */}
                <span className={`cert-status cert-status-${status}`} hidden={status === "expired"}>
                  {CERTIFICATION_STATUS_LABELS[status]}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
