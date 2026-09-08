# GSH OTA updates

GSH keeps its Capacitor Android runtime as the native shell. The
`@capgo/capacitor-updater` plugin downloads a complete `dist/` web bundle,
validates the HTTPS manifest and SHA-256 checksum, and stages the bundle for
activation. `notifyAppReady()` confirms that the active bundle started
successfully; a failed startup is rolled back by the native plugin.

## First installation

OTA requires a new bootstrap APK containing the updater plugin and its
configuration. The currently installed APK cannot gain native OTA support
retroactively. After that bootstrap APK is installed, web-layer updates do not
require another APK.

## Publishing a production update

1. Make and test the web-layer change.
2. Choose a new semver greater than the installed OTA version.
3. Push a promotion tag:

   ```text
   git tag ota-v1.0.1
   git push origin ota-v1.0.1
   ```

4. GitHub Actions runs `Publish OTA bundle` in the protected `production`
   environment, builds `dist/`, creates `dist.zip`, generates `manifest.json`,
   and publishes an immutable GitHub Release.
5. Devices check the stable
   `releases/latest/download/manifest.json` URL, download and checksum the
   immutable bundle, then show an **Apply update** action in More → Local-first
   sync. The current app data remains in `window.storage`; the OTA bundle only
   replaces web assets.

The workflow can also be run manually with a semver `version` input. Ordinary
commits do not publish to production.

## Rollback

Do not delete the last known-good release. Disable automatic updates in the
application build if necessary, or publish a new OTA version containing the
previous known-good web assets. If a staged bundle fails before `notifyAppReady`,
the native updater automatically returns to the previous successful bundle.

## Native APK changes

These still require a new signed APK:

- Android Java/Kotlin code
- Capacitor or native plugin changes
- Android permissions and manifest changes
- Package/app configuration
- Native SDK or major Capacitor dependency changes
- Background workers, deep links, or other native integrations

UI, HTML/CSS, web JavaScript business logic, text, reports, and web-layer AI
routing can use OTA.

## Secrets and configuration

No API key or private secret is embedded in the APK. The release workflow uses
the built-in `GITHUB_TOKEN` to publish releases and requires a protected
GitHub environment named `production` for approval. The repository must be
public for unauthenticated Android clients to download GitHub release assets;
private repositories should use an authenticated HTTPS object store/CDN and
set the manifest URL in `OTA_MANIFEST_URL` during the bootstrap APK build.

The updater can be disabled at build time with `OTA_ENABLED=false`. Users can
also pause/resume automatic checks locally from the sync status sheet.
