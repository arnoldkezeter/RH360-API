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
        service: 'gmail', // ou autre
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user:  process.env.EMAIL_USER,
            pass:  process.env.EMAIL_APP_PASS
        }
    });

    const message = {
        from: process.env.EMAIL_USER,
        to,
        subject: lang === 'fr'
            ? 'Notification de demande de stage reçue'
            : 'Internship Application Received',
        html: `
            <p><strong>${lang === 'fr' ? 'Bonjour M./Mme' : 'Hello Mr./Mrs'} ${prenom} ${nom},</strong></p>
            <p>${lang === 'fr'
                ? 'Votre demande de stage académique ou professionnel a bien été reçue par la DGI.'
                : 'We have successfully received your academic or professional internship application at the DGI.'
            }</p>
            <p>${lang === 'fr'
                ? 'Cette demande est en cours de traitement.'
                : 'Your application is currently under review.'
            }</p>
            <p>${lang === 'fr'
                ? 'Vous serez informé(e) de toute évolution concernant votre demande.'
                : 'You will be informed of any progress or updates regarding your application.'
            }</p>
            <p>${lang === 'fr'
                ? 'La DGI vous remercie.'
                : 'Thank you for your interest in working with the DGI.'
            }</p>
        `,
    };


    await transporter.sendMail(message);
};
