# Testing instructions for judges

**The logins and PayPal sandbox accounts are not in this repository.** They are sent privately in the *Testing instructions* field of our Devpost submission (visible to judges only). Use them exactly as listed below.

> Everything here is **PayPal sandbox**. No real money moves and no real person's account is involved.

## Which way do you test?

| | What you need |
|---|---|
| **Hosted demo** (https://payeeguard.onrender.com) | The Devpost logins and PayPal accounts. Nothing to install. |
| **Local** | pixi, an NVIDIA key, your own PayPal sandbox app, and the Devpost PayPal accounts. Steps in section 4. |
| **No accounts at all** | Demo mode in the [README](../README.md) (simulated PayPal, canned AI). |

## 1. Accounts to use (from the Devpost field)

| Case | App logins | PayPal sandbox accounts |
|---|---|---|
| **Case 1: a genuine seller** | `seller`, then `operator` | **B** (new account), then **A** (current account) |
| **Case 2: compromised marketplace credentials** | `seller_stolen`, then `operator_stolen` | **T** (the fraudster's new account), twice |

Account **A** is the seller's current (old) account and is on file at the marketplace. **B** is the seller's new account. **T** is a fraudster's new account (Canada, with a different name from the seller's). In Case 2, someone has the seller's *marketplace* login and tries to send the earnings to T. The seller's PayPal accounts are not compromised. Each seller has its own care-team login because a login can review only one seller.

The first time PayPal sees B or T for this app it shows a consent page. Press **Agree and Connect**.

## 2. Case 1: a genuine seller

1. Open `/seller` and sign in as `seller`.
2. In "Reason for the change" type: `I opened a new PayPal account for my new business and want my earnings paid there.` Press **Submit request**. (Or use the Guardy chat: press "I opened a new PayPal account", then say yes.)
3. Press **Continue with PayPal** and log in as **Account B**.
4. Press **Continue with PayPal** again and log in as **Account A**.
5. Sign out. Open `/console` and sign in as `operator`. Open the case. The AI summary appears after about 30 seconds. It lists no backend flags.
6. Press **Approve change**. It is blocked: evidence is missing.
7. In "Marketplace evidence" type reference `order-history-1042` and reason `Fourteen months of sales on record. The records confirm this request.` Choose **The records confirm this request**, press **Record evidence**.
8. In "Operator rationale" type `Evidence confirms the seller and both PayPal accounts are verified.` Press **Approve change**. The case becomes Active.
9. Open the **Payouts** tab and press **Pay this earning** on `order-1001` (1.00 USD sandbox).

## 3. Case 2: compromised marketplace credentials

1. Open `/seller` and sign in as `seller_stolen`.
2. In "Reason for the change" type: `I need my payouts moved to my new PayPal account today.` Press **Submit request**.
3. Press **Continue with PayPal** and log in as **Account T**.
4. Press **Continue with PayPal** again and log in as **Account T** again. The fraudster does not have the real account A, so the app flags a different account. (Alternative: press **I cannot access it**, type `I forgot the old account login and lost my phone.`, press **Ask for a recovery review**.)
5. Sign out. Open `/console` and sign in as `operator_stolen`. Open the case. The red box **What the backend found** lists the flags: a different account (or the recovery request), new device, password reset, name mismatch and country mismatch.
6. Press **Approve change**. It is blocked.
7. In "Marketplace evidence" type reference `account-match-check` and reason `The login came from a new device after a password reset. The records do not confirm this request.` Choose **The records do not confirm it**, press **Record evidence**.
8. In "Operator rationale" type `A different PayPal account logged in as the current account, plus risk signals. Rejecting.` Press **Reject change**, then **Confirm Reject**. The case is Blocked, and payouts still go to Account A.

## 4. Local run

Everything, including the PayPal sandbox app's Client ID and Secret, is in the private file on Devpost. This is the generic version.

**Tools:** `git` and [pixi](https://pixi.sh). Pixi installs Python 3.11 **and Node 22 with npm**, so you do not install Node or npm yourself. Install pixi with `curl -fsSL https://pixi.sh/install.sh | bash` (Linux, macOS), `brew install pixi`, or on Windows `powershell -ExecutionPolicy ByPass -c "irm -useb https://pixi.sh/install.ps1 | iex"`.

**Keys:**
- **PayPal sandbox app Client ID and Secret:** in the Devpost field.
- **NVIDIA API key (free, one key for all AI):** go to [build.nvidia.com](https://build.nvidia.com), sign in, open a model page (for example `nvidia/nemotron-3.5-bolt-e4b`), press **Get API Key**, and copy the `nvapi-` key. See [`docs/MODELS.md`](MODELS.md).
- **AG Studio trial key (optional, free, 45 days):** request it at [ag-grid.com](https://www.ag-grid.com) and put it in `ui/.env.local` as `VITE_AG_STUDIO_LICENSE=<key>` before building the UI. Without it the dashboards may not render. The hosted demo has one.
- No ElevenLabs key is needed.

```sh
git clone https://github.com/ntini773/PayeeGuard.git && cd PayeeGuard
pixi install

cd ui
echo 'VITE_AG_STUDIO_LICENSE=<your key>' > .env.local        # optional
NODE_OPTIONS=--max-old-space-size=6144 pixi run npm ci
NODE_OPTIONS=--max-old-space-size=6144 pixi run npm run build
cd ..

cat > .env <<'EOF'
NVIDIA_API_KEY=<your nvapi- key>
PAYPAL_CLIENT_ID=<from the Devpost field>
PAYPAL_CLIENT_SECRET=<from the Devpost field>
RESCUE_PAYPAL_SCOPES="openid profile address https://uri.paypal.com/services/paypalattributes"
EOF

# three values from the Devpost field: Account A's payer ID, and the seller's name and country on file
export JUDGE_ACTIVE_PAYER_ID=<from Devpost>
export JUDGE_SELLER_LEGAL_NAME="<from Devpost>"
export JUDGE_SELLER_COUNTRY=<from Devpost>

pixi run judge-setup                       # creates the four logins with new random passwords
cat .runtime/judge/judge-accounts.json     # read the generated passwords
pixi run judge-serve                       # open http://127.0.0.1:8765
```

The PayPal sandbox app in the Devpost field already has the return URL `http://127.0.0.1:8765/api/v1/paypal/callback`. Then follow Cases 1 and 2 with the **generated** app passwords and the Devpost PayPal accounts. Setup never changes an existing login. To start over, delete `.runtime/judge` and run it again. With no keys at all, use demo mode in the [README](../README.md).

## For the team: how the hosted credentials stay frozen

- `deploy/start.py` creates the database and the four logins **only if** `app-sandbox.sqlite3` is missing from the Render disk, from the `JUDGE_*` variables. It never generates passwords. Restarts and redeploys change nothing. To change a password on purpose, delete the database on the disk and redeploy.
- Render variables: `RESCUE_PUBLIC_ORIGIN`, `NVIDIA_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `VITE_AG_STUDIO_LICENSE`, `JUDGE_SELLER_PASSWORD`, `JUDGE_OPERATOR_PASSWORD`, `JUDGE_ACTIVE_PAYER_ID`, `JUDGE_SELLER_LEGAL_NAME`, `JUDGE_SELLER_COUNTRY`.
- PayPal sandbox app: add the return URL `https://<service>.onrender.com/api/v1/paypal/callback`. The sandbox business account must hold funds.
