# Update Delivery Process

## How to Deliver Updates to Users

### Prerequisites
1. Your repository must be set to `keyuser/keyuser-popup` on GitHub
2. The repository must be public (for auto-updater to access releases)
3. Ensure `package.json` version is updated before creating a tag

### Automated Release Process

#### Step 1: Update Version
Update the version in `package.json`:
```json
{
  "version": "1.0.1"
}
```

#### Step 2: Push a Git Tag
Create and push a version tag to trigger the automated workflow:
```bash
git tag v1.0.1
git push origin v1.0.1
```

This will automatically:
- Build the Windows installer
- Create a GitHub release
- Upload the `.exe` file to the release
- Make it available for auto-update

#### Step 3: Users Receive Update
Users running the app will:
1. Automatically check for updates daily (or on app restart)
2. See a notification: "A new version of Keyuser Popup is available"
3. Download happens silently in the background
4. Get another notification: "Update Ready"
5. Can restart now or later
6. App restarts with the new version

### Manual Release (if needed)
If GitHub Actions fails, you can manually create a release:

1. Build locally:
```bash
npm run dist:win
```

2. Create a release on GitHub:
   - Go to your repository's Releases page
   - Click "Create a new release"
   - Tag: `v1.0.1`
   - Title: `Keyuser Popup v1.0.1`
   - Upload the `.exe` from `dist/` folder
   - Publish

### File Structure
The auto-updater uses:
- GitHub Releases: Stores `.exe` installers
- `latest.yml`: Auto-generated manifest file (stored in release assets)
- `package.json`: Current app version (used by auto-updater to check for updates)

### How Auto-Update Works
1. App starts → electron-updater checks GitHub releases
2. Compares local version with latest release tag
3. If newer version exists → downloads `.exe`
4. Prompts user to restart
5. On restart → installer runs and updates the app

### Troubleshooting
- **Auto-updater not checking?**: Make sure `autoUpdater.checkForUpdatesAndNotify()` runs in main process
- **Repository is private?**: Change to public or use a custom update server
- **GitHub Actions failed?**: Check the "Actions" tab in your repository for error logs
- **No notifications showing?**: Verify Windows allows notifications from your app

### Check Update Status in App
To debug, you can add this to your preload script:
```javascript
ipcMain.handle('app:getVersion', () => app.getVersion());
```

Then display the current version in the settings window.
