import Stage from '../models/Stage.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import Stagiaire from '../models/Stagiaire.js';
import { sendStageNotificationEmail } from '../utils/sendMailNotificatonStage.js';
import { Groupe } from '../models/Groupe.js';
import { Rotation } from '../models/Rotation.js';

//Stage Individuel
export const creerStage = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    // Validation des champs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map((err) => err.msg),
        });
    }

    try {
        const { stagiaires } = req.body;

        // Vérification des stagiaires
        const stagiairesPromises = stagiaires.map(async (stagiaire) => {
            const stagiaireData = await Stagiaire.findById(stagiaire.stagiaire);
            if (!stagiaireData) {
                throw new Error(t('stagiaire_non_trouve', lang));
            }
            return {
                ...stagiaire,
                email: stagiaireData.email,
                nom: stagiaireData.nom,
                prenom: stagiaireData.prenom,
            };
        });

        const validatedStagiaires = await Promise.all(stagiairesPromises);

        // Création d'un stage unique avec plusieurs stagiaires
        const stage = await Stage.create({
            typeStage:'INDIVIDUEL',
            stagiaires: validatedStagiaires.map((s) => ({
                stagiaire: s.stagiaire,
                servicesAffectes: s.servicesAffectes,
            })),
            statut: 'EN_ATTENTE',
        });


        // Mise à jour des stagiaires pour ajouter l'ID du stage
        const stagiaireUpdatePromises = validatedStagiaires.map(async (s) => {
            await Stagiaire.findByIdAndUpdate(
                s.stagiaire,
                { $addToSet: { stages: stage._id } }, // Ajout sans duplication
                { new: true }
            );
        });

        await Promise.all(stagiaireUpdatePromises);

        // Envoi d'e-mails à chaque stagiaire
        const emailPromises = validatedStagiaires.map((stagiaire) => 
            sendStageNotificationEmail(
                stagiaire.email,
                lang,
                stagiaire.nom,
                stagiaire.prenom
            )
        );

        await Promise.all(emailPromises);


        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            stage,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


//Stage en groupe
export const creerStageGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    // Validation des champs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map((err) => err.msg),
        });
    }

    try {
        const { typeStage, groupes, rotations } = req.body;

        // Validation : typeStage doit être 'GROUPE'
        if (typeStage !== 'GROUPE') {
            return res.status(400).json({
                success: false,
                message: t('type_stage_invalide', lang),
            });
        }

        // Création du stage
        const stage = new Stage({
            typeStage,
            statut: 'EN_ATTENTE', // Par défaut
        });

        // Validation des groupes
        const groupesPromises = groupes.map(async (groupeData) => {
            const groupe = new Groupe({
                stage: stage._id,
                numero: groupeData.numero,
                stagiaires: groupeData.stagiaires,
                serviceFinal: groupeData.serviceFinal, // { service, superviseur, dateDebut, dateFin }
            });
            return await groupe.save();
        });

        const groupesEnregistres = await Promise.all(groupesPromises);

        

        // Validation des rotations
        const rotationsPromises = rotations.map(async (rotationData) => {
            const rotation = new Rotation({
                stage: stage._id,
                service: rotationData.service,
                groupe: rotationData.groupe,
                superviseur: rotationData.superviseur,
                dateDebut: rotationData.dateDebut,
                dateFin: rotationData.dateFin,
            });
            return await rotation.save();
        });

        const rotationsEnregistrees = await Promise.all(rotationsPromises);

        // Mise à jour des groupes et des rotations dans le stage
        stage.groupes = groupesEnregistres.map((groupe) => groupe._id);
        stage.rotations = rotationsEnregistrees.map((rotation) => rotation._id);


        // Enregistrement du stage
        await stage.save();

        // Récupérer la liste plate des stagiaires dans tous les groupes
        const tousStagiairesIds = groupesEnregistres.flatMap(groupe => groupe.stagiaires);

        // Mise à jour de la propriété "stage" pour tous les stagiaires (en parallèle)
        const updatePromises = tousStagiairesIds.map(async stagiaireId =>
            await Stagiaire.findByIdAndUpdate(
                stagiaireId,
                { $addToSet: { stages: stage._id } }, // Ajout sans duplication
                { new: true }
            )
        );
        await Promise.all(updatePromises);


        // Charger tous les stagiaires mis à jour pour envoyer les emails
        const stagiaires = await Stagiaire.find({ _id: { $in: tousStagiairesIds } });

        // Envoi des emails en parallèle, avec gestion individuelle d'erreur
       
        const emailPromises = stagiaires.map((stagiaire) => 
            sendStageNotificationEmail(
                stagiaire.email,
                lang,
                stagiaire.nom,
                stagiaire.prenom
            )
        );

        await Promise.all(emailPromises);

        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            stage,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

//Générer des groupes
export const genererGroupes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const { stagiaires, nombreGroupes } = req.body;

        if (!stagiaires || !Array.isArray(stagiaires) || stagiaires.length === 0) {
            return res.status(400).json({
                success: false,
                message: t('liste_stagiaire_requis', lang),
            });
        }

        if (!nombreGroupes || typeof nombreGroupes !== "number" || nombreGroupes < 1) {
            return res.status(400).json({
                success: false,
                message: t('nb_groupe_entier_positif', lang),
            });
        }

        // Répartir les stagiaires dans les groupes
        const groupes = [];
        const tailleGroupe = Math.ceil(stagiaires.length / nombreGroupes);

        for (let i = 0; i < nombreGroupes; i++) {
            groupes.push({
                numero: i + 1,
                stagiaires: stagiaires.slice(i * tailleGroupe, (i + 1) * tailleGroupe),
                serviceFinal: null, // Initialisé à null, sera défini plus tard
            });
        }

        return res.status(200).json({
            success: true,
            groupes,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

//Générer période de rotations
export const genererRotations = (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try{
        const { groupes, services, periodeRotation, dateDebut, dateFin } = req.body;

        // Vérification des données d'entrée
        if (!groupes || !services || !periodeRotation || !dateDebut || !dateFin) {
            return res.status(400).json({
                success: false,
                message: t('donnee_imcomplete', lang)
            });
        }


        if (!periodeRotation || typeof periodeRotation !== "number" || periodeRotation < 1) {
            return res.status(400).json({
                success: false,
                message: t('periode_entier_positif', lang),
            });
        }

        const dateDebutStage = new Date(dateDebut);
        const dateFinStage = new Date(dateFin);

        // Vérification des dates
        if (dateDebutStage >= dateFinStage) {
            return res.status(400).json({
                success: false,
                message: t('date_debut_anterieur_date_fin', lang),
            });
        }

        const rotations = [];
        const totalServices = services.length;

        // Calculer le nombre de périodes de rotation disponibles
        const dureeTotale = (dateFinStage - dateDebutStage) / (24 * 60 * 60 * 1000); // Durée totale en jours
        const nombreDeRotations = Math.floor(dureeTotale / periodeRotation);

        if (nombreDeRotations < totalServices) {
            return res.status(400).json({
                success: false,
                message: t('ajuster_periode_durer', lang)        
            });
        }

        // Génération des rotations pour chaque groupe
        groupes.forEach((groupe, index) => {
            let dateActuelle = new Date(dateDebutStage);

            for (let rotationIndex = 0; rotationIndex < nombreDeRotations; rotationIndex++) {
                const serviceIndex = (rotationIndex + index) % totalServices; // Répartir les services de manière cyclique

                const dateDebutRotation = new Date(dateActuelle);
                const dateFinRotation = new Date(
                    dateActuelle.getTime() + periodeRotation * 24 * 60 * 60 * 1000
                );

                // Ajouter la rotation au tableau
                rotations.push({
                    groupe,
                    service: services[serviceIndex],
                    dateDebut: dateDebutRotation,
                    dateFin: dateFinRotation,
                    superviseur: services[serviceIndex].superviseur || null,
                });

                // Avancer la date pour la prochaine rotation
                dateActuelle = new Date(dateFinRotation);

                // Arrêter si on dépasse la date de fin du stage
                if (dateActuelle >= dateFinStage) {
                    break;
                }
            }
        });

        // Réponse avec les rotations générées
        return res.status(200).json({
            success: true,
            rotations,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


export const verifierStagiairesManquants = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { stageId } = req.params;

    try {
        // Récupérer tous les stagiaires liés au stage
        const stagiaires = await Stagiaire.find({ stage: stageId });

        // Récupérer les stagiaires déjà assignés à des groupes
        const groupes = await Groupe.find({ stage: stageId }).populate('stagiaires');

        const stagiairesAssignes = groupes.flatMap(groupe => groupe.stagiaires.map(stagiaire => stagiaire._id.toString()));

        // Identifier les stagiaires non assignés
        const stagiairesManquants = stagiaires.filter(stagiaire => !stagiairesAssignes.includes(stagiaire._id.toString()));

        if (stagiairesManquants.length === 0) {
            return res.status(200).json({
                success: true,
                message: t('stagiaires_deja_assignes', lang),
            });
        }

        return res.status(200).json({
            success: true,
            message: t('stagiaires_non_assignes', lang),
            stagiairesManquants,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

//Ajouter des stagiaires au groupe après création
export const ajouterStagiairesAuxGroupes = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { stageId } = req.params;
    const { stagiairesManquants } = req.body;

    try {
        // Attendre la récupération des groupes
        const groupes = await Groupe.find({ stage: stageId });
        if (!groupes || groupes.length === 0) {
            return res.status(404).json({
                success: false,
                message: t('groupe_non_trouve', lang),
            });
        }

        // Répartition des stagiaires manquants dans les groupes existants
        let index = 0;
        for (const stagiaire of stagiairesManquants) {
            const groupeIndex = index % groupes.length; // Boucle dans les groupes
            groupes[groupeIndex].stagiaires.push(stagiaire);
            index++;
        }

        // Sauvegarder les modifications des groupes en base de données (en parallèle)
        await Promise.all(groupes.map(groupe => 
            Groupe.findByIdAndUpdate(groupe._id, { stagiaires: groupe.stagiaires })
        ));

        // Mise à jour en bloc des stagiaires
        await Stagiaire.updateMany(
            { _id: { $in: stagiairesManquants } },
            { $addToSet: { stages: stageId } }
        );

        return res.status(200).json({
            success: true,
            message: t('ajouter_succes', lang),
            groupes,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


//Créer nouveau groupe pour ajouter les stagiaires manquant
export const creerNouveauxGroupesEtReorganiserRotations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr'; // Gestion de la langue de l'utilisateur
    const { stageId } = req.params;
    const { stagiairesManquants, services, periodeRotation, dateDebut, dateFin } = req.body;

    try {
        // Étape 1 : Récupérer le stage, les groupes existants et les rotations
        const groupesExistants = await Groupe.find({ stage: stageId });
        const rotationsExistantes = await Rotation.find({ stage: stageId });

        if (!rotationsExistantes) {
            return res.status(404).json({
                success: false,
                message: t('rotation_non_trouvee', lang),
            });
        }

        // Étape 2 : Créer de nouveaux groupes
        // const nouveauxGroupes = [];
        // let groupeNumero = groupesExistants.length + 1;

        // for (let i = 0; i < stagiairesManquants.length; i++) {
        //     const nouveauGroupe = new Groupe({
        //         stage: stageId,
        //         numero: groupeNumero,
        //         stagiaires: [stagiairesManquants[i]],
        //     });
        //     await nouveauGroupe.save();
        //     nouveauxGroupes.push(nouveauGroupe);
        //     groupeNumero++;
        // }

        const nouveauxGroupes = stagiairesManquants.map((stagiaire, index) => ({
            stage: stageId,
            numero: groupesExistants.length + index + 1,
            stagiaires: [stagiaire],
        }));
        const groupesInseres = await Groupe.insertMany(nouveauxGroupes);

        // Mise à jour en bloc des stagiaires
        await Stagiaire.updateMany(
            { _id: { $in: stagiairesManquants } },
            { $addToSet: { stages: stageId } }
        );

        // Étape 3 : Réorganiser les rotations
        const tousLesGroupes = [...groupesExistants, ...groupesInseres];
        const nouvellesRotations = [];
        const dateActuelle = new Date(dateDebut);

        for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
            for (let groupeIndex = 0; groupeIndex < tousLesGroupes.length; groupeIndex++) {
                const dateRotationDebut = new Date(
                    dateActuelle.getTime() + (serviceIndex * periodeRotation * 24 * 60 * 60 * 1000)
                );
                const dateRotationFin = new Date(
                    dateRotationDebut.getTime() + periodeRotation * 24 * 60 * 60 * 1000
                );

                if (dateRotationDebut > new Date(dateFin)) break;

                const nouvelleRotation = {
                    stage: stageId,
                    service: services[serviceIndex]._id,
                    groupe: tousLesGroupes[groupeIndex]._id,
                    dateDebut: dateRotationDebut,
                    dateFin: dateRotationFin,
                };
                nouvellesRotations.push(nouvelleRotation);
            }
        }

        // Supprimer les rotations existantes et enregistrer les nouvelles
        await Rotation.deleteMany({ stage: stageId });
        await Rotation.insertMany(nouvellesRotations);

        return res.status(200).json({
            success: true,
            message: t('nouveaux_groupes_et_rotations_crees', lang),
            nouveauxGroupes,
            nouvellesRotations,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_creation_groupes_rotations', lang),
            error: error.message,
        });
    }
};


//Modifier un groupe
export const modifierGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr'; // Gestion de la langue
    const { groupeId } = req.params; // ID du groupe à modifier
    const { stagiaires, serviceFinal } = req.body; // Données à mettre à jour

    try {
        // Vérifier si le groupe existe
        const groupe = await Groupe.findById(groupeId);

        if (!groupe) {
            return res.status(404).json({
                success: false,
                message: t('groupe_non_trouve', lang),
            });
        }

        // Mettre à jour les champs autorisés
        if (stagiaires) {
            groupe.stagiaires = stagiaires;
        }

        if (serviceFinal) {
            groupe.serviceFinal = {
                service: serviceFinal.service || groupe.serviceFinal.service,
                superviseur: serviceFinal.superviseur || groupe.serviceFinal.superviseur,
                dateDebut: serviceFinal.dateDebut || groupe.serviceFinal.dateDebut,
                dateFin: serviceFinal.dateFin || groupe.serviceFinal.dateFin,
            };
        }

        // Sauvegarder les modifications
        await groupe.save();

        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            groupe,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


//Supprimer un groupe
export const supprimerGroupe = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr'; // Gestion de la langue
    const { groupeId } = req.params; // ID du groupe à supprimer

    try {
        // Trouver le groupe à supprimer
        const groupe = await Groupe.findById(groupeId);

        if (!groupe) {
            return res.status(404).json({
                success: false,
                message: t('groupe_non_trouve', lang),
            });
        }

        // Supprimer les rotations associées à ce groupe
        await Rotation.deleteMany({ groupe: groupeId });

        // Supprimer la référence du groupe dans les stagiaires
        await Stagiaire.updateMany(
            { stages: groupe.stage },
            { $pull: { stages: groupe.stage } }
        );

        // Supprimer le groupe lui-même
        await groupe.deleteOne();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};



//Suppression d'un stage
export const supprimerStage = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr'; // Gestion de la langue
    const { stageId } = req.params; // ID du stage à supprimer

    try {
        // Trouver le stage à supprimer
        const stage = await Stage.findById(stageId);

        if (!stage) {
            return res.status(404).json({
                success: false,
                message: t('stage_non_trouve', lang),
            });
        }

        // Si le stage est de type GROUPE, supprimer les groupes et rotations associés
        if (stage.typeStage === 'GROUPE') {
            await Groupe.deleteMany({ stage: stageId }); // Supprimer les groupes liés
            await Rotation.deleteMany({ stage: stageId }); // Supprimer les rotations liées
        }

        // Supprimer la référence du stage dans les stagiaires
        await Stagiaire.updateMany(
            { stages: stageId },
            { $pull: { stages: stageId } }
        );

        // Supprimer le stage lui-même
        await stage.deleteOne();

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};



// Ajouter un serviceAffecte à un stagiaire dans un stage individuel
export const ajouterServiceAffecte = async (req, res) => {
    try {
        const { stageId, stagiaireId } = req.params;
        const { service, annee, dateDebut, dateFin, superviseurs } = req.body;

        // Validation basique (à améliorer selon besoin)
        if (!service || !annee || !dateDebut || !dateFin || !superviseurs || superviseurs.length === 0) {
        return res.status(400).json({ message: "Tous les champs sont obligatoires" });
        }

        const stage = await Stage.findById(stageId);
       if (!stage) {
            return res.status(404).json({ 
                success:false,
                message: t('stage_non_trouve', lang)
            });
        }

        if (stage.typeStage !== 'INDIVIDUEL'){
            return res.status(400).json({ 
                success:false,
                message: t('operation_stage_individuel', lang)
            })
        };

        const stagiaire = stage.stagiaires.id(stagiaireId);
        if (!stagiaire) {
            return res.status(404).json({
                success:false,
                message: t('stagiaire_non_trouve', lang) 
            });
        }

        // Ajouter le nouveau service affecté
        stagiaire.servicesAffectes.push({
            service,
            annee,
            dateDebut,
            dateFin,
            superviseurs,
        });

        await stage.save();

        // Récupérer le dernier élément ajouté
        const nouveauService = stagiaire.servicesAffectes[stagiaire.servicesAffectes.length - 1];

        return res.status(201).json({ 
            success:true,
            message: t('ajouter_succes', lang), 
            serviceAffecte: nouveauService
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message: t('erreur_serveur', lang), 
            error:error.message
        });
    }
};


// Modifier un serviceAffecte d'un stagiaire dans un stage individuel
export const modifierServiceAffecte = async (req, res) => {
    try {
        const { stageId, stagiaireId, serviceAffecteId } = req.params;
        const updateData = req.body; // { service, annee, dateDebut, dateFin, superviseurs }

        // Trouver le stage
        const stage = await Stage.findById(stageId);
        if (!stage) {
            return res.status(404).json({ 
                success:false,
                message: t('stage_non_trouve', lang)
            });
        }

        if (stage.typeStage !== 'INDIVIDUEL'){
            return res.status(400).json({ 
                success:false,
                message: t('operation_stage_individuel', lang)
            })
        };

        const stagiaire = stage.stagiaires.id(stagiaireId);
        if (!stagiaire) {
            return res.status(404).json({
                success:false,
                message: t('stagiaire_non_trouve', lang) 
            });
        }

        const serviceAffecte = stagiaire.servicesAffectes.id(serviceAffecteId);
        if (!serviceAffecte) {
            return res.status(404).json({ 
                success:false,
                message: t('service_affecte_non_trouve', lang) 
            });
        }

        // Mettre à jour les champs
        Object.assign(serviceAffecte, updateData);

        await stage.save();

        return res.json({
            success:true,
            message:t('modifier_succes', lang),
            serviceAffecte 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message: t('erreur_serveur', lang), 
            error:error.message
        });
    }
};


// Supprimer un serviceAffecte d'un stagiaire dans un stage individuel
export const supprimerServiceAffecte = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr'; // Gestion de la langue
    try {
        const { stageId, stagiaireId, serviceAffecteId } = req.params;

        const stage = await Stage.findById(stageId);
        if (!stage) {
            return res.status(404).json({ 
                success:false,
                message: t('stage_non_trouve', lang)
            });
        }

        if (stage.typeStage !== 'INDIVIDUEL'){
            return res.status(400).json({ 
                success:false,
                message: t('operation_stage_individuel', lang)
            })
        };

        const stagiaire = stage.stagiaires.id(stagiaireId);
        if (!stagiaire) {
            return res.status(404).json({
                success:false,
                message: t('stagiaire_non_trouve', lang) 
            });
        }

        const serviceAffecte = stagiaire.servicesAffectes.id(serviceAffecteId);
        if (!serviceAffecte) {
            return res.status(404).json({ 
                success:false,
                message: t('service_affecte_non_trouve', lang) 
            });
        }

        // Supprimer le service affecté
        serviceAffecte.remove();

        await stage.save();

        return res.json({
            success:true,
            message: t('supprimer_succes') 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message: t('erreur_serveur', lang), 
            error:error.message
        });
  }
};



//Liste des stages
export const listeStages = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { page = 1, limit = 10 } = req.query;

    try {
        const stages = await Stage.aggregate([
            {
                $lookup: {
                    from: 'stagiaires',
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'stagiaires',
                },
            },
            {
                $lookup: {
                    from: 'groupes',
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'groupes',
                },
            },
            {
                $lookup: {
                    from: 'rotations',
                    localField: '_id',
                    foreignField: 'stage',
                    as: 'rotations',
                },
            },
            {
                $addFields: {
                    typeStage: '$typeStage',
                    nombreStagiaires: { $size: '$stagiaires' },
                    nombreGroupes: { $size: '$groupes' },
                    dateDebut: {
                        $cond: [
                            { $eq: ['$typeStage', 'GROUPE'] },
                            { $min: '$rotations.dateDebut' },
                            { $min: '$stagiaires.dateDebutAffectation' },
                        ],
                    },
                    dateFin: {
                        $cond: [
                            { $eq: ['$typeStage', 'GROUPE'] },
                            { $max: '$rotations.dateFin' },
                            { $max: '$stagiaires.dateFinAffectation' },
                        ],
                    },
                },
            },
            {
                $sort: { createdAt: -1 }, // Tri par date de création
            },
            {
                $skip: (page - 1) * limit,
            },
            {
                $limit: parseInt(limit),
            },
            {
                $project: {
                    _id: 1,
                    nom: 1,
                    typeStage: 1,
                    nombreStagiaires: 1,
                    nombreGroupes: 1,
                    dateDebut: 1,
                    dateFin: 1,
                    createdAt: 1,
                },
            },
        ]);

        const total = await Stage.countDocuments();

        return res.status(200).json({
            success: true,
            data: {
                stages,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

//Liste des stagiaires par établissement
export const listeStagiairesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { etablissementId } = req.params;

    try {
        const stagesIndividuels = await Stage.find({
            typeStage: 'INDIVIDUEL',
            'stagiaires.stagiaire.etablissement': etablissementId,
        }).populate('stagiaires.stagiaire', 'nom prenom etablissement');

        const groupes = await Groupe.find({
            'stagiaires.etablissement': etablissementId,
        }).populate('stagiaires', 'nom prenom etablissement');

        return res.status(200).json({
            success: true,
            message: t('liste_stagiaires_succes', lang),
            data: {
                stagesIndividuels,
                groupes,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};



export const calendrierRotations = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        // Récupérer les rotations avec leurs groupes et services
        const rotations = await Rotation.find()
            .populate('groupe', 'numero')
            .populate('service', 'nomFr nomEn structure')
            .sort({ dateDebut: 1 });

        // Récupérer les stages finaux pour chaque groupe
        const stagesFinaux = await Groupe.find()
            .populate('serviceFinal.service', 'nomFr nomEn structure')
            .populate('numero', 'numero');

        // Construire le calendrier
        const calendrier = {};

        // Ajouter les rotations
        rotations.forEach((rotation) => {
            const groupe = `Groupe ${rotation.groupe.numero}`;
            const service = {
                nomFr: rotation.service.nomFr,
                nomEn: rotation.service.nomEn,
                structure: rotation.service.structure,
            };
            const periode = `${rotation.dateDebut.toISOString()} - ${rotation.dateFin.toISOString()}`;

            if (!calendrier[groupe]) calendrier[groupe] = {};
            if (!calendrier[groupe][service.nomFr]) calendrier[groupe][service.nomFr] = [];

            calendrier[groupe][service.nomFr].push(periode);
        });

        // Ajouter les stages finaux
        stagesFinaux.forEach((groupe) => {
            const groupeKey = `Groupe ${groupe.numero}`;
            const service = groupe.serviceFinal.service;

            if (service) {
                const serviceDetails = {
                    nomFr: service.nomFr,
                    nomEn: service.nomEn,
                    structure: service.structure,
                };
                const periode = 'Stage final';

                if (!calendrier[groupeKey]) calendrier[groupeKey] = {};
                if (!calendrier[groupeKey][serviceDetails.nomFr]) calendrier[groupeKey][serviceDetails.nomFr] = [];

                calendrier[groupeKey][serviceDetails.nomFr].push(periode);
            }
        });

        return res.status(200).json({
            success: true,
            calendrier,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};

//Statistique sur stage
//Nombre de stage enregistrer par établissement
export const nombreStagiairesParEtablissement = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { dateDebut, dateFin } = req.query;

    try {
        let matchFiltersStage = {};
        let matchFiltersGroupe = {};

        if (dateDebut && dateFin) {
            // Filtrage par période uniquement
            matchFiltersStage = {
                'stagiaires.servicesAffectes.dateDebut': { $gte: new Date(dateDebut) },
                'stagiaires.servicesAffectes.dateFin': { $lte: new Date(dateFin) },
            };
            matchFiltersGroupe = {
                'serviceFinal.dateDebut': { $gte: new Date(dateDebut) },
                'serviceFinal.dateFin': { $lte: new Date(dateFin) },
            };
        }
        // Si aucun filtre n'est défini, matchFilters reste vide pour inclure tous les résultats.

        // Stages individuels
        const individuel = await Stage.aggregate([
            { $match: matchFiltersStage },
            { $unwind: '$stagiaires' },
            { $unwind: '$stagiaires.servicesAffectes' },
            {
                $lookup: {
                    from: 'stagiaires', // Collection stagiaires
                    localField: 'stagiaires.stagiaire',
                    foreignField: '_id',
                    as: 'stagiaireDetails',
                },
            },
            { $unwind: '$stagiaireDetails' },
            {
                $group: {
                    _id: '$stagiaireDetails.parcours.etablissement',
                    nombreStagiaires: { $sum: 1 },
                },
            },
        ]);

        // Stages en groupe
        const groupe = await Groupe.aggregate([
            { $match: matchFiltersGroupe },
            { $unwind: '$stagiaires' },
            {
                $lookup: {
                    from: 'stagiaires', // Collection stagiaires
                    localField: 'stagiaires',
                    foreignField: '_id',
                    as: 'stagiaireDetails',
                },
            },
            { $unwind: '$stagiaireDetails' },
            {
                $group: {
                    _id: '$stagiaireDetails.parcours.etablissement',
                    nombreStagiaires: { $sum: 1 },
                },
            },
        ]);

        // Fusion des résultats
        const result = [...individuel, ...groupe].reduce((acc, item) => {
            const existing = acc.find((i) => i._id?.toString() === item._id?.toString());
            if (existing) {
                existing.nombreStagiaires += item.nombreStagiaires;
            } else {
                acc.push(item);
            }
            return acc;
        }, []);

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


//Nombre de stage accepté par établissement
export const nombreStagiairesParStatutEtEtablissement = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  const { dateDebut, dateFin } = req.query;

  try {
    let matchFiltersStage = {};
    let matchFiltersGroupe = {};

    if (dateDebut && dateFin) {
      // Filtrage par période uniquement
      matchFiltersStage = {
        'stagiaires.servicesAffectes.dateDebut': { $gte: new Date(dateDebut) },
        'stagiaires.servicesAffectes.dateFin': { $lte: new Date(dateFin) },
      };
      matchFiltersGroupe = {
        'serviceFinal.dateDebut': { $gte: new Date(dateDebut) },
        'serviceFinal.dateFin': { $lte: new Date(dateFin) },
      };
    }

    // Stages individuels acceptés
    const individuelAccepte = await Stage.aggregate([
      { $match: { ...matchFiltersStage, statut: 'ACCEPTE' } },
      { $unwind: '$stagiaires' },
      { $unwind: '$stagiaires.servicesAffectes' },
      {
        $lookup: {
          from: 'stagiaires',
          localField: 'stagiaires.stagiaire',
          foreignField: '_id',
          as: 'stagiaireDetails',
        },
      },
      { $unwind: '$stagiaireDetails' },
      {
        $group: {
          _id: '$stagiaireDetails.parcours.etablissement', // ici on a {nomFr, nomEn, _id}
          nombreStagiaires: { $sum: 1 },
        },
      },
    ]);

    // Stages en groupe acceptés
    const groupeAccepte = await Groupe.aggregate([
      {
        $lookup: {
          from: 'stages',
          localField: 'stage',
          foreignField: '_id',
          as: 'stageDetails',
        },
      },
      { $unwind: '$stageDetails' },
      { $match: { ...matchFiltersGroupe, 'stageDetails.statut': 'ACCEPTE' } },
      { $unwind: '$stagiaires' },
      {
        $lookup: {
          from: 'stagiaires',
          localField: 'stagiaires',
          foreignField: '_id',
          as: 'stagiaireDetails',
        },
      },
      { $unwind: '$stagiaireDetails' },
      {
        $group: {
          _id: '$stagiaireDetails.parcours.etablissement',
          nombreStagiaires: { $sum: 1 },
        },
      },
    ]);

    // Stages individuels refusés
    const individuelRefuse = await Stage.aggregate([
      { $match: { ...matchFiltersStage, statut: 'REFUSE' } },
      { $unwind: '$stagiaires' },
      { $unwind: '$stagiaires.servicesAffectes' },
      {
        $lookup: {
          from: 'stagiaires',
          localField: 'stagiaires.stagiaire',
          foreignField: '_id',
          as: 'stagiaireDetails',
        },
      },
      { $unwind: '$stagiaireDetails' },
      {
        $group: {
          _id: '$stagiaireDetails.parcours.etablissement',
          nombreStagiaires: { $sum: 1 },
        },
      },
    ]);

    // Stages en groupe refusés
    const groupeRefuse = await Groupe.aggregate([
      {
        $lookup: {
          from: 'stages',
          localField: 'stage',
          foreignField: '_id',
          as: 'stageDetails',
        },
      },
      { $unwind: '$stageDetails' },
      { $match: { ...matchFiltersGroupe, 'stageDetails.statut': 'REFUSE' } },
      { $unwind: '$stagiaires' },
      {
        $lookup: {
          from: 'stagiaires',
          localField: 'stagiaires',
          foreignField: '_id',
          as: 'stagiaireDetails',
        },
      },
      { $unwind: '$stagiaireDetails' },
      {
        $group: {
          _id: '$stagiaireDetails.parcours.etablissement',
          nombreStagiaires: { $sum: 1 },
        },
      },
    ]);

    // Fonction de fusion pour accepter/refuser
    const mapEtablissements = new Map();

    function mergeData(array, keyName) {
      array.forEach(item => {
        if (!item._id) return;
        // Ici on suppose _id = { _id, nomFr, nomEn }
        // Certaines bases Mongo peuvent stocker _id sous forme ObjectId ou objet, on gère les 2 cas :
        const idStr = (item._id._id ? item._id._id.toString() : item._id.toString()) || 'unknown';

        let obj = mapEtablissements.get(idStr);
        if (!obj) {
          obj = {
            etablissement: {
              nomFr: item._id.nomFr || '',
              nomEn: item._id.nomEn || '',
            },
            acceptes: 0,
            refuses: 0,
          };
          mapEtablissements.set(idStr, obj);
        }
        obj[keyName] += item.nombreStagiaires;
      });
    }

    mergeData(individuelAccepte, 'acceptes');
    mergeData(groupeAccepte, 'acceptes');
    mergeData(individuelRefuse, 'refuses');
    mergeData(groupeRefuse, 'refuses');

    const mergedResult = Array.from(mapEtablissements.values());

    return res.status(200).json({
      success: true,
      data: mergedResult,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};



// helpers/filters.js
export const buildFilters = (query) => {
    const filters = {};

    if (query.dateDebut || query.dateFin) {
        filters.periode = {};
        if (query.dateDebut) filters.periode.$gte = new Date(query.dateDebut);
        if (query.dateFin) filters.periode.$lte = new Date(query.dateFin);
    }

    return filters;
};

// services/groupes.js
export const getFilteredGroupes = async (filters) => {
    const match = {};
    if (filters.dateDebut) match['serviceFinal.dateDebut'] = filters.dateDebut;
    if (filters.dateFin) match['serviceFinal.dateFin'] = filters.dateFin;
    return await Groupe.find(match).exec();
};

// 1. Total des stagiaires (uniques) dans stages liés aux groupes filtrés
export const totalStagiaires = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    try {
        const filters = buildFilters(req.query);

        let groupesFiltres = [];

        if (filters.superviseur || filters.dateDebut) {
            groupesFiltres = await getFilteredGroupes(filters);
        }

        const stageIds = groupesFiltres.map(g => g.stage.toString());

        const matchStage = {};
        if (stageIds.length > 0) {
            matchStage._id = { $in: stageIds.map(id => mongoose.Types.ObjectId(id)) };
        }

        const result = await Stage.aggregate([
            { $match: matchStage },
            { $unwind: '$stagiaires' },
            { $group: { _id: null, uniqueStagiaires: { $addToSet: '$stagiaires.stagiaire' } } },
            { $project: { total: { $size: '$uniqueStagiaires' } } }
        ]);

        return res.status(200).json({ 
            success:true,
            totalStagiaires: result[0]?.total || 0 
        });
    } catch (error) {
        return res.status(500).json({ 
            success:false,
            message : t('erreur_serveur',lang),
            error: error.message 
        });
    }
};

// 2. Total des stages terminés (tous groupes ont dateFin serviceFinal < maintenant)
export const totalStagesTermines = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const filters = buildFilters(req.query);

        const groupesFiltres = await getFilteredGroupes(filters);

        // Regrouper groupes par stage
        const groupesByStage = {};
        groupesFiltres.forEach(g => {
        const stageId = g.stage.toString();
        if (!groupesByStage[stageId]) groupesByStage[stageId] = [];
        groupesByStage[stageId].push(g);
        });

        const now = new Date();

        // On ne compte que les stages dont tous les groupes ont dateFin < now
        const stagesTermines = Object.entries(groupesByStage)
        .filter(([_, groupes]) => groupes.every(g => g.serviceFinal.dateFin < now))
        .map(([stageId]) => mongoose.Types.ObjectId(stageId));

        return res.status(200).json({
            success:true,
            totalStagesTermines: stagesTermines.length 
        });
    } catch (error) {
        return res.status(500).json({ 
            success:false,
            message:t('erreur_serveur', lang),
            error: error.message 
        });
    }
};

// 3. Moyenne des stagiaires par superviseur
export const moyenneStagiairesParSuperviseur = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const filters = buildFilters(req.query);

        const matchGroupe = {};
        if (filters.dateDebut) matchGroupe['serviceFinal.dateDebut'] = filters.dateDebut;
        if (filters.superviseur) matchGroupe['serviceFinal.superviseur'] = filters.superviseur;

        // Trouver groupes filtrés
        const groupes = await Groupe.find(matchGroupe).populate({
            path: 'stage',
            select: 'stagiaires',
        }).exec();

        // Map superviseur -> set stagiaires uniques
        const superviseurMap = new Map();

        groupes.forEach(g => {
            const supId = g.serviceFinal.superviseur?.toString();
            if (!supId) return;
            if (!superviseurMap.has(supId)) superviseurMap.set(supId, new Set());

            const stagiaires = g.stage?.stagiaires || [];
            stagiaires.forEach(s => superviseurMap.get(supId).add(s.stagiaire.toString()));
        });

        if (superviseurMap.size === 0) return res.json({ moyenneStagiairesParSuperviseur: 0 });

        // Calcul moyenne
        let total = 0;
        superviseurMap.forEach(setStagiaires => {
            total += setStagiaires.size;
        });
        let moyenne = 0;
        if(superviseurMap.size != 0)
            moyenne = total / superviseurMap.size;

        return res.status(200).json({ 
            success :true,
            moyenneStagiairesParSuperviseur: moyenne 
        });
    } catch (error) {
        res.status(500).json({ 
            success : true,
            message:t('erreur_serveur', lang),
            error: error.message 
        });
    }
};

// 4. Durée moyenne des stages en mois (calculée sur dateDebut/dateFin serviceFinal des groupes et stages uniques)
export const dureeMoyenneStages = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const filters = buildFilters(req.query);

        // Filtrer les groupes
        const matchGroupe = {};
        if (filters.dateDebut) matchGroupe['serviceFinal.dateDebut'] = filters.dateDebut;
        if (filters.superviseur) matchGroupe['serviceFinal.superviseur'] = filters.superviseur;

        const groupes = await Groupe.find(matchGroupe).exec();

        // Filtrer les stages individuels
        const matchStage = {};
        if (filters.dateDebut) matchStage['stagiaires.servicesAffectes.dateDebut'] = filters.dateDebut;
        if (filters.superviseur) matchStage['stagiaires.servicesAffectes.superviseurs'] = filters.superviseur;

        const stagesIndividuels = await Stage.find(matchStage)
            .select('stagiaires.servicesAffectes')
            .exec();

        // Calculer la durée totale pour les groupes
        const totalMoisGroupes = groupes.reduce((acc, g) => {
            const diffMs = g.serviceFinal.dateFin - g.serviceFinal.dateDebut;
            const mois = diffMs / (1000 * 60 * 60 * 24 * 30);
            return acc + mois;
        }, 0);

        // Calculer la durée totale pour les stages individuels
        const totalMoisIndividuels = stagesIndividuels.reduce((acc, s) => {
            const durees = s.stagiaires.flatMap(stagiaire =>
                stagiaire.servicesAffectes.map(service => {
                    const diffMs = service.dateFin - service.dateDebut;
                    return diffMs / (1000 * 60 * 60 * 24 * 30);
                })
            );
            return acc + durees.reduce((sum, mois) => sum + mois, 0);
        }, 0);

        // Nombre total de groupes et stages individuels
        const totalGroupes = groupes.length;
        const totalStagesIndividuels = stagesIndividuels.reduce(
            (count, s) => count + s.stagiaires.length,
            0
        );

        const totalMois = totalMoisGroupes + totalMoisIndividuels;
        const totalStages = totalGroupes + totalStagesIndividuels;

        const moyenne = totalStages > 0 ? totalMois / totalStages : 0;

        return res.status(200).json({
            success: true,
            dureeMoyenneMois: moyenne.toFixed(2),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message,
        });
    }
};


// 5,6,7 Taux acceptation/refus/en attente
export const tauxStatutStages = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const filters = buildFilters(req.query);

        // Trouver stages via groupes filtrés
        const groupes = await getFilteredGroupes(filters);
        const stageIds = [...new Set(groupes.map(g => g.stage.toString()))];

        const matchStage = {};
        if (stageIds.length > 0) {
            matchStage._id = { $in: stageIds.map(id => mongoose.Types.ObjectId(id)) };
        }

        const result = await Stage.aggregate([
            { $match: matchStage },
            {
                $group: {
                _id: '$statut',
                count: { $sum: 1 }
                }
            }
        ]);

        const total = result.reduce((acc, cur) => acc + cur.count, 0);
        const map = result.reduce((acc, cur) => {
            acc[cur._id] = cur.count;
            return acc;
        }, {});

        return res.status(200).json({
            success : true,
            tauxStatutStages:{
                tauxAccepte: total > 0 ? (map.ACCEPTE || 0) / total : 0,
                tauxRefuse: total > 0 ? (map.REFUSE || 0) / total : 0,
                tauxEnAttente: total > 0 ? (map.EN_ATTENTE || 0) / total : 0,
            }
        });
    } catch (error) {
        return res.status(500).json({ 
            success:false,
            message:t('erreur_serveur', lang),
            error: error.message 
        });
    }
};

// 8. Répartition stagiaires par service (servicesAffectes dans stagiaires)
export const repartitionStagiairesParService = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const filters = buildFilters(req.query);

        // Récupérer les groupes filtrés
        const groupes = await getFilteredGroupes(filters);
        const stageIds = groupes.map(g => g.stage.toString());

        // Préparer le filtre pour les stages
        const matchStage = {};
        if (stageIds.length > 0) {
            matchStage._id = { $in: stageIds.map(id => mongoose.Types.ObjectId(id)) };
        }

        // Pipeline d'agrégation
        const pipeline = [
            { $match: matchStage },
            { $unwind: '$stagiaires' },
            { $unwind: '$stagiaires.servicesAffectes' },
            {
                $group: {
                    _id: '$stagiaires.servicesAffectes.service',
                    nombreStagiaires: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'services', // Nom de la collection des services
                    localField: '_id',
                    foreignField: '_id',
                    as: 'serviceDetails'
                }
            },
            { $unwind: '$serviceDetails' },
            {
                $project: {
                    _id: 0,
                    serviceId: '$_id',
                    nombreStagiaires: 1,
                    nomFr: '$serviceDetails.nomFr',
                    nomEn: '$serviceDetails.nomEn'
                }
            }
        ];

        // Exécuter l'agrégation
        const result = await Stage.aggregate(pipeline);

        return res.json({
            success: true,
            repartitionParService: result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: error.message
        });
    }
};



// 9. Répartition stagiaires par superviseur (nombre groupes en cours et terminés + stages uniques)
export const repartitionStagiairesParSuperviseur = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';

  try {
    const filters = buildFilters(req.query);

    // Appliquer uniquement le filtrage par date
    const matchGroupe = {};
    const matchStageUnique = {};

    if (filters.dateDebut && filters.dateFin) {
      matchGroupe['serviceFinal.dateDebut'] = { $gte: new Date(filters.dateDebut) };
      matchGroupe['serviceFinal.dateFin'] = { $lte: new Date(filters.dateFin) };

      matchStageUnique.dateDebut = { $gte: new Date(filters.dateDebut) };
      matchStageUnique.dateFin = { $lte: new Date(filters.dateFin) };
    }

    // Récupérer les groupes et stages individuels avec les superviseurs
    const groupes = await Groupe.find(matchGroupe)
      .populate('serviceFinal.superviseur', 'nom prenom')
      .exec();

    const stagesUniques = await Stage.find(matchStageUnique)
      .populate('superviseur', 'nom prenom')
      .exec();

    const now = new Date();
    const map = {};

    // Traiter les groupes
    groupes.forEach(g => {
      const sup = g.serviceFinal?.superviseur;
      if (!sup || !sup._id) return;

      const supId = sup._id.toString();
      if (!map[supId]) {
        map[supId] = {
          superviseur: { nom: sup.nom, prenom: sup.prenom },
          enCours: 0,
          termines: 0
        };
      }

      const dateFin = g.serviceFinal?.dateFin;
      if (dateFin && dateFin < now) {
        map[supId].termines++;
      } else {
        map[supId].enCours++;
      }
    });

    // Traiter les stages individuels
    stagesUniques.forEach(stage => {
      const sup = stage.superviseur;
      if (!sup || !sup._id) return;

      const supId = sup._id.toString();
      if (!map[supId]) {
        map[supId] = {
          superviseur: { nom: sup.nom, prenom: sup.prenom },
          enCours: 0,
          termines: 0
        };
      }

      const dateFin = stage.dateFin;
      if (dateFin && dateFin < now) {
        map[supId].termines++;
      } else {
        map[supId].enCours++;
      }
    });

    // Retourner la structure demandée
    return res.status(200).json({
      success: true,
      data: Object.values(map)
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message
    });
  }
};


export const getNombreStagesEnCours = async (req, res) => {
  const lang = req.headers['accept-language'] || 'fr';
  try {
    const now = new Date();

    // 1. Stages individuels : on compte les stagiaires dont au moins un service affecté est en cours (dateFin > now)
    // On décompose en pipeline d'agrégation pour filtrer les stagiaires dans stages individuels
    const individuelPipeline = [
      { $match: { typeStage: 'INDIVIDUEL' } },
      { $unwind: '$stagiaires' },
      { $unwind: '$stagiaires.servicesAffectes' },
      { $match: { 'stagiaires.servicesAffectes.dateFin': { $gt: now } } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ];
    const individuelResult = await Stage.aggregate(individuelPipeline);
    const nombreIndividuel = individuelResult.length > 0 ? individuelResult[0].count : 0;

    // 2. Stages en groupe : on trouve les groupes dont serviceFinal.dateFin > now
    // puis on compte le nombre total de stagiaires dans ces groupes
    const groupes = await Groupe.find({ 'serviceFinal.dateFin': { $gt: now } }).select('stagiaires').lean();
    const nombreGroupe = groupes.reduce((acc, groupe) => acc + (groupe.stagiaires?.length || 0), 0);

    const totalStagesEnCours = nombreIndividuel + nombreGroupe;

    return res.status(200).json({
      success: true,
      data: totalStagesEnCours,
    });
  } catch (error) {
    console.error('Erreur getNombreStagesEnCours:', error);
    return res.status(500).json({
      success: false,
      message: t('erreur_serveur', lang),
      error: error.message,
    });
  }
};










// const genererGroupes = async (req, res) => {
//     try {
//         const { stagiaires, tailleGroupe } = req.body;

//         if (!stagiaires || !Array.isArray(stagiaires) || stagiaires.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "La liste des stagiaires est requise.",
//             });
//         }

//         if (!tailleGroupe || typeof tailleGroupe !== "number" || tailleGroupe < 1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "La taille des groupes doit être un entier positif.",
//             });
//         }

//         const groupes = [];
//         let index = 0;

//         while (index < stagiaires.length) {
//             // Si les stagiaires restants sont inférieurs à la moitié de la taille du groupe
//             if (stagiaires.length - index < Math.ceil(tailleGroupe / 2)) {
//                 groupes[groupes.length - 1].stagiaires.push(...stagiaires.slice(index));
//                 break;
//             }

//             groupes.push({
//                 numero: groupes.length + 1,
//                 stagiaires: stagiaires.slice(index, index + tailleGroupe),
//                 serviceFinal: null,
//             });

//             index += tailleGroupe;
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Groupes générés avec succès.",
//             groupes,
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             success: false,
//             message: "Erreur interne du serveur.",
//             error: error.message,
//         });
//     }
// };




