import nodemailer from 'nodemailer';

/**
 * Envoie un e-mail de notification pour informer les stagiaires de la réception de leur demande de stage.
 * @param {string} to - Adresse e-mail du destinataire.
 * @param {string} lang - Langue préférée pour le message (ex: 'fr' ou 'en').
 * @param {string} nom - Nom du stagiaire.
 * @param {string} prenom - Prénom du stagiaire.
 */
export const sendStageNotificationEmail = async (to, lang, nom, prenom) => {
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
        subject: lang === 'fr' ? 'Notification de stage soumis' : 'Internship Request Submitted',
        html: `
            <p><strong>${lang === 'fr' ? 'Bonjour' : 'Hello'}, ${prenom} ${nom},</strong></p>
            <p>${lang === 'fr'
                ? 'Nous avons bien reçu votre demande de stage. Elle est actuellement en attente de traitement.'
                : 'We have received your internship request. It is currently pending processing.'
            }</p>
            <p>${lang === 'fr'
                ? 'Merci de patienter pendant que nous examinons votre demande.'
                : 'Thank you for your patience as we review your request.'
            }</p>
            <p>${lang === 'fr'
                ? 'Cordialement,'
                : 'Best regards,'
            }<br/>
            ${lang === 'fr' ? 'L\'équipe RH360' : 'The RH360 Team'}</p>
        `,
    };

    await transporter.sendMail(message);
};
