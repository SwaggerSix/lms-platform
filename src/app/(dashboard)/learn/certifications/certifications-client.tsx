"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Download,
  Share2,
  RefreshCw,
  Shield,
  AlertTriangle,
  ExternalLink,
  Eye,
  Copy,
  Linkedin,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DOMPurify from "dompurify";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getHelp } from "@/lib/help-content";
import { CertStatusBadge } from "@/components/certifications/cert-status-badge";
import type { CertStatus } from "@/lib/certifications/status";

/** Escape HTML entities to prevent XSS in certificate templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface Certificate {
  id: string;
  name: string;
  issuingCourse: string;
  courseId: string | null;
  issueDate: string;
  expiryDate: string;
  status: CertStatus;
  credentialId: string;
  verificationCode?: string | null;
}

const TABS = [
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface CertificationsClientProps {
  certificates: Certificate[];
  userName: string;
}

function handleDownloadPDF(cert: Certificate, userName: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const safeName = escapeHtml(cert.name);
  const safeUser = escapeHtml(userName);
  const safeCourse = escapeHtml(cert.issuingCourse);
  const safeCredId = escapeHtml(cert.credentialId);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Certificate - ${safeName}</title>
      <style>
        @media print { body { margin: 0; } }
        body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
        .certificate { width: 800px; padding: 60px; border: 8px double #91C53C; text-align: center; position: relative; }
        .certificate::before { content: ''; position: absolute; inset: 8px; border: 2px solid #cde3a4; pointer-events: none; }
        .header { font-size: 14px; text-transform: uppercase; letter-spacing: 4px; color: #739E2D; margin-bottom: 10px; }
        .title { font-size: 36px; color: #49641d; margin: 20px 0 10px; }
        .subtitle { font-size: 16px; color: #6b7280; margin-bottom: 30px; }
        .recipient { font-size: 28px; color: #49641d; border-bottom: 2px solid #91C53C; display: inline-block; padding-bottom: 5px; margin-bottom: 20px; }
        .course { font-size: 18px; color: #374151; margin: 15px 0; }
        .details { display: flex; justify-content: space-around; margin-top: 40px; font-size: 13px; color: #6b7280; }
        .details div { text-align: center; }
        .details .label { font-weight: bold; color: #374151; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="header">Certificate of Completion</div>
        <div class="title">${safeName}</div>
        <div class="subtitle">This certificate is awarded to</div>
        <div class="recipient">${safeUser}</div>
        <div class="course">For successfully completing: ${safeCourse}</div>
        <div class="details">
          <div><div class="label">Issue Date</div>${new Date(cert.issueDate).toLocaleDateString()}</div>
          <div><div class="label">Expiry Date</div>${new Date(cert.expiryDate).toLocaleDateString()}</div>
          <div><div class="label">Certificate ID</div>${safeCredId}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

export default function CertificationsClient({ certificates, userName }: CertificationsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [viewingCert, setViewingCert] = useState<{ svg: string; html: string } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  function getVerifyUrl(cert: Certificate): string {
    const code = cert.verificationCode || cert.credentialId;
    return `${window.location.origin}/verify/${code}`;
  }

  async function handleViewCertificate(cert: Certificate) {
    setGeneratingId(cert.id);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_certification_id: cert.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to generate certificate");
        return;
      }
      const data = await res.json();
      setViewingCert({ svg: data.svg, html: data.html });
    } catch {
      toast.error("Failed to generate certificate");
    } finally {
      setGeneratingId(null);
    }
  }

  function handleDesignedDownloadPDF(cert: Certificate) {
    // Generate and open in new window for printing
    handleViewAndDownload(cert);
  }

  async function handleViewAndDownload(cert: Certificate) {
    setGeneratingId(cert.id);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_certification_id: cert.id }),
      });
      if (!res.ok) {
        // Fall back to old method
        handleDownloadPDF(cert, userName);
        return;
      }
      const data = await res.json();
      const sanitizedHtml = DOMPurify.sanitize(data.html, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style", "link"] });
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(sanitizedHtml);
        printWindow.document.close();
      }
    } catch {
      // Fall back to old method
      handleDownloadPDF(cert, userName);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleCopyLink(cert: Certificate) {
    const url = getVerifyUrl(cert);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Verification link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link.");
    }
    setShareMenuId(null);
  }

  function handleShareLinkedIn(cert: Certificate) {
    const url = getVerifyUrl(cert);
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
    setShareMenuId(null);
  }

  async function handleShare(cert: Certificate) {
    const shareUrl = getVerifyUrl(cert);
    const shareData = {
      title: `Certificate: ${cert.name}`,
      text: `I earned the ${cert.name} certification!`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed silently
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Certificate link copied to clipboard!");
      } catch {
        toast.error("Failed to copy link to clipboard.");
      }
    }
  }

  async function handleRenew(cert: Certificate) {
    if (!cert.courseId) {
      toast.error("No recertification course is linked to this certificate.");
      return;
    }

    setRenewingId(cert.id);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: cert.courseId }),
      });

      if (res.status === 409) {
        // Already enrolled, just navigate
        toast.info("You are already enrolled. Redirecting to the course...");
      } else if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to re-enroll.");
        setRenewingId(null);
        return;
      } else {
        toast.success("Re-enrolled successfully! Redirecting to the course...");
      }

      router.push(`/learn/player/${cert.courseId}`);
    } catch {
      toast.error("An error occurred while re-enrolling.");
    } finally {
      setRenewingId(null);
    }
  }

  const activeCerts = certificates.filter((c) => c.status === "active");
  const expiringCerts = certificates.filter((c) => c.status === "expiring_soon");

  const filteredCerts =
    activeTab === "all"
      ? certificates
      : activeTab === "active"
      ? certificates.filter((c) => c.status === "active" || c.status === "expiring_soon")
      : certificates.filter((c) => c.status === "expired");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-primary-600" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">My Certifications</h1>
              <InfoTooltip content={getHelp("learn.certifications").details} label="About Certifications" side="bottom" />
            </div>
            <p className="mt-1 text-gray-500">View and manage your earned certificates.</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeCerts.length}</p>
                <p className="text-sm text-gray-500">Active Certificates</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{expiringCerts.length}</p>
                <p className="text-sm text-gray-500">Expiring Soon</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <Award className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{certificates.length}</p>
                <p className="text-sm text-gray-500">Total Earned</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as TabKey)} className="mt-8">
          <TabsList aria-label="Filter certificates by status">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Certificate Cards */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredCerts.map((cert) => (
            <div
              key={cert.id}
              className="relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-sm"
            >
              {/* Decorative border pattern */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary-500 via-purple-500 to-primary-500" />
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500" />
                <div className="absolute right-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary-500 via-purple-500 to-primary-500" />
                <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500" />
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                      <Award className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{cert.name}</h3>
                      <p className="text-sm text-gray-500">{cert.issuingCourse}</p>
                    </div>
                  </div>
                  <CertStatusBadge status={cert.status} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Issue Date</p>
                    <p className="font-medium text-gray-900">{formatDate(cert.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expiry Date</p>
                    <p className="font-medium text-gray-900">{formatDate(cert.expiryDate)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Credential ID</p>
                    <p className="font-mono text-sm font-medium text-gray-900">{cert.credentialId}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  <Button
                    onClick={() => handleViewCertificate(cert)}
                    disabled={generatingId === cert.id}
                  >
                    {generatingId === cert.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    View Certificate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDesignedDownloadPDF(cert)}
                  >
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => setShareMenuId(shareMenuId === cert.id ? null : cert.id)}
                    >
                      <Share2 className="h-4 w-4" /> Share
                    </Button>
                    {shareMenuId === cert.id && (
                      <div className="absolute bottom-full mb-1 left-0 z-10 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                        <button
                          onClick={() => handleCopyLink(cert)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="h-4 w-4 text-gray-400" /> Copy Verification URL
                        </button>
                        <button
                          onClick={() => handleShareLinkedIn(cert)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Linkedin className="h-4 w-4 text-blue-600" /> Share to LinkedIn
                        </button>
                        <button
                          onClick={() => { handleShare(cert); setShareMenuId(null); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                        >
                          <ExternalLink className="h-4 w-4 text-gray-400" /> More Options...
                        </button>
                      </div>
                    )}
                  </div>
                  {(cert.status === "expiring_soon" || cert.status === "expired") && (
                    <button
                      onClick={() => handleRenew(cert)}
                      disabled={renewingId === cert.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                    >
                      <RefreshCw className={cn("h-4 w-4", renewingId === cert.id && "animate-spin")} /> {renewingId === cert.id ? "Renewing..." : "Renew"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredCerts.length === 0 && (
          <EmptyState
            className="mt-12"
            icon={<Award className="h-10 w-10" aria-hidden="true" />}
            title="No certificates found"
            description="Complete courses to earn certificates."
          />
        )}
      </div>

      {/* Certificate View Modal */}
      {viewingCert && (
        <Modal
          isOpen
          onClose={() => setViewingCert(null)}
          title="Certificate Preview"
          size="xl"
          className="max-w-[90vw]"
          footer={
            <Button
              variant="outline"
              onClick={() => {
                const w = window.open("", "_blank");
                if (w) { w.document.write(viewingCert.html); w.document.close(); }
              }}
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          }
        >
            <div className="flex justify-center">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingCert.svg) }} />
            </div>
        </Modal>
      )}
    </div>
  );
}
