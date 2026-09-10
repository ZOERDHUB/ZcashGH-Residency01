# Private Bill — Quest 03

## Build Recipient Bank Details Form

Quest 03 extends Private Bill with a recipient bank-details stage after the NGN/GHS amount and live ZEC quote are known.

### Included
- Nigeria and Ghana recipient country/currency flow
- Searchable bank selector with curated demo data for both markets
- Normalized bank model including bank code
- Account number and account-name validation
- Selected bank code retained in transaction state for the next stage
- Review screen with masked account number
- State is kept in React memory only; no localStorage and no sensitive console logging
- Live ZEC conversion from Quest 02 is preserved
- Responsive, keyboard-friendly interaction patterns

### Production API architecture
The UI is intentionally separated from the bank provider. `BankProvider` exposes `listBanks(country)` and `ApiBankProvider` expects a backend endpoint such as `/api/banks?country=NG|GH`.

A backend adapter can call Paystack or Flutterwave and normalize the response to the local `Bank` type. **Never expose a Paystack/Flutterwave secret key in the browser.**

The included `DemoBankProvider` makes the quest fully previewable without credentials or a live payment account. Replace it with `ApiBankProvider` when the project has a secure backend/serverless endpoint.

### Scope / security
This quest does not initiate bank transfers, ZEC transactions, account resolution, or custody. No API credentials, private keys, seed phrases, or real funds are used.

### Financial provider coverage

The Quest 03 demo directory now covers three recipient destination categories for Nigeria and Ghana:

- Traditional banks
- Fintech / digital banking providers such as OPay, PalmPay, Moniepoint, Kuda and Carbon in Nigeria
- Mobile-money / wallet providers such as MTN MoMo, Telecel Cash, AT Money, G-Money and Zeepay in Ghana, plus additional fintech coverage

These are demo directory entries, not claims that every provider is supported by the eventual transfer/verification rail. A production implementation should source the live provider directory from a server-side payment provider and normalize its response into the `Bank` type. Provider credentials must remain server-side.


## Quest 04 — Build Transaction Review

This stage gives the user a final review of the Private Bill transaction before an order is created. The review displays the recipient fiat amount, required ZEC, live exchange-rate information, destination provider, masked account number, account name, country/currency, and the fee status available in the current application.

The user can return to the recipient-details step and correct information before using the **Confirm & continue** action. This quest does not create an order, initiate a bank transfer, or submit a ZEC transaction.
