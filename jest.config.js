/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.(m?t|j)sx?$': '@swc/jest',
  },
}

module.exports = config
