async function fetchUserProfile(db, userId) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('Database client is required to fetch profile.');
  }

  const result = await db.query(
    `
      SELECT id, name, email, role, daily_quota, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

module.exports = {
  fetchUserProfile,
};
