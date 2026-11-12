# PayeeGuard demo: voiceover script

Target: one video under 3:00, no on-screen captions (YouTube supplies subtitles from the .srt). Each line is one text-to-speech sentence group.
Pronunciation (the SRT keeps the normal spelling): PayeeGuard = "Pay-ee guard". AI = "A I". NVIDIA = "en-vid-ee-uh". AG Grid = "A G Grid". APIMatic = "A P I Matic".

## Scene 0: the problem (over the landing page)
- [0.1] Imagine you sell on a marketplace, and your earnings are paid to your PayPal account.
- [0.2] One day someone takes over your marketplace login. They don't touch your money. They just change where your future earnings go.
- [0.3] A PayPal login proves that someone controls an account. It doesn't prove that the account is entitled to your earnings.
- [0.5] PayeeGuard closes it. Rules decide, AI recommends, and a person approves.

## Scene 1: a genuine seller (title card: "Case 1: a genuine seller")
- [1.0] Meet a genuine seller. They are starting a new business, or they lost access to the old PayPal account, and they want their earnings paid to a new one.
- [1.1] They sign in and chat with Guardy, a helper powered by an NVIDIA model, about why.
- [1.2] The seller explains, and Guardy offers to fill the request in. Nothing is sent until the seller says yes.
- [1.3] The seller says yes, and the request fills in. Then they submit it.
- [1.4] They prove both PayPal accounts by logging in on PayPal's sandbox: the new one first, then the current one.
- [1.5] While the change waits, new sales still go to the current account.
- [1.6] The care team opens the case. An AI recommendation is already waiting. It read the case and checked PayPal.
- [1.7] Approval waits for the marketplace's own evidence.
- [1.8] Once it does, care approves, and after a safety wait the new account starts getting paid.
- [1.9] A clean change can also take a fast lane, where manual review is skipped. The safety wait still runs.

## Scene 3: a fraud attempt (title card: "Case 2: a stolen login")
- [3.1] Now a stolen login. The fraudster even uses the same name on the new PayPal account.
- [3.2] But the account that logs in as the current one isn't the seller's.
- [3.3] The AI summary lists what the backend found: a different account, a new device, and a fresh password reset. Approval is blocked.
- [3.4] The care team rejects it, and every payout still goes to the real account.

## Scene 4: dashboards and the Postman run
- [4.1] Both sides have dashboards, built with AG Grid and AG Studio.
- [4.2] The care team sees risk flags and change requests over time.
- [4.3] The AG Studio AI Assistant button opens a chat. Type what you want in plain words, and a custom chart appears.
- [4.4] The seller sees income over past days, and can ask for just the last two days.
- [4.6] The API is documented right in the app: the case schema, and every endpoint.
- [4.7] A Postman run checks all of it: forty-six requests and sixty-two checks, without failures.

## Scene 5: outro
- [5.1] Built on PayPal's sandbox, with an NVIDIA model, AG Grid, AG Studio and Postman.
- [5.2] The APIMatic plugin helped us review our PayPal client.
- [5.3] Marketplace signals and trend charts are simulated. The AI recommends, and the rules and a person decide.
