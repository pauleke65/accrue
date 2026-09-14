# Demo walkthrough

A shooting script for a three-minute recording, and a checklist for walking
the product end to end.

Everything here runs against Monad testnet with real transactions. Amounts are
test money; the mechanics are not simulated.

## Before you record

```sh
npm run build && npm run dev
```

1. **Sign in with your passkey.** One ceremony creates three accounts — payer,
   worker and verifier — at separate derivation paths from the same passkey.
   They have different addresses, so the contract treats them as three
   unrelated people. That is what lets one person demonstrate all three sides
   on one device without pretending a role switch is authorization.

2. **Read your three addresses.** Switch role in the top bar; each role's
   address shows on the Send screen.

3. **Fund them**, so nothing stalls on camera:

   ```sh
   node scripts/demo-seed.mjs --fund 0xPayer,0xWorker,0xVerifier
   ```

   Run without `--fund` as well if you want example jobs in the background at
   various stages. `--status` shows what is staged.

4. **Claim a tag per role** — `@amara` as payer, `@bola` as worker, `@ngozi`
   as verifier. Worth filming: it is one field and a passkey prompt.

5. **Check the fallbacks.** Connections should show what is live and what is
   not. If you have added an Envio token, history is complete; if not, the
   page says the list is only what the app recorded.

## The three-minute recording

**0:00 – 0:20 · The problem.** Amara is in London paying for a renovation in
Lagos. She wants evidence before releasing money; Bola wants to know the money
exists before he starts. Ngozi, a site engineer they both trust, checks the
work.

**0:20 – 0:40 · Getting in.** Open the app, sign in with the passkey. No seed
phrase, no extension, no email code. Point out the tag: `@amara` is how people
pay her, not a forty-character address.

**0:40 – 1:10 · Fund the job.** *Funded jobs → Fund a job.* Name the job, set
the scope, type `@bola` and `@ngozi` — the field resolves as you type and
shows who it found, which is the moment to catch a wrong name. Two milestones
with real acceptance criteria. Create, then fund.

Say what happened: the AUSD moved into the contract. Not to Accrue — to a
contract that will only release it on the agreed terms.

**1:10 – 1:40 · Do the work.** Switch to the worker. The job is there because
the worker is a party to it, not because the interface says so. Submit
evidence against the first milestone.

**1:40 – 2:10 · Verify, and get paid.** Switch to the verifier. Show the
criteria beside the evidence, then approve. Worker and verifier are credited
in the same transaction — if one is paid, both are. Withdraw as the worker;
the balance moves in about a second.

**2:10 – 2:30 · What cannot happen.** Back to the payer: the approved
milestone's money is gone from the reserve and cannot be pulled back. Expiry
returns only what was never earned. The guarantee is in the contract, not in a
promise from us.

**2:30 – 3:00 · Honesty.** Open Connections. Name what is live — passkey
accounts, AUSD, the escrow, sponsored fees — and what is not: no audit, no
bank payout, testnet only. Close on the product: fund the job, agree what
done means, get paid when the work is verified.

## Full feature checklist

Useful for a longer walkthrough, or for checking nothing has regressed.

| Feature | Where | What to show |
|---|---|---|
| Passkey sign-in | Top bar | One ceremony, three role accounts, no seed phrase |
| Stateless recovery | Any browser | Clear site data, sign in again, same accounts |
| Payment tag | Send | Claim `@name`, signed by the account it points at |
| Tag resolution | Send, Fund a job | Type a tag, see who it resolves to before committing |
| Direct payment | Send | Pay `@bola`, settles in about a second |
| Receipt | Send → Receipt | Amount, parties, date, network fee, reference |
| Payment ledger | Send | Status per payment, each checked against the chain |
| Sponsored fees | Send, with a new account | No MON needed; the first fee is covered |
| Test money | Send → Get test AUSD | Works on an account holding nothing |
| Fund a job | Funded jobs | Milestones, criteria, worker and verifier amounts |
| Acceptance | Funded jobs | Each party accepts the same terms before funding |
| Escrow funding | Funded jobs | Deposit moves into the contract |
| Evidence | Funded jobs, as worker | Submit against a milestone |
| Approval | Funded jobs, as verifier | Worker and verifier paid in one transaction |
| Withdrawal | Funded jobs | Beneficiary moves their own balance |
| Protected earnings | Funded jobs, as payer | Earned money is not in the reserve |
| Network switch | Top bar | Testnet active, mainnet locked and why |
| Disclosure | Connections | Live, simulated, and not built, with addresses |
| Sandbox | Sandbox | The full workflow with no money at all |

## What to say, and what not to

Say testnet. Say the contract is unaudited. Say the tag directory lives in
Accrue's database, so a tag stops resolving if the app goes away even though
the account behind it keeps working. Say that verification is a person's
judgement, not proof the work happened.

Do not call the sandbox a payment. Do not imply money reaches a bank. Do not
describe the activity record as a trust score — it is a history, and a history
can be manufactured by colluding parties.

The product is more convincing with the limits stated than without.
