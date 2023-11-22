<br>
<div align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/fp-tx/build-tools/assets/build-tools-logo-dark.png">
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fp-tx/build-tools/assets/build-tools-logo-light.png">
    <img alt="schemata-ts" src="https://raw.githubusercontent.com/fp-tx/build-tools/assets/build-tools-logo-purple.png">
  </picture>
</div>
<br>

# build-tools

`@fp-tx/build-tools` is a thin wrapper around `tsup` for the purpose of building dual ESM/CJS packages. It contains a chief export `makeConfig` which will read from a configurable source directory and determine which files to include as entrypoints. Using these entrypoints, it also adds dynamic "exports" field with `types`, `import`, and `default` fields based on the determined entrypoints.

# Configuration
