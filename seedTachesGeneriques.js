// import mongoose from 'mongoose';

// import dotenv from 'dotenv';
// import TacheGenerique from './src/models/TacheGenerique.js';

// dotenv.config();
// // Configuration de la base de données
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:8085/votre_db';

// // Liste des tâches génériques à pré-enregistrer
// const tachesGeneriques = [
//   {
//     code: 'def_objectifs',
//     nomFr: 'Définition des objectifs',
//     nomEn: 'Objectives Definition',
//     descriptionFr: 'Définir et enregistrer les objectifs pédagogiques de la formation',
//     descriptionEn: 'Define and record the pedagogical objectives of the training',
//     type: 'form',
//     obligatoire: true
//   },
//   {
//     code: 'ident_participants',
//     nomFr: 'Identification des participants',
//     nomEn: 'Participants Identification',
//     descriptionFr: 'Sélectionner les participants parmi les employés concernés selon les postes de travail du public cible',
//     descriptionEn: 'Select participants from concerned employees according to target audience job positions',
//     type: 'form',
//     obligatoire: true
//   },
//   {
//     code: 'ident_formateurs',
//     nomFr: 'Identification des formateurs',
//     nomEn: 'Trainers Identification',
//     descriptionFr: 'Enregistrer et sélectionner les équipes pédagogiques dans l\'application',
//     descriptionEn: 'Register and select pedagogical teams in the application',
//     type: 'form',
//     obligatoire: true
//   },
//   {
//     code: 'choix_lieu_periode',
//     nomFr: 'Choix du lieu et de la période',
//     nomEn: 'Venue and Period Selection',
//     descriptionFr: 'Choisir le(s) lieu(x) de formation, la période et les jours concernés',
//     descriptionEn: 'Choose training venue(s), period and concerned days',
//     type: 'form',
//     obligatoire: true
//   },
//   {
//     code: 'elaboration_budget',
//     nomFr: 'Élaboration du budget',
//     nomEn: 'Budget Development',
//     descriptionFr: 'Élaborer et enregistrer le budget prévisionnel de la formation',
//     descriptionEn: 'Develop and record the training budget forecast',
//     type: 'form',
//     obligatoire: true
//   },
//   {
//     code: 'elaboration_tdr',
//     nomFr: 'Élaboration des termes de référence',
//     nomEn: 'Terms of Reference Development',
//     descriptionFr: 'Élaborer les termes de référence de la formation',
//     descriptionEn: 'Develop the training terms of reference',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'note_service_convocation',
//     nomFr: 'Élaboration de la note de service convoquant les participants',
//     nomEn: 'Service Note for Participants Convocation',
//     descriptionFr: 'Génération automatique de la note de service pour convoquer les participants',
//     descriptionEn: 'Automatic generation of service note to convene participants',
//     type: 'autoGenerate',
//     obligatoire: true
//   },
//   {
//     code: 'note_presentation',
//     nomFr: 'Élaboration de la note de présentation',
//     nomEn: 'Presentation Note Development',
//     descriptionFr: 'Génération automatique de la note de présentation de la formation',
//     descriptionEn: 'Automatic generation of training presentation note',
//     type: 'autoGenerate',
//     obligatoire: true
//   },
//   {
//     code: 'validation_dg',
//     nomFr: 'Validation par le Directeur Général',
//     nomEn: 'General Director Validation',
//     descriptionFr: 'Upload de la note de service signée et scannée par le DG pour validation',
//     descriptionEn: 'Upload of service note signed and scanned by General Director for validation',
//     type: 'upload',
//     obligatoire: true
//   },
//   {
//     code: 'reunion_prep_beneficiaires',
//     nomFr: 'Réunion préparatoire avec les services bénéficiaires',
//     nomEn: 'Preparatory Meeting with Beneficiary Services',
//     descriptionFr: 'Organiser et valider la tenue de la réunion préparatoire avec les services bénéficiaires',
//     descriptionEn: 'Organize and validate the preparatory meeting with beneficiary services',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'reunion_prep_formateurs',
//     nomFr: 'Réunion préparatoire avec les formateurs',
//     nomEn: 'Preparatory Meeting with Trainers',
//     descriptionFr: 'Organiser et valider la tenue de la réunion préparatoire avec les formateurs',
//     descriptionEn: 'Organize and validate the preparatory meeting with trainers',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'communication_participants',
//     nomFr: 'Communication aux participants',
//     nomEn: 'Communication to Participants',
//     descriptionFr: 'Envoi automatique d\'emails de communication aux participants',
//     descriptionEn: 'Automatic sending of communication emails to participants',
//     type: 'email',
//     obligatoire: true
//   },
//   {
//     code: 'communication_formateurs',
//     nomFr: 'Communication aux formateurs',
//     nomEn: 'Communication to Trainers',
//     descriptionFr: 'Envoi automatique d\'emails de communication aux formateurs',
//     descriptionEn: 'Automatic sending of communication emails to trainers',
//     type: 'email',
//     obligatoire: true
//   },
//   {
//     code: 'confection_fiches_eval_chaud',
//     nomFr: 'Confection des fiches d\'évaluation à chaud',
//     nomEn: 'Hot Evaluation Forms Creation',
//     descriptionFr: 'Créer les fiches d\'évaluation à chaud dans l\'application',
//     descriptionEn: 'Create hot evaluation forms in the application',
//     type: 'form',
//     obligatoire: true
//   },
//   {
//     code: 'confection_fiches_presence_formateur',
//     nomFr: 'Confection des fiches de présence formateur',
//     nomEn: 'Trainer Attendance Sheets Creation',
//     descriptionFr: 'Génération automatique des fiches de présence pour les formateurs',
//     descriptionEn: 'Automatic generation of attendance sheets for trainers',
//     type: 'autoGenerate',
//     obligatoire: true
//   },
//   {
//     code: 'confection_fiches_presence_participant',
//     nomFr: 'Confection des fiches de présence participant',
//     nomEn: 'Participant Attendance Sheets Creation',
//     descriptionFr: 'Génération automatique des fiches de présence pour les participants',
//     descriptionEn: 'Automatic generation of attendance sheets for participants',
//     type: 'autoGenerate',
//     obligatoire: true
//   },
//   {
//     code: 'confection_supports',
//     nomFr: 'Confection des supports de formation',
//     nomEn: 'Training Materials Creation',
//     descriptionFr: 'Préparer et valider les supports pédagogiques de la formation',
//     descriptionEn: 'Prepare and validate training pedagogical materials',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'confection_kits_formateur',
//     nomFr: 'Confection des kits du formateur',
//     nomEn: 'Trainer Kits Creation',
//     descriptionFr: 'Préparer et valider les kits destinés aux formateurs',
//     descriptionEn: 'Prepare and validate kits for trainers',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'verification_salles',
//     nomFr: 'Vérification de la disponibilité des salles',
//     nomEn: 'Training Rooms Availability Check',
//     descriptionFr: 'Vérifier et confirmer la disponibilité des salles de formation',
//     descriptionEn: 'Check and confirm training rooms availability',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'mise_disposition_frais',
//     nomFr: 'Mise à disposition des frais de mission',
//     nomEn: 'Mission Expenses Provision',
//     descriptionFr: 'Valider la mise à disposition des frais de mission pour la formation',
//     descriptionEn: 'Validate the provision of mission expenses for training',
//     type: 'checkbox',
//     obligatoire: true
//   },
//   {
//     code: 'deroulement_formation',
//     nomFr: 'Déroulement effectif de la formation',
//     nomEn: 'Actual Training Conduct',
//     descriptionFr: 'Valider le déroulement effectif de chaque journée de formation',
//     descriptionEn: 'Validate the actual conduct of each training day',
//     type: 'table-form',
//     obligatoire: true
//   },
//   {
//     code: 'signature_presence_formateur',
//     nomFr: 'Signature des fiches de présence formateur',
//     nomEn: 'Trainer Attendance Sheets Signature',
//     descriptionFr: 'Valider la signature des fiches de présence formateur par jour de formation',
//     descriptionEn: 'Validate trainer attendance sheets signature per training day',
//     type: 'table-form',
//     obligatoire: true
//   },
//   {
//     code: 'signature_presence_participant',
//     nomFr: 'Signature des fiches de présence participant',
//     nomEn: 'Participant Attendance Sheets Signature',
//     descriptionFr: 'Valider la signature des fiches de présence participant par jour de formation',
//     descriptionEn: 'Validate participant attendance sheets signature per training day',
//     type: 'table-form',
//     obligatoire: true
//   },
//   {
//     code: 'remplissage_eval_chaud',
//     nomFr: 'Remplissage des fiches d\'évaluation à chaud',
//     nomEn: 'Hot Evaluation Forms Completion',
//     descriptionFr: 'Valider le remplissage des fiches d\'évaluation à chaud (en ligne ou manuel)',
//     descriptionEn: 'Validate hot evaluation forms completion (online or manual)',
//     type: 'evaluation',
//     obligatoire: true
//   },
//   {
//     code: 'evaluation_connaissances',
//     nomFr: 'Évaluation des connaissances par le formateur',
//     nomEn: 'Knowledge Assessment by Trainer',
//     descriptionFr: 'Enregistrement des moyennes obtenues par chaque participant (optionnel)',
//     descriptionEn: 'Recording of averages obtained by each participant (optional)',
//     type: 'form',
//     obligatoire: false
//   },
//   {
//     code: 'evaluation_froid',
//     nomFr: 'Réalisation de l\'évaluation à froid',
//     nomEn: 'Cold Evaluation Implementation',
//     descriptionFr: 'Valider la réalisation de l\'évaluation à froid (en ligne ou manuel)',
//     descriptionEn: 'Validate cold evaluation implementation (online or manual)',
//     type: 'evaluation',
//     obligatoire: true
//   }
// ];

// /**
//  * Fonction pour connecter à la base de données
//  */
// const connectDB = async () => {
//   try {
//     await mongoose.connect(MONGODB_URI);
//     console.log('✅ Connexion à MongoDB réussie');
//   } catch (error) {
//     console.error('❌ Erreur de connexion à MongoDB:', error);
//     process.exit(1);
//   }
// };

// /**
//  * Fonction pour insérer ou mettre à jour les tâches génériques
//  */
// const seedTachesGeneriques = async () => {
//   try {
//     console.log('🚀 Début du pré-enregistrement des tâches génériques...\n');
    
//     let countCreated = 0;
//     let countUpdated = 0;
//     let countSkipped = 0;
    
//     for (const tacheData of tachesGeneriques) {
//       try {
//         // Vérifier si la tâche existe déjà (par code)
//         const existingTache = await TacheGenerique.findOne({ code: tacheData.code });
        
//         if (existingTache) {
//           // Mettre à jour si des champs ont changé
//           const fieldsToUpdate = ['nomFr', 'nomEn', 'descriptionFr', 'descriptionEn', 'type', 'obligatoire'];
//           let hasChanges = false;
          
//           fieldsToUpdate.forEach(field => {
//             if (existingTache[field] !== tacheData[field]) {
//               existingTache[field] = tacheData[field];
//               hasChanges = true;
//             }
//           });
          
//           if (hasChanges) {
//             await existingTache.save();
//             console.log(`🔄 Tâche mise à jour: ${tacheData.nomFr}`);
//             countUpdated++;
//           } else {
//             console.log(`⏭️  Tâche déjà à jour: ${tacheData.nomFr}`);
//             countSkipped++;
//           }
//         } else {
//           // Créer une nouvelle tâche
//           await TacheGenerique.create({
//             ...tacheData,
//             actif: true
//           });
//           console.log(`✅ Tâche créée: ${tacheData.nomFr}`);
//           countCreated++;
//         }
//       } catch (error) {
//         console.error(`❌ Erreur pour la tâche "${tacheData.nomFr}":`, error.message);
//       }
//     }
    
//     console.log('\n📊 Résumé du pré-enregistrement:');
//     console.log(`   • Tâches créées: ${countCreated}`);
//     console.log(`   • Tâches mises à jour: ${countUpdated}`);
//     console.log(`   • Tâches ignorées (déjà à jour): ${countSkipped}`);
//     console.log(`   • Total traité: ${countCreated + countUpdated + countSkipped}`);
    
//     console.log('\n🎉 Pré-enregistrement terminé avec succès !');
    
//   } catch (error) {
//     console.error('❌ Erreur lors du pré-enregistrement:', error);
//     throw error;
//   }
// };

// /**
//  * Fonction pour vérifier les tâches créées
//  */
// const verifyTaches = async () => {
//   try {
//     console.log('\n🔍 Vérification des tâches en base...');
    
//     const totalTaches = await TacheGenerique.countDocuments();
//     const tachesActives = await TacheGenerique.countDocuments({ actif: true });
    
//     console.log(`📈 Statistiques:`);
//     console.log(`   • Total des tâches: ${totalTaches}`);
//     console.log(`   • Tâches actives: ${tachesActives}`);
    
//     // Grouper par type
//     const tachesParType = await TacheGenerique.aggregate([
//       { $group: { _id: '$type', count: { $sum: 1 } } },
//       { $sort: { _id: 1 } }
//     ]);
    
//     console.log(`\n📋 Répartition par type:`);
//     tachesParType.forEach(item => {
//       console.log(`   • ${item._id}: ${item.count} tâche(s)`);
//     });
    
//   } catch (error) {
//     console.error('❌ Erreur lors de la vérification:', error);
//   }
// };

// /**
//  * Fonction principale
//  */
// const main = async () => {
//   try {
//     await connectDB();
//     await seedTachesGeneriques();
//     await verifyTaches();
//   } catch (error) {
//     console.error('❌ Erreur dans le processus principal:', error);
//   } finally {
//     await mongoose.disconnect();
//     console.log('\n🔌 Déconnexion de MongoDB');
//     process.exit(0);
//   }
// };

// // Gestion des arguments de ligne de commande
// const args = process.argv.slice(2);
// if (args.includes('--help') || args.includes('-h')) {
//   console.log(`
// 🚀 Script de pré-enregistrement des tâches génériques

// Usage: node seedTachesGeneriques.js [OPTIONS]

// Options:
//   --help, -h     Afficher cette aide
//   --verify-only  Seulement vérifier les tâches existantes
//   --force        Forcer la mise à jour de toutes les tâches

// Variables d'environnement:
//   MONGODB_URI    URI de connexion MongoDB (défaut: mongodb://localhost:27017/votre_db)

// Exemple:
//   node seedTachesGeneriques.js
//   MONGODB_URI="mongodb://localhost:27017/ma_db" node seedTachesGeneriques.js
//   `);
//   process.exit(0);
// }

// if (args.includes('--verify-only')) {
//   // Mode vérification seulement
//   connectDB().then(verifyTaches).then(() => {
//     mongoose.disconnect();
//     process.exit(0);
//   });
// } else {
//   // Exécution normale
//   main();
// }

// export default { seedTachesGeneriques, connectDB, verifyTaches };