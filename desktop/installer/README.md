# Experimental Windows installer

The Inno Setup script builds a per-user Windows x64 installer from an already built and verified desktop stage. It installs the executable, WebView2 loader, local editor assets, MIT license and third-party notices. It does not install Node.js, download anything, configure hosting, or publish a website. Uninstall removes installed program files but does not remove the separate WebView profile, project files or optional AI files.

The Microsoft Edge WebView2 Runtime must be installed separately; see [Microsoft's runtime distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution). Optional local AI files are not included. The installer and application are experimental; an independent license audit and a clean Windows installation and end-to-end workflow are still required before release.

For the initial local build, Inno Setup 6.7.4 was obtained from the [official download page](https://jrsoftware.org/isdl.php), verified with a valid Pyrsys B.V. Authenticode signature, and installed in portable mode under `test-results`. Its installer SHA-256 was `a549929319f9120716677c685535ca4671e4b937b5fdc87e2585f32d8eb30e8c`. The compiler reported non-commercial use; confirm the applicable Inno Setup license before any commercial use.

To rebuild with an installed or portable `ISCC.exe`, use a freshly built stage containing `DelphiWebStudio.exe`, the x64 `WebView2Loader.dll` and the `editor` directory:

```powershell
& 'C:\path\to\ISCC.exe' '/DStageDir=C:\path\to\verified-stage' '/OC:\path\to\output' 'desktop\installer\DelphiWebStudio.iss'
```

The first local test installed to a fresh folder under `test-results`, compared all staged executable, loader and editor files by SHA-256, and uninstalled. The uninstaller preserved a synthetic user-created file in the install folder. This was not a clean Windows VM test and did not exercise the installed application end to end.
