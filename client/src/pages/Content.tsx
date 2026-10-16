// Content pages: About, FAQ, Shipping & returns, Privacy, Terms, Contact.
// Kept in one module because they are all static marketing/policy copy for the
// same store, tuned for a US audience.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Clock, Home, Mail, MapPin, Phone, Truck, RotateCcw, ShieldCheck, ShoppingBag, Plus } from "lucide-react";
import { useSeo } from "@/lib/petparcel";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { safeErrorMessage } from "@/lib/errors";
import { Section, SectionHeading, PolicyPage, CtaLink } from "@/components/site/Bits";
import { Turnstile } from "@/components/site/Turnstile";
import { useSite } from "@/components/site/Layout";
import { CONTACT_TOPICS } from "@shared/signup-validation";
import { cleanAddress } from "@shared/store";

// ── About ────────────────────────────────────────────────────────────────────
export function About() {
  useSeo({
    title: "About Us",
    description:
      "PetParcel is a US pet-supplies store built on a simple idea: everything a pet owner needs, from food and beds to toys and grooming, shipped fast and backed by real support.",
    path: "/about",
  });

  return (
    <>
      <Section className="!pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">About PetParcel</p>
          <h1 className="mt-3 text-3xl font-medium sm:text-4xl">
            Every pet, every aisle, one store
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            PetParcel exists because shopping for a pet online is exhausting. Thousands of near-identical
            listings, unclear sizing, and a coin-flip on whether anything will survive a week with a determined
            chewer. So we built one store that carries the whole range - food and treats, beds and crates,
            harnesses, toys, grooming and more - and we stand behind every item in it.
          </p>
        </div>
      </Section>

      <Section muted className="!py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { stat: "Dogs, cats & more", label: "Food, beds, toys, grooming and more" },
            { stat: "30 days", label: "To change your mind, no restocking fee" },
            { stat: "US shipping", label: "A flat rate, shown up front at checkout" },
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
            We stock a small, deliberately chosen range rather than thousands of near-identical listings. If
            something does not hold up in everyday use, it does not stay on the site. That's the whole filter.
          </p>
          <p>
            We keep the range tight and the listings honest, so you can find the right size the first time -
            which matters when a harness has just snapped.
          </p>

          <h2 className="text-xl font-semibold text-foreground">How we treat customers</h2>
          <p>
            A flat $6.99 shipping rate and a 30-day return window on everything. Returns are free - we
            provide the prepaid label, so there's no return shipping cost to you. If something arrives
            damaged, we replace it and cover the label. Support is answered by humans in Dallas, Texas -
            not a chatbot.
          </p>
          <p>
            We would rather answer every email properly than grow past the point where we can. That is the
            promise behind every order, whatever is in it.
          </p>
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-medium">Questions before you buy?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We answer every message in the order it arrives, by a person - usually the same day.
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
      "Answers about PetParcel shipping, returns, payment methods, order tracking and product sizing.",
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
          subtitle="Everything about ordering, shipping, returns and payment. If your question isn't here, email us - a human replies."
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
        a: "We dispatch fast and don't publish a delivery window we can't guarantee - carrier transit varies by address and season. We ship with the best carrier available for your ZIP code and email a tracking number the moment the label is created, so you can follow the parcel the whole way.",
      },
      {
        q: "How much is shipping?",
        a: "A flat $6.99 on every US order - no handling fees and no surprise charges. The exact amount appears in your order summary before you confirm.",
      },
      {
        q: "Do you ship outside the US?",
        a: "Not yet - we currently ship to US addresses only. Keeping delivery inside the US is what lets us dispatch quickly and keep returns simple.",
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
        a: "You have 30 days from delivery to return an item for a refund, whether it arrived defective or you simply changed your mind - and we accept exchanges too. Items must be new and unused, with any original packaging and tags where practical, and kept free of pet hair. What you send back is final sale; if you want the same product in another size or colour, place the exchange and we'll refund the original once it arrives. Returns are free - we email you a prepaid return label (it's also included in the package), so there's no return shipping cost to you. There is no restocking fee, and we process the refund within 10 business days of receiving the return.",
      },
      {
        q: "How long do refunds take?",
        a: "We inspect each return as it arrives, then process the refund to your original payment method within 10 business days. Your bank may take its own few days to post it after that - that part is outside our control.",
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
        a: "Visa, Mastercard, American Express, Discover, JCB and Diners Club. Payment is taken on our payment gateway's own secure page - PetParcel never receives or stores your card number.",
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
        a: "Each product page lists measurements per variant, and harness listings show girth ranges. If you're between sizes, size up - and if it's wrong, you can swap it within the return window.",
      },
      {
        q: "Are the materials safe for my pet?",
        a: "We use non-toxic foams, food-grade stainless steel on water products, and machine-washable covers. Anything with a known safety concern doesn't get stocked.",
      },
      {
        q: "Can I leave a review?",
        a: "Yes - once you have received an order, sign in and review any product you bought. Reviews are checked before they go live, and every one from a completed order is marked as a verified purchase.",
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
      "PetParcel's flat US shipping rate, 30-day returns policy, and how to start a return.",
    path: "/shipping-returns",
  });

  return (
    <PolicyPage title="Shipping & returns" updated="October 2026">
      <div className="not-prose grid gap-4 sm:grid-cols-3">
        {[
          { icon: Truck, title: "Fast, tracked shipping", body: "Tracked from our door to yours" },
          { icon: Clock, title: "Dispatched fast", body: "Sent with the best carrier available for your address" },
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

      {/* The Merchant Center "Returns policy" form is filled in field by field
          and an automated reviewer compares each answer here against it, so every
          value lives in ONE place, in the exact words the form asks for, before
          the detail below explains it. Keep the two in step: changing a value
          here means changing it in the Returns section too. */}
      <h2>Returns policy at a glance</h2>
      <table className="spec-table not-prose">
        <tbody>
          {[
            { label: "Returns accepted", value: "Yes - for defective and non-defective products" },
            { label: "Exchanges", value: "Yes - we accept exchanges" },
            { label: "Return window", value: `${s.return_window_days} days from delivery` },
            { label: "Item condition", value: "New and unused only, in original packaging" },
            {
              label: "How to return",
              value:
                "By mail, using the prepaid label we email you (the label is also included in the package)",
            },
            { label: "Return label", value: "Free - we provide the label, no shipping cost" },
            { label: "Restocking fee", value: "None. You get a full refund of the item price" },
            {
              label: "Refund processing",
              value: "Within 10 business days of us receiving the return",
            },
            { label: "Refund method", value: "Original payment method" },
          ].map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Shipping</h2>
      <p>
        We ship to all 50 US states. Orders are dispatched fast - as soon as the same
        day wherever we can - using the best carrier available for your address, and every parcel is tracked
        the whole way. We deliberately don't publish a delivery window: carrier transit varies by address and
        season, and we'd rather not promise something we don't control.
      </p>
      <ul>
        <li>
          <strong>Flat ${(s.shipping_flat_cents / 100).toFixed(2)} shipping</strong> on every order - no
          handling fees, no surprise charges.
        </li>
        <li>Tracking is emailed the moment your label is created, and appears on your order page.</li>
        <li>We don't currently ship to PO boxes outside the continental US, or internationally.</li>
      </ul>

      <h2>Returns</h2>
      <p>
        You have <strong>{s.return_window_days} days from delivery</strong> to return anything for a refund,
        whether it arrived <strong>defective or faulty</strong> or you <strong>changed your mind</strong> -
        both are accepted. There's <strong>no restocking fee</strong>, so you get a full refund of the item
        price.
      </p>
      <ul>
        <li>
          <strong>New and unused only.</strong> The item must come back in the condition you received it -
          unworn, unwashed and unused, with its original packaging, tags and accessories where practical.
        </li>
        <li>
          <strong>Exchanges are welcome.</strong> Want the same product in a different size or colour? Email
          support within the 30-day window and we'll process the exchange. We send the fresh item once the
          original is on its way back; what you receive in exchange is a final sale, so it can't be returned
          again.
        </li>
        <li>
          <strong>Damaged or faulty on arrival?</strong> Contact support with your order number and a photo -
          we'll send a replacement and cover the return cost.
        </li>
        <li>
          <strong>Returns are free.</strong> We provide the return label - it's included in the package and
          there's no charge for it, and no return shipping cost to you.
        </li>
        <li>
          <strong>Refunds are processed within 10 business days</strong> of the return reaching us, back to
          your original payment method. Your bank may then take a few extra days to post it to your statement.
        </li>
        <li>
          Bedding, bowls and grooming tools must be free of pet hair to be accepted; this is a hygiene rule, not
          a technicality.
        </li>
      </ul>

      <h2>Starting a return</h2>
      <p>
        Email <strong>{s.contact_email}</strong> with your order number and whether you'd like a refund or an
        exchange. We'll reply with your prepaid return label, the return address and instructions, usually the
        same day - the label is free, and it's also included in the package with your order. Send the item back
        by mail and keep the tracking receipt for the parcel you send back, because it's your proof of postage
        if anything goes astray.
      </p>
      <p>
        Once the return arrives we inspect it and process your refund within <strong>10 business days</strong>.
        If you're local, email us before posting anything back and we'll tell you whether you can hand the item
        in to us in person - we're an online store, so mail is the return method we offer everywhere in the US.
      </p>

      <h2>Lost or delayed parcels</h2>
      <p>
        If tracking hasn't moved in 15 business days, contact us and we'll open a trace with the carrier. If a
        parcel is confirmed lost we'll reship or refund it - you shouldn't be out of pocket for a carrier's
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
        This policy explains what {s.brand_name} collects when you use our store, why we collect it, and how you
        can control it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> - your name, email address and a securely hashed password.
        </li>
        <li>
          <strong>Order details</strong> - items purchased, order total, and the shipping and billing addresses
          you give us.
        </li>
        <li>
          <strong>Contact records</strong> - emails you send our support team and our replies.
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
        <span className="whitespace-nowrap">{cleanAddress(s.business_address)}</span>
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
        Any delivery indication we give is an estimate, never a guarantee. Risk in the goods passes to you on delivery. If a
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
        <span className="whitespace-nowrap">{cleanAddress(s.business_address)}</span>
        <br />
        {s.contact_email}
      </p>
    </PolicyPage>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────
export function Contact() {
  const s = useSite();
  const { user, isLoading: authLoading } = useAuth();
  const [sent, setSent] = useState(false);
  // Controlled fields so the payload is exactly what the shopper typed, and the
  // server re-validates + sanitises every one of them regardless.
  const [form, setForm] = useState<{ name: string; email: string; topic: string; message: string }>({
    name: "",
    email: "",
    topic: CONTACT_TOPICS[0],
    message: "",
  });
  // Prefill from the signed-in account once it resolves, without clobbering
  // anything the shopper has already typed.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.name || "",
      email: f.email || user.email || "",
    }));
  }, [user]);
  // Cloudflare Turnstile token (empty until solved, and empty when no site key
  // is configured - the server check is a no-op in that case too).
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const submit = trpc.contact.submit.useMutation({
    onSuccess: () => setSent(true),
    onError: () => {
      // A Turnstile token is single-use: refresh the challenge so a retry is not
      // rejected for reusing a spent token.
      setTurnstileToken("");
      setTurnstileReset((n) => n + 1);
    },
  });

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
          subtitle={`We answer every message in the order it arrives, usually the same day. You can also reach us by phone during ${s.support_hours}.`}
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            {[
              { icon: Mail, label: "Email", value: s.contact_email, href: `mailto:${s.contact_email}` },
              { icon: Phone, label: "Phone", value: s.contact_phone, href: `tel:${s.contact_phone.replace(/[^+\d]/g, "")}` },
              { icon: Clock, label: "Hours", value: s.support_hours },
              { icon: MapPin, label: "Address", value: cleanAddress(s.business_address) },
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
                    <span className="mt-1 block whitespace-nowrap text-sm font-semibold">{value}</span>
                  )}
                </span>
              </div>
            ))}

            <div className="card-soft p-5">
              <h2 className="text-sm font-semibold">Track it yourself in a few seconds</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                If your question is "where is my parcel?", the tracking page shows the live status and the carrier
                reference, so you do not have to wait on a reply.
              </p>
              <CtaLink to="/track" variant="outline" size="sm" className="mt-3">
                Track my order
              </CtaLink>
            </div>
          </div>

          {/* Support form - this collects a message for the support inbox shown
              on the page. It does not transmit credentials of any kind. */}
          <div className="card-soft p-6">
            <h2 className="text-lg font-medium">Send us a message</h2>
            {authLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Checking your session…</p>
            ) : !user ? (
              // The form requires a session (the server enforces it too), so a
              // signed-out visitor is asked to sign in and returned here after.
              <div className="mt-4 rounded-lg bg-secondary/60 p-6 text-center">
                <p className="text-sm font-semibold">Sign in to send us a message</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We ask you to sign in so your message is linked to your account and we can reply faster. It
                  takes a few seconds.
                </p>
                <CtaLink to={`/login?next=${encodeURIComponent("/contact")}`} variant="primary" className="mt-4">
                  Sign in
                </CtaLink>
              </div>
            ) : sent ? (
              <div className="mt-4 rounded-lg bg-secondary/60 p-6 text-center">
                <p className="text-sm font-semibold">Thanks - we've got it.</p>
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
                  submit.mutate({
                    name: form.name,
                    email: form.email,
                    topic: form.topic,
                    message: form.message,
                    turnstileToken,
                  });
                }}
              >
                <div>
                  <label className="block text-sm font-semibold" htmlFor="contact-name">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="contact-topic">
                    What's this about?
                  </label>
                  <select
                    id="contact-topic"
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
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
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="mt-1.5 w-full rounded-sm border border-input bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Include your order number if it's about an existing order."
                  />
                </div>
                {submit.isError && (
                  <p role="alert" className="rounded-sm bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                    {safeErrorMessage(submit.error, "We couldn't send your message. Please try again in a moment.")}
                  </p>
                )}
                <Turnstile onToken={setTurnstileToken} resetKey={turnstileReset} />
                <button
                  type="submit"
                  disabled={submit.isPending}
                  className="btn btn-primary btn-md w-full"
                >
                  {submit.isPending ? "Sending…" : "Send message"}
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
          <CtaLink to="/shop" size="lg">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Browse the shop
          </CtaLink>
          <CtaLink to="/" variant="outline" size="lg">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </CtaLink>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-primary" /> Fast, tracked shipping
          </li>
          <li className="inline-flex items-center gap-1.5">
            <RotateCcw className="h-4 w-4 text-primary" /> 30-day returns
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Support Mon-Fri
          </li>
        </ul>
      </div>
    </Section>
  );
}
