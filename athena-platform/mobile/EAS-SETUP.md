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
whoever owns ATHENA's Apple and Google developer accounts, and some of them are
credentials. This page says exactly what has to be supplied, by whom, and
where it goes.

Where it goes is GitHub, not `eas.json`. The mobile workflow
(`.github/workflows/mobile-build.yml`) reads every value below from the
repository's Actions settings at run time and, for a store submission, writes
the store values into the runner's own copy of `eas.json`, which is thrown away
with the runner. Nothing is committed. A value that is missing stops the
workflow with an error naming it and pointing back to the section here, rather
than failing inside `eas submit` after a production build has been paid for.
The same values are listed in the repository's `DEPLOYMENT_GUIDE.md`, under
"Required GitHub Secrets" and "Repository variables".

Settings → Secrets and variables → Actions has two tabs. **Secrets** are for
credentials; **Variables** are for public identifiers and URLs.

| Name | Tab | Section |
| --- | --- | --- |
| `EXPO_TOKEN` | Secret | 1 |
| `EAS_PROJECT_ID` | Secret (a variable of the same name is also read) | 1 |
| `MOBILE_API_URL` | Variable | 1 |
| `ASC_APP_ID` | Variable | 2 |
| `APPLE_TEAM_ID`, `APPLE_ID` | Variable (optional) | 2 |
| `EXPO_APPLE_APP_SPECIFIC_PASSWORD` | Secret (when signing in with an Apple ID) | 2 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Secret, or instead: | 3 |
| `EAS_HOLDS_GOOGLE_SERVICE_ACCOUNT` | Variable, set to `true` | 3 |

## 1. The Expo project — needed for builds and for push notifications

`eas init` in `mobile/`, run on the Expo account that will own the app, creates
the project and prints its id (a UUID).

Store it as the `EAS_PROJECT_ID` repository secret, and export it in the shell
for a local build. `app.config.js` reads it and publishes it as
`extra.eas.projectId`, which is what `expo-notifications` mints a push token
against. The workflow also needs `EXPO_TOKEN` (expo.dev → Account → Access
Tokens), which is what turns EAS builds on at all: without it the build job is
skipped, and with it but without `EAS_PROJECT_ID` the workflow fails and says
so.

The runner evaluates `app.config.js` before anything is sent to EAS, and that
file refuses to run without an API origin. Set the `MOBILE_API_URL` repository
variable to the deployed API origin, the same value as the EAS project's own
`API_URL` secret (`eas secret:create --scope project --name API_URL --value
https://...`), which is what the binary is actually built with.

Until the project id is set: the app builds and runs, and registers no push
token. It says so once in the log (`[push] This build has no EAS project id …`)
and carries on. It used to throw instead, on every cold start and every
sign-in, out of a call nobody awaited — so the whole server-side push stack had
no devices to send to and nothing said why.

## 2. iOS submission — Apple, per app

`eas submit --platform ios` needs values that belong to ATHENA's Apple
Developer account:

| What | Where it comes from | Where it goes |
| --- | --- | --- |
| App Store Connect app id | App Store Connect → the app → App Information → "Apple ID" (a number) | `ASC_APP_ID` variable (required) |
| Apple Team id | developer.apple.com → Membership (a ten-character id) | `APPLE_TEAM_ID` variable (optional) |
| Apple ID | the email of the account with App Manager rights | `APPLE_ID` variable (optional) |
| App-specific password | appleid.apple.com → Sign-In and Security → App-Specific Passwords | `EXPO_APPLE_APP_SPECIFIC_PASSWORD` secret, only when signing in with an Apple ID |

The app-specific password is not needed when an App Store Connect API key is
stored on the EAS project (`eas credentials` → iOS). Do not add an `ios` block
with these values to the committed `eas.json`: the workflow supplies them, and
a committed copy is how the placeholder values described above came to look
like configuration.

## 3. Android submission — Google Play service account

`eas submit --platform android` needs a Google Play service-account key with
the "Release apps to testing tracks" permission, created in the Google Cloud
console and granted access in Play Console → Users and permissions.

Give it to the workflow one of two ways:

- paste the whole JSON key into the `GOOGLE_SERVICE_ACCOUNT_KEY` repository
  secret. The workflow writes it to a file outside the checkout, readable only
  by the runner's user, checks that it is a service-account key, and points the
  runner's `eas.json` at it for that run; or
- upload it to the EAS project with `eas credentials` (Android → Google Service
  Account) and set the `EAS_HOLDS_GOOGLE_SERVICE_ACCOUNT` repository variable
  to `true`. That variable is you saying the key is there: nothing on the
  runner can ask EAS.

**Do not put the JSON key in the repository** — that is what the old
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
