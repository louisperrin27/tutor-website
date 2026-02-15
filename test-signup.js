// Quick test script to verify signup endpoint
// Run with: node test-signup.js

import fetch from 'node-fetch';

const testData = {
  name: 'test one',
  email: 'test1@example.com',
  password: 'test1111!!'
};

async function testSignup() {
  try {
    console.log('Testing signup with:', testData);
    console.log('Sending request to: http://localhost:3000/api/signup');
    
    const response = await fetch('http://localhost:3000/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('\nResponse Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Signup successful!');
    } else {
      console.log('\n❌ Signup failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Make sure the server is running on http://localhost:3000');
  }
}

testSignup();
