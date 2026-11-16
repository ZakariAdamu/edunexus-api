import nodemailer from "nodemailer";
import { emailVerificationHTML } from "../templates/emails/verification-email.ts";
import axios from "axios";
import { env } from "../config/env.ts";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_LOGIN,
    pass: process.env.ZAK_BREVO_SMTP_KEY,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Reusable helper to send verification email
export const sendVerificationEmail = async (email: string, code: string) => {
  console.log(
    `Starting sending verification email to ${email} with code ${code}`,
  );
  await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: env.projectName,
        email: env.fromEmail,
      },
      to: [{ email }],
      subject: `Welcome to ${env.projectName} - Verify Your Email`,
      htmlContent: emailVerificationHTML,
    },
    {
      headers: {
        "api-key": env.edunexusBrevoApiKey,
        "content-type": "application/json",
      },
    },
  );
  console.log(`Verification email sent to ${email}`);
};
