import { env } from "../../config/env.ts";
import { code } from "../../utils/verificationCode.ts";


export const emailVerificationHTML =`
  <div style="
    background-color: #f4f7f6;
    padding: 40px 20px;
    font-family: Arial, Helvetica, sans-serif;
  ">
    <div style="
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    ">
      
      <!-- Header -->
      <div style="
        background-color: #287c1fff;
        padding: 24px;
        text-align: center;
      ">
        <h1 style="
          margin: 0;
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
        ">
         ${env.projectName}
        </h1>
      </div>

      <!-- Body -->
      <div style="
        padding: 40px 30px;
        text-align: center;
      ">
        <h2 style="
          margin: 0 0 16px;
          color: #111827;
          font-size: 22px;
          font-weight: 600;
        ">
          Verify Your Email Address
        </h2>

        <p style="
          margin: 0 0 24px;
          color: #6b7280;
          font-size: 16px;
          line-height: 1.6;
        ">
          Thank you for signing up. Use the verification code below to complete your account setup.
        </p>

        <div style="
          display: inline-block;
          background-color: #f0fdf4;
          border: 2px dashed #287c1fff;
          border-radius: 10px;
          padding: 16px 28px;
          margin-bottom: 24px;
        ">
          <span style="
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #287c1fff;
          ">
            ${code}
          </span>
        </div>

        <p style="
          margin: 0 0 12px;
          color: #374151;
          font-size: 15px;
        ">
          This code expires in <strong>2 minutes</strong>.
        </p>

        <p style="
          margin: 0;
          color: #9ca3af;
          font-size: 14px;
          line-height: 1.6;
        ">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="
        border-top: 1px solid #e5e7eb;
        padding: 20px;
        text-align: center;
        background-color: #fafafa;
      ">
        <p style="
          margin: 0;
          color: #9ca3af;
          font-size: 13px;
        ">
          © ${new Date().getFullYear()} ${env.projectName}. All rights reserved.
        </p>
      </div>

    </div>
  </div>
`