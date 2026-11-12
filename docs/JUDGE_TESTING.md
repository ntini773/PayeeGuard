# Testing instructions for judges

PayeeGuard needs logins, so this page says how to test it. **No password is in this repository.** The usernames, passwords and PayPal sandbox accounts are in the *Testing instructions* field of our Devpost submission (visible only to judges and Devpost).

## Which way do I test?

| If you are... | Use | What you need |
|---|---|---|
| Looking at the **hosted demo** (Render URL in the Devpost submission) | The logins and PayPal sandbox accounts from the Devpost field | Nothing else. Our server holds the keys. |
| Running it **locally** | Create your own app logins (steps below) and log in to PayPal with the **shared sandbox accounts** from the Devpost field | pixi, an NVIDIA key, your own PayPal sandbox app |
| Running it locally with **no accounts at all** | Demo mode (README, mode A): simulated PayPal and canned AI | Nothing |

> **Disclaimer.** The hosted demo uses PayPal's **sandbox** only. No real money moves and no real person's account is involved. The PayPal accounts are sandbox test accounts. Marketplace risk signals and the trend charts are simulated, and the app says so. Please do not enter real credentials anywhere.

## The PayPal accounts (names, not passwords)

| Name | Role in the app |
|---|---|
| **Account A** | The seller's **current (old)** payout account. The marketplace has A on file. |
| **Account B** | The seller's **new** payout account in the genuine case. Its PayPal name matches the seller's name on marketplace records. |
| **Account T** | A fraudster's **new** account in the compromised-credentials case. Its country does not match the seller's records. |

## Hosted demo: two cases to try

The second case models **compromised marketplace credentials**: someone has the seller's marketplace login and tries to point the earnings at their own, new PayPal account. The seller's PayPal accounts are not compromised.

**Genuine case** (sign in as `seller`)
1. Seller page: ask to change the payout account, or chat with Guardy and say yes.
2. Verify the new account: log in with PayPal as **B**. Verify the current account: log in as **A**.
3. Sign in as `operator` (the care team for this seller), open the case, read the AI proposal, record marketplace evidence, approve.

**Compromised-credentials case** (sign in as `seller_stolen`, and later `operator_stolen`)
1. Same request. New account: log in as **T** (the fraudster's own new account).
2. Current account: log in as **T again**. The fraudster does not have the seller's real account A, so any account that is not A is flagged as a different account. The app also flags T's country mismatch. (You can instead choose "I cannot access it" for a recovery review.)
3. Sign in as `operator_stolen` (each seller has its own care-team login, because a login can review only one seller). Approval is blocked. Reject it.

The `operator` login also opens the AG Studio dashboards. The seller login has its own dashboard.

## Local run: generate the four app logins yourself

You do not need our app passwords. The setup creates the same four logins on your machine with fresh random passwords. The PayPal sandbox accounts A, B and T are shared in the Devpost field.

```sh
pixi install
cd ui && npm ci && NODE_OPTIONS=--max-old-space-size=6144 npm run build && cd ..
cp .env.example .env        # fill NVIDIA_API_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (your own PayPal sandbox app)

# values from the Devpost field (Account A's payer ID, the seller name and country on file)
export JUDGE_ACTIVE_PAYER_ID=<from Devpost>
export JUDGE_SELLER_LEGAL_NAME="<from Devpost>"
export JUDGE_SELLER_COUNTRY=<from Devpost>

pixi run judge-setup        # creates seller, operator, seller_stolen, operator_stolen (prints CREATED)
cat .runtime/judge/judge-accounts.json   # the four generated passwords (private file, mode 0600)
pixi run judge-serve        # open http://127.0.0.1:8765
```

Your PayPal sandbox app needs *Log in with PayPal* enabled, the Profile and Address attributes, and the return URL `http://127.0.0.1:8765/api/v1/paypal/callback`. Then follow the two cases above with the shared PayPal accounts. Setup is safe to re-run: existing logins are never changed. To start over, delete `.runtime/judge` and run setup again.

| Login | Use |
|---|---|
| `seller` and `operator` | genuine case (PayPal Accounts B, then A) |
| `seller_stolen` and `operator_stolen` | compromised-credentials case (PayPal Account T) |

## For the team: how credentials stay frozen on Render

- `deploy/start.py` creates the database and the accounts **only if** `app-sandbox.sqlite3` does not exist on the persistent disk, using the `JUDGE_*` environment variables. It refuses to generate passwords.
- Later restarts and redeploys find the database and change nothing. To change a password on purpose, delete the database file on the disk and redeploy.
- Environment variables to set in Render: `RESCUE_PUBLIC_ORIGIN`, `NVIDIA_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `VITE_AG_STUDIO_LICENSE`, `JUDGE_SELLER_PASSWORD`, `JUDGE_OPERATOR_PASSWORD`, `JUDGE_ACTIVE_PAYER_ID`, `JUDGE_SELLER_LEGAL_NAME`, `JUDGE_SELLER_COUNTRY`.
- In the PayPal sandbox app, add the return URL `https://<your-service>.onrender.com/api/v1/paypal/callback`.
- The sandbox business account must hold funds, or payouts fail with `INSUFFICIENT_FUNDS`.
