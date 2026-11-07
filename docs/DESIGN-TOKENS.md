# Studio AM Portal: Design Direction (interim)

Status: Interim, 7 Nov 2026. Based on the current Studio AM logo. Revisit when a full brand identity is developed.

## Source
Logo: `assets/studio-am-logo.png` (white "AM" monogram with rotated "STUDIO", on olive-gold).

## Core colour
| Token | Hex | Use |
|---|---|---|
| `--brand` | `#AEA114` | Logo background, hero panels, large accent surfaces, highlights |
| `--brand-deep` | `#6B6410` | Buttons, links, active states, anything with white text on it |
| `--ink` | `#1C1B12` | Body text, headings (warm near-black) |
| `--paper` | `#FAF9F4` | Page background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards |
| `--line` | `#E6E3D3` | Borders, dividers |
| `--muted` | `#6F6C5A` | Secondary text |

Status colours (approval states) should stay distinct from the brand colour: Draft (grey), Awaiting approval (amber), Changes requested (red-brown), Approved (green), Scheduled (blue-grey), Posted (deep olive).

## Accessibility note (important)
White text on `#AEA114` measures about 2.7:1 contrast, below the 4.5:1 needed for body text. So:
- Use `--brand` for large shapes and the logo only. The logo itself is large, bold white and acceptable.
- Put text on `--brand` only if it is `--ink` (about 6.6:1) or very large.
- Use `--brand-deep` (about 6:1 with white) for buttons and links.

## Typography direction
The logo is a high-contrast, thin-stroke, elegant geometric display style. To match:
- **Headings:** a refined display or high-contrast serif/sans with generous letter spacing (candidates to test: Fraunces, Cormorant, Playfair Display, or a light geometric sans).
- **Body and interface:** a clean, highly legible sans (candidates: Inter, DM Sans, Manrope).
- Final pairing chosen when the interface is built, by looking at it, not by guessing.

## Style principles
- Calm, editorial, premium. Generous whitespace, thin dividers, restrained shadows.
- The olive-gold is used sparingly so it feels deliberate.
- The "STUDIO AM" monogram appears small in the header and large on the login screen.
- Mobile first: clients will mostly open this on their phones.
- Avoid: gradients, generic dashboard chrome, decorative icons without a purpose.

## To confirm with Studio AM
- Is `#AEA114` the final brand colour, or a placeholder?
- Is there an existing font used with the logo?
- Is a dark mode wanted? (Not planned for v1.)
