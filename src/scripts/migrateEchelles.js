// scripts/migrateEchelles.js
import mongoose from 'mongoose';
import EvaluationAChaud from '../models/EvaluationAChaud.js';
import EchelleReponse from '../models/EchelleDeReponse.js';


export async function migrateEchellesSnapshot() {
    console.log('🔄 Migration snapshot échelles...');

    // Charger toutes les échelles en mémoire une seule fois
    const toutesEchelles = await EchelleReponse.find({}).sort({ ordre: 1 }).lean();
    const echellesByTypeId = {};
    for (const e of toutesEchelles) {
        const tid = e.typeEchelle.toString();
        if (!echellesByTypeId[tid]) echellesByTypeId[tid] = [];
        echellesByTypeId[tid].push({ _id: e._id, nomFr: e.nomFr, nomEn: e.nomEn || '', ordre: e.ordre });
    }

    const evaluations = await EvaluationAChaud.find({});
    let nbEvalMigrees = 0;
    let nbQuestionsMigrees = 0;

    for (const ev of evaluations) {
        let modifie = false;

        for (const rubrique of ev.rubriques || []) {
            for (const question of rubrique.questions || []) {
                // Ne migrer que si echelles est vide et typeEchelle existe
                if (question.typeEchelle && (!question.echelles || question.echelles.length === 0)) {
                    const echelles = echellesByTypeId[question.typeEchelle.toString()] || [];
                    question.echelles = echelles;
                    modifie = true;
                    nbQuestionsMigrees++;
                }
            }
        }

        if (modifie) {
            await ev.save();
            nbEvalMigrees++;
            console.log(`  ✅ Évaluation migrée : ${ev.titreFr}`);
        }
    }

    console.log(`✅ Migration terminée : ${nbEvalMigrees} évaluations, ${nbQuestionsMigrees} questions`);
}