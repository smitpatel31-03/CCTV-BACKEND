/**
 * @fileoverview Email service using raw SMTP with STARTTLS (port 25/587)
 * or implicit TLS (port 465). Uses Node's built-in `net` and `tls` modules —
 * no Nodemailer dependency.
 *
 * @module utils/emailService
 */

import net from 'net';
import tls from 'tls';
import { env } from '../config/env.js';

// ── Raw SMTP helpers ─────────────────────────────────────────────────────────

/**
 * Read a full SMTP response from the socket.
 * Resolves once a line matching a 3-digit status code followed by a space is received.
 *
 * @param {net.Socket|tls.TLSSocket} socket
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<string>}
 */
const readResponse = (socket, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    let data = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`SMTP response timed out. Partial data: ${data}`));
    }, timeoutMs);

    const onData = (chunk) => {
      data += chunk.toString();
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

/**
 * Send a command and wait for the SMTP server response.
 *
 * @param {net.Socket|tls.TLSSocket} socket
 * @param {string} command
 * @returns {Promise<string>}
 */
const sendCommand = async (socket, command) => {
  socket.write(command + '\r\n');
  return readResponse(socket);
};

/**
 * Validate that an SMTP response starts with one of the expected status codes.
 *
 * @param {string} response
 * @param {number[]} expectedCodes
 * @param {string} step
 */
const assertCode = (response, expectedCodes, step) => {
  const code = parseInt(response.substring(0, 3), 10);
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP ${step} failed: ${response}`);
  }
};

/**
 * Upgrade a plain socket to TLS using STARTTLS.
 *
 * @param {net.Socket} socket
 * @param {string} host
 * @returns {Promise<tls.TLSSocket>}
 */
const upgradeToTLS = (socket, host) =>
  new Promise((resolve, reject) => {
    const tlsSocket = tls.connect(
      { socket, host, rejectUnauthorized: false },
      () => resolve(tlsSocket),
    );
    tlsSocket.on('error', reject);
  });

/**
 * Send an email via SMTP.
 * - Port 465: Implicit TLS (connects directly over TLS)
 * - Port 25/587: STARTTLS (connects plain, upgrades to TLS)
 *
 * @param {Object} options
 * @param {string} options.to      - Recipient email address.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.text    - Plain-text email body.
 * @param {string} [options.html]  - HTML email body (optional).
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
  // ── Guard: skip if SMTP is not configured ──────────────────────────────
  if (!env.SMTP_HOST || !env.FROM_EMAIL) {
    console.log('\n' + '═'.repeat(60));
    console.log('📧 EMAIL (SMTP not configured — logged only)');
    console.log('═'.repeat(60));
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:\n${text}`);
    console.log('═'.repeat(60) + '\n');
    return;
  }

  const port = env.SMTP_PORT;
  const useImplicitTLS = port === 465;

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Build MIME message
  const messageParts = [
    `From: ${env.FROM_EMAIL}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
  ];

  if (html) {
    messageParts.push(
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
    );
  }

  messageParts.push('', `--${boundary}--`, '');
  const message = messageParts.join('\r\n');

  // ── Connect ────────────────────────────────────────────────────────────
  let socket;

  if (useImplicitTLS) {
    // Port 465: Implicit TLS
    socket = await new Promise((resolve, reject) => {
      const sock = tls.connect(
        { host: env.SMTP_HOST, port, rejectUnauthorized: false },
        () => resolve(sock),
      );
      sock.on('error', reject);
    });
  } else {
    // Port 25/587: Plain connection first, then STARTTLS
    socket = await new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: env.SMTP_HOST, port }, () => resolve(sock));
      sock.on('error', reject);
    });
  }

  try {
    // Greeting
    const greeting = await readResponse(socket);
    assertCode(greeting, [220], 'greeting');

    // EHLO
    let ehlo = await sendCommand(socket, `EHLO ${env.SMTP_HOST}`);
    assertCode(ehlo, [250], 'EHLO');

    // STARTTLS upgrade (for port 25/587)
    if (!useImplicitTLS) {
      const starttls = await sendCommand(socket, 'STARTTLS');
      assertCode(starttls, [220], 'STARTTLS');

      // Upgrade connection to TLS
      socket = await upgradeToTLS(socket, env.SMTP_HOST);

      // Re-send EHLO after TLS upgrade
      ehlo = await sendCommand(socket, `EHLO ${env.SMTP_HOST}`);
      assertCode(ehlo, [250], 'EHLO after STARTTLS');
    }

    // AUTH LOGIN
    const authStart = await sendCommand(socket, 'AUTH LOGIN');
    assertCode(authStart, [334], 'AUTH LOGIN');

    const userResp = await sendCommand(
      socket,
      Buffer.from(env.FROM_EMAIL).toString('base64'),
    );
    assertCode(userResp, [334], 'AUTH username');

    const passResp = await sendCommand(
      socket,
      Buffer.from(env.FROM_EMAIL_PASS).toString('base64'),
    );
    assertCode(passResp, [235], 'AUTH password');

    // MAIL FROM
    const mailFrom = await sendCommand(socket, `MAIL FROM:<${env.FROM_EMAIL}>`);
    assertCode(mailFrom, [250], 'MAIL FROM');

    // RCPT TO
    const rcptTo = await sendCommand(socket, `RCPT TO:<${to}>`);
    assertCode(rcptTo, [250], 'RCPT TO');

    // DATA
    const dataResp = await sendCommand(socket, 'DATA');
    assertCode(dataResp, [354], 'DATA');

    // Send message body (end with \r\n.\r\n)
    const sendDone = await sendCommand(socket, message + '\r\n.');
    assertCode(sendDone, [250], 'message delivery');

    // QUIT
    socket.write('QUIT\r\n');
    console.log(`📧 Email sent to ${to}: "${subject}"`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email. Please try again later.');
  } finally {
    socket.destroy();
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send an email verification email with a tokenised link.
 *
 * @param {string} email - Recipient email address.
 * @param {string} token - Plain-text verification token.
 * @returns {Promise<void>}
 */
export const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email — CCTV Service Dashboard',
    text: [
      'Welcome to the CCTV Service Dashboard!',
      '',
      'Please verify your email address by clicking the link below:',
      verifyUrl,
      '',
      'This link will expire in 24 hours.',
      '',
      'If you did not create an account, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <h2>Welcome to the CCTV Service Dashboard!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}" style="padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
      <p style="color: #666;">If you did not create an account, you can safely ignore this email.</p>
    `,
  });
};

/**
 * Send a password reset email with a tokenised link.
 *
 * @param {string} email - Recipient email address.
 * @param {string} token - Plain-text reset token.
 * @returns {Promise<void>}
 */
export const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Password Reset Request — CCTV Service Dashboard',
    text: [
      'You requested a password reset for your CCTV Service Dashboard account.',
      '',
      'Click the link below to reset your password:',
      resetUrl,
      '',
      'This link will expire in 10 minutes.',
      '',
      'If you did not request a password reset, please ignore this email.',
      'Your password will remain unchanged.',
    ].join('\n'),
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your CCTV Service Dashboard account.</p>
      <p>Click the button below to reset your password:</p>
      <p><a href="${resetUrl}" style="padding: 12px 24px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
      <p><strong>This link will expire in 10 minutes.</strong></p>
      <p style="color: #666;">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
    `,
  });
};
