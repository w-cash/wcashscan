# Wcash Wallet — UI/UX reference review

Reviewed 13 September 2026 by two research agents, with the site owner reviewing Wcash identity. Research included official websites, rendered wallet previews and documentation; wallets were not installed or transacted with.

## Reference findings and applied decisions

| Reference | Observed strength | Wcash decision |
| --- | --- | --- |
| [Vizor](https://vizor.cash/) and [downloads](https://vizor.cash/get) | Strong product presentation and explicit downloads for five platforms | Put readable wallet UI in the hero and provide an accessible five-platform chooser |
| [Zodl](https://zodl.com/) and [support](https://support.zodl.com/) | Clear balance, labeled actions, contextual privacy state, simple distribution flow | Prioritize balance, Send/Receive and shielded state; use as UX reference only |
| [Zingo](https://zingolabs.org/zingo/) and [downloads](https://zingolabs.org/zingo/download/) | Wallet foundation specified by the user; balance, privacy and memo workflows | Make the Zingo provenance explicit and align the demo with its wallet behavior |
| [Zkool](https://hhanh00.github.io/zkool2/) | Detailed wallet/account state, pool-aware balances and recovery education | Preserve privacy precision while keeping advanced terminology secondary |
| [Cake Wallet](https://cakewallet.com/install/) | Explicit mobile and desktop distribution choices | Make alternate platforms as discoverable as the selected one |
| [Unstoppable](https://unstoppable.money/) | Bold product-led hero, evidence-linked trust claims | Use an original prominent wallet preview; omit unverified audit claims |
| [Edge](https://edge.app/) | Familiar task language and recovery education | Use plain-language actions and practical ownership guidance |
| [Keystone](https://keyst.one/) | Tangible product imagery and verification resources | Use a restrained material brand image; do not imply hardware support |
| [Ledger](https://www.ledger.com/) | High-contrast typography and clear product hierarchy | Keep one primary wallet-download journey |
| [Trezor](https://trezor.io/) | Strong typography, restrained accent, generous spacing | Create a calm, substantial graphite and lime identity |
| [Brave Wallet](https://brave.com/wallet/) | Product screenshot, explicit platform caveats and setup FAQ | Explain privacy and platform assumptions clearly |
| [Zallet](https://github.com/zcash/zallet) | RPC/full-node operator wallet, currently documented as beta | Treat as operator context, not the consumer website UI base |

## Directories and scope

[ZecHub](https://zechub.wiki/using-zcash/wallets), [zcash.school](https://zcash.school/using/wallets/) and [z.cash ecosystem](https://z.cash/ecosystem) were checked as discovery sources. They differ in freshness and upgrade readiness. ZecHub currently marks Ywallet not ready for Ironwood, while some older directory navigation still contains Ywallet and Nighthawk. Legacy wallets were not used as the current design base.

No Zcash wallet listing establishes Wcash compatibility. This work is a website design and implementation, not a wallet fork, release audit, binary verification or mainnet deployment. The user confirmed that Wcash Wallet is based on Zingo. Zingo therefore defines the wallet foundation and interaction reference; Zkool and Vizor inform visual UI, and Zodl informs UX only. No native wallet source was copied into this website.

The SDKs, node services, and infrastructure repositories supplied in the brief are implementation references for future native wallet work, not consumer website UI. The extra Zodl web domains were not used as authoritative download or source destinations.

## Content policy for this concept

- Use the requested identity: **Wcash is w.cash, a Zcash fork with merged mining and no dev tax**.
- State the separate wallet identity: **Based on Zingo. Built for Wcash.** Link to the upstream mobile and desktop projects without presenting those Zcash downloads as Wcash releases.
- Treat all five native wallet releases as the user's assumed product state; visibly identify placeholder download links.
- Label wallet balances and history as illustrative; do not show market prices, invented adoption metrics, audits or live network statistics.
- Explain that shielded privacy is a transfer choice and that zero protocol development tax does not remove transaction fees.
- Link network context to [w.cash](https://w.cash/), which currently states that mainnet is not live. Do not suggest this website proves live releases or network availability.
- Keep the website local. No publishing, custom-domain changes or third-party messages.

## Final visual direction

The selected direction is an immersive product launch. A custom cobalt guilloché engraving gives Wcash its own currency identity, and becomes the live wallet balance surface. Instrument Serif and Manrope combine the character of an engraved money instrument with practical wallet controls. Ivory, cobalt and neutral ink replace the earlier graphite-and-lime treatment.

The first screen contains the interactive product. A native range slider reveals the public view of an illustrative shielded transfer; the banknote responds subtly to a fine pointer. Send, Receive and Activity open real working demo views. Transfers can be reviewed and simulated, changing the in-memory sample balance and history. The receiving details are explicitly nonfunctional demo data; copying them is user-triggered. Reset and refresh restore the sample wallet.

The deeper [Vizor](https://vizor.cash/) review informed the coherent visual world, editorial type, product scale and pacing. The Wcash banknote artwork, interaction design and website code are original. Newer [Zend](https://justzend.com/) was reviewed for concise annotations; [Noir](https://www.zknoir.com/) yielded no reliable extractable design evidence.

The network explanation uses a large typographic zero and a simple merged-mining diagram. All five platform choices remain explicit. Fonts and artwork are served locally. There are no analytics, third-party runtime scripts, or blockchain connections. Motion respects reduced-motion preferences.

## Validation

Verified static file serving, local asset references, internal anchors, unique HTML IDs, accessibility references, and JavaScript syntax. The browser's supported WebMCP context verified all five registered demo tools, including successful simulation, state read-back, reset, excessive-amount rejection, duplicate-completion rejection and invalid navigation rejection. This is a focused interaction contract check, not a native wallet or real transaction test.

## Zingo alignment

Reviewed official [mobile send flow](https://github.com/zingolabs/zingo-mobile/blob/dev/screens/Send/Send.tsx), [desktop privacy confirmation](https://github.com/zingolabs/zingo-pc/blob/dev/src/components/send/components/SendConfirmModal.tsx), and [mobile UI copy](https://github.com/zingolabs/zingo-mobile/blob/dev/app/translations/en.json).

The demo distinguishes total and spendable balances, models privacy from the recipient and shielded source funds, supports an optional memo only for a shielded recipient, and starts Receive with shielded sample details. It has no live sync status or blockchain connection. The 120-character memo limit and all-spendable balance are explicit demo simplifications. Newer upstream integrations and network upgrades are not claimed for Wcash merely because they appear in Zingo's current development source.
