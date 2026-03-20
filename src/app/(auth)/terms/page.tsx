import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-1 text-sm text-gray-500">
          Last updated: March 2026
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            1. Acceptable Use
          </h2>
          <p>
            By using LearnHub, you agree to use the platform responsibly and in
            accordance with these terms. You must not misuse the platform by
            interfering with its normal operation, attempting to access it
            through unauthorized means, or using it for any unlawful purpose.
            You are responsible for maintaining the confidentiality of your
            account credentials.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            2. User Accounts
          </h2>
          <p>
            You must provide accurate and complete information when creating an
            account. You are responsible for all activity that occurs under your
            account. If you suspect unauthorized access to your account, you
            must notify your administrator immediately. We reserve the right to
            suspend or terminate accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            3. Intellectual Property
          </h2>
          <p>
            All course content, materials, and platform features are protected
            by intellectual property laws. You may access and use course
            materials solely for your personal learning purposes. You must not
            copy, distribute, modify, or create derivative works from any
            content without explicit written permission from the content owner.
            Certificates earned are for personal use and verification only.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            4. User-Generated Content
          </h2>
          <p>
            You retain ownership of any content you submit to the platform, such
            as discussion posts and assignment submissions. By submitting
            content, you grant LearnHub a non-exclusive license to use, display,
            and distribute that content within the platform as needed to provide
            our services.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            5. Disclaimers
          </h2>
          <p>
            LearnHub is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis. We make no warranties, express or implied,
            regarding the reliability, accuracy, or availability of the
            platform. We do not guarantee that course completion will result in
            any specific certification, qualification, or employment outcome.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            6. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, LearnHub and its operators
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising from your use of the
            platform. Our total liability for any claims arising from these terms
            shall not exceed the amount you have paid to access the platform in
            the twelve months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            7. Changes to These Terms
          </h2>
          <p>
            We reserve the right to modify these terms at any time. We will
            provide notice of material changes by posting the updated terms on
            this page. Your continued use of the platform after changes take
            effect constitutes acceptance of the revised terms.
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
            href="/privacy"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
