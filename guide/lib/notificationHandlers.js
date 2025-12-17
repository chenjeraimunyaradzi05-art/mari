const { prisma } = require('./prisma')

async function getNotificationsForUser(userId) {
  if (!userId) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  const notifications = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 200 })
  return { notifications }
}

async function markNotificationsRead(userId, ids) {
  if (!userId) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    const err = new Error('Validation')
    err.status = 422
    throw err
  }
  const updated = await prisma.notification.updateMany({ where: { id: { in: ids }, userId }, data: { isRead: true } })
  return { count: updated.count }
}

module.exports = { getNotificationsForUser, markNotificationsRead }
