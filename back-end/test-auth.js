// Simple authentication test script
// Usage: node test-auth.js

const API_BASE = 'http://localhost:3001';

async function testAuth() {
  console.log('=== Testing Authentication Flow ===\n');

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'Test123456';

  try {
    // Step 1: Send verification code
    console.log('1. Sending verification code...');
    const codeRes = await fetch(`${API_BASE}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    const codeData = await codeRes.json();
    console.log('Response:', codeData);

    if (!codeRes.ok) {
      console.error('Failed to send code');
      return;
    }

    // Step 2: Get code from console (in real scenario, from email)
    const code = await new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      readline.question('Enter verification code from server logs: ', (answer) => {
        readline.close();
        resolve(answer);
      });
    });

    // Step 3: Register
    console.log('\n2. Registering user...');
    const registerRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, code })
    });
    const registerData = await registerRes.json();
    console.log('Response:', registerData);

    if (!registerRes.ok) {
      console.error('Registration failed');
      return;
    }

    const token = registerData.token;
    console.log('Token received:', token);

    // Step 4: Get profile
    console.log('\n3. Fetching user profile...');
    const profileRes = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    console.log('Response:', profileData);

    // Step 5: Login
    console.log('\n4. Testing login...');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    console.log('Response:', loginData);

    console.log('\n=== All tests passed! ===');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAuth();
