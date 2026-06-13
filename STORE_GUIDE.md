# Your Online Stores — Owner's Guide

This platform now includes its own online shopping capability, so the
gothamCulture and Gotham Government Services course catalogs can be sold
directly from here instead of through a paid third-party store (Ecwid).

Written for non-technical use — no coding needed for day-to-day store
management.

## Where everything lives

| What | Where |
|---|---|
| Manage your stores | **Admin → Storefronts** (left sidebar) |
| gothamCulture store (what customers see) | `/store/gothamculture` |
| Gotham Government store (what customers see) | `/store/gothamgovernment` |

Both stores are already created with your brand colors and a handful of
sample courses so you can click around immediately.

## Day-to-day tasks

**Add or edit a course/product:** Admin → Storefronts → Manage → Products tab.
Set the name, description, price, optional sale price, category, and an image.
"Featured" pins it to the top of the store.

**See orders:** Manage → Orders tab. Every order shows the customer's name,
email, what they bought, and whether payment completed.

**Change how the store looks:** Manage → Settings tab — brand colors, logo,
banner image, tagline, announcement bar (great for sale promotions), and an
on/off switch for the whole store.

**Discount codes:** Admin → eCommerce → Coupons. Customers type the code at
checkout and the discount is applied on the payment page.

## Bringing over your existing catalogs (one-time)

1. Log in to your current store's admin (Ecwid) → **Catalog → Products →
   Export** → download the CSV file. Do this once per website.
2. Here: Admin → Storefronts → Manage → **Import catalog** tab → upload the
   file. All products come in with names, descriptions, prices, categories,
   and images.
3. Review the Products tab and tidy anything up. Re-importing the same file
   later updates products instead of duplicating them.

## Turning on real payments (one-time, before going live)

Right now the stores run in **test mode**: checkout works end to end but no
card is ever charged — perfect for trying everything out.

To accept real payments you need a free Stripe account (Stripe is the same
processor that powers Shopify's payments; there's no monthly fee, just a
per-transaction fee of roughly 2.9% + 30¢):

1. Create an account at stripe.com and complete the business verification.
2. Whoever manages your deployment adds two settings (see
   `.env.local.example`): `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`,
   with a Stripe webhook pointed at `/api/storefront/webhook` for the
   `checkout.session.completed` event.
3. That's it — checkout automatically switches from test mode to real
   payments. Card details are entered on Stripe's secure page and never touch
   this platform (which is what keeps you out of scope for card-security
   compliance).

## Putting the stores on your websites

Each store's **"Put it on your website"** tab shows three ready-to-copy
options, simplest first:

1. **Link** your existing "Store" menu item to the store's address.
2. **Embed** the store inside an existing page with one copy-paste snippet.
3. **Subdomain** (e.g. `store.gothamculture.com`) — the cleanest long-term
   option; needs one DNS record from whoever manages your domains.

## Suggested go-live checklist

1. Import both catalogs from Ecwid CSV exports.
2. Click through both stores in test mode: browse, add to cart, check out,
   confirm the order appears under Manage → Orders.
3. Connect Stripe and place one small real order with your own card
   (you can refund it from the Stripe dashboard).
4. Point your websites at the new stores.
5. Keep Ecwid active for a couple of weeks as a fallback, then cancel it.

## A bonus the old store couldn't do

If a buyer's email matches an LMS account here, paid courses that are linked
to LMS courses are **enrolled automatically** the moment payment completes —
no manual roster work.

## How orders work (B2B)

These stores sell to **client organizations** that buy seats for their
employees — not to individual self-registrants. At checkout the client gives
their organization, contact, email, optional phone, **PO number**, and order
notes, then pays by credit card (Stripe). After payment, both the client and
your team get an order email, and your team follows up to collect the attendee
roster and confirm scheduling.

### Seat limits per course
Each course can set a **minimum and maximum number of seats** (e.g. 10–25).
Set these on a product under Products → edit. The store enforces them in the
seat selector and again at checkout.

### Managing orders (Orders tab)
Click any order to expand it. You can change its **status** (pending,
completed, cancelled, refunded…), issue a full or partial **refund** (processed
through Stripe automatically when the order was paid by card), and keep
**internal notes** your client never sees.

### Reports tab
Net revenue, order count, seats sold, refunds, and your **top courses** over a
30/90/180/365-day window.

### Volume discounts (off by default)
Under **Volume discounts**, add tiers like "10+ seats → 10% off." They only
apply once you switch them **on** in Settings → "Apply volume discounts." Each
course line automatically gets the best tier it qualifies for.

### Tax (off by default)
Settings → "Charge tax on orders" with a rate and label. Leave it off for
tax-exempt B2B/federal sales.

### Abandoned-cart recovery
If a client enters their email but doesn't finish, the platform emails them a
one-click link to resume their cart (runs automatically a couple of times a
day). Nothing to configure.

### Customer order history
Clients can review past orders at `/store/<slug>/orders` using their email plus
any order number from a confirmation email — no account required.

### Richer product pages
Products support an **image gallery**, a **duration label** (used as a store
filter), **delivery formats** (e.g. Virtual / Onsite), and a **scheduling &
delivery** block (lead time, coordinator email/phone, notes).

### Search-friendly & migration-ready
Every product page has its own SEO/social metadata, both stores are in the
sitemap, and legacy Ecwid product links of the form `…-p<number>` can 301 to
the matching new product page (products carry their original Ecwid id when
imported). Add a Google Analytics measurement ID under Settings to track
storefront traffic.
