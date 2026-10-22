// Accepted payment marks for the footer, drawn as inline SVG.
//
// Deliberately dependency-free: an icon library would add an install and a
// supply-chain surface for six small marks. Each mark is built from the
// network's own brand colours and geometry (the Bitcoin ₿, the Ethereum
// diamond, the Tether ₮) rather than a traced copy of trademarked artwork.
//
// ONE SHARED TILE, SIX ACCURATE MARKS. Every badge is the same 40x25 rounded
// tile: no fill, one hairline, one soft shadow. Inside it each mark keeps its
// own true proportions - nothing is stretched, squashed or cropped - and the
// marks are optically balanced against each other rather than forced into one
// bounding box, which is what made the old row look uneven.
//
// WHAT IS LISTED HERE IS WHAT THE STORE ACTUALLY ACCEPTS. PetParcel takes
// crypto payments through NOWPayments, so the marks are the coins that gateway
// settles for physical goods. Card schemes and bank rails (Visa, Mastercard,
// PayPal, wire/ACH) are intentionally NOT shown - they are not switched on for
// this account, and advertising a payment method the till cannot take is worse
// than a shorter row of logos.
import type { ReactNode } from "react";

/** One badge: the shared tile plus the mark. The `<title>` gives assistive tech
 *  the coin name, so the row reads as "Bitcoin, Ethereum, ..." instead of six
 *  anonymous images. */
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

/** The "Secured by NOWPayments" trust badge. It renders a clean wordmark lockup
 *  (the vendor's own name plus a shield glyph) rather than a redrawn lookalike,
 *  and links to the gateway so a shopper can check the claim. The caption above
 *  it is real text, so the badge still reads correctly with images off or to a
 *  screen reader. */
export function VerifiedByNowPayments() {
  return (
    <a
      className="pay-verified"
      href="https://nowpayments.io/"
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label="Secured by NOWPayments - crypto payments"
    >
      <span className="pay-verified-label">Secured by</span>
      <svg
        className="pay-verified-logo"
        role="img"
        aria-label="NOWPayments"
        viewBox="0 0 132 22"
        width={132}
        height={22}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>NOWPayments</title>
        {/* Shield glyph in the brand blue, with a check inside. */}
        <path
          d="M11 1.6 3.4 4.5v5.1c0 4.3 3.1 8.2 7.6 9.3 4.5-1.1 7.6-5 7.6-9.3V4.5L11 1.6Z"
          fill="#0B4C8C"
        />
        <path
          d="M7.6 10.6 10 13l4.4-4.6"
          fill="none"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Wordmark: "NOW" in the brand blue, "Payments" in ink, so the lockup
            reads as one name rather than two words. */}
        <text
          x="24"
          y="16"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="800"
          letterSpacing="-0.2"
          fill="#0B4C8C"
        >
          NOW
        </text>
        <text
          x="55"
          y="16"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="600"
          letterSpacing="-0.2"
          fill="#1B2430"
        >
          Payments
        </text>
      </svg>
    </a>
  );
}

export function PaymentMark() {
  return (
    <>
      {/* Bitcoin - the orange disc with the ₿ glyph, the network's own mark. */}
      <Mark label="Bitcoin">
        <circle cx="24" cy="15" r="9.5" fill="#F7931A" />
        <text
          x="24"
          y="19.6"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
          fill="#fff"
        >
          ₿
        </text>
      </Mark>

      {/* Ethereum - the faceted diamond, drawn in the brand's two blues. */}
      <Mark label="Ethereum">
        <g transform="translate(24 15)">
          <path d="M0 -9.5 5.6 0 0 3.4 -5.6 0Z" fill="#8A92B2" />
          <path d="M0 -9.5 5.6 0 0 3.4Z" fill="#62688F" />
          <path d="M0 4.6 5.6 1.2 0 9.5 -5.6 1.2Z" fill="#62688F" />
          <path d="M0 4.6 5.6 1.2 0 9.5Z" fill="#454A75" />
        </g>
      </Mark>

      {/* Tether (USDT) - the green disc with the ₮ glyph. */}
      <Mark label="Tether USDT">
        <circle cx="24" cy="15" r="9.5" fill="#26A17B" />
        <text
          x="24"
          y="19.6"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
          fill="#fff"
        >
          ₮
        </text>
      </Mark>

      {/* USD Coin - the blue disc with the $ glyph. */}
      <Mark label="USD Coin">
        <circle cx="24" cy="15" r="9.5" fill="#2775CA" />
        <text
          x="24"
          y="19.6"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
          fill="#fff"
        >
          $
        </text>
      </Mark>

      {/* Litecoin - the steel-blue disc with the Ł glyph. */}
      <Mark label="Litecoin">
        <circle cx="24" cy="15" r="9.5" fill="#345D9D" />
        <text
          x="24"
          y="19.6"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
          fill="#fff"
        >
          Ł
        </text>
      </Mark>

      {/* Dogecoin - the gold disc with the Ð glyph. */}
      <Mark label="Dogecoin">
        <circle cx="24" cy="15" r="9.5" fill="#C2A633" />
        <text
          x="24"
          y="19.6"
          textAnchor="middle"
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
          fill="#fff"
        >
          Ð
        </text>
      </Mark>
    </>
  );
}
