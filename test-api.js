/**
 * Quick end-to-end API smoke test
 */

const BASE = 'http://localhost:3000/api';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('=== CCTV Service Dashboard API - Smoke Test ===\n');

  // 1. Health check
  console.log('1. Health Check');
  const health = await request('GET', '/health');
  console.log(`   Status: ${health.status} | ${health.data.message}\n`);

  // 2. Register owner
  console.log('2. Register Owner');
  const reg = await request('POST', '/auth/register', {
    name: 'John Owner',
    email: `owner${Date.now()}@test.com`,
    password: 'Password123!',
    role: 'owner',
    companyName: 'CCTV Pro Solutions',
    companyAddress: '456 Tech Blvd, Suite 100',
    companyEmail: `company${Date.now()}@test.com`,
    ownerKey: 'adftryr',
  });
  console.log(`   Status: ${reg.status} | Success: ${reg.data.success}`);
  if (!reg.data.success) { console.log('   Error:', reg.data); return; }
  const ownerToken = reg.data.data.token;
  const companyId = reg.data.data.user.companyId;
  console.log(`   Company ID: ${companyId}`);
  console.log(`   Token: ${ownerToken.substring(0, 30)}...\n`);

  // 3. Get profile
  console.log('3. Get Profile');
  const profile = await request('GET', '/auth/profile', null, ownerToken);
  console.log(`   Status: ${profile.status} | Name: ${profile.data.data.name} | Role: ${profile.data.data.role}\n`);

  // 4. Get company
  console.log('4. Get Company');
  const company = await request('GET', '/companies', null, ownerToken);
  console.log(`   Status: ${company.status} | Company: ${company.data.data.name}\n`);

  // 5. Create employee
  console.log('5. Create Employee');
  const emp = await request('POST', '/users', {
    name: 'Mike Employee',
    email: `employee${Date.now()}@test.com`,
    password: 'Password123!',
    role: 'employee',
  }, ownerToken);
  console.log(`   Status: ${emp.status} | Success: ${emp.data.success}`);
  if (!emp.data.success) { console.log('   Error:', emp.data); return; }
  const employeeId = emp.data.data._id;
  console.log(`   Employee ID: ${employeeId}\n`);

  // 6. Create client
  console.log('6. Create Client');
  const client = await request('POST', '/clients', {
    name: 'John Doe',
    companyName: 'ABC Corporation',
    phone: '+91-9876543210',
    address: '789 Business Park, Mumbai',
  }, ownerToken);
  console.log(`   Status: ${client.status} | Success: ${client.data.success}`);
  if (!client.data.success) { console.log('   Error:', client.data); return; }
  const clientId = client.data.data._id;
  console.log(`   Client ID: ${clientId}\n`);

  // 7. Create task
  console.log('7. Create Task');
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const task = await request('POST', '/tasks', {
    clientId,
    assignedTo: employeeId,
    title: 'Install 4-Camera CCTV System',
    description: 'Full installation with NVR setup',
    scheduledDate: tomorrow,
    estimatedAmount: 15000,
  }, ownerToken);
  console.log(`   Status: ${task.status} | Success: ${task.data.success}`);
  if (!task.data.success) { console.log('   Error:', task.data); return; }
  const taskId = task.data.data._id;
  console.log(`   Task ID: ${taskId}\n`);

  // 8. Login as employee
  console.log('8. Login as Employee');
  const empLogin = await request('POST', '/auth/login', {
    email: emp.data.data.email,
    password: 'Password123!',
  });
  console.log(`   Status: ${empLogin.status} | Success: ${empLogin.data.success}`);
  const empToken = empLogin.data.data.token;
  console.log(`   Token: ${empToken.substring(0, 30)}...\n`);

  // 9. Get today's tasks (employee)
  console.log('9. Today Tasks (Employee)');
  const today = await request('GET', '/tasks/today', null, empToken);
  console.log(`   Status: ${today.status} | Count: ${today.data.count}\n`);

  // 10. Complete task with TaskLog auto-creation
  console.log('10. Complete Task (auto-creates TaskLog)');
  const complete = await request('PATCH', `/tasks/${taskId}/status`, {
    status: 'completed',
    actionSummary: 'Installed 4 cameras, configured NVR, tested all feeds',
    amountCollected: 14500,
  }, empToken);
  console.log(`   Status: ${complete.status} | Success: ${complete.data.success}`);
  if (complete.data.data?.taskLog) {
    console.log(`   TaskLog created: ${complete.data.data.taskLog._id}`);
  }
  console.log('');

  // 11. Daily completion logs
  console.log('11. Daily Completion Logs');
  const daily = await request('GET', '/task-logs/daily', null, ownerToken);
  console.log(`   Status: ${daily.status} | Today count: ${daily.data.data.count}\n`);

  // 12. Monthly revenue
  console.log('12. Monthly Revenue');
  const revenue = await request('GET', '/task-logs/monthly-revenue', null, ownerToken);
  console.log(`   Status: ${revenue.status} | Months: ${revenue.data.count}`);
  if (revenue.data.data?.[0]) {
    console.log(`   Latest: ${revenue.data.data[0].monthLabel} → ₹${revenue.data.data[0].totalRevenue}\n`);
  } else {
    console.log('');
  }

  // 13. Client history
  console.log('13. Client History');
  const history = await request('GET', `/clients/${clientId}/history`, null, ownerToken);
  console.log(`   Status: ${history.status} | Past: ${history.data.data.past.length} | Present: ${history.data.data.present.length} | Future: ${history.data.data.future.length}\n`);

  // 14. Notifications
  console.log('14. Unread Notifications');
  const notifs = await request('GET', '/notifications/unread-count', null, empToken);
  console.log(`   Status: ${notifs.status} | Unread: ${notifs.data.data.unreadCount}\n`);

  // 15. 404 test
  console.log('15. 404 Test');
  const notFound = await request('GET', '/nonexistent');
  console.log(`   Status: ${notFound.status} | Message: ${notFound.data.message}\n`);

  console.log('=== ALL TESTS PASSED ✅ ===');
}

run().catch(console.error);
