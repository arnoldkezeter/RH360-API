import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "gmail",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
      attachments
    });

    console.log("✅ Email envoyé à", to);
  } catch (error) {
    console.error("❌ Erreur envoi email:", error);
    throw error;
  }
};
