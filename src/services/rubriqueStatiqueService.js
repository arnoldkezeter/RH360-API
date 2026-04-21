// services/rubriqueStatiqueService.js
import mongoose from 'mongoose';
import RubriqueStatique from '../models/RubriqueStatique.js';
import QuestionStatique from '../models/QuestionStatique.js';
import TypeEchelleReponse from '../models/TypeEchelleDeReponse.js';
import EchelleReponse from '../models/EchelleDeReponse.js';

/**
 * Récupère les mappings des types d'échelles depuis la base
 * Retourne un Map: nomFr -> _id
 */
async function getTypeEchelleMapping() {
    const types = await TypeEchelleReponse.find({}).lean();
    const mapping = new Map();
    
    for (const type of types) {
        // Mapping par nomFr
        mapping.set(type.nomFr.toLowerCase().trim(), type._id);
        // Mapping par nomEn
        mapping.set(type.nomEn?.toLowerCase().trim(), type._id);
        // Mapping par ID
        mapping.set(type._id.toString(), type._id);
    }
    
    return mapping;
}

/**
 * Données par défaut pour les rubriques statiques
 */
const RUBRIQUES_PAR_DEFAUT = [
    {
        code: 'PROFIL',
        titreFr: 'Profil',
        titreEn: 'Profile',
        ordre: 1,
        masquable: false,
        questionsPersonnalisables: true,
        questionsSupprimables: false
    },
    {
        code: 'ORGANISATION',
        titreFr: 'Organisation de la formation',
        titreEn: 'Training Organisation',
        ordre: 2,
        masquable: true,
        questionsPersonnalisables: true,
        questionsSupprimables: true
    },
    {
        code: 'CONTENU_PEDAGOGIQUE',
        titreFr: 'Contenus pédagogiques et animation de la formation',
        titreEn: 'Pedagogical Content and Training Delivery',
        ordre: 3,
        masquable: true,
        questionsPersonnalisables: true,
        questionsSupprimables: true
    },
    {
        code: 'APPRENTISSAGE',
        titreFr: 'Apprentissage et transfert de connaissances',
        titreEn: 'Learning and Knowledge Transfer',
        ordre: 4,
        masquable: true,
        questionsPersonnalisables: true,
        questionsSupprimables: true
    }
];

/**
 * Construction des questions par défaut avec les vrais ObjectId des types d'échelles
 */
async function buildQuestionsParDefaut(typeMapping) {
    // Fonction helper pour récupérer l'ID d'un type d'échelle
    const getTypeId = (nom) => {
        // Normaliser la casse et les espaces pour la recherche
        const nomNormalise = nom.toLowerCase().trim();
        const id = typeMapping.get(nomNormalise);
        if (!id) {
            console.warn(`⚠️ Type d'échelle non trouvé: ${nom}`);
            return null;
        }
        return id;
    };

    return [
        // ========== RUBRIQUE PROFIL ==========
        {
            rubriqueCode: 'PROFIL',
            code: 'profil_structure',
            libelleFr: 'Structure de rattachement',
            libelleEn: 'Reporting structure',
            type: 'texte_libre',
            typeEchelle: null,
            commentaireGlobal: true,
            ordre: 1,
            supprimable: false
        },
        {
            rubriqueCode: 'PROFIL',
            code: 'profil_grade',
            libelleFr: 'Grade',
            libelleEn: 'Grade',
            type: 'texte_libre',
            typeEchelle: null,
            commentaireGlobal: true,
            ordre: 2,
            supprimable: false
        },
        {
            rubriqueCode: 'PROFIL',
            code: 'profil_poste',
            libelleFr: 'Poste occupé',
            libelleEn: 'Position held',
            type: 'texte_libre',
            typeEchelle: null,
            commentaireGlobal: true,
            ordre: 3,
            supprimable: false
        },
        {
            rubriqueCode: 'PROFIL',
            code: 'profil_genre',
            libelleFr: 'Genre',
            libelleEn: 'Gender',
            type: 'avec_sous_questions',
            typeEchelle: null,
            commentaireGlobal: false,
            ordre: 4,
            supprimable: false,
            sousQuestions: [
                { libelleFr: 'Femme', libelleEn: 'Female', ordre: 1, commentaireObligatoire: false },
                { libelleFr: 'Homme', libelleEn: 'Male', ordre: 2, commentaireObligatoire: false }
            ]
        },
        
        // ========== RUBRIQUE ORGANISATION ==========
        {
            rubriqueCode: 'ORGANISATION',
            code: 'org_duree',
            libelleFr: 'Que pensez-vous de la durée de la formation ?',
            libelleEn: 'What do you think of the training duration?',
            type: 'simple',
            typeEchelle: getTypeId("Echelle d’évaluation de la durée"),
            commentaireGlobal: false,
            ordre: 1,
            supprimable: true
        },
        {
            rubriqueCode: 'ORGANISATION',
            code: 'org_satisfaction',
            libelleFr: 'Quel est votre degré de satisfaction générale concernant les aspects suivants :',
            libelleEn: 'What is your overall degree of satisfaction regarding the following aspects:',
            type: 'avec_sous_questions',
            typeEchelle: getTypeId("Echelle satisfaction"),
            commentaireGlobal: false,
            ordre: 2,
            supprimable: true,
            sousQuestions: [
                { libelleFr: "Organisation de l'espace", libelleEn: 'Space organisation', ordre: 1, commentaireObligatoire: false }
            ]
        },
        
        // ========== RUBRIQUE CONTENU PEDAGOGIQUE ==========
        {
            rubriqueCode: 'CONTENU_PEDAGOGIQUE',
            code: 'contenu_satisfaction',
            libelleFr: 'Quel est votre degré de satisfaction concernant :',
            libelleEn: 'What is your degree of satisfaction regarding:',
            type: 'avec_sous_questions',
            typeEchelle: getTypeId("Echelle satisfaction"),
            commentaireGlobal: false,
            ordre: 1,
            supprimable: false,
            sousQuestions: [
                { libelleFr: 'La clarté des objectifs de la formation', libelleEn: 'Clarity of training objectives', ordre: 1, commentaireObligatoire: false },
                { libelleFr: 'La maîtrise par le formateur des sujets abordés', libelleEn: "Trainer's mastery of topics covered", ordre: 2, commentaireObligatoire: false },
                { libelleFr: 'Les réponses données par le formateur sur les questions posées lors de la formation', libelleEn: "Trainer's answers to questions raised", ordre: 3, commentaireObligatoire: false },
                { libelleFr: 'Le scénario pédagogique', libelleEn: 'Pedagogical scenario', ordre: 4, commentaireObligatoire: false },
                { libelleFr: 'La qualité des supports pédagogiques remis aux participants', libelleEn: 'Quality of training materials provided', ordre: 5, commentaireObligatoire: false },
                { libelleFr: 'Les contenus théoriques', libelleEn: 'Theoretical content', ordre: 6, commentaireObligatoire: false },
                { libelleFr: 'Les activités pratiques proposées', libelleEn: 'Practical activities proposed', ordre: 7, commentaireObligatoire: false },
                { libelleFr: "L'animation générale de la formation", libelleEn: 'Overall training facilitation', ordre: 8, commentaireObligatoire: false }
            ]
        },
        {
            rubriqueCode: 'CONTENU_PEDAGOGIQUE',
            code: 'contenu_attentes',
            libelleFr: 'Cette formation a-t-elle répondu à vos attentes ?',
            libelleEn: 'Did this training meet your expectations?',
            type: 'simple',
            typeEchelle: getTypeId("Echelle d’accord simplifiée"),
            commentaireGlobal: true,
            ordre: 10,
            supprimable: false
        },
        
        // ========== RUBRIQUE APPRENTISSAGE ==========
        {
            rubriqueCode: 'APPRENTISSAGE',
            code: 'app_occasion',
            libelleFr: "Aurez-vous l'occasion d'utiliser ces nouvelles connaissances dans l'exécution de votre travail ?",
            libelleEn: 'Will you have the opportunity to use this new knowledge in your work?',
            type: 'simple',
            typeEchelle: getTypeId("Echelle d’accord simplifiée"),
            commentaireGlobal: true,
            ordre: 1,
            supprimable: true
        },
        {
            rubriqueCode: 'APPRENTISSAGE',
            code: 'app_mesure',
            libelleFr: "Si oui, vous sentez-vous en mesure d'appliquer les contenus présents dans votre travail ?",
            libelleEn: 'If yes, do you feel able to apply the content in your work?',
            type: 'simple',
            typeEchelle: getTypeId("Echelle d’accord simplifiée"),
            commentaireGlobal: true,
            ordre: 2,
            supprimable: true
        },
        {
            rubriqueCode: 'APPRENTISSAGE',
            code: 'app_contraintes',
            libelleFr: "Si oui, quelles contraintes vous empêcheraient d'appliquer les contenus présents dans votre travail ?",
            libelleEn: 'If yes, what constraints would prevent you from applying the content?',
            type: 'texte_libre',
            typeEchelle: null,
            commentaireGlobal: true,
            ordre: 3,
            supprimable: true
        },
        {
            rubriqueCode: 'APPRENTISSAGE',
            code: 'app_duplication',
            libelleFr: 'Vous sentez-vous en mesure de dupliquer cette formation dans votre structure de rattachement ou ailleurs ?',
            libelleEn: 'Do you feel able to replicate this training in your reporting structure or elsewhere?',
            type: 'simple',
            typeEchelle: getTypeId("Echelle d’accord simplifiée"),
            commentaireGlobal: true,
            ordre: 4,
            supprimable: true
        }
    ];
}

/**
 * Initialise les rubriques statiques en base (à appeler au démarrage)
 */
export async function initialiserRubriquesStatiques() {
    console.log('🔄 Initialisation des rubriques statiques...');
    
    for (const rubriqueData of RUBRIQUES_PAR_DEFAUT) {
        const existing = await RubriqueStatique.findOne({ code: rubriqueData.code });
        
        if (!existing) {
            await RubriqueStatique.create(rubriqueData);
            console.log(`✅ Rubrique créée: ${rubriqueData.code}`);
        }
    }
    
    console.log('✅ Initialisation des rubriques terminée');
}

/**
 * Initialise les questions statiques en base
 * Utilise les vrais ObjectId des types d'échelles
 */
export async function initialiserQuestionsStatiques() {
    console.log('🔄 Initialisation des questions statiques...');
    
    // Récupérer le mapping des types d'échelles
    const typeMapping = await getTypeEchelleMapping();
    console.log(`📊 Types d'échelles trouvés: ${typeMapping.size}`);
    
    // Construire les questions avec les bons IDs
    const questionsData = await buildQuestionsParDefaut(typeMapping);
    
    for (const questionData of questionsData) {
        const existing = await QuestionStatique.findOne({ code: questionData.code });
        
        if (!existing) {
            await QuestionStatique.create(questionData);
            console.log(`✅ Question créée: ${questionData.code}`);
        } else {
            // Mettre à jour si le typeEchelle a changé
            if (existing.typeEchelle?.toString() !== questionData.typeEchelle?.toString()) {
                await QuestionStatique.updateOne(
                    { code: questionData.code },
                    { typeEchelle: questionData.typeEchelle }
                );
                console.log(`🔄 Question mise à jour: ${questionData.code}`);
            }
        }
    }
    
    console.log('✅ Initialisation des questions terminée');
}

/**
 * Récupère toutes les rubriques statiques avec leurs questions
 * Les questions contiennent les vrais ObjectId des types d'échelles
 */
export async function getRubriquesStatiquesCompletes() {
    const rubriques = await RubriqueStatique.find({ actif: true }).sort({ ordre: 1 });
    const questions = await QuestionStatique.find({ actif: true })
        .populate('typeEchelle')  // Peupler les infos du type d'échelle
        .sort({ ordre: 1 });
    
    return rubriques.map(rubrique => ({
        ...rubrique.toObject(),
        questions: questions.filter(q => q.rubriqueCode === rubrique.code)
    }));
}

/**
 * Récupère les échelles complètes pour un type d'échelle donné
 * Utile pour construire le formulaire d'évaluation
 */
export async function getEchellesByTypeId(typeEchelle) {
    if (!typeEchelle) return [];
    
    const echelles = await EchelleReponse.find({ typeEchelle: typeEchelle })
        .sort({ ordre: 1 })
        .lean();
    
    return echelles;
}

/**
 * Met à jour une rubrique statique
 */
export async function updateRubriqueStatique(code, updateData) {
    const rubrique = await RubriqueStatique.findOne({ code });
    if (!rubrique) throw new Error(`Rubrique ${code} non trouvée`);
    
    // Incrémenter la version
    updateData.version = (rubrique.version || 1) + 1;
    
    const updated = await RubriqueStatique.findOneAndUpdate(
        { code },
        updateData,
        { new: true }
    );
    
    return updated;
}

/**
 * Ajoute une question personnalisée à une rubrique
 * (pour l'admin qui veut ajouter des questions par défaut)
 */
export async function ajouterQuestionStatique(questionData) {
    // Générer un code unique
    const code = `${questionData.rubriqueCode}_${Date.now()}`;
    questionData.code = code;
    
    const question = await QuestionStatique.create(questionData);
    return question;
}

/**
 * Supprime une question statique (soft delete)
 */
export async function supprimerQuestionStatique(code) {
    const question = await QuestionStatique.findOneAndUpdate(
        { code },
        { actif: false },
        { new: true }
    );
    
    if (!question) throw new Error(`Question ${code} non trouvée`);
    return question;
}

/**
 * Met à jour les sous-questions d'une question statique
 */
export async function updateSousQuestions(code, sousQuestions) {
    const question = await QuestionStatique.findOne({ code });
    if (!question) throw new Error(`Question ${code} non trouvée`);
    
    question.sousQuestions = sousQuestions;
    await question.save();
    
    return question;
}