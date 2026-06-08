// services/participantFormationService.js

/**
 * ÉTAPE 1 — Génère les ParticipantFormation depuis le publicCible du thème.
 * Déduit la structure de rattachement de chaque utilisateur.
 */
export async function genererParticipants(themeId) {
    const theme = await ThemeFormation.findById(themeId);
    const utilisateurs = await theme.resolveTargetedUsers();

    // Peupler la structure pour chaque utilisateur
    const utilisateursAvecStructure = await Utilisateur.find({
        _id: { $in: utilisateurs.map(u => u._id) }
    }).populate('structure', '_id nomFr nomEn');

    const operations = utilisateursAvecStructure.map(user => ({
        updateOne: {
            filter: { theme: themeId, participant: user._id },
            update: {
                $setOnInsert: {
                    theme: themeId,
                    participant: user._id,
                    structure: user.structure?._id || null,
                    statut: 'EN_ATTENTE',
                    ajoutManuellement: false,
                }
            },
            upsert: true
        }
    }));

    const result = await ParticipantFormation.bulkWrite(operations);
    
    return {
        total: utilisateurs.length,
        nouveaux: result.upsertedCount,
        dejaCrees: result.matchedCount,
        sansStructure: utilisateursAvecStructure.filter(u => !u.structure).length,
    };
}

/**
 * ÉTAPE 2 — Décompose automatiquement les participants en groupes par structure.
 * Appelé quand le responsable saisit la capacité par groupe.
 * Ne touche pas aux participants déjà AFFECTE.
 */
export async function decomposerEnGroupes(themeId, capaciteParGroupe) {

    // Récupérer tous les participants EN_ATTENTE avec leur structure
    const participants = await ParticipantFormation.find({
        theme: themeId,
        statut: 'EN_ATTENTE'
    });

    // Regrouper par structure (_id en string comme clé, null → '__sans_structure__')
    const parStructure = participants.reduce((acc, p) => {
        const key = p.structure?.toString() || '__sans_structure__';
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
    }, {});

    const groupesCrees = [];

    for (const [structureKey, participantsStructure] of Object.entries(parStructure)) {
        const structureId = structureKey === '__sans_structure__' ? null : structureKey;

        // Compter les groupes existants pour cette structure (pour numérotation)
        const nbGroupesExistants = await GroupeFormation.countDocuments({
            theme: themeId,
            structure: structureId
        });

        // Découper en tranches
        const tranches = [];
        for (let i = 0; i < participantsStructure.length; i += capaciteParGroupe) {
            tranches.push(participantsStructure.slice(i, i + capaciteParGroupe));
        }

        for (let i = 0; i < tranches.length; i++) {
            const groupe = await GroupeFormation.create({
                theme: themeId,
                structure: structureId,
                numeroGroupe: nbGroupesExistants + i + 1,
                // lieu, formateurs, dates → renseignés plus tard par le responsable
            });

            const ids = tranches[i].map(p => p._id);
            await ParticipantFormation.updateMany(
                { _id: { $in: ids } },
                { $set: { groupe: groupe._id, statut: 'AFFECTE' } }
            );

            groupesCrees.push({
                groupe,
                structure: structureId,
                nombreParticipants: tranches[i].length
            });
        }
    }

    return groupesCrees;
}

/**
 * ÉTAPE 3a — Déplace un participant vers un autre groupe (action manuelle).
 * Fonctionne même si les deux groupes sont de structures différentes (fusion).
 */
export async function deplacerParticipant(participantFormationId, nouveauGroupeId) {
    const participant = await ParticipantFormation.findById(participantFormationId);
    if (!participant) throw new Error('Participant introuvable');

    const ancienGroupeId = participant.groupe;

    await ParticipantFormation.findByIdAndUpdate(participantFormationId, {
        $set: { groupe: nouveauGroupeId }
    });

    // Si l'ancien groupe est maintenant vide → le supprimer automatiquement
    if (ancienGroupeId) {
        const nbRestants = await ParticipantFormation.countDocuments({ 
            groupe: ancienGroupeId 
        });
        if (nbRestants === 0) {
            await GroupeFormation.findByIdAndDelete(ancienGroupeId);
        }
    }
}

/**
 * ÉTAPE 3b — Fusionne deux groupes en un seul.
 * Tous les participants du groupeSource rejoignent le groupeCible.
 * Le groupeSource est supprimé.
 */
export async function fusionnerGroupes(groupeSourceId, groupeCibleId) {
    const [source, cible] = await Promise.all([
        GroupeFormation.findById(groupeSourceId),
        GroupeFormation.findById(groupeCibleId),
    ]);
    if (!source || !cible) throw new Error('Groupe introuvable');

    // Déplacer tous les participants
    await ParticipantFormation.updateMany(
        { groupe: groupeSourceId },
        { $set: { groupe: groupeCibleId } }
    );

    // Supprimer le groupe source
    await GroupeFormation.findByIdAndDelete(groupeSourceId);

    // Retourner le groupe cible avec son nouveau nombre de participants
    const nombreParticipants = await ParticipantFormation.countDocuments({ 
        groupe: groupeCibleId 
    });
    
    return { groupe: cible, nombreParticipants };
}

/**
 * ÉTAPE 3c — Configure un groupe (lieu, formateurs, dates).
 */
export async function configurerGroupe(groupeId, config) {
    const { lieu, formateurs, dateDebut, dateFin } = config;

    const groupe = await GroupeFormation.findByIdAndUpdate(
        groupeId,
        { 
            $set: { 
                lieu, formateurs, dateDebut, dateFin,
                // Passe en PLANIFIE si toutes les infos sont là
                statut: lieu && dateDebut && dateFin ? 'PLANIFIE' : 'BROUILLON'
            } 
        },
        { new: true }
    ).populate('structure formateurs');

    return groupe;
}

/**
 * Ajoute un participant manuellement par son ID.
 */
export async function ajouterParticipantManuellement(
    themeId, utilisateurId, ajouteParId, groupeId = null
) {
    const user = await Utilisateur.findById(utilisateurId).populate('structure');
    if (!user) throw new Error('Utilisateur introuvable');

    const existant = await ParticipantFormation.findOne({ 
        theme: themeId, participant: utilisateurId 
    });
    if (existant) throw new Error('Participant déjà inscrit à ce thème');

    const participant = await ParticipantFormation.create({
        theme: themeId,
        participant: utilisateurId,
        structure: user.structure?._id || null,
        groupe: groupeId,
        statut: groupeId ? 'AFFECTE' : 'EN_ATTENTE',
        ajoutManuellement: true,
        ajoutePar: ajouteParId,
    });

    return participant;
}

/**
 * Retourne un résumé des groupes d'un thème pour l'affichage UI.
 */
export async function getResume(themeId) {
    const groupes = await GroupeFormation.find({ theme: themeId })
        .populate('structure', 'nomFr nomEn')
        .populate('formateurs')
        .sort({ structure: 1, numeroGroupe: 1 });

    const resume = await Promise.all(groupes.map(async (g) => {
        const nombre = await ParticipantFormation.countDocuments({ groupe: g._id });
        return { groupe: g, nombreParticipants: nombre };
    }));

    const sansGroupe = await ParticipantFormation.countDocuments({ 
        theme: themeId, groupe: null 
    });

    return { groupes: resume, sansGroupe };
}