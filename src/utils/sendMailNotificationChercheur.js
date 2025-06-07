import nodemailer from 'nodemailer';

/**
 * Envoie un e-mail de notification pour informer les chercheurs de la réception de leur demande.
 * @param {string} to - Adresse e-mail du destinataire.
 * @param {string} lang - Langue préférée pour le message (ex: 'fr' ou 'en').
 * @param {string} nom - Nom du chercheur.
 * @param {string} prenom - Prénom du chercheur.
 */
export const sendMandatNotificationEmail = async (to, lang, nom, prenom) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Utilisez votre service SMTP préféré
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const message = {
        from: process.env.EMAIL_USER,
        to,
        subject: lang === 'fr' ? 'Nouveau mandat de recherche' : 'New Research Mandate',
        html: `
            <p><strong>${lang === 'fr' ? 'Bonjour' : 'Hello'}, ${prenom} ${nom},</strong></p>
            <p>${lang === 'fr'
                ? 'Nous avons bien reçu votre demande. Elle est actuellement en attente de traitement.'
                : 'We have received your request. It is currently pending processing.'
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
