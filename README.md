<br>
<div align="center">
  <picture>
    <img alt="@fp-tx/build-tools" src="https://github.com/fp-tx/build-tools/assets/7153123/a201ed6a-8d81-4d3b-8e3e-17ab71ca4247">
  </picture>
</div>
<br>

# build-tools

`@fp-tx/build-tools` is a thin wrapper around `tsup` for the purpose of building dual ESM/CJS packages. It contains a chief export `makeConfig` which will read from a configurable source directory and determine which files to include as entrypoints. Using these entrypoints, it also adds a dynamic "exports" field with `import` and `default` fields based on the determined entrypoints and module type (determined by `package.json > type`).

## Usage

```ts
// tsup.config.ts
import { makeConfig } from '@fp-tx/build-tools'

const config = makeConfig(
  // Configuration Parameters
  {
    getEntrypoints: srcFiles => srcFiles.map(file => file.name),
  },
  // Tsup options (overrides the above)
  {
    tsconfig: './tsconfig.build.json',
  },
  // CLI options override both of the above
)

export default config
```

## Configuration Parameters

| Parameter          | Type     | Description                                                                           | Default                          |
| ------------------ | -------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| iife               | boolean  | Include IIFE generation for browser script tags (that don't support module scripts)   | `false`                          |
| srcDir             | string   | The source directory to read from                                                     | `'src'`                          |
| basePath           | string   | The current working directory                                                         | `'.'`                            |
| getEntrypoints     | function | A function which maps resolved entrypoints in "src" to their respective output paths. | all src `.ts(x?)` files          |
| omittedPackageKeys | array    | Array of keys to omit from the package.json file                                      | `["devDependencies", "scripts"]` |
| copyFiles          | boolean  | Whether to copy non-typescript files                                                  | `[]`                             |
| outDir             | string   | The output directory                                                                  | `dist`                           |
| minify             | boolean  | Whether to minify the output                                                          | `false`                          |
| splitting          | boolean  | Whether to enable code splitting                                                      | `false`                          |
| sourcemap          | boolean  | Whether to generate source maps                                                       | `true`                           |
| dts                | boolean  | Whether to generate declaration files                                                 | `true`                           |
| experimentalDts    | boolean  | Whether to emit experimental declaration files                                        | `false`                          |
| clean              | boolean  | Whether to cleanup dist before building                                               | `true`                           |
| platform           | string   | Target platform                                                                       | `'neutral'`                      |
