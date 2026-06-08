/**
 * Quick SMTP test — run with: bun test_smtp.js
 */
import tls from 'tls';

const SMTP_HOST = 'shriiitrackingsolution.in';
const SMTP_PORT = 465;
const FROM_EMAIL = 'smit@shriiitrackingsolution.in';
const FROM_EMAIL_PASS = 'Smit@63547';
const TO_EMAIL = 'smit@shriiitrackingsolution.in'; // send to yourself

const readResponse = (socket, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    let data = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`SMTP timed out. Partial: ${data}`));
    }, timeoutMs);

    const onData = (chunk) => {
      data += chunk.toString();
      console.log('  ← ', chunk.toString().trim());
      const lines = data.split('\r\n');
      for (const line of lines) {
        if (/^\d{3} /.test(line)) {
          cleanup();
          resolve(data.trim());
          return;
        }
      }
    };
    const onError = (err) => { cleanup(); reject(err); };
    const onClose = () => { cleanup(); resolve(data.trim()); };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    };
    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });

const sendCmd = async (socket, cmd) => {
  console.log('  → ', cmd.startsWith('AUTH') || cmd.length > 50 ? cmd.substring(0, 30) + '...' : cmd);
  socket.write(cmd + '\r\n');
  return readResponse(socket);
};

const assertCode = (resp, codes, step) => {
  const code = parseInt(resp.substring(0, 3), 10);
  if (!codes.includes(code)) throw new Error(`${step} failed [${code}]: ${resp}`);
  console.log(`  ✅ ${step} OK`);
};

const main = async () => {
  console.log(`\n🔌 Connecting to ${SMTP_HOST}:${SMTP_PORT} via TLS...\n`);

  const socket = await new Promise((resolve, reject) => {
    const sock = tls.connect(
      { host: SMTP_HOST, port: SMTP_PORT, rejectUnauthorized: false },
      () => { console.log('  ✅ TLS connected\n'); resolve(sock); },
    );
    sock.on('error', (err) => { console.error('  ❌ TLS error:', err.message); reject(err); });
  });

  try {
    const greeting = await readResponse(socket);
    assertCode(greeting, [220], 'Greeting');

    const ehlo = await sendCmd(socket, `EHLO ${SMTP_HOST}`);
    assertCode(ehlo, [250], 'EHLO');

    const authStart = await sendCmd(socket, 'AUTH LOGIN');
    assertCode(authStart, [334], 'AUTH LOGIN');

    const userResp = await sendCmd(socket, Buffer.from(FROM_EMAIL).toString('base64'));
    assertCode(userResp, [334], 'Username');

    const passResp = await sendCmd(socket, Buffer.from(FROM_EMAIL_PASS).toString('base64'));
    assertCode(passResp, [235], 'Password');

    const mailFrom = await sendCmd(socket, `MAIL FROM:<${FROM_EMAIL}>`);
    assertCode(mailFrom, [250], 'MAIL FROM');

    const rcptTo = await sendCmd(socket, `RCPT TO:<${TO_EMAIL}>`);
    assertCode(rcptTo, [250], 'RCPT TO');

    const dataResp = await sendCmd(socket, 'DATA');
    assertCode(dataResp, [354], 'DATA');

    const message = [
      `From: ${FROM_EMAIL}`,
      `To: ${TO_EMAIL}`,
      `Subject: SMTP Test from CCTV Backend`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      'This is a test email from the CCTV Backend SMTP test script.',
      '',
      `Sent at: ${new Date().toISOString()}`,
    ].join('\r\n');

    const sendDone = await sendCmd(socket, message + '\r\n.');
    assertCode(sendDone, [250], 'Message delivery');

    console.log('\n🎉 Email sent successfully!\n');
    socket.write('QUIT\r\n');
  } catch (err) {
    console.error('\n❌ SMTP Error:', err.message, '\n');
  } finally {
    socket.destroy();
  }
};

main();
