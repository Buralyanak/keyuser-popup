# Keyuser Popup

A small Electron desktop window that opens:

`https://main.d1uanrj3qjhflx.amplifyapp.com/`

## Run locally

Requirements: Node.js 20 or newer.

```powershell
npm.cmd install
npm.cmd start
```

`npm.cmd` is used here because some Windows PowerShell installations block the
`npm.ps1` script.

## Build a Windows installer

```powershell
npm.cmd run dist:win
```

The installer will be created in the `dist` folder.

## Change the icon

Replace `build/favicon.ico`, then rebuild:

```powershell
npm.cmd run dist:win
```

## Window behavior

- Opens at 430 × 720 pixels and remains resizable.
- Only one copy of the application can run at a time.
- Links that request a new window open in the default browser.
- `F5` and `Ctrl+R` reload the page.
- The remote page cannot access Node.js or Electron APIs.
