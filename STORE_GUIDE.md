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

**Changing a coupon** (Admin → eCommerce → Coupons, on the coupon's row):
- **Switch on / off:** click the switch on the row. Off (Inactive) means the
  code stops working at once; switch it back on any time.
- **Edit:** click **Edit** to change the code, discount, max uses, minimum
  purchase, dates, Active, or "Only for product", then **Save Changes**. The
  usage count can't be edited. Changes apply to future checkouts only.
- **Delete:** the bin icon, then confirm. A coupon that has already been used
  can't be deleted (orders refer to it); switch it off instead.

## Selling a bundle (several courses as one product)

A **bundle** is one store product that sells a whole group of courses at one
price. The group is a **learning path**, so you build the list of courses once
and the store sells it. When someone buys the bundle, they're enrolled in the
learning path and in every course on it.

### Example: the Mosaic certification bundle ($599, courses not sold separately)

The five Mosaic certification courses (MOS-100, MOS-210, MOS-220, MOS-230,
MOS-240) are sold **only** as one bundle for $599. Partners who use their 50%
partner code pay $299.50.

**Step 1 — Make the learning path (one time)**
1. Go to **Admin → Learning Paths** → **Create Path**.
2. Name it, e.g. "Mosaic Certification".
3. Add the five courses in the order learners should take them: MOS-100,
   MOS-210, MOS-220, MOS-230, MOS-240.
4. Save it, then **Publish** it. Buyers then see it, with their progress,
   under Learning Paths. People who are signed in but haven't bought it can't
   join it themselves; you and managers can still assign it to someone.

**Step 2 — Make the bundle product**
1. Go to **Admin → Storefronts** → the store you want it in → **Manage** →
   **Products** → **Add product**.
2. Name: "Mosaic Certification Bundle". Add a description.
3. Tick **Bundle**, then under **Learning path it sells** pick "Mosaic
   Certification". The form shows **Includes: 5 courses** and lists them.
   Check that all five are there.
4. Price: **599**. Leave "Sale price" empty unless you're running a sale.
5. Keep **Visibility** on "Visible in store" and **Offer in the online store**
   ticked, then click **Add product**.

In the product list the bundle has a "Bundle · Includes: 5 courses" label. In
the store it shows as one product with its price and an "Includes 5 courses"
list.

**Step 3 — Keep the five courses off the store individually**
The courses don't need store products of their own. A course only appears in
the store on its own when its **Website catalogs** box is ticked (Admin →
Courses → edit the course). Leave that box **unticked** on all five Mosaic
courses. (They're unticked today.) If one of them already has its own store
product, hide it on the Products tab: edit it → Visibility → "Hidden".

### Good to know
- **Discount codes work on bundles** just like on a single course. That
  includes the 50% partner code and any code under Admin → eCommerce → Coupons.
- **The partner code doesn't apply to MOS-210 Coaching Studio or MOS-220
  SurveyCraft** (operator decision, 12 Nov 2026). Partners pay full price for
  those two; checkout leaves them out of the discount.
- **A buyer who already has some of the courses can still buy the bundle.**
  They keep those courses (and their progress) and get the rest. The price is
  the same (no partial refund or reduced price).
- **Changing the learning path changes the bundle.** Buyers get the courses on
  the path at the time they pay. Adding a course to the path later doesn't
  give it to people who already bought.
- You can't delete a learning path that a bundle is selling. Remove the bundle
  product (or untick Bundle on it) first.
- **One thing to know about the LMS catalog:** because the five courses are
  published with open enrollment, anyone who already has an LMS login could
  join one from the course catalog without paying. If that matters, ask for
  their enrollment to be switched to "approval required".

## Give someone the certification free (coupon code)

Make a code that takes 100% off the Mosaic Certification bundle. Whoever uses
it checks out without paying (no card page) and is enrolled straight away in
the learning path and all five courses. New people get an email to set their
password, the same as a paying buyer.

1. Go to **Admin → eCommerce → Coupons** → **Create Coupon**.
2. **Coupon Code:** something easy to type, e.g. `MOSAICGIFT`.
3. **Discount Type:** Percentage (%). **Discount Value:** `100`.
4. **Only for product:** pick "Mosaic Certification Bundle". The code then
   works only on the bundle, so it can't make anything else free.
5. **Max Uses:** how many people may use it (e.g. `5`). Leave it empty for no
   limit.
6. **Valid Until:** the date the code stops working (optional).
7. Keep **Active** ticked → **Create Coupon**.
8. Send the person the store link and the code. They add the bundle to the
   cart, type the code in "Discount code", and click check out.

Good to know:
- The order appears under the store's **Orders** tab at $0, with payment
  "coupon". The **Usage** column on the Coupons page counts each use.
- When the uses run out or the date passes, the code simply stops working.
- A code that leaves something to pay (e.g. 50% off) still goes to the normal
  card payment page.
- Prefer this when people should go through the store themselves. To add
  people directly, use the invite below.

## Invite people to a learning path

Give people a learning path (and every course on it) without them buying
anything, just by pasting their email addresses.

1. Go to **Admin → Learning Paths**.
2. On the path (e.g. "Mosaic Certification") click the **envelope** button
   ("Invite people"). The path must be published.
3. Paste the email addresses, one per line or separated by commas. You can add
   names, like `Jane Doe <jane@example.com>` — up to 200 at a time.
4. Click **Send**.

Everyone on the list gets the path and all of its courses and an email:
- **People who already have an account** get a "you've been given access"
  email with a link to the path.
- **People without an account** get one, plus an email to set their password.
- **People who already had the path** are left as they are (no email).

When it finishes you see a summary: invited (new accounts), given access,
already had access, and failed (with the reason, e.g. a typo in an address).
Managers can invite only their own team members, and only admins can invite
people who don't have an account yet.

(The person-with-a-plus button next to it, **Assign learners**, does the same
for people you pick from the list of existing users.)

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
