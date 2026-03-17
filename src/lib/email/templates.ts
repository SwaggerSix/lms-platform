/**
 * Email templates for LMS transactional notifications.
 * Each template returns HTML string for the email body.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function baseLayout(content: string, portalName: string = "LearnHub"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${portalName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#4f46e5;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${portalName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
              <p style="margin:0;color:#6b7280;font-size:12px;text-align:center;">
                This is an automated message from ${portalName}. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#4f46e5;border-radius:6px;">
        <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${text}</a>
      </td>
    </tr>
  </table>`;
}

// ============================================================================
// Template definitions
// ============================================================================

export function enrollmentConfirmation(params: {
  learnerName: string;
  courseName: string;
  courseUrl: string;
  startDate?: string;
  portalName?: string;
}): EmailTemplate {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">You&apos;re enrolled!</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.learnerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      You have been successfully enrolled in <strong>${params.courseName}</strong>.
      ${params.startDate ? `The course begins on <strong>${params.startDate}</strong>.` : "You can start learning right away."}
    </p>
    ${button("Start Learning", params.courseUrl)}
    <p style="margin:0;color:#6b7280;font-size:13px;">Happy learning!</p>
  `;

  return {
    subject: `Enrolled: ${params.courseName}`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.learnerName}, you've been enrolled in ${params.courseName}. Visit ${params.courseUrl} to start.`,
  };
}

export function approvalRequest(params: {
  managerName: string;
  learnerName: string;
  courseName: string;
  reason?: string;
  approvalUrl: string;
  portalName?: string;
}): EmailTemplate {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Enrollment Approval Needed</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.managerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      <strong>${params.learnerName}</strong> has requested enrollment in <strong>${params.courseName}</strong> and needs your approval.
    </p>
    ${params.reason ? `<div style="padding:12px 16px;background-color:#f9fafb;border-radius:6px;border-left:4px solid #4f46e5;margin:0 0 16px;"><p style="margin:0;color:#374151;font-size:13px;"><strong>Reason:</strong> ${params.reason}</p></div>` : ""}
    ${button("Review Request", params.approvalUrl)}
  `;

  return {
    subject: `Approval needed: ${params.learnerName} → ${params.courseName}`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.managerName}, ${params.learnerName} needs approval for ${params.courseName}. Review at: ${params.approvalUrl}`,
  };
}

export function approvalDecision(params: {
  learnerName: string;
  courseName: string;
  decision: "approved" | "rejected";
  managerName: string;
  reason?: string;
  courseUrl?: string;
  portalName?: string;
}): EmailTemplate {
  const isApproved = params.decision === "approved";
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">
      Enrollment ${isApproved ? "Approved" : "Declined"}
    </h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.learnerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      Your request to enroll in <strong>${params.courseName}</strong> has been
      <strong style="color:${isApproved ? "#059669" : "#dc2626"};">${params.decision}</strong>
      by ${params.managerName}.
    </p>
    ${params.reason ? `<div style="padding:12px 16px;background-color:#f9fafb;border-radius:6px;border-left:4px solid ${isApproved ? "#059669" : "#dc2626"};margin:0 0 16px;"><p style="margin:0;color:#374151;font-size:13px;"><strong>Note:</strong> ${params.reason}</p></div>` : ""}
    ${isApproved && params.courseUrl ? button("Start Course", params.courseUrl) : ""}
  `;

  return {
    subject: `Enrollment ${params.decision}: ${params.courseName}`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.learnerName}, your enrollment in ${params.courseName} has been ${params.decision} by ${params.managerName}.`,
  };
}

export function courseCompletion(params: {
  learnerName: string;
  courseName: string;
  score?: number;
  certificateUrl?: string;
  dashboardUrl: string;
  portalName?: string;
}): EmailTemplate {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Congratulations! 🎉</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.learnerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      You have successfully completed <strong>${params.courseName}</strong>!
      ${params.score !== undefined ? `Your score: <strong>${params.score}%</strong>.` : ""}
    </p>
    ${params.certificateUrl ? button("View Certificate", params.certificateUrl) : button("View Dashboard", params.dashboardUrl)}
  `;

  return {
    subject: `Completed: ${params.courseName}`,
    html: baseLayout(content, params.portalName),
    text: `Congratulations ${params.learnerName}! You completed ${params.courseName}${params.score !== undefined ? ` with a score of ${params.score}%` : ""}.`,
  };
}

export function certificationExpiry(params: {
  learnerName: string;
  certName: string;
  expiryDate: string;
  daysRemaining: number;
  renewalUrl: string;
  portalName?: string;
}): EmailTemplate {
  const urgency = params.daysRemaining <= 7 ? "#dc2626" : params.daysRemaining <= 30 ? "#d97706" : "#4f46e5";
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Certification Expiring Soon</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.learnerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      Your <strong>${params.certName}</strong> certification expires on
      <strong style="color:${urgency};">${params.expiryDate}</strong>
      (${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""} remaining).
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      Please complete the renewal process before the expiration date to maintain your certification status.
    </p>
    ${button("Renew Certification", params.renewalUrl)}
  `;

  return {
    subject: `${params.daysRemaining <= 7 ? "URGENT: " : ""}${params.certName} expires ${params.expiryDate}`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.learnerName}, your ${params.certName} certification expires on ${params.expiryDate} (${params.daysRemaining} days). Renew at: ${params.renewalUrl}`,
  };
}

export function dueDateReminder(params: {
  learnerName: string;
  courseName: string;
  dueDate: string;
  daysRemaining: number;
  courseUrl: string;
  portalName?: string;
}): EmailTemplate {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Course Due Date Reminder</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.learnerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      This is a reminder that <strong>${params.courseName}</strong> is due on
      <strong>${params.dueDate}</strong> (${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""} remaining).
    </p>
    ${button("Continue Course", params.courseUrl)}
  `;

  return {
    subject: `Reminder: ${params.courseName} due ${params.dueDate}`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.learnerName}, ${params.courseName} is due on ${params.dueDate}. Continue at: ${params.courseUrl}`,
  };
}

export function iltSessionReminder(params: {
  learnerName: string;
  sessionTitle: string;
  date: string;
  time: string;
  location: string;
  isVirtual: boolean;
  meetingUrl?: string;
  portalName?: string;
}): EmailTemplate {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Upcoming Training Session</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.learnerName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      You have an upcoming training session:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%;">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:100px;">Session:</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${params.sessionTitle}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Date:</td><td style="padding:8px 0;color:#111827;font-size:13px;">${params.date}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Time:</td><td style="padding:8px 0;color:#111827;font-size:13px;">${params.time}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Location:</td><td style="padding:8px 0;color:#111827;font-size:13px;">${params.location}</td></tr>
    </table>
    ${params.isVirtual && params.meetingUrl ? button("Join Meeting", params.meetingUrl) : ""}
  `;

  return {
    subject: `Reminder: ${params.sessionTitle} on ${params.date}`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.learnerName}, reminder: ${params.sessionTitle} on ${params.date} at ${params.time}. Location: ${params.location}.`,
  };
}

export function scheduledReportDelivery(params: {
  recipientName: string;
  reportName: string;
  period: string;
  downloadUrl: string;
  portalName?: string;
}): EmailTemplate {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Your Scheduled Report</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
      Hi ${params.recipientName},
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
      Your <strong>${params.reportName}</strong> report for <strong>${params.period}</strong> is ready.
    </p>
    ${button("Download Report", params.downloadUrl)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">This report was generated automatically. You can manage your report subscriptions in Settings.</p>
  `;

  return {
    subject: `Report: ${params.reportName} (${params.period})`,
    html: baseLayout(content, params.portalName),
    text: `Hi ${params.recipientName}, your ${params.reportName} report for ${params.period} is ready. Download: ${params.downloadUrl}`,
  };
}
