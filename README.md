<br>
<div align="center">
  <picture>
    <img alt="@fp-tx/build-tools" src="https://github.com/fp-tx/build-tools/assets/7153123/a201ed6a-8d81-4d3b-8e3e-17ab71ca4247">
  </picture>
</div>
<br>

# build-tools

`@fp-tx/build-tools` is a thin wrapper around `tsup` for the purpose of building dual ESM/CJS packages. It contains a chief export `makeConfig` which will read from a configurable source directory and determine which files to include as entrypoints. Using these entrypoints, it also adds a dynamic "exports" field with `import` and `default` fields based on the determined entrypoints and module type (determined by `package.json > type`).

Additionally, `build-tools` will emit smart declaration files with rewritten import, export, and `declare module` paths.

## Usage

```ts
// tsup.config.js
import { makeConfig } from '@fp-tx/build-tools'

const config = makeConfig(
  // Configuration Parameters
  {
    buildType: 'dual',
    buildMode: {
      type: 'Single',
      entrypoint: 'index.ts',
    },
    iife: false,

    srcDir: 'src',
    basePath: '.',
    outDir: 'dist',

    emitTypes: true,
    dtsConfig: 'tsconfig.json',

    omittedPackageKeys: ['devDependencies', 'scripts', 'lint-staged'],
    copyFiles: ['README.md', 'LICENSE'],
    // ^^^ These are the default options
  },
  // Tsup options (overrides the above)
  {
    clean: true,
  },
  // CLI options override both of the above
)

export default config
```

## Installation

### PNPM

```console
pnpm add -D tsup @fp-tx/build-tools
```

### Yarn

```console
yarn add -D tsup @fp-tx/build-tools
```

### NPM

```console
npm install -D tsup @fp-tx/build-tools
```

## Configuration Parameters

| Parameter          | Type                    | Description                                                                                    | Default                                      |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| iife               | `boolean`               | Include IIFE generation as fallback. This setting is recommended for single-target builds      | `false`                                      |
| emitTypes          | `boolean`               | Generate `.d.ts`, and `.d.cts` or `.d.mts` files                                               | `true`                                       |
| dtsConfig          | `string`                | The `tsconfig.json` for types generation                                                       | `tsconfig.json`                              |
| srcDir             | `string`                | The source directory to read from                                                              | `'src'`                                      |
| basePath           | `string`                | The current working directory                                                                  | `'.'`                                        |
| buildMode          | `BuildMode`             | Determines the package entrypoints, "Single" and `entrypoint` or "Multi" and `entrypointGlobs` | `{ type: "Single", entrypoint: "index.ts" }` |
| buildType          | `cjs`, `esm`, or `dual` | Determines the output module format along with `package.json > type`                           | `dual`                                       |
| omittedPackageKeys | `ReadonlyArray<string>` | Array of keys to omit from the package.json file                                               | `["devDependencies", "scripts"]`             |
| copyFiles          | `ReadonlyArray<string>` | Whether to copy non-typescript files                                                           | `['README.md', 'LICENSE']`                   |
| outDir             | `string`                | The output directory                                                                           | `dist`                                       |
