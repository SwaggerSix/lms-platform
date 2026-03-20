import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-gray-500">
          Last updated: March 2026
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            1. Data Collection
          </h2>
          <p>
            LearnHub collects information you provide when creating an account,
            enrolling in courses, and using our platform. This includes your
            name, email address, profile information, and learning activity data
            such as course progress, quiz results, and completion records.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            2. How We Use Your Data
          </h2>
          <p>
            We use your information to provide and improve our learning
            management services, personalize your experience, track course
            progress, issue certificates, communicate important updates, and
            generate aggregated analytics for administrators. We do not sell your
            personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            3. Data Storage and Security
          </h2>
          <p>
            Your data is stored securely using industry-standard encryption both
            in transit and at rest. We use trusted cloud infrastructure providers
            and implement appropriate technical and organizational measures to
            protect your personal information against unauthorized access,
            alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            4. Cookies and Tracking
          </h2>
          <p>
            LearnHub uses essential cookies to maintain your session and
            authentication state. We may also use analytics cookies to understand
            how users interact with the platform in order to improve our
            services. You can manage cookie preferences through your browser
            settings.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            5. Your Rights
          </h2>
          <p>
            You have the right to access, correct, or delete your personal data.
            You may request a copy of the data we hold about you, ask us to
            update inaccurate information, or request account deletion. To
            exercise these rights, please contact your organization administrator
            or our support team.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            6. Data Retention
          </h2>
          <p>
            We retain your personal data for as long as your account is active or
            as needed to provide services. Course completion records and
            certificates may be retained longer for verification purposes. When
            you delete your account, we will remove your personal information
            within a reasonable timeframe, subject to legal obligations.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            7. Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of any material changes by posting the new policy on this page
            and updating the &quot;Last updated&quot; date. Your continued use of
            the platform after changes constitutes acceptance of the updated
            policy.
          </p>
        </section>
      </div>

      {/* Footer Links */}
      <div className="mt-8 flex flex-col items-center gap-3 border-t border-gray-100 pt-6">
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Sign in
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Register
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href="/terms"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
