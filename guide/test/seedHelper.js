const { execSync } = require('child_process')
const path = require('path')

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

function runSeed() {
  const cwd = path.resolve(__dirname, '..')
  console.log('Running seed in', cwd)

  const maxAttempts = 3
  let attempt = 0
  while (attempt < maxAttempts) {
    try {
      attempt++
      console.log(`Seeding attempt ${attempt}/${maxAttempts}...`)
      execSync('npm run seed:dev', { cwd, stdio: 'inherit' })
      return
    } catch (err) {
      console.error(`Seed attempt ${attempt} failed:`)
      console.error(err.message || err)
      if (attempt >= maxAttempts) {
        throw err
      }
      const backoff = 2000 * attempt
      console.log(`Waiting ${backoff}ms before retrying...`)
      // synchronous sleep not available; busy-waiting avoided - use blocking exec
      const end = Date.now() + backoff
      while (Date.now() < end) {}
    }
  }
}

module.exports = { runSeed }
