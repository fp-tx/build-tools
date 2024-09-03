/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.(m?t|j)sx?$': '@swc/jest',
  },
  testTimeout: 20000,
}

module.exports = config
