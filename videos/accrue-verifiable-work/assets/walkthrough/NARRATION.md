# Narration

## 01-create-agreement

I’m creating an API agreement. I set the expected response, five AUSD reward, worker, three reviewers, and a two-vote threshold.

## 02-accept-and-fund

I switch to the worker account to accept the locked terms. Back as payer, I fund five AUSD for the worker and separate fees for reviewers.

## 03-submit-evidence

As worker, I submit a public GitHub commit and deployment URL. Accrue records a hash of this evidence on chain.

## 04-run-jev

Now I run verification. Accrue checks the commit and live endpoint, then asks Jev to assess the report. Jev scores the requirements at ninety-four percent, but estimates fourteen percent need for human review. That crosses our ten percent limit, so Jev abstains.

## 05-review-and-settle

I switch to a named reviewer, read the evidence, write a reason, and cast a pass vote with that passkey. A second independent reviewer signs a matching vote. Two of three reaches the threshold, and the contract marks the reward payable. The payer never has to manually release these funds.

## 06-withdraw

Finally, I return to the worker account and withdraw five AUSD. This is a real testnet settlement; the evidence and reviewer votes remain recorded on chain.
