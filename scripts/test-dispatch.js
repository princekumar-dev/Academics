// Test the scheduled dispatch by calling the API endpoint
async function testDispatch() {
  try {
    const response = await fetch('http://localhost:3001/api/scheduled-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process-due' })
    })
    
    const result = await response.json()
    console.log('Response:', result)
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testDispatch()
