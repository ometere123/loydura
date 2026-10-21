# Economics and accounting

## Membership

Each shop charges a fixed amount of its ERC-20 payment token for 30 days of access. On each purchase, 1% of the amount transfers to the immutable protocol fee recipient; 99% transfers atomically among the shop's immutable recipients. The final recipient receives rounding dust. A refund of a paid membership is not provided by these contracts; shops must communicate their terms.

## Commitment campaign

The creator transfers `netRewardPool + ceil(1% * netRewardPool)` USDC on creation. The pool is funded in full; the 1% platform fee is **additional**, not withheld from advertised rewards.

There is no interest-bearing investment and **no yield guarantee**. Net pool emits at `floor(netPool / durationSeconds)` units per second, with remainder unallocated. Locking closes at the start; no joins or stake increases after campaign begins. Each member may have only one position per campaign. Full early exit returns original principal and redistributes all unclaimed entitlement using an accumulator; when the last member leaves, unallocated balances return to the refundable pool. Claims are allowed only after campaign end.

The creator cannot reclaim unpaid survivor rewards. Before completion, creator refunds consist only of idle emission and stranded forfeitures; after all eligible participants have claimed, unspent rounding dust becomes refundable.

The repository includes an independent reference settlement model in `contracts/test/LoyduraReferenceModel.t.sol`. It fuzzes two-member early-exit sequences and checks that claims plus creator refunds never exceed the funded pool while locked principal remains recoverable. This is a model-based test, not an external audit or a guarantee against every hostile ERC-20 behavior.

Proof of lock completion is **not** user engagement, repeat purchase, next-day retention or token price support. The UI shows the honest on-chain lock and early-exit statistics, not imaginary human-user analytics.

## Candidate platform token

LOYD's 1B token supply and Ascend USDC pool were proposed in the contest plan, but this repository does not issue a token or imply that an Ascend launch has happened. Full supply/distribution/token economics belong in organizer-approved launch planning, outside this prototype.
