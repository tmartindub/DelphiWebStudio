# Third party inventory and notices

Reviewed November 15, 2026 for Delphi Web Studio Pro 1.0.0 build 1.

OpenPage copyright (c) 2026 Federico De Ponte is preserved under the repository MIT license. Keep LICENSE and the attribution with redistributed software.

The desktop payload contains the native executable, its architecture-matched Microsoft WebView2 loader, the built editor files, guides and notices. It excludes Node.js, development tools, service API code, AI runtimes/models, user projects and site exports. The inventory below describes the complete current lockfile, including optional and build-only packages; a listed dependency is not by itself proof that it is shipped in browser output.

`docs/THIRD_PARTY_LICENSE_TEXTS.txt` contains the license/notice texts from installed non-development packages, including conservative build/optional entries. JSZip is used under its offered MIT license. PDF.js is Apache-2.0; its included license text is retained. No additional font files or AI model weights are included in this release payload.

Both architecture-matched WebView2 loaders have valid Microsoft signatures. The SDK license is included as `docs/WEBVIEW2_SDK_LICENSE.txt`; the separately installed Runtime has its own terms. Windows OpenSSH is an optional Windows feature and is not copied into the installer. The native application links the Delphi runtime rather than shipping development tools or BPL packages; the owner's RAD Studio redistribution terms still apply.

| Package | Version | Declared license | Lockfile scope |
| --- | --- | --- | --- |
| @babel/code-frame | 7.29.7 | MIT | development |
| @babel/compat-data | 7.29.7 | MIT | development |
| @babel/core | 7.29.7 | MIT | development |
| @babel/generator | 7.29.12 | MIT | development |
| @babel/helper-compilation-targets | 7.29.7 | MIT | development |
| @babel/helper-globals | 7.29.7 | MIT | development |
| @babel/helper-module-imports | 7.29.7 | MIT | development |
| @babel/helper-module-transforms | 7.29.7 | MIT | development |
| @babel/helper-plugin-utils | 7.28.6 | MIT | development |
| @babel/helper-string-parser | 7.29.11 | MIT | development |
| @babel/helper-validator-identifier | 7.29.7 | MIT | development |
| @babel/helper-validator-option | 7.29.7 | MIT | development |
| @babel/helpers | 7.29.10 | MIT | development |
| @babel/parser | 7.29.12 | MIT | development |
| @babel/plugin-transform-react-jsx-self | 7.27.1 | MIT | development |
| @babel/plugin-transform-react-jsx-source | 7.27.1 | MIT | development |
| @babel/template | 7.29.7 | MIT | development |
| @babel/traverse | 7.29.12 | MIT | development |
| @babel/types | 7.29.11 | MIT | development |
| @dnd-kit/accessibility | 3.1.1 | MIT | runtime or build dependency |
| @dnd-kit/core | 6.3.1 | MIT | runtime or build dependency |
| @dnd-kit/sortable | 10.0.0 | MIT | runtime or build dependency |
| @dnd-kit/utilities | 3.2.2 | MIT | runtime or build dependency |
| @esbuild/aix-ppc64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/android-arm | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/android-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/android-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/darwin-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/darwin-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/freebsd-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/freebsd-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-arm | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-ia32 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-loong64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-mips64el | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-ppc64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-riscv64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-s390x | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/linux-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/netbsd-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/netbsd-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/openbsd-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/openbsd-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/openharmony-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/sunos-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/win32-arm64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/win32-ia32 | 0.27.2 | MIT | runtime or build dependency; optional |
| @esbuild/win32-x64 | 0.27.2 | MIT | runtime or build dependency; optional |
| @eslint-community/eslint-utils | 4.10.1 | MIT | development |
| eslint-visitor-keys | 3.4.3 | Apache-2.0 | development |
| @eslint-community/regexpp | 4.12.2 | MIT | development |
| @eslint/config-array | 0.21.2 | Apache-2.0 | development |
| @eslint/config-helpers | 0.4.2 | Apache-2.0 | development |
| @eslint/core | 0.17.0 | Apache-2.0 | development |
| @eslint/eslintrc | 3.3.7 | MIT | development |
| ajv | 6.15.0 | MIT | development |
| globals | 14.0.0 | MIT | development |
| json-schema-traverse | 0.4.1 | MIT | development |
| @eslint/js | 9.39.5 | MIT | development |
| @eslint/object-schema | 2.1.7 | Apache-2.0 | development |
| @eslint/plugin-kit | 0.4.1 | Apache-2.0 | development |
| @humanfs/core | 0.19.2 | Apache-2.0 | development |
| @humanfs/node | 0.16.8 | Apache-2.0 | development |
| @humanfs/types | 0.15.0 | Apache-2.0 | development |
| @humanwhocodes/module-importer | 1.0.1 | Apache-2.0 | development |
| @humanwhocodes/retry | 0.4.3 | Apache-2.0 | development |
| @isaacs/nonrecursive-glob-match | 1.1.0 | BlueOak-1.0.0 | development |
| @jridgewell/gen-mapping | 0.3.13 | MIT | runtime or build dependency |
| @jridgewell/remapping | 2.3.5 | MIT | runtime or build dependency |
| @jridgewell/resolve-uri | 3.1.2 | MIT | runtime or build dependency |
| @jridgewell/sourcemap-codec | 1.5.5 | MIT | runtime or build dependency |
| @jridgewell/trace-mapping | 0.3.31 | MIT | runtime or build dependency |
| @napi-rs/canvas | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-android-arm64 | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-darwin-arm64 | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-darwin-x64 | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-linux-arm-gnueabihf | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-linux-arm64-gnu | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-linux-arm64-musl | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-linux-riscv64-gnu | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-linux-x64-gnu | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-linux-x64-musl | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-win32-arm64-msvc | 1.0.13 | MIT | runtime or build dependency; optional |
| @napi-rs/canvas-win32-x64-msvc | 1.0.13 | MIT | runtime or build dependency; optional |
| @rolldown/pluginutils | 1.0.0-rc.3 | MIT | development |
| @rollup/rollup-android-arm-eabi | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-android-arm64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-darwin-arm64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-darwin-x64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-freebsd-arm64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-freebsd-x64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-arm-gnueabihf | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-arm-musleabihf | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-arm64-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-arm64-musl | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-loong64-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-loong64-musl | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-ppc64-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-ppc64-musl | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-riscv64-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-riscv64-musl | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-s390x-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-x64-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-linux-x64-musl | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-openbsd-x64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-openharmony-arm64 | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-win32-arm64-msvc | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-win32-ia32-msvc | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-win32-x64-gnu | 4.59.0 | MIT | runtime or build dependency; optional |
| @rollup/rollup-win32-x64-msvc | 4.59.0 | MIT | runtime or build dependency; optional |
| @standard-schema/spec | 1.1.0 | MIT | development |
| @tailwindcss/node | 4.2.1 | MIT | runtime or build dependency |
| @tailwindcss/oxide | 4.2.1 | MIT | runtime or build dependency |
| @tailwindcss/oxide-android-arm64 | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-darwin-arm64 | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-darwin-x64 | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-freebsd-x64 | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-linux-arm-gnueabihf | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-linux-arm64-gnu | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-linux-arm64-musl | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-linux-x64-gnu | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-linux-x64-musl | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-wasm32-wasi | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-win32-arm64-msvc | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/oxide-win32-x64-msvc | 4.2.1 | MIT | runtime or build dependency; optional |
| @tailwindcss/vite | 4.2.1 | MIT | runtime or build dependency |
| @types/babel__core | 7.20.5 | MIT | development |
| @types/babel__generator | 7.27.0 | MIT | development |
| @types/babel__template | 7.4.4 | MIT | development |
| @types/babel__traverse | 7.28.0 | MIT | development |
| @types/chai | 5.2.3 | MIT | development |
| @types/deep-eql | 4.0.2 | MIT | development |
| @types/estree | 1.0.8 | MIT | runtime or build dependency |
| @types/json-schema | 7.0.15 | MIT | development |
| @types/node | 24.10.14 | MIT | runtime or build dependency |
| @types/react | 19.2.14 | MIT | runtime or build dependency |
| @types/react-dom | 19.2.3 | MIT | development |
| @typescript-eslint/eslint-plugin | 8.72.2 | MIT | development |
| ignore | 7.0.14 | MIT | development |
| @typescript-eslint/parser | 8.72.2 | MIT | development |
| @typescript-eslint/project-service | 8.72.2 | MIT | development |
| @typescript-eslint/scope-manager | 8.72.2 | MIT | development |
| @typescript-eslint/tsconfig-utils | 8.72.2 | MIT | development |
| @typescript-eslint/type-utils | 8.72.2 | MIT | development |
| @typescript-eslint/types | 8.72.2 | MIT | development |
| @typescript-eslint/typescript-estree | 8.72.2 | MIT | development |
| balanced-match | 4.0.4 | MIT | development |
| brace-expansion | 5.0.13 | MIT | development |
| minimatch | 11.0.8 | BlueOak-1.0.0 | development |
| semver | 7.8.6 | ISC | development |
| @typescript-eslint/utils | 8.72.2 | MIT | development |
| @typescript-eslint/visitor-keys | 8.72.2 | MIT | development |
| eslint-visitor-keys | 5.0.1 | Apache-2.0 | development |
| @vitejs/plugin-react | 5.1.4 | MIT | development |
| @vitest/expect | 4.1.12 | MIT | development |
| @vitest/mocker | 4.1.12 | MIT | development |
| estree-walker | 3.0.3 | MIT | development |
| @vitest/pretty-format | 4.1.12 | MIT | development |
| @vitest/runner | 4.1.12 | MIT | development |
| @vitest/snapshot | 4.1.12 | MIT | development |
| @vitest/spy | 4.1.12 | MIT | development |
| @vitest/utils | 4.1.12 | MIT | development |
| acorn | 8.19.0 | MIT | development |
| acorn-jsx | 5.3.2 | MIT | development |
| ansi-styles | 4.3.0 | MIT | development |
| argparse | 2.0.1 | Python-2.0 | development |
| assertion-error | 2.0.1 | MIT | development |
| balanced-match | 1.0.2 | MIT | development |
| baseline-browser-mapping | 2.11.34 | Apache-2.0 | development |
| brace-expansion | 1.1.21 | MIT | development |
| browserslist | 4.29.5 | MIT | development |
| callsites | 3.1.0 | MIT | development |
| caniuse-lite | 1.0.30001820 | CC-BY-4.0 | development |
| chai | 6.3.0 | MIT | development |
| chalk | 4.1.2 | MIT | development |
| clsx | 2.1.1 | MIT | runtime or build dependency |
| color-convert | 2.0.1 | MIT | development |
| color-name | 1.1.4 | MIT | development |
| concat-map | 0.0.1 | MIT | development |
| convert-source-map | 2.0.0 | MIT | development |
| cookie | 1.1.1 | MIT | runtime or build dependency |
| core-util-is | 1.0.3 | MIT | runtime or build dependency |
| cross-spawn | 7.0.6 | MIT | development |
| csstype | 3.2.3 | MIT | runtime or build dependency |
| debug | 4.4.3 | MIT | development |
| deep-is | 0.1.4 | MIT | development |
| detect-libc | 2.1.2 | Apache-2.0 | runtime or build dependency |
| electron-to-chromium | 1.5.472 | ISC | development |
| enhanced-resolve | 5.19.0 | MIT | runtime or build dependency |
| esbuild | 0.27.2 | MIT | runtime or build dependency |
| escalade | 3.2.0 | MIT | development |
| escape-string-regexp | 4.0.0 | MIT | development |
| eslint | 9.39.5 | MIT | development |
| eslint-plugin-react-hooks | 7.0.1 | MIT | development |
| eslint-plugin-react-refresh | 0.4.26 | MIT | development |
| eslint-scope | 8.4.0 | BSD-2-Clause | development |
| eslint-visitor-keys | 4.2.1 | Apache-2.0 | development |
| ajv | 6.15.0 | MIT | development |
| json-schema-traverse | 0.4.1 | MIT | development |
| espree | 10.4.0 | BSD-2-Clause | development |
| esquery | 1.7.0 | BSD-3-Clause | development |
| esrecurse | 4.3.0 | BSD-2-Clause | development |
| estraverse | 5.3.0 | BSD-2-Clause | development |
| esutils | 2.0.3 | BSD-2-Clause | development |
| expect-type | 1.3.0 | Apache-2.0 | development |
| fake-indexeddb | 6.2.4 | Apache-2.0 | development |
| fast-deep-equal | 3.1.3 | MIT | development |
| fast-json-stable-stringify | 2.1.0 | MIT | development |
| fast-levenshtein | 2.0.6 | MIT | development |
| fdir | 6.5.0 | MIT | runtime or build dependency |
| file-entry-cache | 8.0.0 | MIT | development |
| find-up | 5.0.0 | MIT | development |
| flat-cache | 4.0.1 | MIT | development |
| flatted | 3.4.4 | ISC | development |
| fsevents | 2.3.3 | MIT | runtime or build dependency; optional |
| gensync | 1.0.0-beta.2 | MIT | development |
| glob-parent | 6.0.2 | ISC | development |
| globals | 16.5.0 | MIT | development |
| graceful-fs | 4.2.11 | ISC | runtime or build dependency |
| has-flag | 4.0.0 | MIT | development |
| hermes-estree | 0.25.1 | MIT | development |
| hermes-parser | 0.25.1 | MIT | development |
| ignore | 5.3.2 | MIT | development |
| immediate | 3.0.6 | MIT | runtime or build dependency |
| immer | 11.1.4 | MIT | runtime or build dependency |
| import-fresh | 3.3.1 | MIT | development |
| resolve-from | 4.0.0 | MIT | development |
| imurmurhash | 0.1.4 | MIT | development |
| inherits | 2.0.4 | ISC | runtime or build dependency |
| is-extglob | 2.1.1 | MIT | development |
| is-glob | 4.0.3 | MIT | development |
| isarray | 1.0.0 | MIT | runtime or build dependency |
| isexe | 2.0.0 | ISC | development |
| jiti | 2.6.1 | MIT | runtime or build dependency |
| js-tokens | 4.0.0 | MIT | development |
| js-yaml | 4.3.2 | MIT | development |
| jsesc | 3.1.0 | MIT | development |
| json-buffer | 3.0.1 | MIT | development |
| json-stable-stringify-without-jsonify | 1.0.1 | MIT | development |
| json5 | 2.2.3 | MIT | development |
| jszip | 3.10.1 | (MIT OR GPL-3.0-or-later) | runtime or build dependency |
| keyv | 4.5.4 | MIT | development |
| levn | 0.4.1 | MIT | development |
| lie | 3.3.0 | MIT | runtime or build dependency |
| lightningcss | 1.31.1 | MPL-2.0 | runtime or build dependency |
| lightningcss-android-arm64 | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-darwin-arm64 | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-darwin-x64 | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-freebsd-x64 | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-linux-arm-gnueabihf | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-linux-arm64-gnu | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-linux-arm64-musl | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-linux-x64-gnu | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-linux-x64-musl | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-win32-arm64-msvc | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| lightningcss-win32-x64-msvc | 1.31.1 | MPL-2.0 | runtime or build dependency; optional |
| locate-path | 6.0.0 | MIT | development |
| lodash.merge | 4.6.2 | MIT | development |
| lru-cache | 5.1.1 | ISC | development |
| lucide-react | 0.575.0 | ISC | runtime or build dependency |
| magic-string | 0.30.21 | MIT | runtime or build dependency |
| minimatch | 3.1.5 | ISC | development |
| ms | 2.1.3 | MIT | development |
| nanoid | 3.3.20 | MIT | runtime or build dependency |
| natural-compare | 1.4.0 | MIT | development |
| node-releases | 2.0.63 | MIT | development |
| obug | 2.1.1 | MIT | development |
| optionator | 0.9.4 | MIT | development |
| p-limit | 3.1.0 | MIT | development |
| p-locate | 5.0.0 | MIT | development |
| pako | 1.0.11 | (MIT AND Zlib) | runtime or build dependency |
| parent-module | 1.0.1 | MIT | development |
| path-exists | 4.0.0 | MIT | development |
| path-key | 3.1.1 | MIT | development |
| pathe | 2.0.3 | MIT | development |
| pdfjs-dist | 6.4.299 | Apache-2.0 | runtime or build dependency |
| picocolors | 1.1.1 | ISC | runtime or build dependency |
| picomatch | 4.0.7 | MIT | runtime or build dependency |
| postcss | 8.5.32 | MIT | runtime or build dependency |
| prelude-ls | 1.2.1 | MIT | development |
| process-nextick-args | 2.0.1 | MIT | runtime or build dependency |
| punycode | 2.3.1 | MIT | development |
| react | 19.2.4 | MIT | runtime or build dependency |
| react-dom | 19.2.4 | MIT | runtime or build dependency |
| react-refresh | 0.18.0 | MIT | development |
| react-router | 7.18.5 | MIT | runtime or build dependency |
| react-router-dom | 7.18.5 | MIT | runtime or build dependency |
| readable-stream | 2.3.8 | MIT | runtime or build dependency |
| rollup | 4.59.0 | MIT | runtime or build dependency |
| safe-buffer | 5.1.2 | MIT | runtime or build dependency |
| scheduler | 0.27.0 | MIT | runtime or build dependency |
| semver | 6.3.1 | ISC | development |
| set-cookie-parser | 2.7.3 | MIT | runtime or build dependency |
| setimmediate | 1.0.5 | MIT | runtime or build dependency |
| shebang-command | 2.0.0 | MIT | development |
| shebang-regex | 3.0.0 | MIT | development |
| siginfo | 2.0.0 | ISC | development |
| sonner | 2.0.7 | MIT | runtime or build dependency |
| source-map-js | 1.2.2 | BSD-3-Clause | runtime or build dependency |
| stackback | 0.0.2 | MIT | development |
| std-env | 4.3.0 | MIT | development |
| string_decoder | 1.1.1 | MIT | runtime or build dependency |
| strip-json-comments | 3.1.1 | MIT | development |
| supports-color | 7.2.0 | MIT | development |
| tailwind-merge | 3.5.0 | MIT | runtime or build dependency |
| tailwindcss | 4.2.1 | MIT | runtime or build dependency |
| tapable | 2.3.0 | MIT | runtime or build dependency |
| tinybench | 2.9.0 | MIT | development |
| tinyexec | 1.0.2 | MIT | development |
| tinyglobby | 0.2.15 | MIT | runtime or build dependency |
| tinyrainbow | 3.2.0 | MIT | development |
| ts-api-utils | 2.5.0 | MIT | development |
| tslib | 2.8.1 | 0BSD | runtime or build dependency |
| type-check | 0.4.0 | MIT | development |
| typescript | 5.9.3 | Apache-2.0 | development |
| typescript-eslint | 8.72.2 | MIT | development |
| undici-types | 7.16.0 | MIT | runtime or build dependency |
| update-browserslist-db | 1.3.4 | MIT | development |
| uri-js | 4.4.1 | BSD-2-Clause | development |
| util-deprecate | 1.0.2 | MIT | runtime or build dependency |
| vite | 7.3.7 | MIT | runtime or build dependency |
| vitest | 4.1.12 | MIT | development |
| es-module-lexer | 2.3.2 | MIT | development |
| which | 2.0.2 | ISC | development |
| why-is-node-running | 2.3.0 | MIT | development |
| word-wrap | 1.2.5 | MIT | development |
| yallist | 3.1.1 | ISC | development |
| yocto-queue | 0.1.0 | MIT | development |
| zod | 4.6.7 | MIT | development |
| zod-validation-error | 4.0.2 | MIT | development |
| zustand | 5.0.11 | MIT | runtime or build dependency |
