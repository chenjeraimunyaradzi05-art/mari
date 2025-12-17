const { runSeed } = require('./seedHelper')

module.exports = async () => {
  console.log('Playwright global setup: running seed...')
  if (process.env.PLAYWRIGHT_SKIP_SEED === '1' || process.env.PLAYWRIGHT_SKIP_SEED === 'true') {
    console.warn('PLAYWRIGHT_SKIP_SEED is set — skipping DB seed (tests may fail if they rely on seeded data)')
    return
  }

  try {
    runSeed()
    console.log('Seed finished')
  } catch (e) {
    console.error('\nSeed failed. Common causes: Docker/MySQL not running or DATABASE_URL misconfigured.')
    console.error('Action: start the DB with `docker-compose up -d` in `guide/` (requires Docker to be running),')
    console.error('or set PLAYWRIGHT_SKIP_SEED=1 to skip seeding (not recommended for full e2e).')
    console.error('Full error:')
    console.error(e)
    throw e
  }
}
