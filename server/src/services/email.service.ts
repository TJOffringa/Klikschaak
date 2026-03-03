import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = 'Klikschaak <noreply@klikschaak.nl>';
const BASE_URL = process.env.CLIENT_URL || 'https://klikschaak.nl';

export async function sendVerificationEmail(email: string, username: string, token: string): Promise<void> {
  const verifyUrl = `${BASE_URL}/?verify-email=${token}`;

  if (!resend) {
    console.warn('Resend not configured, verification email not sent. Token:', token);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verifieer je Klikschaak account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Welkom bij Klikschaak, ${username}!</h2>
        <p>Klik op de knop hieronder om je e-mailadres te verifiëren:</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #4a6cf7; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          E-mail verifiëren
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          Of kopieer deze link: <br>
          <a href="${verifyUrl}" style="color: #4a6cf7;">${verifyUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">Deze link is 24 uur geldig.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, username: string, token: string): Promise<void> {
  const resetUrl = `${BASE_URL}/?reset-password=${token}`;

  if (!resend) {
    console.warn('Resend not configured, reset email not sent. Token:', token);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Wachtwoord resetten - Klikschaak',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Wachtwoord resetten</h2>
        <p>Hoi ${username}, je hebt een wachtwoord-reset aangevraagd voor je Klikschaak account.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #4a6cf7; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Wachtwoord resetten
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          Of kopieer deze link: <br>
          <a href="${resetUrl}" style="color: #4a6cf7;">${resetUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">Deze link is 1 uur geldig. Als je dit niet hebt aangevraagd, kun je deze e-mail negeren.</p>
      </div>
    `,
  });
}
