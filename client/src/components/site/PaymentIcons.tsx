// Accepted payment marks for the footer, drawn as inline SVG.
//
// Deliberately dependency-free: an icon library would add an install and a
// supply-chain surface for four small marks. Each mark is built from the
// network's own brand colours and geometry rather than a traced copy of
// trademarked artwork.
//
// ONE SHARED TILE, ACCURATE MARKS. Every badge is the same 40x25 rounded
// tile: no fill, one hairline, one soft shadow. Inside it each mark keeps its
// own true proportions - nothing is stretched, squashed or cropped - and the
// marks are optically balanced against each other rather than forced into one
// bounding box, which is what made the old row look uneven.
//
// WHAT IS LISTED HERE IS WHAT THE STORE ACTUALLY ACCEPTS. PetParcel takes
// card payments in USD through Bachs' hosted checkout, so the marks are the US
// card networks that checkout accepts. Wallets, bank rails and crypto are
// intentionally NOT shown - they are not switched on for this account, and
// advertising a payment method the till cannot take is worse than a shorter
// row of logos.
import type { ReactNode } from "react";

/** One badge: the shared tile plus the mark. The `<title>` gives assistive tech
 *  the card network's name, so the row reads as "Visa, Mastercard, ..." instead
 *  of three anonymous images. */
function Mark({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      className="pay-badge"
      role="img"
      aria-label={label}
      viewBox="0 0 48 30"
      width="40"
      height="25"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <rect x="0.5" y="0.5" width="47" height="29" rx="6" className="pay-badge-tile" />
      {children}
    </svg>
  );
}

/** The "Secured by Bachs" trust badge. It renders a clean wordmark lockup (the
 *  vendor's own name plus its mark) rather than a redrawn lookalike, and links
 *  to the gateway so a shopper can check the claim. The caption above it is
 *  real text, so the badge still reads correctly with images off or to a screen
 *  reader. */
export function VerifiedByBachs() {
  return (
    <a
      className="pay-verified"
      href="https://bachs.io/"
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label="Secured by Bachs - card payments"
    >
      <span className="pay-verified-label">Secured by</span>
      <svg
        className="pay-verified-logo"
        role="img"
        aria-label="Bachs"
        viewBox="0 0 108 22"
        width={108}
        height={22}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Bachs</title>
        {/* The vendor's own mark: a rounded square holding a card, drawn in the
            brand's black. */}
        <rect x="0" y="1" width="20" height="20" rx="5" fill="#111111" />
        <rect x="4.5" y="6" width="11" height="7.5" rx="1.6" fill="#FCFBF7" />
        <rect x="4.5" y="8" width="11" height="2" fill="#111111" opacity="0.35" />
        <rect x="6" y="11.4" width="5" height="1.1" rx="0.55" fill="#111111" opacity="0.5" />
        {/* Wordmark: "BACHS", letterspaced caps, in the brand's black. */}
        <text
          x="27"
          y="16"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="12"
          fontWeight="700"
          letterSpacing="1.6"
          fill="#1B2430"
        >
          BACHS
        </text>
      </svg>
    </a>
  );
}

export function PaymentMark() {
  return (
    <>
      {/* Visa - the wordmark, in Visa's own navy, set in its italic. */}
      <Mark label="Visa">
        <text
          x="24"
          y="20"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="12"
          fontWeight="800"
          fontStyle="italic"
          letterSpacing="-0.4"
          fill="#1A1F71"
        >
          VISA
        </text>
      </Mark>

      {/* Mastercard - the network's own geometry: two overlapping discs in its
          two brand colours, with the intersection in the third. */}
      <Mark label="Mastercard">
        <circle cx="20.5" cy="15" r="8" fill="#EB001B" />
        <circle cx="27.5" cy="15" r="8" fill="#F79E1B" />
        <path
          d="M24 8.16a8 8 0 0 0 0 13.68 8 8 0 0 0 0-13.68Z"
          fill="#FF5F00"
        />
      </Mark>

      {/* American Express - the wordmark, in Amex's own blue. */}
      <Mark label="American Express">
        <text
          x="24"
          y="19.4"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="-0.2"
          fill="#006FBD"
        >
          AMEX
        </text>
      </Mark>
    </>
  );
}
