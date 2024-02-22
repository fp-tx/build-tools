import { exec } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

// import { makeConfig } from '../src'

describe('test projects', () => {
  test('index-ref', async () => {
    await promisify(exec)('npm install', {
      cwd: path.join(__dirname, 'test-projects/index-ref'),
    })

    await promisify(exec)('npx tsup', {
      cwd: path.join(__dirname, 'test-projects/index-ref'),
    })

    await new Promise<void>((resolve, reject) => {
      const attw = exec('npx attw --pack .', {
        cwd: path.join(__dirname, 'test-projects/index-ref/dist'),
      })
      attw.stdout?.on('data', data => console.log(data))
      attw.on('close', code => {
        if (code === 0) resolve()
        else reject('attw failed')
      })
    })
  }, 10000)
})
