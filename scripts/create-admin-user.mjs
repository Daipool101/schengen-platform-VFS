/**
 * Creates the default VFS agent user via the /auth/register endpoint.
 * Run: node scripts/create-admin-user.mjs
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

const users = [
  { email: 'agent@vfs.com', password: 'Agent@1234', full_name: 'VFS Agent' },
];

for (const user of users) {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    const data = await res.json();

    if (res.ok) {
      console.log(`✅ Created user: ${user.email}`);
      console.log(`   Token: ${data.access_token?.slice(0, 40)}...`);
    } else if (res.status === 409) {
      console.log(`ℹ️  User already exists: ${user.email}`);
    } else {
      console.error(`❌ Failed to create ${user.email}:`, data);
    }
  } catch (err) {
    console.error(`❌ Network error for ${user.email}:`, err.message);
    console.log('   Make sure the backend is running on', API_URL);
  }
}
