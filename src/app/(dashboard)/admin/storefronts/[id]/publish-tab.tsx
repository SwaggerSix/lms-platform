"use client";

import type { Storefront } from "./store-shared";

export default function PublishTab({ store }: { store: Storefront }) {
  return (
    <div className="max-w-2xl space-y-6 text-sm text-gray-700">
      <div>
        <h2 className="font-semibold text-lg text-gray-900">Option 1 — Link to the store (simplest)</h2>
        <p className="mt-2">
          On your website, point your “Store” menu link to this address:
        </p>
        <code className="mt-2 block rounded-lg bg-gray-100 px-4 py-3 font-mono text-xs break-all">
          {typeof window !== "undefined" ? window.location.origin : ""}/store/{store.slug}
        </code>
      </div>
      <div>
        <h2 className="font-semibold text-lg text-gray-900">Option 2 — Embed it inside your page</h2>
        <p className="mt-2">
          Paste this snippet into your website page (in WordPress, add a “Custom HTML” block)
          and the store appears inside your existing site:
        </p>
        <code className="mt-2 block rounded-lg bg-gray-100 px-4 py-3 font-mono text-xs break-all whitespace-pre-wrap">
          {`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/store/${store.slug}" style="width:100%;min-height:1400px;border:0;" title="${store.name}"></iframe>`}
        </code>
      </div>
      <div>
        <h2 className="font-semibold text-lg text-gray-900">Option 3 — Its own web address (recommended long-term)</h2>
        <p className="mt-2">
          A subdomain like <strong>store.gothamculture.com</strong> can point directly at this
          store. That needs one DNS record added wherever your domain is managed — ask
          whoever set up your website hosting, or we can walk through it together.
        </p>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800">
        <strong>Before going live:</strong> connect Stripe so real cards can be charged. Until
        then the store runs in test mode (orders work, nothing is charged). See STORE_GUIDE.md
        in the project, or ask your developer to set STRIPE_SECRET_KEY and
        STRIPE_WEBHOOK_SECRET.
      </div>
    </div>
  );
}
