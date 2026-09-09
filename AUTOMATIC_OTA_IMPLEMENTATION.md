# Automatic OTA Updates Implementation

## Summary

Successfully implemented automatic OTA (Over-The-Air) updates for the Gopeshwar Stationary House application. The app now checks for, downloads, and installs updates automatically without user confirmation.

## Changes Made

### 1. Capacitor Configuration (`capacitor.config.ts`)
- **Changed**: `autoUpdate: 'off'` → `autoUpdate: 'background'`
- **Effect**: Enables automatic background updates that don't require user confirmation
- **Data Preservation**: Capacitor automatically preserves local data during updates

### 2. OTA Check Logic (`preview/index.html`)
- **Modified**: `checkOtaUpdate()` function to accept `autoApply` parameter
- **Added**: Automatic installation and reload when new version is detected
- **Removed**: Manual apply button from settings UI
- **Behavior**: 
  - Automatically downloads and installs updates
  - Reloads app after 1 second to apply changes
  - Can be paused via settings toggle

### 3. Pull-to-Refresh Gesture
- **Added**: Touch event listeners for pull-to-refresh
- **Trigger**: When user pulls down from top of screen (80px threshold)
- **Action**: Triggers OTA check with auto-apply
- **Implementation**: 
  - `handlePullToRefreshStart()`
  - `handlePullToRefreshMove()`
  - `handlePullToRefreshEnd()`

### 4. GitHub Actions Workflow (`.github/workflows/ota-release.yml`)
- **Added**: Automatic trigger on push to `main` branch
- **Enhanced**: Auto-generate version numbers for non-tagged releases
- **Added**: Delete old "latest" release before publishing new one
- **Behavior**: 
  - Every push to main triggers OTA build
  - Tagged releases use explicit version
  - Untagged releases auto-generate version (YYYY.MM.DD.RUN_NUMBER)

### 5. UI Changes
- **Removed**: Manual "Apply update" button from settings
- **Simplified**: OTA status display
- **Preserved**: Pause/Resume toggle for user control

## How It Works

### App Launch
1. App starts and boots up
2. Capacitor updater plugin initializes
3. `checkOtaUpdate(true)` called automatically
4. If new version exists:
   - Downloads bundle in background
   - Verifies SHA-256 checksum
   - Installs update automatically
   - Reloads app after 1 second

### Pull-to-Refresh
1. User pulls down from top of screen
2. When threshold reached (80px):
   - Triggers `checkOtaUpdate(true)`
   - Same automatic installation process

### Settings Control
1. User can pause automatic updates via settings
2. Toggle stored in `gsh:otaDisabled` key
3. Paused state persists across app restarts

## GitHub Actions Workflow

### Automatic Publishing
```yaml
on:
  push:
    branches: [main]    # Every push triggers OTA
    tags:
      - 'ota-v*'       # Tagged releases use explicit version
```

### Version Generation
- **Tagged releases**: Use tag version (e.g., `ota-v1.4.0` → `1.4.0`)
- **Untagged releases**: Auto-generate (e.g., `2026.09.09.42`)

### Release Process
1. Build web bundle with OTA manifest URL
2. Package as `dist.zip`
3. Generate `manifest.json` with SHA-256
4. Delete old "latest" release
5. Publish new release as "latest"

## Local Data Preservation

Capacitor's native updater automatically preserves:
- `window.storage` (all business data)
- Capacitor preferences
- File system storage
- SQLite databases
- Other native storage mechanisms

No migration needed - data survives OTA updates seamlessly.

## Testing

### Manual Testing
1. Build app: `npm run build`
2. Generate test manifest: `node scripts/create-ota-manifest.mjs`
3. Test in Android emulator/device
4. Verify automatic download and install
5. Test pull-to-refresh gesture
6. Verify data preservation after update

### GitHub Actions Testing
1. Push to `main` branch
2. Monitor workflow execution
3. Verify release creation
4. Check manifest.json content
5. Test OTA on real device

## Rollback

If issues occur:
1. Capacitor auto-rollback within 15 seconds if `notifyAppReady()` not called
2. User can clear app cache: Settings → Apps → GSH → Clear Cache
3. Reinstall last known-good APK
4. Publish hotfix as new OTA version

## Security

- SHA-256 checksum verification for bundle integrity
- HTTPS-only bundle downloads
- GitHub token authentication for releases
- No embedded secrets in app
- Protected production environment in GitHub Actions

## Configuration

### Environment Variables
- `OTA_MANIFEST_URL`: GitHub releases manifest URL
- `OTA_ENABLED`: Enable/disable OTA functionality
- `OTA_VERSION`: Version for manual releases
- `OTA_BUNDLE_URL`: Bundle download URL
- `OTA_MIN_NATIVE_VERSION`: Minimum native APK version

### Build Configuration
```bash
# Build with OTA enabled
OTA_MANIFEST_URL=https://github.com/sachingupta-ERP/gsh-app/releases/latest/download/manifest.json
OTA_ENABLED=true
npm run build
```

## Version History

### v1.4.0 (Current)
- Automatic OTA updates on app launch
- Pull-to-refresh for manual OTA checks
- GitHub Actions auto-publishing
- Removed manual confirmation dialogs

### v1.3.0 (Previous)
- Manual OTA with user confirmation
- PIN-based authentication
- Biometric support

## Notes

- No breaking changes to existing functionality
- All existing features preserved
- Local-first architecture maintained
- Offline-first operation unaffected
- Sync architecture unchanged
- Authentication flow unchanged

## Next Steps

1. Test automatic OTA on real Android device
2. Verify pull-to-refresh gesture
3. Test data preservation across updates
4. Monitor GitHub Actions workflow execution
5. Monitor OTA success rates in production
