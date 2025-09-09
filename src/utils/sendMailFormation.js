import nodemailer from 'nodemailer';

/**
 * Envoie un e-mail de notification pour informer les stagiaires de la réception de leur demande de stage.
 * @param {string} to - Adresse e-mail du destinataire.
 * @param {string} content - Contenu du message.
 * @param {string} subject - Sujet.
 */
export const sendMailFormation = async (to, content, subject) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Utilisez votre service SMTP préféré
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASS,
        },
    });

    const message = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html: `<p>
            ${content}
        <p/>`,
    };


    await transporter.sendMail(message);
};
