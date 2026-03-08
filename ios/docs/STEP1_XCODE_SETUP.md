# Step 1: Xcode Project Structure and Build Gate

This repo now includes a Safari extension seed at:
- `ios/SafariCaptureExtensionSeed/`

And a generator script at:
- `ios/scripts/create_ios_extension_project.sh`

## Prerequisites

- Install full Xcode from the App Store.
- Launch Xcode once and accept license/components.
- Ensure `xcode-select -p` points to Xcode app path (not CommandLineTools):
  - expected: `/Applications/Xcode.app/Contents/Developer`

If needed:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

## Generate project structure

From repo root:

```bash
./ios/scripts/create_ios_extension_project.sh
```

Expected output:
- `ios/ToThreadCaptureApp/` containing app + Safari extension Xcode project.

## Build verification gate

1. Open generated project in Xcode.
2. Set Team and Signing for app + extension targets.
3. Select your iPhone as build destination.
4. Build (`Product > Build`).

Gate passes when:
- Clean build succeeds with no compile/signing errors.
