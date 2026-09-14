# Wcash Wallet + WcashExplorer — Codex project context

**Last verified:** 2026-09-14
**Workspace:** /Users/rustdev/Documents/ChatGPT/wcashwallet
**Purpose:** hand this file to a new Codex context before it changes the Wcash Wallet website, WcashExplorer scanner, or begins native Zingo-based wallet work.

## Start here

This checkout contains two deliberately separate surfaces: the original static Wcash Wallet concept in `dist/`, and the WcashExplorer scanner imported from [w-cash/wcashscan](https://github.com/w-cash/wcashscan). It is not a native wallet, a Wcash blockchain node, a lightwalletd/indexer deployment, or a release repository.

The old `wcashexplorer.com` implementation is out of scope. Do not copy its UI, logic, data endpoints, or branding into this project.

The product brief is:

- Wcash is <code>w.cash</code>, a Zcash fork with merged mining and no protocol development tax.
- Wcash Wallet is **based on Zingo** and adapted for Wcash. The network and wallet foundations are separate things.
- The assumed product has iOS, Android, macOS, Windows, and Linux releases.
- The current website is an immersive product-launch experience with an interactive wallet demo. Download buttons intentionally point to <code>https://wcashwallet.com</code> as placeholders until verified installers exist.

Read this file first, then read:

1. [README.md](README.md) for the short run guide and current limitations.
2. [WCASHEXPLORER-STATUS.md](WCASHEXPLORER-STATUS.md) for scanner architecture, verification evidence, and the Wcash data-adapter milestone.
3. [DESIGN-RESEARCH.md](DESIGN-RESEARCH.md) for the wallet UI/UX review and design decisions.
4. [dist/index.html](dist/index.html), [dist/styles.css](dist/styles.css), and [dist/app.js](dist/app.js) before editing the wallet concept.

Keep website and scanner work in this checkout. Keep cloned Zingo, Wcash node, and infrastructure repositories in a separate sibling directory. No native Zingo or Wcash node source is currently checked out here.

## What exists in this checkout

| Path | Role |
| --- | --- |
| <code>dist/index.html</code> | The complete page markup, inline SVG icon symbols, navigation, hero, wallet demo views, download selector, FAQ, and footer. |
| <code>dist/styles.css</code> | All theme, layout, responsive, focus, animation, and reduced-motion styles. There is no CSS framework. |
| <code>dist/app.js</code> | The in-memory demo state machine, wallet navigation, privacy slider, send/review/simulate/reset actions, receive clipboard behavior, platform selection, and optional WebMCP tools. |
| <code>app/</code>, <code>components/</code>, <code>contexts/</code>, <code>hooks/</code> | WcashExplorer Next.js/React pages, dashboards, UI components, client state, and data hooks imported from <code>w-cash/wcashscan</code>. |
| <code>lib/</code>, <code>types/</code>, <code>wasm/</code>, <code>workers/</code> | Scanner configuration, API clients, chain/format helpers, browser decoding, and background workers. |
| <code>server/api/</code> | Express API, WebSocket server, PostgreSQL/Redis access, gRPC/compact-block scan routes, and API tests. |
| <code>WCASHEXPLORER-STATUS.md</code> | Scanner architecture boundary, test evidence, environment contract, and Wcash readiness checklist. |
| <code>dist/assets/cobalt-guilloche.png</code> | Primary original cobalt banknote/guilloche artwork used by the wallet surface. |
| <code>dist/assets/platinum-ribbon.png</code> | Older/secondary artwork kept in the asset folder; check references before using it in new work. |
| <code>dist/assets/manrope-*.ttf</code> | Local Manrope UI fonts. |
| <code>dist/assets/instrument-serif*.ttf</code> | Local Instrument Serif display fonts. |
| <code>dist/assets/favicon.svg</code> | Local favicon. |
| <code>README.md</code> | Concise project description, preview command, and limitations. |
| <code>DESIGN-RESEARCH.md</code> | Research on Vizor, Zodl, Zingo, Zkool, Cake, Unstoppable, Edge, Keystone, Ledger, Trezor, Brave, and Zallet, plus Wcash/Zingo decisions. |
| <code>.openai/hosting.json</code> | Static hosting configuration: the output directory is <code>dist</code>. It does not mean the site has been published. |
| <code>.gitignore</code> | Ignores <code>.DS_Store</code>, <code>.sites-runtime/</code>, <code>.preview/</code>, and <code>node_modules/</code>. |

The scanner has a <code>package.json</code>, Next.js build, TypeScript, and an Express API. The files under <code>dist/</code> remain a separate static wallet concept and are authored directly/served as-is. Do not mix the scanner build output with the wallet demo output.

## Current website behavior

The visual direction is a cobalt-and-ivory product launch: the hero says **“Money has a private side.”**, with a banknote-like interactive wallet surface as the main product moment. The design uses Manrope for UI text, Instrument Serif for expressive display type, cobalt <code>#2851ee</code> for the primary accent, dark navy ink, and an ivory paper background.

The wallet surface currently includes:

- Total balance and Spendable balance labels, with sample balance <code>2,480.00 WCASH</code>.
- A private/public view slider. It is an explanatory visual layer, not a chain privacy setting.
- Overview, Send, Receive, and Activity views.
- A send flow with Alex (fictional shielded recipient) and Morgan (fictional transparent recipient).
- Privacy derived from the recipient address: Alex is **Private**; Morgan is **Deshielded**. There is no user-selectable privacy toggle.
- An optional encrypted memo for the shielded Alex demo only, with a 120-character demo limit.
- Review, simulated completion, error handling, and reset behavior.
- A shielded sample receiving address that is explicitly marked as unable to receive funds.
- Five accessible platform tabs: iOS, Android, macOS, Windows, and Linux. The browser device is used only to choose the initially selected tab.

All demo state stays in JavaScript memory. Refresh resets it. The demo has no private keys, recovery phrases, real addresses, market data, blockchain connection, real sync, or real funds. The simulated transfer must never be described as a real transaction.

dist/app.js also registers these optional WebMCP tools when document.modelContext is available:

- <code>get_wallet_demo</code>
- <code>navigate_wallet_demo</code>
- <code>stage_demo_transfer</code>
- <code>complete_demo_transfer</code>
- <code>reset_wallet_demo</code>

Those tools expose the same simulated state as the visible page and must keep the same “sample funds only” boundary.

## Wcash truth boundary

At the time this context was written, the public [w.cash](https://w.cash) page described Wcash as pre-announcement/not live and stated that no mainnet WCASH exists yet. Re-check that page and the current Wcash source before publishing any network or release claim; this status can change.

The website may describe the user-provided network idea (Zcash fork, merged mining, zero dev tax), but it must not invent or imply any of the following until verified from Wcash consensus/source documentation:

- live mainnet, a working testnet, or a public regtest endpoint;
- a genesis hash, chain ID, network magic, address prefixes/HRPs, RPC ports, activation heights, block time, fee rules, or emission schedule;
- Sapling/Orchard parameters, shielded transaction compatibility, memo behavior, or consensus upgrades;
- signed installers, app-store listings, audited security, support commitments, or completed releases.

Do not point a Zcash lightwalletd service or Zcash wallet binary at Wcash and call that compatibility. A Zingo-based Wcash wallet needs Wcash-compatible consensus parameters, node/indexer behavior, lightwalletd protocol behavior, and tests.

The [draft Wcash whitepaper](https://w.cash/whitepaper) describes Wcash as an independent genesis/network, so it does not import Zcash balances or history. Its draft plan mentions a 21M cap, a 10 WCASH initial subsidy, halvings every 1,050,000 blocks, a 120-second target, and no tail emission; treat those as proposals until the Wcash source/specification freezes them. Merged mining also requires a Wcash-aware pool/miner adapter and a frozen AuxPoW serialization format. Before native implementation, resolve chain ID, network magic, address prefixes, shielded protocol and upgrade activations, Equihash parameters/personalization, AuxPoW commitment/proof format, accepted parent rules, difficulty/timestamp/fork-choice behavior, block/transaction limits, coinbase maturity, fees, and any Bitcoin launch-anchor rules.

## Run the website locally

From the workspace root:

~~~sh
cd /Users/rustdev/Documents/ChatGPT/wcashwallet
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
~~~

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The server command stays running in the terminal; stop it with Ctrl-C when finished. The bundled workspace Python used during this work is:

~~~text
/Users/rustdev/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
~~~

Use that absolute interpreter if the shell’s python3 is unavailable. Useful checks from another terminal are:

~~~sh
curl -I http://127.0.0.1:4173/
/Users/rustdev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check dist/app.js
~~~

There is no install or build step for this website. After HTML/CSS/JS edits, reload the local page and exercise the wallet tabs, slider, send/review/simulate/reset flow, platform tabs, FAQ, mobile navigation, and reduced-motion behavior. If browser automation is available, verify that the five WebMCP actions still reject invalid navigation, excessive amounts, duplicate completion, and stale review state.

The <code>.openai/hosting.json</code> file says <code>{ "static": { "directory": "dist" } }</code> for possible future Sites hosting. The site has not been deployed or registered. Do not publish it or replace placeholder download links without an explicit release decision.

## Safe website editing workflow

1. Run <code>git status --short</code> and inspect the relevant file before editing.
2. Use <code>rg</code> to find selectors, IDs, copy, and function names. Keep IDs and <code>aria-*</code> references synchronized between <code>index.html</code> and <code>app.js</code>.
3. Make small, reviewable edits. Keep the static site independent of native wallet repositories.
4. Run <code>node --check dist/app.js</code>, serve <code>dist</code>, and test the changed interaction in a browser.
5. Run <code>git diff --check</code> and inspect <code>git diff</code> before committing.

The simulated transfer state is intentionally strict: leaving Send/Review clears a pending transfer, and completion requires the current view to be Review. Preserve that behavior when changing navigation.

## Official Zingo and related source locations

These are upstream references, not local directories in this checkout:

| Component | Official location | What it is used for |
| --- | --- | --- |
| Zingo product | [zingolabs.org/zingo](https://zingolabs.org/zingo/) | Product language and high-level wallet foundation reference. |
| Zingo Mobile | [github.com/zingolabs/zingo-mobile](https://github.com/zingolabs/zingo-mobile) | React Native Android/iOS light-client wallet, powered by the Rust Zingolib SDK. Relevant mobile files include <code>screens/Send/Send.tsx</code> and <code>app/translations/en.json</code>. |
| Zingo PC | [github.com/zingolabs/zingo-pc](https://github.com/zingolabs/zingo-pc) | Electron desktop wallet for Windows, macOS, and Linux, powered by Zingolib. Relevant UI is under <code>src/</code>; config, public, native, flatpak, and docs are also present. |
| Zingolib | [github.com/zingolabs/zingolib](https://github.com/zingolabs/zingolib) | Rust API/library that exposes Zcash wallet functionality to the apps. |
| Zaino | [github.com/zingolabs/zaino](https://github.com/zingolabs/zaino) | Rust indexer/service reference. Wcash compatibility must be implemented and tested; do not assume Zcash indexer behavior is sufficient. |
| Zingo Regchest | [github.com/zingolabs/zingo-regchest](https://github.com/zingolabs/zingo-regchest) | Regtest orchestration reference used by Zingo’s integration/e2e workflow. |
| lightwalletd | [github.com/zcash/lightwalletd](https://github.com/zcash/lightwalletd) | Zcash light-client service reference. A Wcash wallet needs a Wcash-compatible service. |

If native work is requested, use a sibling layout such as:

~~~text
/Users/rustdev/Documents/ChatGPT/zingolabs/
├── zingo-mobile/
├── zingo-pc/
├── zingolib/
├── zaino/
└── zingo-regchest/       # optional, if the workflow needs a local checkout
~~~

Example clone commands (replace the destination if the user chooses another source root):

~~~sh
mkdir -p /Users/rustdev/Documents/ChatGPT/zingolabs
git clone https://github.com/zingolabs/zingo-mobile.git /Users/rustdev/Documents/ChatGPT/zingolabs/zingo-mobile
git clone https://github.com/zingolabs/zingo-pc.git /Users/rustdev/Documents/ChatGPT/zingolabs/zingo-pc
git clone https://github.com/zingolabs/zingolib.git /Users/rustdev/Documents/ChatGPT/zingolabs/zingolib
git clone https://github.com/zingolabs/zaino.git /Users/rustdev/Documents/ChatGPT/zingolabs/zaino
~~~

Before changing an upstream checkout, record:

~~~sh
git remote -v
git branch --show-current
git status --short
git log -1 --oneline
~~~

Use a feature branch and keep the official repository as a read-only <code>upstream</code> remote when working from a fork. Do not silently copy upstream code into <code>dist/</code>; the website only references Zingo and models its UX.

### Native source map

These are useful starting points after the upstream repositories have been cloned. Paths are relative to their respective repositories and may move as upstream develops:

- Mobile send and memo behavior: <code>screens/Send/Send.tsx</code>, <code>screens/Send/components/Memo.tsx</code>.
- Mobile receive and chain/server configuration: <code>screens/Receive/Receive.tsx</code>, <code>app/AppState/enums/ChainNameEnum.ts</code>, <code>app/uris/serverUris.ts</code>, <code>app/uris/parseServerURI.ts</code>, <code>app/uris/checkServerURI.ts</code>, <code>app/uris/fetchServerList.ts</code>, and <code>app/walletBackend/config/WalletBackendConfig.ts</code>.
- Mobile native builds/tests: <code>rust/android/build_android.mjs</code>, <code>rust/ios/build_ios.mjs</code>, <code>rust/android/tests/</code>, and <code>rust/ios/tests/</code>.
- Desktop send/receive and chain configuration: <code>src/components/send/Send.tsx</code>, <code>src/components/send/components/SendConfirmModal.tsx</code>, <code>src/components/receive/Receive.tsx</code>, <code>src/components/appstate/enums/ServerChainNameEnum.ts</code>, and <code>src/utils/uris.ts</code>.
- Desktop native bridge and startup: <code>native/src/lib.rs</code>, <code>native/Cargo.toml</code>, and <code>scripts/start.js</code>. The desktop native manifest pins an exact Zingolib revision; update that dependency deliberately when forking.
- Zingolib chain configuration: <code>zingolib/src/config.rs</code>. Current upstream supports Mainnet, Testnet, and Regtest with activation heights; Wcash requires an explicit chain/parameter implementation, not just a renamed ticker or server URL.

## Zingo behavior that the website intentionally follows

The current demo is aligned with observed Zingo behavior in these ways:

- **Total vs Spendable:** show both concepts. A real wallet must calculate spendable from sync/confirmation state rather than assuming every total is spendable.
- **Privacy from the destination:** derive Private, Amount Revealed, or Deshielded from destination and source funds. Do not offer a misleading “make transparent funds private” checkbox.
- **Encrypted memo:** expose it only when the destination and transaction type support it; clear or disable it for transparent destinations.
- **Receive:** default to a shielded receiving path, with transparent details behind a clear disclosure after Wcash address parameters are known.
- **Sync:** show actual sync status in a native wallet. The website may say “demo” and “sample” but must not claim a live synced Wcash backend.

Do not automatically inherit every feature visible in current Zingo development source (for example network upgrades, swaps, NYM, aliases, or other integrations). Confirm each feature against Wcash’s fork and release plan first.

## Regtest architecture and procedure

### What regtest means here

The Zingo apps are light clients. A usable local integration environment normally has:

~~~text
Wcash-compatible node + CLI  →  lightwalletd or Zaino-compatible service  →  Zingo wallet app
~~~

For the upstream Zcash workflow, the node side uses <code>zcashd</code> and <code>zcash-cli</code>, and the mobile tests use <code>lightwalletd</code>. For Wcash, those components must be Wcash-compatible before the result is meaningful. This website workspace does not contain those native binaries. A sibling Wcash <code>wolf</code> checkout is currently running the local regtest profile on RPC <code>127.0.0.1:48232</code> with an embedded lightwalletd-compatible listener on <code>127.0.0.1:48234</code>; the explorer's read-only checks pass through <code>npm run verify:regtest</code> and <code>npm run verify:regtest:scanner</code>. No Wcash indexer or persistent explorer API is currently attached, so the explorer dashboards are not yet regtest-data-backed.

### Zingo Mobile’s documented Linux setup

The upstream mobile repository’s integration/e2e instructions require local <code>lightwalletd</code>, <code>zcashd</code>, and <code>zcash-cli</code> binaries. From the Zingo Mobile checkout, create the expected links using absolute paths to binaries that already exist on the machine:

~~~sh
cd /path/to/zingo-mobile/rust/android/regtest/bin
ln -s /absolute/path/to/lightwalletd ./lightwalletd
ln -s /absolute/path/to/zcashd ./zcashd
ln -s /absolute/path/to/zcash-cli ./zcash-cli

cd /path/to/zingo-mobile/rust/android/lightwalletd_bin
ln -s /absolute/path/to/lightwalletd ./lightwalletd
~~~

Inspect each destination before creating a link. Do not overwrite an existing binary or link, and do not delete files as a cleanup shortcut. The <code>/path/to/...</code> and <code>/absolute/path/to/...</code> strings above are placeholders, not paths that currently exist in this workspace.

### Regchest option

The upstream instructions use Regchest for non-Linux environments and as a portable Docker-backed option. The documented image pull is:

~~~sh
cd /path/to/zingo-mobile
docker pull zingodevops/regchest:013
~~~

Use the current Zingo repository scripts and README for how that image is started; the tag may change upstream. Do not invent a Wcash-compatible result from a Zcash Regchest run.

### Zingo Mobile test commands

Run these from the Zingo Mobile repository after following its current dependency and emulator/device setup. The repository has a <code>yarn.lock</code>, so inspect its README and package scripts and use the expected Yarn version rather than guessing.

~~~sh
# repository root
yarn test
yarn start

# Android integration tests; -s creates/uses quick-boot snapshots
./scripts/android_integration_tests.sh -a x86_64 -s
./scripts/android_integration_tests.sh -a x86 -s

# Android end-to-end tests
./scripts/e2e_tests.sh -a x86_64 -s

# from the rust directory
cd rust
cargo nextest run android_integration
cargo nextest run android_integration --features regchest
cargo nextest run e2e

# optional ABI-specific forms
cargo nextest run android_integration::x86_64
cargo nextest run android_integration::x86_32
cargo nextest run android_integration::arm64
cargo nextest run android_integration::arm32
~~~

The exact test names and feature flags are upstream-controlled; check the current repository before running a command that has changed. Android integration requires an emulator/device configured through Android Studio. Current Android quickstart requirements include Node/Yarn, Rust, JDK, Android SDK/API, NDK, CMake, ccache, and <code>cargo-nextest</code>; use the versions in the upstream quickstart rather than copying stale values. iOS uses Xcode/simulator setup; do not claim iOS CI coverage merely because the app supports iOS. Maestro is an optional mobile UI-test tool; use the repository’s current <code>.maestro/</code> flows if UI testing is requested. Legacy Detox instructions are not the primary CI path.

For a native app build, follow the current platform quickstarts rather than assuming the website’s Python/Node runtime is sufficient. The current mobile quickstart flow is conceptually <code>yarn</code>, <code>yarn rust:android</code>, then <code>yarn start</code> and <code>yarn android:prod</code> or <code>yarn android:beta</code> for Android. iOS requires macOS/Xcode, Rust iOS targets, CocoaPods, <code>yarn rust:ios</code>, <code>pod install</code>, <code>yarn start</code>, and <code>yarn ios</code>. Check the upstream README/quickstart for exact working-directory and version requirements before running these commands.

### Current Zingolib CLI/infrastructure regtest direction

Current upstream Zingolib documentation is moving toward a local **Zebrad + Zainod + zcash-devtool** stack. See the [Zingolib CLI regtest instructions](https://github.com/zingolabs/zingolib/blob/dev/zingo-cli/README.md#regtest), [infrastructure local-net README](https://github.com/zingolabs/infrastructure/blob/dev/zcash_local_net/README.md), and [regtest launcher README](https://github.com/zingolabs/infrastructure/blob/dev/regtest-launcher/README.md). The CLI example is conceptually:

~~~sh
cargo build --release -p zingo-cli
./target/release/zingo-cli --chain regtest --server 127.0.0.1:8137 --data-dir /absolute/path/to/regtest_temp
~~~

The infrastructure README says the legacy zcashd/lightwalletd stack is unsupported/untested in that path and requires the patched Zingolabs Zcash fork. The regtest launcher currently bootstraps a short chain and mines periodically; activation heights and launcher defaults are upstream-controlled. Treat all of these as Zcash test infrastructure until Wcash node/indexer binaries and Wcash parameters exist. Each chain needs its own wallet data directory. Never reuse a real wallet directory for regtest.

### How to adapt this for Wcash

The node-level check now passes, but complete wallet/explorer regtest coverage still requires the following:

1. Obtain the Wcash node/CLI and light-client service source or verified binaries. If they do not exist, report that native Wcash regtest is blocked; do not substitute a Zcash endpoint silently.
2. Confirm Wcash consensus and network parameters: genesis, chain/network ID, network magic, address prefixes/HRPs, RPC and service ports, block timing, activation heights, fee rules, Sapling/Orchard parameters, emission, and any merged-mining/AuxPoW rules.
3. Implement those parameters in the appropriate forked node, Zingolib configuration/core, mobile/desktop configuration, and lightwalletd/Zaino-compatible service. Keep this native work in the sibling source tree.
4. Start the node/service using the current upstream scripts and configuration. Record the exact commit, binary version, config path, endpoint, and logs. Avoid putting RPC credentials or wallet seeds in logs or this file.
5. Exercise the meaningful flow: create a wallet, sync, mine or fund regtest coins, wait for maturity as required, send shielded and transparent transactions, attach an encrypted memo where supported, receive funds, restart/restore, and verify activity/balance/privacy state.
6. Run the relevant mobile and desktop integration/e2e tests, then record pass/fail output and the Wcash parameters used. A passing Zcash test against unchanged Zcash binaries is not evidence of Wcash compatibility.

Do not write generic <code>zcashd</code> startup commands into a release guide without checking the exact fork’s config and scripts. The upstream test harness may own process startup and ports.

## GitHub SSH, commit, branch, and merge workflow

This context intentionally contains **no SSH private key, passphrase, GitHub token, or personal email address**. Another Codex must use the developer’s configured credential store or ask the repository owner to configure it. Never paste a private key, recovery phrase, <code>.env</code> secret, or access token into this file, a prompt, an issue, or a commit.

At handoff, this website checkout is on <code>main</code> with no commits and no configured Git remote; the project files are untracked. Establish the intended GitHub repository and remote only after the owner confirms the repository name and access.

### Verify SSH access

Use the developer’s own key path; the filename below is only an example:

~~~sh
ssh-add -l
ssh-add /absolute/path/to/your/private_key
ssh -T git@github.com
~~~

The first SSH connection may ask to trust GitHub’s host key. Verify the fingerprint through GitHub’s official documentation before accepting it. If no key exists, create an Ed25519 key locally, add only the <code>.pub</code> public key to **GitHub → Settings → SSH and GPG keys**, and keep the private key on the developer’s machine. Do not send the private key to Codex.

Check repository access without modifying anything:

~~~sh
git ls-remote git@github.com:ORG/REPOSITORY.git
~~~

If the command fails, fix the local SSH agent/key or GitHub repository permission first. Do not work around it by putting a token in a remote URL.

### Configure a repository

Set the author identity locally or globally according to the developer’s preference:

~~~sh
git config user.name "Your Name"
git config user.email "you@example.com"
~~~

For a fork, keep the fork as the writable <code>origin</code> and add the official project as read-only <code>upstream</code>:

~~~sh
git remote -v
git remote set-url origin git@github.com:YOUR_GITHUB_USER/REPOSITORY.git
git remote add upstream https://github.com/OWNER/REPOSITORY.git
git fetch upstream --prune
~~~

If <code>origin</code> does not exist, use <code>git remote add origin git@github.com:YOUR_GITHUB_USER/REPOSITORY.git</code>. Replace all uppercase placeholders; never invent an organization or repository name.

### Make a reviewable change

Use a branch named for the change. The <code>codex/</code> prefix is the default for this workspace, but use the repository’s documented convention if it has one.

~~~sh
git status --short
git switch -c codex/wcash-zingo-adapter
# edit and test the relevant files
git diff --check
git diff
git add path/to/only/the/intended/files
git diff --cached --check
git diff --cached
git commit -m "Describe the concrete change"
git push -u origin codex/wcash-zingo-adapter
~~~

For this website, do not stage <code>.sites-runtime/</code>, <code>.preview/</code>, <code>node_modules/</code>, local server output, generated secrets, wallet databases, or emulator artifacts. A handoff file is safe to commit when it contains procedures and public URLs only.

### Open and merge a pull request

Create a pull request from the feature branch into the repository’s default branch. Use the GitHub web UI if GitHub CLI is not installed. If <code>gh</code> is already authenticated, the equivalent flow is:

~~~sh
gh auth status
gh pr create --base main --head codex/wcash-zingo-adapter --title "Concrete change title" --body-file /absolute/path/to/pr-body.md
gh pr checks --watch
gh pr merge --squash --delete-branch
~~~

The final merge is a repository-owner/reviewer decision. Before merging, inspect the PR diff, verify the checks, confirm no credentials or generated artifacts are present, and verify that download links and Wcash claims are backed by actual release evidence. If upstream changes need to be incorporated, fetch <code>upstream</code>, rebase or merge deliberately, rerun tests, and push the updated branch. Do not force-push a shared branch without explicit authorization.

After a merge, sync a local checkout with the repository’s chosen strategy, for example:

~~~sh
git switch main
git fetch origin --prune
git pull --ff-only origin main
git branch --merged
~~~

Do not merge directly to <code>main</code> merely because a local test passes. Use the project’s review and CI process.

## Validation checklist for a future Codex

Before handing work back:

- Website: <code>node --check dist/app.js</code>, <code>git diff --check</code>, local HTTP preview, responsive browser check, and the changed interaction exercised.
- Content: Zingo relationship is explicit; Wcash network claims are qualified; all five platform links are clearly marked placeholders until real releases exist.
- Native work: source commit refs, fork parameters, node/service versions, endpoint/config locations, and test commands/results are recorded without secrets.
- Git: branch is reviewable, diff contains only intended files, SSH push used the configured key, and the PR is ready for owner review.
- Never claim a native Wcash wallet, live network, regtest, release binary, audit, or transaction capability that has not actually been built and verified.
