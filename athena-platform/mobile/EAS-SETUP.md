# What is missing from eas.json, and why it is missing

`eas.json` sits next to this file and contains no store credentials. That is
deliberate, and it is a change: it used to carry
`"ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"`, `"appleTeamId": "YOUR_APPLE_TEAM_ID"`,
an `appleId` on a domain ATHENA does not own, and a
`"serviceAccountKeyPath": "./google-service-account.json"` naming a file that
has never been in the repository. Strings shaped like configuration read as
configuration: someone running `eas submit` had every reason to think the file
was set up, and only found out it was not when the submission failed.

None of the values below can be written here in advance. They are issued to
whoever owns ATHENA's Apple and Google developer accounts, and they are
credentials. This page says exactly what has to be supplied, by whom, and
where it goes.

## 1. The Expo project — needed for builds and for push notifications

`eas init` in `mobile/`, run on the Expo account that will own the app, creates
the project and prints its id (a UUID).

Set it as `EAS_PROJECT_ID` wherever builds are run — locally in the shell, and
in GitHub Actions as a repository secret exposed to the mobile workflow.
`app.config.js` reads it and publishes it as `extra.eas.projectId`, which is
what `expo-notifications` mints a push token against.

Until it is set: the app builds and runs, and registers no push token. It says
so once in the log (`[push] This build has no EAS project id …`) and carries
on. It used to throw instead, on every cold start and every sign-in, out of a
call nobody awaited — so the whole server-side push stack had no devices to
send to and nothing said why.

## 2. iOS submission — Apple, per app

`eas submit --platform ios` needs three things that belong to ATHENA's Apple
Developer account:

| What | Where it comes from |
| --- | --- |
| Apple ID | the email of the account with App Manager rights |
| App Store Connect app id | App Store Connect → the app → App Information → "Apple ID" (a number) |
| Apple Team id | developer.apple.com → Membership (a ten-character id) |

Supply them by running `eas submit --platform ios` interactively once, which
asks for each and stores them against the EAS project, or add an `ios` block to
the `submit` profile in `eas.json` once the real values are known. Do not
commit an app-specific password; EAS keeps it in the project's credentials
(`EXPO_APPLE_APP_SPECIFIC_PASSWORD` for a non-interactive run).

## 3. Android submission — Google Play service account

`eas submit --platform android` needs a Google Play service-account key with
the "Release apps to testing tracks" permission, created in the Google Cloud
console and granted access in Play Console → Users and permissions.

Upload it to the EAS project with `eas credentials` (Android → Google Service
Account). **Do not put the JSON key in the repository** — that is what the old
`serviceAccountKeyPath` implied and it would have committed a key that can
publish to the store.

The `track` and `rollout` values that remain in `eas.json` are real decisions
and are correct: staging goes to the internal track, production to the
production track at a 10% staged rollout.

## 4. Over-the-air updates — not configured, and no longer implied

Every build profile used to declare an EAS Update `channel`. Nothing was bound
to those channels: `expo-updates` is not a dependency, and `app.json` declares
neither an `updates` block nor a `runtimeVersion`, so no build has ever been
able to fetch an update and the channels only made it look as though a JS-only
fix could be shipped without a store release. They have been removed rather
than left looking like configuration.

Turning OTA updates on is three steps, in this order, and all three are needed:

```bash
npx expo install expo-updates     # adds the native module at the SDK's version
eas update:configure              # writes updates.url and runtimeVersion, needs the project from step 1
```

then add `"channel": "<profile>"` back to each build profile in `eas.json`.
The first build after that is still a store release; the ones after it are not.
