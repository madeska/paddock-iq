# Direct F1 browser transfer

Sign in to Paddock IQ with Google in the same browser first. On Team setup, replace the old bookmark with Send team to Paddock IQ. Open the official F1 Fantasy My Team and run that bookmark. A Paddock IQ tab opens, receives the sanitized lineup, and runs the existing authenticated preview. Review it and press Save all teams. This is a user-initiated snapshot, not continuous F1 account synchronization.

The bookmark opens its destination synchronously before fetching to preserve user activation. Its destination comes only from the configured NEXTAUTH_URL, never the request Host or a query parameter. HTTPS is required except localhost/127.0.0.1 development. Private F1 requests remain same-origin with the F1 session; only whitelisted lineup fields leave that origin.

Transport uses postMessage with exact target origins, expected source windows and a fresh random channel nonce. The nonce alone is in the fragment; no lineup or credentials are placed in URLs, browser storage or a relay server. The receiver accepts one bounded payload and clears the fragment and opener. Both sides expire after 90 seconds and remove listeners. Server preview and save continue to require Google session ownership and existing export validation. Receiving a message never saves automatically.

Allow popups for F1. Expired Paddock sessions or cross-origin isolation may interrupt the opener connection: sign in and rerun the bookmark. File import remains in a collapsed fallback section with its own download bookmark. Existing old bookmarks still download files until replaced. No schema migration is needed.

Validation includes forged origin/source/nonce rejection, oversized payload rejection, replay/expiry and blocked-popup handling, existing import/auth tests, plus a headless Chrome integration test using isolated F1/Paddock fixture origins. The fixture test transfers sanitized data across real windows and verifies nonce cleanup/opener detachment. Live authenticated F1-to-Paddock transfer still needs the user's browser check.
