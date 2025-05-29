import nodemailer from 'nodemailer';

export const sendAccountEmail = async (to, email, password) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // ou autre
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const message = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Création de votre compte RH360 / RH360 Account Creation',
    html: `
      <p><strong>🇫🇷 Bonjour,</strong></p>
      <p>Votre compte sur la plateforme <strong>RH360</strong> a été créé avec succès.</p>
      <p>Voici vos identifiants de connexion :</p>
      <ul>
        <li><strong>Email :</strong> ${email}</li>
        <li><strong>Mot de passe :</strong> ${password}</li>
      </ul>
      <p>Merci de vous connecter et de modifier votre mot de passe dès que possible.</p>
      <hr style="margin: 20px 0;">
      <p><strong>🇬🇧 Hello,</strong></p>
      <p>Your <strong>RH360</strong> account has been successfully created.</p>
      <p>Here are your login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p>Please log in and change your password as soon as possible.</p>
      <p>Best regards,<br/>The RH360 Team</p>
    `
  };
  

  await transporter.sendMail(message);
};
