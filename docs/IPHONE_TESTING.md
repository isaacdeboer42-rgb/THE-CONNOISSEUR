# iPhone test build

The fastest physical-device test uses Expo Go. It runs the complete local prototype on an iPhone without requiring an Apple Developer membership or a signed build.

## Run on an iPhone now

1. Install **Expo Go** from the iPhone App Store.
2. Put the iPhone and this computer on the same Wi-Fi network.
3. Double-click `START-IPHONE-TEST.cmd` in the project folder. Alternatively, open a terminal here and run `pnpm start:iphone`.
4. Scan the displayed QR code with the iPhone Camera app and open it in Expo Go.
5. Keep the terminal window open while testing. Press `Ctrl+C` when finished.

If LAN discovery is blocked by a guest network, VPN, or firewall, run `pnpm exec expo start --tunnel`. The tunnel route can require an Expo sign-in and a one-time tunnel dependency download.

## Recommended walkthrough

1. Open **Explore a sample bar** and compare Availability with Taste-led recommendations.
2. Open a recipe, change servings from 1 to 8, switch ml/fl oz in Preferences, save it, then start Make mode.
3. Exit Make mode, reopen it, and confirm the active step, serving count, and timer resume.
4. In **My Bar**, mark an item empty, restock it, and confirm Tonight updates immediately.
5. Open **Scan bottle**, grant camera access, scan a real UPC-A/EAN-13 bottle, and confirm the code reaches verified or unknown recovery. Then test duplicate, denied-permission/manual, extraction failure/retry, and fixture states.
6. Add a missing ingredient to Shopping and inspect the recipes it unlocks.
7. Create the clearly labelled local account preview, verify guest import, then review the simulated catalogue queue.
8. Force-close and reopen the app to confirm inventory, saves, shopping, preferences, and unfinished Make state persist.

## What this prototype can test

- Guest onboarding and bar setup
- Ingredient and product inventory states
- Explainable recipe matching and ranking
- Recipe details, serving scaling, measurement preferences, saving, and shopping
- Persistent Make mode, timers, completion feedback, and private notes
- Live rear-camera UPC-A/EAN-13 detection, checksum validation, and recognised/unknown-product recovery
- Local account-import and catalogue-review previews
- Empty, error, retry, duplicate, withdrawn-content, and reset states

Camera barcode detection is live and opt-in; no frame or photo is saved. External barcode lookup, hosted AI extraction, real authentication, cloud sync, photo upload, and catalogue publication remain deliberately simulated. Real bottles not present in the local verified fixture catalogue therefore enter the private unknown-product recovery flow.

## Standalone installable iPhone build

iOS does not allow a generic unsigned `.ipa` to be copied onto any iPhone. A standalone preview build must be signed and provisioned for the tester's device.

Prerequisites:

- Expo account and EAS project
- Paid Apple Developer Program membership
- A unique, organization-owned iOS bundle identifier
- The iPhone registered in the ad hoc provisioning profile

Build flow:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Open the EAS installation link on the registered iPhone. For wider distribution, use the production profile and TestFlight after configuring App Store Connect.

## Release gate

Before any handoff build, run:

```bash
pnpm check:release
```

This type-checks the app, runs the automated suite, and verifies the production web export. Physical-device checks should still cover safe areas, large text, VoiceOver, background/resume behavior, screen-awake behavior in Make mode, and persistence after force-close.
