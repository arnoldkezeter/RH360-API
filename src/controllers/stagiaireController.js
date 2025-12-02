import Stagiaire from '../models/Stagiaire.js';
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import { generateRandomPassword } from '../utils/password.js';
import { sendAccountEmail } from '../utils/sendMail.js';
import { Groupe } from '../models/Groupe.js';
import Etablissement from '../models/Etablissement.js';
import BaseUtilisateur from '../models/BaseUtilisateur.js';
import { AffectationFinale } from '../models/AffectationFinale.js';

export const createStagiaire = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    // Validation des champs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { nom, prenom, email, genre, dateNaissance, lieuNaissance, telephone, commune, parcours } = req.body;

        // Vérifier si l'email existe déjà
        const exists = await BaseUtilisateur.exists({ email });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: t('stagiaire_email_existe', lang),
            });
        }

        // Vérification du parcours
        if (!parcours || parcours.length !== 1 || !parcours[0].etablissement) {
            return res.status(400).json({
                success: false,
                message: t('parcours_invalide', lang),
            });
        }

        const etablissement  = parcours[0].etablissement;
        
        // Vérifier si l'établissement existe
        let etablissementRecord = await Etablissement.findOne({
            $or: [
                { nomFr: etablissement.nomFr },
                { nomEn: etablissement.nomEn },
            ],
        });

        // Si l'établissement n'existe pas, le créer
        if (!etablissementRecord) {
            etablissementRecord = await Etablissement.create({
                nomFr: etablissement.nomFr,
                nomEn: etablissement.nomEn,
            });
        }

        const password = generateRandomPassword();
        parcours[0].etablissement = etablissementRecord._id;
        // Créer un stagiaire
        const stagiaire = await Stagiaire.create({
            nom,
            prenom,
            email,
            motDePasse: password,
            genre,
            dateNaissance,
            lieuNaissance,
            telephone,
            commune,
            parcours: parcours
        });
        const stagiairePopulate = await stagiaire.populate('parcours.etablissement');

        // Envoi de l'email de création de compte
        // await sendAccountEmail(email, email, password);
        return res.status(201).json({
            success: true,
            message: t('ajouter_succes', lang),
            data:stagiairePopulate,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const updateStagiaire = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const { id } = req.params;
        const { parcours, ...otherData } = req.body;

        // Trouver le stagiaire
        const stagiaire = await Stagiaire.findById(id);
        if (!stagiaire) {
            return res.status(404).json({
                success: false,
                message: t('stagiaire_non_trouve', lang),
            });
        }
        const email = otherData.email
        if (email) {
            const emailExists = await BaseUtilisateur.findOne({
                email,
                _id: { $ne: id }, // Exclure le chercheur actuel
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: t('email_deja_utilise', lang),
                });
            }
        }

        // Traiter les parcours
        if (parcours && Array.isArray(parcours)) {
            for (const newParcours of parcours) {
                // Vérifier l'existence de l'établissement
                let etablissement = await Etablissement.findOne({
                    $or: [
                        { nomFr: newParcours.etablissement.nomFr },
                        { nomEn: newParcours.etablissement.nomEn },
                    ],
                });

                if (!etablissement) {
                    // Créer l'établissement si inexistant
                    etablissement = await Etablissement.create(newParcours.etablissement);
                }

                // Vérifier si le parcours existe pour l'année donnée
                const existingIndex = stagiaire.parcours.findIndex(p => p.annee === newParcours.annee);

                if (existingIndex !== -1) {
                    // Mettre à jour le parcours existant
                    stagiaire.parcours[existingIndex] = {
                        ...stagiaire.parcours[existingIndex],
                        ...newParcours,
                        etablissement: etablissement._id,
                    };
                } else {
                    // Ajouter un nouveau parcours
                    stagiaire.parcours.push({
                        ...newParcours,
                        etablissement: etablissement._id,
                    });
                }
            }
        }

        // Mettre à jour les autres données du stagiaire
        Object.assign(stagiaire, otherData);

        // Sauvegarder les modifications
        await stagiaire.save();
        const stagiairePopulate = await stagiaire.populate('parcours.etablissement');
        return res.status(200).json({
            success: true,
            message: t('modifier_succes', lang),
            data:stagiairePopulate,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const deleteStagiaire = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';

    try {
        const { id } = req.params;

        const stagiaire = await Stagiaire.findByIdAndDelete(id);

        if (!stagiaire) {
            return res.status(404).json({
                success: false,
                message: t('stagiaire_non_trouve', lang),
            });
        }

        return res.status(200).json({
            success: true,
            message: t('supprimer_succes', lang),
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};

export const updatePassword = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { id } = req.params;
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: t('champs_obligatoires', lang),
            errors: errors.array().map(err => err.msg),
        });
    }

    try {
        const stagiaire = await Stagiaire.findById(id);
        if (!stagiaire) {
            return res.status(404).json({
                success: false,
                message: t('stagiaire_non_trouve', lang),
            });
        }

        const match = await bcrypt.compare(ancienMotDePasse, stagiaire.motDePasse);
        if (!match) {
            return res.status(401).json({
                success: false,
                message: t('mot_de_passe_incorrect', lang),
            });
        }

        const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
        stagiaire.motDePasse = hashedPassword;
        await stagiaire.save();

        return res.status(200).json({
            success: true,
            message: t('mot_de_passe_modifie', lang),
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: t('erreur_serveur', lang),
            error: err.message,
        });
    }
};


export const getStagiaires = async (req, res) => {
    const lang = req.headers['accept-language'] || 'fr';
    const { page = 1, limit = 10, dateDebut, dateFin, serviceId, etablissement, statut, search } = req.query;

    try {
        const pipeline = [];

        // 1. Filtrage initial des stagiaires
        const stagiaireFilters = {};
        
        if (search) {
            stagiaireFilters.$or = [
                { nom: { $regex: search, $options: 'i' } },
                { prenom: { $regex: search, $options: 'i' } },
            ];
        }
        
        if (etablissement) {
            stagiaireFilters['parcours.etablissement'] = new mongoose.Types.ObjectId(etablissement);
        }
        
        if (Object.keys(stagiaireFilters).length > 0) {
            pipeline.push({ $match: stagiaireFilters });
        }

        // 2. Lookup des affectations finales pour chaque stagiaire (individuelles)
        pipeline.push({
            $lookup: {
                from: 'affectationfinales',
                localField: '_id',
                foreignField: 'stagiaire',
                as: 'affectationsIndividuelles'
            }
        });

        // 3. Lookup des groupes dont le stagiaire fait partie
        pipeline.push({
            $lookup: {
                from: 'groupes',
                localField: '_id',
                foreignField: 'stagiaires',
                as: 'groupes'
            }
        });

        // 4. Lookup des affectations de groupe
        pipeline.push({
            $lookup: {
                from: 'affectationfinales',
                localField: 'groupes._id',
                foreignField: 'groupe',
                as: 'affectationsGroupes'
            }
        });

        // 5. Combiner toutes les affectations
        pipeline.push({
            $addFields: {
                toutesAffectations: {
                    $concatArrays: ['$affectationsIndividuelles', '$affectationsGroupes']
                }
            }
        });

        // 6. Filtrer les affectations selon les critères
        pipeline.push({
            $addFields: {
                affectationsFiltrees: {
                    $filter: {
                        input: '$toutesAffectations',
                        as: 'aff',
                        cond: {
                            $and: [
                                dateDebut ? { $gte: ['$$aff.dateDebut', new Date(dateDebut)] } : true,
                                dateFin ? { $lte: ['$$aff.dateFin', new Date(dateFin)] } : true,
                                serviceId ? { $eq: ['$$aff.service', new mongoose.Types.ObjectId(serviceId)] } : true
                            ]
                        }
                    }
                }
            }
        });

        // 7. Ne garder que les stagiaires avec au moins une affectation filtrée
        if (dateDebut || dateFin || serviceId) {
            pipeline.push({
                $match: {
                    'affectationsFiltrees.0': { $exists: true }
                }
            });
        }

        // 8. Lookup des stages depuis les affectations
        pipeline.push({
            $lookup: {
                from: 'stages',
                localField: 'affectationsFiltrees.stage',
                foreignField: '_id',
                as: 'stagesFromAffectations'
            }
        });

        // 9. Filtrer par statut de stage si nécessaire
        if (statut) {
            pipeline.push({
                $match: {
                    'stagesFromAffectations.statut': statut
                }
            });
        }

        // 10. Trouver la dernière affectation
        pipeline.push({
            $addFields: {
                derniereAffectation: {
                    $first: {
                        $sortArray: {
                            input: '$affectationsFiltrees',
                            sortBy: { dateDebut: -1 }
                        }
                    }
                }
            }
        });

        // 11. Lookup du stage de la dernière affectation
        pipeline.push({
            $lookup: {
                from: 'stages',
                localField: 'derniereAffectation.stage',
                foreignField: '_id',
                as: 'dernierStageDetails'
            }
        });

        // 12. Lookup du service de la dernière affectation
        pipeline.push({
            $lookup: {
                from: 'services',
                localField: 'derniereAffectation.service',
                foreignField: '_id',
                as: 'dernierServiceDetails'
            }
        });

        // 13. Lookup de l'établissement
        pipeline.push({
            $lookup: {
                from: 'etablissements',
                localField: 'parcours.etablissement',
                foreignField: '_id',
                as: 'etablissementDetails'
            }
        });

        // 14. Lookup de la commune
        pipeline.push({
            $lookup: {
                from: 'communes',
                localField: 'commune',
                foreignField: '_id',
                as: 'communeDetails'
            }
        });

        // 15. Projection finale
        pipeline.push({
            $project: {
                _id: 1,
                nom: 1,
                prenom: 1,
                email: 1,
                genre: 1,
                dateNaissance: 1,
                lieuNaissance: 1,
                telephone: 1,
                commune: { $arrayElemAt: ['$communeDetails', 0] },
                parcours: {
                    $map: {
                        input: '$parcours',
                        as: 'p',
                        in: {
                            annee: '$$p.annee',
                            filiere: '$$p.filiere',
                            option: '$$p.option',
                            niveau: '$$p.niveau',
                            etablissement: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: '$etablissementDetails',
                                            as: 'etab',
                                            cond: { $eq: ['$$etab._id', '$$p.etablissement'] }
                                        }
                                    },
                                    0
                                ]
                            }
                        }
                    }
                },
                statut: { 
                    $ifNull: [
                        { $arrayElemAt: ['$dernierStageDetails.statut', 0] },
                        'EN_ATTENTE'
                    ]
                },
                periode: {
                    $cond: {
                        if: { $ne: ['$derniereAffectation', null] },
                        then: {
                            dateDebut: '$derniereAffectation.dateDebut',
                            dateFin: '$derniereAffectation.dateFin'
                        },
                        else: null
                    }
                },
                service: { $arrayElemAt: ['$dernierServiceDetails', 0] }
            }
        });

        // 16. Calculer le total
        const countPipeline = [...pipeline, { $count: 'total' }];
        
        // 17. Appliquer la pagination
        const paginatedPipeline = [
            ...pipeline,
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        ];

        // 18. Exécuter les deux pipelines en parallèle
        const [totalResult, paginatedResults] = await Promise.all([
            Stagiaire.aggregate(countPipeline),
            Stagiaire.aggregate(paginatedPipeline),
        ]);

        const totalItems = totalResult.length > 0 ? totalResult[0].total : 0;
        const totalPages = Math.ceil(totalItems / parseInt(limit));

        return res.status(200).json({
            success: true,
            data: {
                stagiaires: paginatedResults,
                totalItems,
                currentPage: parseInt(page),
                totalPages,
                pageSize: parseInt(limit),
            },
        });
    } catch (error) {
        console.error("Erreur dans getStagiaires:", error);
        return res.status(500).json({
            success: false,
            message: lang === 'en' 
                ? 'An error occurred while retrieving interns'
                : 'Une erreur est survenue lors de la récupération des stagiaires',
            error: error.message,
        });
    }
};




export const saveManyStagiaires = async (req, res) => {
    try{
        // data/stagiaires.js
        const stagiairesData = [
            {
                nom: "Ngono",
                prenom: "Jean",
                email: "jean.ngono@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1999-05-14"),
                lieuNaissance: "Yaoundé",
                telephone: 670112233,
                parcours: [{
                annee: 2025,
                etablissement: "6849be7de505d0efcdbb52cd",
                filiere: "Informatique",
                option: "Développement",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Mballa",
                prenom: "Chantal",
                email: "chantal.mballa@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("2000-07-21"),
                lieuNaissance: "Douala",
                telephone: 690223344,
                parcours: [{
                annee: 2025,
                etablissement: "6849bea4e505d0efcdbb52df",
                filiere: "Comptabilité",
                option: "Audit",
                niveau: "Licence 2"
                }]
            },
            {
                nom: "Ewane",
                prenom: "Marc",
                email: "marc.ewane@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1998-03-10"),
                lieuNaissance: "Bafoussam",
                telephone: 699334455,
                parcours: [{
                annee: 2025,
                etablissement: "6851c47078b234748a4ef2dd",
                filiere: "Gestion",
                option: "Management",
                niveau: "Master 1"
                }]
            },
            {
                nom: "Nana",
                prenom: "Clarisse",
                email: "clarisse.nana@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("2001-01-30"),
                lieuNaissance: "Yaoundé",
                telephone: 655445566,
                parcours: [{
                annee: 2025,
                etablissement: "6851c59fde4d392fa3559617",
                filiere: "Ressources Humaines",
                option: "Formation",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Tchinda",
                prenom: "Paul",
                email: "paul.tchinda@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1997-12-15"),
                lieuNaissance: "Ngaoundéré",
                telephone: 678556677,
                parcours: [{
                annee: 2025,
                etablissement: "6849be7de505d0efcdbb52cd",
                filiere: "Electronique",
                option: "Automatisme",
                niveau: "Licence 2"
                }]
            },
            {
                nom: "Abena",
                prenom: "Lucie",
                email: "lucie.abena@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("2000-09-05"),
                lieuNaissance: "Bertoua",
                telephone: 675667788,
                parcours: [{
                annee: 2025,
                etablissement: "6849bea4e505d0efcdbb52df",
                filiere: "Communication",
                option: "Journalisme",
                niveau: "Master 1"
                }]
            },
            {
                nom: "Ondoa",
                prenom: "Samuel",
                email: "samuel.ondoa@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1998-11-11"),
                lieuNaissance: "Kribi",
                telephone: 674778899,
                parcours: [{
                annee: 2025,
                etablissement: "6851c47078b234748a4ef2dd",
                filiere: "Informatique",
                option: "Réseaux",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Talla",
                prenom: "Béatrice",
                email: "beatrice.talla@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("1999-02-19"),
                lieuNaissance: "Bamenda",
                telephone: 679889900,
                parcours: [{
                annee: 2025,
                etablissement: "6851c59fde4d392fa3559617",
                filiere: "Sciences Politiques",
                option: "Relations Internationales",
                niveau: "Licence 2"
                }]
            },
            {
                nom: "Fouda",
                prenom: "Pierre",
                email: "pierre.fouda@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("2001-06-25"),
                lieuNaissance: "Yaoundé",
                telephone: 691990011,
                parcours: [{
                annee: 2025,
                etablissement: "6849be7de505d0efcdbb52cd",
                filiere: "Mathématiques",
                option: "Statistiques",
                niveau: "Master 1"
                }]
            },
            {
                nom: "Nkoua",
                prenom: "Estelle",
                email: "estelle.nkoua@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("1997-10-07"),
                lieuNaissance: "Douala",
                telephone: 672112233,
                parcours: [{
                annee: 2025,
                etablissement: "6849bea4e505d0efcdbb52df",
                filiere: "Commerce",
                option: "Marketing",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Kamdem",
                prenom: "Alain",
                email: "alain.kamdem@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("2000-08-12"),
                lieuNaissance: "Garoua",
                telephone: 677001122,
                parcours: [{
                annee: 2025,
                etablissement: "6851c59fde4d392fa3559617",
                filiere: "Génie Civil",
                option: "Bâtiment",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Mbarga",
                prenom: "Sylvie",
                email: "sylvie.mbarga@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("1999-11-29"),
                lieuNaissance: "Ebolowa",
                telephone: 676112233,
                parcours: [{
                annee: 2025,
                etablissement: "6849be7de505d0efcdbb52cd",
                filiere: "Sciences de l'Éducation",
                option: "Pédagogie",
                niveau: "Licence 2"
                }]
            },
            {
                nom: "Njiki",
                prenom: "Hermann",
                email: "hermann.njiki@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1998-04-16"),
                lieuNaissance: "Maroua",
                telephone: 675223344,
                parcours: [{
                annee: 2025,
                etablissement: "6849bea4e505d0efcdbb52df",
                filiere: "Informatique",
                option: "Sécurité",
                niveau: "Master 1"
                }]
            },
            {
                nom: "Essomba",
                prenom: "Patricia",
                email: "patricia.essomba@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("2001-12-02"),
                lieuNaissance: "Yaoundé",
                telephone: 674334455,
                parcours: [{
                annee: 2025,
                etablissement: "6851c47078b234748a4ef2dd",
                filiere: "Biologie",
                option: "Microbiologie",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Ebene",
                prenom: "Franck",
                email: "franck.ebene@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1999-07-18"),
                lieuNaissance: "Limbé",
                telephone: 670889900,
                parcours: [{
                annee: 2025,
                etablissement: "6851c59fde4d392fa3559617",
                filiere: "Chimie",
                option: "Analyse",
                niveau: "Licence 2"
                }]
            },
            {
                nom: "Mvondo",
                prenom: "Aurélie",
                email: "aurelie.mvondo@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("2000-03-23"),
                lieuNaissance: "Mbalmayo",
                telephone: 673990011,
                parcours: [{
                annee: 2025,
                etablissement: "6849be7de505d0efcdbb52cd",
                filiere: "Lettres Modernes",
                option: "Français",
                niveau: "Master 1"
                }]
            },
            {
                nom: "Yondo",
                prenom: "Christophe",
                email: "christophe.yondo@example.com",
                motDePasse: "password123",
                genre: "M",
                dateNaissance: new Date("1998-06-09"),
                lieuNaissance: "Douala",
                telephone: 672778899,
                parcours: [{
                annee: 2025,
                etablissement: "6849bea4e505d0efcdbb52df",
                filiere: "Philosophie",
                option: "Éthique",
                niveau: "Licence 3"
                }]
            },
            {
                nom: "Ngassa",
                prenom: "Mireille",
                email: "mireille.ngassa@example.com",
                motDePasse: "password123",
                genre: "F",
                dateNaissance: new Date("2001-05-01"),
                lieuNaissance: "Yaoundé",
                telephone: 676556677,
                parcours: [{
                annee: 2025,
                etablissement: "6851c47078b234748a4ef2dd",
                filiere: "Sciences Sociales",
                option: "Sociologie",
                niveau: "Licence 2"
                }]
            }
        ];

        await Stagiaire.insertMany(stagiairesData);
        return res.status(200).json({
            success: true,
            message:"Stagiaires enregistrées" 
        })
    }catch(err){
        console.log(err)
        return res.status(500).json({
            success: false,
            message:"Erreur serveur" 
        })
    }
    
}










