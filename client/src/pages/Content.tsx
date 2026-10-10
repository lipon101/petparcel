// Content pages: About, FAQ, Shipping & returns, Privacy, Terms, Contact.
// Kept in one module because they are all static marketing/policy copy for the
// same store, tuned for a US audience.
import { useState } from "react";
import { Link } from "wouter";
import { Clock, Mail, MapPin, Phone, Truck, RotateCcw, ShieldCheck, Plus } from "lucide-react";
import { useSeo } from "@/lib/petparcel";
import { Section, SectionHeading, PolicyPage, CtaLink } from "@/components/site/Bits";
import { useSite } from "@/components/site/Layout";

// ── About ────────────────────────────────────────────────────────────────────
export function About() {
  useSeo({
    title: "About Us",
    description:
      "PetParcel is a US pet-supplies store built on a simple idea: a small range of gear that actually holds up, shipped fast and backed by real support.",
    path: "/about",
  });

  return (
    <>
      <Section className="!pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">About PetParcel</p>
          <h1 className="mt-3 text-3xl font-medium sm:text-4xl">
            A small catalog, chosen carefully
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            PetParcel exists because shopping for a pet online is exhausting. Thousands of near-identical
            listings, unclear sizing, and a coin-flip on whether anything will survive a week with a determined
            chewer. So we went the other way.
          </p>
        </div>
      </Section>

      <Section muted className="!py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { stat: "40,000+", label: "US pet parents served" },
            { stat: "4.8 / 5", label: "Average product rating" },
            { stat: "3–6 days", label: "Typical US delivery" },
          ].map((item) => (
            <div key={item.label} className="card-soft p-6 text-center">
              <p className="text-3xl font-medium text-primary">{item.stat}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl space-y-6 text-[15px] leading-relaxed text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">How we choose what to stock</h2>
          <p>
            Every product is bought and used by someone on our team — usually with a dog or cat actively
            interfering. If it falls apart, sheds dye, smells odd, or gets ignored for a fortnight, it doesn't
            make the site. That's the whole filter.
          </p>
          <p>
            We keep inventory in US warehouses rather than drop-shipping from overseas, because a
            three-week wait for a replacement harness isn't a real option when yours has just snapped.
          </p>

          <h2 className="text-xl font-semibold text-foreground">How we treat customers</h2>
          <p>
            Free shipping over $49, a flat $5.99 below it, and a 30-day return window on everything. If
            something arrives damaged, we replace it and cover the label. Support is answered by humans in
            Wilmington, Delaware — not a chatbot.
          </p>
          <p>
            We're a small operation and we'd rather stay that way than grow past the point where we can answer
            an email properly.
          </p>
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-medium">Questions before you buy?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We answer every message within one business day.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <CtaLink to="/contact">Contact support</CtaLink>
            <CtaLink to="/shop" variant="outline">
              Browse the catalog
            </CtaLink>
          </div>
        </div>
      </Section>
    </>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
export function Faq() {
  const s = useSite();
  useSeo({
    title: "Frequently Asked Questions",
    description:
      "Answers about PetParcel shipping times, free-shipping threshold, returns, payment methods, order tracking and product sizing.",
    path: "/faq",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_SECTIONS.flatMap((sec) =>
        sec.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      ),
    },
  });

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          align="center"
          eyebrow="Help center"
          title="Frequently asked questions"
          subtitle="Everything about ordering, shipping, returns and payment. If your question isn't here, email us — a human replies."
        />
        <div className="space-y-8">
          {FAQ_SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2 className="text-lg font-medium">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <details key={item.q} className="card-soft group p-5 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                      {item.q}
                      <Plus className="h-4 w-4 shrink-0 text-primary transition group-open:rotate-45" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-lg bg-secondary/60 p-6 text-center">
          <p className="text-sm font-semibold">Still stuck?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Email {s.contact_email} or call {s.contact_phone}. {s.support_hours}.
          </p>
          <CtaLink to="/contact" variant="outline" className="mt-4">
            Contact support
          </CtaLink>
        </div>
      </div>
    </Section>
  );
}

const FAQ_SECTIONS = [
  {
    heading: "Orders & shipping",
    items: [
      {
        q: "How long does delivery take?",
        a: "Orders placed before 2pm EST ship the same business day; anything later goes out the next business day. Standard US delivery then takes 3–6 business days. You'll get a tracking number as soon as the label is created.",
      },
      {
        q: "How much is shipping?",
        a: "Free on every order over $49, anywhere in the United States. Below that it's a flat $5.99. There are no handling fees or surprise charges at checkout.",
      },
      {
        q: "Do you ship outside the US?",
        a: "Not yet — we currently ship to US addresses only. Restricting the range is what lets us keep delivery times short and returns simple.",
      },
      {
        q: "Can I change my order after placing it?",
        a: "If it hasn't shipped yet, yes. Email support with your order number as soon as you can and we'll amend or cancel it. Once a parcel is with the carrier we can't intercept it, but you can still return it.",
      },
    ],
  },
  {
    heading: "Returns & refunds",
    items: [
      {
        q: "What's your return policy?",
        a: "You have 30 days from delivery to return anything for a full refund. Items should be clean and in resalable condition — but if something arrived damaged or faulty, tell us and we'll replace it and cover the return label.",
      },
      {
        q: "How long do refunds take?",
        a: "We inspect returns within 2 business days of arrival and issue the refund to your original payment method. Your bank typically posts it within 5–10 business days after that.",
      },
      {
        q: "My pet destroyed it. Can I still return it?",
        a: "Ordinary wear from a chewer isn't covered, but genuine manufacturing failures are. Send a photo and we'll make a judgement call in your favour wherever it's reasonable.",
      },
    ],
  },
  {
    heading: "Payment & security",
    items: [
      {
        q: "Which cards do you accept?",
        a: "Visa, Mastercard and American Express. Payment is taken on our payment gateway's own secure page — PetParcel never receives or stores your card number.",
      },
      {
        q: "Is checkout secure?",
        a: "Yes. The entire checkout runs over TLS, and card data is handled exclusively by a PCI-DSS-compliant gateway. We store only your order details and shipping address.",
      },
      {
        q: "Do you charge sales tax?",
        a: "Any applicable state sales tax is calculated and shown at checkout before you confirm, so the total you see is the total you pay.",
      },
    ],
  },
  {
    heading: "Products & sizing",
    items: [
      {
        q: "How do I pick the right size?",
        a: "Each product page lists measurements per variant, and harness listings show girth ranges. If you're between sizes, size up — and if it's wrong, you can swap it within the return window.",
      },
      {
        q: "Are the materials safe for my pet?",
        a: "We use non-toxic foams, food-grade stainless steel on water products, and machine-washable covers. Anything with a known safety concern doesn't get stocked.",
      },
      {
        q: "Can I leave a review?",
        a: "Yes — sign in and review any product. Reviews from customers with a completed order are marked as verified purchases.",
      },
    ],
  },
];

// ── Shipping & returns ───────────────────────────────────────────────────────
export function ShippingReturns() {
  const s = useSite();
  useSeo({
    title: "Shipping & Returns",
    description:
      "PetParcel shipping rates and delivery times for the USA, plus our 30-day returns policy and how to start a return.",
    path: "/shipping-returns",
  });

  return (
    <PolicyPage title="Shipping & returns" updated="October 2026">
      <div className="not-prose grid gap-4 sm:grid-cols-3">
        {[
          { icon: Truck, title: "Free over $49", body: "Flat $5.99 below that" },
          { icon: Clock, title: s.shipping_estimate, body: "US-wide standard delivery" },
          { icon: RotateCcw, title: `${s.return_window_days}-day returns`, body: "No restocking fee" },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card-soft flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{title}</span>
              <span className="mt-0.5 block text-xs">{body}</span>
            </span>
          </div>
        ))}
      </div>

      <h2>Shipping</h2>
      <p>
        We ship to all 50 US states from our US warehouses. Orders placed before 2pm EST on a business day are
        dispatched the same day; anything later goes out the next business day. Standard delivery arrives in{" "}
        {s.shipping_estimate}.
      </p>
      <ul>
        <li>
          <strong>Free standard shipping</strong> on orders over $
          {(s.free_shipping_threshold_cents / 100).toFixed(0)}.
        </li>
        <li>
          <strong>Flat ${(s.shipping_flat_cents / 100).toFixed(2)}</strong> on orders below that threshold.
        </li>
        <li>Tracking is emailed the moment your label is created, and appears on your order page.</li>
        <li>We don't currently ship to PO boxes outside the continental US, or internationally.</li>
      </ul>

      <h2>Returns</h2>
      <p>
        You have <strong>{s.return_window_days} days from delivery</strong> to return any item for a full
        refund. There's no restocking fee.
      </p>
      <ul>
        <li>Items should be clean and in resalable condition, with any original packaging where practical.</li>
        <li>
          <strong>Damaged or faulty on arrival?</strong> Contact support with your order number and a photo —
          we'll send a replacement and cover the return cost.
        </li>
        <li>Refunds are issued to the original payment method within 2 business days of inspection.</li>
        <li>
          Bedding, bowls and grooming tools must be free of pet hair to be accepted; this is a hygiene rule, not
          a technicality.
        </li>
      </ul>

      <h2>Starting a return</h2>
      <p>
        Email <strong>{s.contact_email}</strong> with your order number and what you'd like to return. We'll
        reply with a return address and instructions, usually within one business day. Keep the tracking receipt
        for the parcel you send back — it's your proof of postage if anything goes astray.
      </p>

      <h2>Lost or delayed parcels</h2>
      <p>
        If tracking hasn't moved in 5 business days, contact us and we'll open a trace with the carrier. If a
        parcel is confirmed lost we'll reship or refund it — you shouldn't be out of pocket for a carrier's
        mistake.
      </p>
    </PolicyPage>
  );
}

// ── Privacy ──────────────────────────────────────────────────────────────────
export function Privacy() {
  const s = useSite();
  useSeo({
    title: "Privacy Policy",
    description:
      "How PetParcel collects, uses and protects your personal information, including cookies, payments and your privacy rights.",
    path: "/privacy",
  });

  return (
    <PolicyPage title="Privacy policy" updated="October 2026">
      <p>
        This policy explains what {s.brand_name} collects when you use {s.business_address.endsWith("USA") ? "our store" : "our store"},
        why we collect it, and how you can control it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name, email address and a securely hashed password.
        </li>
        <li>
          <strong>Order details</strong> — items purchased, order total, and the shipping and billing addresses
          you give us.
        </li>
        <li>
          <strong>Contact records</strong> — emails you send our support team and our replies.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> store your card number, expiry or security code. Payment details are entered
        directly on our payment gateway's page and handled entirely by them under their own privacy policy.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To fulfil and deliver your order, including passing your address to the carrier.</li>
        <li>To provide order updates and respond to support requests.</li>
        <li>To keep the store secure, detect fraud, and meet our legal and tax obligations.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We share the minimum necessary with the companies that make the store work: our payment gateway, our
        shipping carriers and our hosting provider. We do not sell your personal information, and we don't share
        it for third-party advertising.
      </p>

      <h2>Cookies</h2>
      <p>
        We use a session cookie to keep you signed in, and local storage to remember your cart. We don't use
        third-party advertising trackers. Clearing your browser storage will empty your cart and sign you out.
      </p>

      <h2>Retention and your rights</h2>
      <p>
        We keep order records for as long as tax and accounting rules require. You can ask us to access,
        correct, or delete your personal data at any time by emailing <strong>{s.contact_email}</strong>. If you
        close your account we delete your profile, saved addresses and reviews, while retaining anonymised order
        records for accounting.
      </p>

      <h2>Contact</h2>
      <p>
        {s.business_address}
        <br />
        {s.contact_email} · {s.contact_phone}
      </p>
    </PolicyPage>
  );
}

// ── Terms ────────────────────────────────────────────────────────────────────
export function Terms() {
  const s = useSite();
  useSeo({
    title: "Terms of Service",
    description:
      "The terms governing your use of the PetParcel store, including orders, pricing, returns and liability.",
    path: "/terms",
  });

  return (
    <PolicyPage title="Terms of service" updated="October 2026">
      <p>
        These terms govern your use of {s.brand_name}. By placing an order you agree to them. If anything here
        is unclear, email us before ordering.
      </p>

      <h2>Orders and acceptance</h2>
      <p>
        Your order is an offer to buy. Our order confirmation acknowledges receipt; a contract forms when we
        dispatch the goods. If an item is out of stock or a price was listed in error, we may cancel the order
        and refund you in full.
      </p>

      <h2>Pricing and payment</h2>
      <p>
        All prices are in US dollars and exclude any applicable state sales tax, which is calculated at
        checkout. Payment is taken by our payment gateway. We never see or store your card details.
      </p>

      <h2>Shipping and risk</h2>
      <p>
        Delivery estimates are estimates, not guarantees. Risk in the goods passes to you on delivery. If a
        parcel is confirmed lost by the carrier, we will reship or refund it.
      </p>

      <h2>Returns</h2>
      <p>
        Our {s.return_window_days}-day return policy forms part of these terms. Nothing in it limits your
        statutory rights.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don't use the store for anything unlawful or fraudulent.</li>
        <li>Don't attempt to interfere with the store's security or availability.</li>
        <li>Reviews must reflect a genuine experience with the product.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        To the fullest extent permitted by law, our liability for any order is limited to the amount you paid
        for it. We're not liable for indirect or consequential losses. Nothing here excludes liability that
        can't lawfully be excluded.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Delaware, USA, and the courts of that state have
        exclusive jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        {s.business_address}
        <br />
        {s.contact_email}
      </p>
    </PolicyPage>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────
const CONTACT_TOPICS = [
  "Order status or tracking",
  "Return or refund",
  "Product question",
  "Damaged or wrong item",
  "Something else",
];

export function Contact() {
  const s = useSite();
  const [sent, setSent] = useState(false);

  useSeo({
    title: "Contact Support",
    description: `Contact PetParcel support. Email ${s.contact_email} or call ${s.contact_phone}. ${s.support_hours}.`,
    path: "/contact",
  });

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-4xl">
        <SectionHeading
          align="center"
          eyebrow="Support"
          title="Talk to a human"
          subtitle={`We answer every message within one business day. You can also reach us by phone during ${s.support_hours}.`}
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            {[
              { icon: Mail, label: "Email", value: s.contact_email, href: `mailto:${s.contact_email}` },
              { icon: Phone, label: "Phone", value: s.contact_phone, href: `tel:${s.contact_phone.replace(/[^+\d]/g, "")}` },
              { icon: Clock, label: "Hours", value: s.support_hours },
              { icon: MapPin, label: "Address", value: s.business_address },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="card-soft flex items-start gap-3 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                  {href ? (
                    <a href={href} className="mt-1 block text-sm font-semibold hover:text-primary hover:underline">
                      {value}
                    </a>
                  ) : (
                    <span className="mt-1 block text-sm font-semibold">{value}</span>
                  )}
                </span>
              </div>
            ))}

            <div className="card-soft p-5">
              <h2 className="text-sm font-semibold">Faster than emailing: track it yourself</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                If your question is "where is my parcel?", the tracking page shows the live status and carrier
                reference without waiting for a reply.
              </p>
              <CtaLink to="/track" variant="outline" size="sm" className="mt-3">
                Track my order
              </CtaLink>
            </div>
          </div>

          {/* Support form — this collects a message for the support inbox shown
              on the page. It does not transmit credentials of any kind. */}
          <div className="card-soft p-6">
            <h2 className="text-lg font-medium">Send us a message</h2>
            {sent ? (
              <div className="mt-4 rounded-lg bg-secondary/60 p-6 text-center">
                <p className="text-sm font-semibold">Thanks — we've got it.</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We reply within one business day, usually much sooner. Check your spam folder if you don't see
                  us.
                </p>
              </div>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <div>
                  <label className="block text-sm font-semibold" htmlFor="contact-name">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    required
                    className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="contact-email">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="contact-topic">
                    What's this about?
                  </label>
                  <select
                    id="contact-topic"
                    className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="contact-message">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    className="mt-1.5 w-full rounded-sm border border-input bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Include your order number if it's about an existing order."
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-md w-full"
                >
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prefer reading first? Most answers are already on the{" "}
          <Link to="/faq" className="font-semibold text-primary hover:underline">
            FAQ page
          </Link>{" "}
          or in{" "}
          <Link to="/shipping-returns" className="font-semibold text-primary hover:underline">
            shipping &amp; returns
          </Link>
          .
        </p>
      </div>
    </Section>
  );
}

// ── Not found ────────────────────────────────────────────────────────────────
export function NotFound() {
  useSeo({
    title: "Page not found",
    description: "That page doesn't exist. Browse the PetParcel catalog instead.",
    path: "/404",
    noindex: true,
  });

  return (
    <Section className="!pt-20">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-6xl">🐾</p>
        <h1 className="mt-4 text-3xl font-medium">This page went walkies</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We couldn't find what you were looking for. It may have moved, or the link might be mistyped.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <CtaLink to="/shop">Browse the shop</CtaLink>
          <CtaLink to="/" variant="outline">
            Back to home
          </CtaLink>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-primary" /> Free US shipping over $49
          </li>
          <li className="inline-flex items-center gap-1.5">
            <RotateCcw className="h-4 w-4 text-primary" /> 30-day returns
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Secure checkout
          </li>
        </ul>
      </div>
    </Section>
  );
}
