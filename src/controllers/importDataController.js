import fs from "fs";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import Region from "../models/Region.js";
import Departement from "../models/Departement.js";
import Commune from "../models/Commune.js";
import Grade from "../models/Grade.js";
import CategorieProfessionnelle from "../models/CategorieProfessionnelle.js";
import FamilleMetier from "../models/FamilleMetier.js";
import PosteDeTravail from "../models/PosteDeTravail.js";
import Structure from "../models/Structure.js";
import Service from "../models/Service.js";
import Utilisateur from "../models/Utilisateur.js";
import mongoose from 'mongoose';


const passwordParDefaut = "Utilisateur@123";


function nettoyerTexte(texte) {
  if (!texte) return null;
  return texte.trim().replace(/\s+/g, " ");
}

function convertirDateNaissance(dateStr) {
  if (!dateStr) return null;
  const [jour, mois, annee] = dateStr.split("/");
  if (!jour || !mois || !annee) return null;
  return new Date(+annee, +mois - 1, +jour);
}


export const importerDonnees = async (req, res) => {
  const fichierCSV = req.file ? req.file.path : "./FICHIER_PERSONNEL_DGI_TRADUIT_CSV.csv";

  try {
    // Fonction pour nettoyer et préserver les caractères spéciaux
    const nettoyerTexte = (texte) => {
      if (!texte) return null;
      return texte.trim().replace(/\s+/g, ' ');
    };

    // Lecture du fichier CSV avec encodage UTF-8 et BOM
    const stream = fs.createReadStream(fichierCSV, { encoding: 'utf8' })
      .pipe(csv({ 
        separator: ";", 
        mapHeaders: ({ header }) => header.trim(),
        skipLinesWithError: true,
        encoding: 'utf8'
      }));
    
    // Nettoyer les collections
    await Promise.all([
      Region.deleteMany({}),
      Departement.deleteMany({}),
      Commune.deleteMany({}),
      Grade.deleteMany({}),
      CategorieProfessionnelle.deleteMany({}),
      FamilleMetier.deleteMany({}),
      PosteDeTravail.deleteMany({}),
      Structure.deleteMany({}),
      Service.deleteMany({})
    ]);
    
    // Supprimer tous les utilisateurs sauf les 4 premiers
    const premiersUtilisateurs = await Utilisateur.find({})
      .sort({ _id: 1 })
      .limit(4)
      .select('_id')
      .lean();

    const idsASauvegarder = premiersUtilisateurs.map(u => u._id);
    await Utilisateur.deleteMany({ _id: { $nin: idsASauvegarder } });

    // Lire toutes les données du CSV d'abord
    const lignes = [];
    for await (const ligne of stream) {
      lignes.push(ligne);
    }

    console.log(`📊 ${lignes.length} lignes à traiter`);

    // Caches améliorés pour éviter les requêtes répétées
    const caches = {
      regions: new Map(),
      departements: new Map(),
      communes: new Map(),
      grades: new Map(),
      categories: new Map(), // Stockera {id, grades, isInDB, data?}
      famillesMetier: new Map(),
      postes: new Map(), // Stockera {id, famillesMetier, isInDB, data?}
      structures: new Map(),
      services: new Map(),
      utilisateurs: new Set()
    };

    // Données à insérer en lot
    const donneesAInserer = {
      regions: [],
      departements: [],
      communes: [],
      grades: [],
      categories: [],
      famillesMetier: [],
      postes: [],
      structures: [],
      services: [],
      utilisateurs: []
    };

    // Traitement des lignes
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      
      if (i % 500 === 0) {
        console.log(`🔄 Traitement ligne ${i + 1}/${lignes.length}`);
      }

      try {
        let regionId = null;
        let departementId = null;
        let communeId = null;
        let gradeId = null;
        let categorieId = null;
        let familleMetierId = null;
        let posteId = null;
        let structureId = null;
        let serviceId = null;

        // 1️⃣ Région
        if (ligne.REGION_FR && nettoyerTexte(ligne.REGION_FR) && ligne.REGION_EN && nettoyerTexte(ligne.REGION_EN)) {
          const regionFr = nettoyerTexte(ligne.REGION_FR).toUpperCase();
          const regionEn = nettoyerTexte(ligne.REGION_EN).toUpperCase();
          const regionKey = `${regionFr}|${regionEn}`;
          
          if (!caches.regions.has(regionKey)) {
            const regionData = {
              _id: new mongoose.Types.ObjectId(),
              code: "REG-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: regionFr,
              nomEn: regionEn,
            };
            caches.regions.set(regionKey, regionData._id);
            donneesAInserer.regions.push(regionData);
            regionId = regionData._id;
          } else {
            regionId = caches.regions.get(regionKey);
          }
        }

        // 2️⃣ Département
        if (regionId && ligne.DEPARTEMENT_FR && nettoyerTexte(ligne.DEPARTEMENT_FR) && ligne.DEPARTEMENT_EN && nettoyerTexte(ligne.DEPARTEMENT_EN)) {
          const departementFr = nettoyerTexte(ligne.DEPARTEMENT_FR).toUpperCase();
          const departementEn = nettoyerTexte(ligne.DEPARTEMENT_EN).toUpperCase();
          const departementKey = `${departementFr}|${regionId}`;
          
          if (!caches.departements.has(departementKey)) {
            const departementData = {
              _id: new mongoose.Types.ObjectId(),
              code: "DEP-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: departementFr,
              nomEn: departementEn,
              region: regionId,
            };
            caches.departements.set(departementKey, departementData._id);
            donneesAInserer.departements.push(departementData);
            departementId = departementData._id;
          } else {
            departementId = caches.departements.get(departementKey);
          }
        }

        // 3️⃣ Commune
        if (departementId && ligne.COMMUNE_FR && nettoyerTexte(ligne.COMMUNE_FR) && ligne.COMMUNE_EN && nettoyerTexte(ligne.COMMUNE_EN)) {
          const communeFr = nettoyerTexte(ligne.COMMUNE_FR).toUpperCase();
          const communeEn = nettoyerTexte(ligne.COMMUNE_EN).toUpperCase();
          const communeKey = `${communeFr}|${departementId}`;
          
          if (!caches.communes.has(communeKey)) {
            const communeData = {
              _id: new mongoose.Types.ObjectId(),
              code: "COM-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: communeFr,
              nomEn: communeEn,
              departement: departementId,
            };
            caches.communes.set(communeKey, communeData._id);
            donneesAInserer.communes.push(communeData);
            communeId = communeData._id;
          } else {
            communeId = caches.communes.get(communeKey);
          }
        }

        // 4️⃣ Grade
        if (ligne.GRADE_FR && nettoyerTexte(ligne.GRADE_FR) && ligne.GRADE_EN && nettoyerTexte(ligne.GRADE_EN)) {
          const gradeFr = nettoyerTexte(ligne.GRADE_FR).toUpperCase();
          const gradeEn = nettoyerTexte(ligne.GRADE_EN).toUpperCase();
          const gradeKey = gradeFr;
          
          if (!caches.grades.has(gradeKey)) {
            const gradeData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: gradeFr,
              nomEn: gradeEn,
            };
            caches.grades.set(gradeKey, gradeData._id);
            donneesAInserer.grades.push(gradeData);
            gradeId = gradeData._id;
          } else {
            gradeId = caches.grades.get(gradeKey);
          }
        }

        // 5️⃣ Catégorie Professionnelle - CORRIGÉ
        if (gradeId && ligne.CATEGORIE_PROFESSIONNELLE && nettoyerTexte(ligne.CATEGORIE_PROFESSIONNELLE)) {
          const categoriePro = nettoyerTexte(ligne.CATEGORIE_PROFESSIONNELLE).toUpperCase();
          const categorieKey = categoriePro;

          if (!caches.categories.has(categorieKey)) {
            // Vérifier si la catégorie existe déjà en base
            let existingCategorie = await CategorieProfessionnelle.findOne({ 
              nomFr: categoriePro, 
              nomEn: categoriePro
            });

            if (existingCategorie) {
              // Ajout du grade si absent
              if (!existingCategorie.grades.some(id => id.equals(gradeId))) {
                existingCategorie.grades.push(gradeId);
                await existingCategorie.save();
              }

              caches.categories.set(categorieKey, {
                id: existingCategorie._id,
                grades: [...existingCategorie.grades],
                isInDB: true
              });
              categorieId = existingCategorie._id;
            } else {
              // Nouvelle catégorie
              const categorieData = {
                _id: new mongoose.Types.ObjectId(),
                nomFr: categoriePro,
                nomEn: categoriePro,
                grades: [gradeId],
              };
              caches.categories.set(categorieKey, {
                id: categorieData._id,
                grades: [gradeId],
                isInDB: false,
                data: categorieData
              });
              donneesAInserer.categories.push(categorieData);
              categorieId = categorieData._id;
            }
          } else {
            // La catégorie existe dans le cache
            const cachedCategorie = caches.categories.get(categorieKey);
            
            // Vérifier si le grade doit être ajouté
            const gradeExists = cachedCategorie.grades.some(id => 
              id.equals ? id.equals(gradeId) : id.toString() === gradeId.toString()
            );
            
            if (!gradeExists) {
              cachedCategorie.grades.push(gradeId);
              
              if (cachedCategorie.isInDB) {
                // Mettre à jour en base
                await CategorieProfessionnelle.findByIdAndUpdate(
                  cachedCategorie.id,
                  { $addToSet: { grades: gradeId } }
                );
              } else {
                // Mettre à jour les données en attente d'insertion
                cachedCategorie.data.grades.push(gradeId);
              }
            }
            
            categorieId = cachedCategorie.id;
          }
        }

        // 6️⃣ Famille Métier
        if (ligne.FAMILLE_METIER_FR && nettoyerTexte(ligne.FAMILLE_METIER_FR) && ligne.FAMILLE_METIER_EN && nettoyerTexte(ligne.FAMILLE_METIER_EN)) {
          const familleMetierFr = nettoyerTexte(ligne.FAMILLE_METIER_FR).toUpperCase();
          const familleMetierEn = nettoyerTexte(ligne.FAMILLE_METIER_EN).toUpperCase();
          const familleMetierKey = familleMetierFr;
          
          if (!caches.famillesMetier.has(familleMetierKey)) {
            const familleMetierData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: familleMetierFr,
              nomEn: familleMetierEn,
            };
            caches.famillesMetier.set(familleMetierKey, familleMetierData._id);
            donneesAInserer.famillesMetier.push(familleMetierData);
            familleMetierId = familleMetierData._id;
          } else {
            familleMetierId = caches.famillesMetier.get(familleMetierKey);
          }
        }

        // 7️⃣ Poste de Travail - CORRIGÉ
        if (familleMetierId && ligne.POSTE_DE_TRAVAIL_FR && nettoyerTexte(ligne.POSTE_DE_TRAVAIL_FR) && ligne.POSTE_DE_TRAVAIL_EN && nettoyerTexte(ligne.POSTE_DE_TRAVAIL_EN)) {
          const posteFr = nettoyerTexte(ligne.POSTE_DE_TRAVAIL_FR).toUpperCase();
          const posteEn = nettoyerTexte(ligne.POSTE_DE_TRAVAIL_EN).toUpperCase();
          const posteKey = posteFr;

          if (!caches.postes.has(posteKey)) {
            // Vérifier si le poste existe déjà en base
            let existingPoste = await PosteDeTravail.findOne({ 
              nomFr: posteFr, 
              nomEn: posteEn
            });

            if (existingPoste) {
              // Ajout familleMetier si elle n'existe pas déjà
              if (!existingPoste.famillesMetier.some(id => id.equals(familleMetierId))) {
                existingPoste.famillesMetier.push(familleMetierId);
                await existingPoste.save();
              }

              caches.postes.set(posteKey, {
                id: existingPoste._id,
                famillesMetier: [...existingPoste.famillesMetier],
                isInDB: true
              });
              posteId = existingPoste._id;
            } else {
              // Nouveau poste
              const posteData = {
                _id: new mongoose.Types.ObjectId(),
                nomFr: posteFr,
                nomEn: posteEn,
                famillesMetier: [familleMetierId],
              };
              caches.postes.set(posteKey, {
                id: posteData._id,
                famillesMetier: [familleMetierId],
                isInDB: false,
                data: posteData
              });
              donneesAInserer.postes.push(posteData);
              posteId = posteData._id;
            }
          } else {
            // Le poste existe dans le cache
            const cachedPoste = caches.postes.get(posteKey);
            
            // Vérifier si la famille métier doit être ajoutée
            const familleExists = cachedPoste.famillesMetier.some(id => 
              id.equals ? id.equals(familleMetierId) : id.toString() === familleMetierId.toString()
            );
            
            if (!familleExists) {
              cachedPoste.famillesMetier.push(familleMetierId);
              
              if (cachedPoste.isInDB) {
                // Mettre à jour en base
                await PosteDeTravail.findByIdAndUpdate(
                  cachedPoste.id,
                  { $addToSet: { famillesMetier: familleMetierId } }
                );
              } else {
                // Mettre à jour les données en attente d'insertion
                cachedPoste.data.famillesMetier.push(familleMetierId);
              }
            }
            
            posteId = cachedPoste.id;
          }
        }

        // 8️⃣ Structure
        if (ligne.STRUCTURE_FR && nettoyerTexte(ligne.STRUCTURE_FR) && ligne.STRUCTURE_EN && nettoyerTexte(ligne.STRUCTURE_EN)) {
          const structureFr = nettoyerTexte(ligne.STRUCTURE_FR).toUpperCase();
          const structureEn = nettoyerTexte(ligne.STRUCTURE_EN).toUpperCase();
          const structureKey = structureFr;
          
          if (!caches.structures.has(structureKey)) {
            const structureData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: structureFr,
              nomEn: structureEn,
            };
            caches.structures.set(structureKey, structureData._id);
            donneesAInserer.structures.push(structureData);
            structureId = structureData._id;
          } else {
            structureId = caches.structures.get(structureKey);
          }
        }

        // 9️⃣ Service
        if (structureId && ligne.SERVICE_FR && nettoyerTexte(ligne.SERVICE_FR) && ligne.SERVICE_EN && nettoyerTexte(ligne.SERVICE_EN)) {
          const serviceFr = nettoyerTexte(ligne.SERVICE_FR).toUpperCase();
          const serviceEn = nettoyerTexte(ligne.SERVICE_EN).toUpperCase();
          const serviceKey = `${serviceFr}|${structureId}`;
          
          if (!caches.services.has(serviceKey)) {
            const serviceData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: serviceFr,
              nomEn: serviceEn,
              structure: structureId,
            };
            caches.services.set(serviceKey, serviceData._id);
            donneesAInserer.services.push(serviceData);
            serviceId = serviceData._id;
          } else {
            serviceId = caches.services.get(serviceKey);
          }
        }

        // 🔟 Utilisateur
        if (ligne.EMAIL && nettoyerTexte(ligne.EMAIL) && !caches.utilisateurs.has(ligne.EMAIL.toLowerCase())) {
          const hashedPassword = await bcrypt.hash(passwordParDefaut, 10);
          
          const utilisateurData = {
            matricule: ligne.MATRICULE ? nettoyerTexte(ligne.MATRICULE) : null,
            nom: ligne.NOM ? nettoyerTexte(ligne.NOM).toUpperCase() : null,
            prenom: ligne.PRENOM ? nettoyerTexte(ligne.PRENOM).toUpperCase() : null,
            email: nettoyerTexte(ligne.EMAIL).toLowerCase(),
            motDePasse: hashedPassword,
            genre: ligne.SEXE ? nettoyerTexte(ligne.SEXE) : null,
            dateNaissance: ligne.DATE_NAISSANCE ? convertirDateNaissance(ligne.DATE_NAISSANCE) : null,
            lieuNaissance: ligne.LIEU_NAISSANCE ? nettoyerTexte(ligne.LIEU_NAISSANCE).toUpperCase() : null,
            telephone: ligne.TEL ? nettoyerTexte(ligne.TEL) : null,
            dateEntreeEnService: ligne.DATE_E_ADM ? convertirDateNaissance(ligne.DATE_E_ADM) : null,
            role: "UTILISATEUR",
            actif: true,
          };

          // Ajouter les références si elles existent
          if (serviceId) utilisateurData.service = serviceId;
          if (categorieId) utilisateurData.categorieProfessionnelle = categorieId;
          if (posteId) utilisateurData.posteDeTravail = posteId;
          if (gradeId) utilisateurData.grade = gradeId;
          if (familleMetierId) utilisateurData.familleMetier = familleMetierId;
          if (communeId) utilisateurData.commune = communeId

          donneesAInserer.utilisateurs.push(utilisateurData);
          caches.utilisateurs.add(ligne.EMAIL.toLowerCase());
        }

      } catch (err) {
        console.error(`❌ Erreur ligne ${i + 1}:`, err.message);
      }
    }

    // Insertion en lot pour optimiser les performances
    console.log('📝 Insertion des données...');
    
    const insertions = [];
    
    if (donneesAInserer.regions.length > 0) {
      insertions.push(Region.insertMany(donneesAInserer.regions, { ordered: false }));
    }
    if (donneesAInserer.departements.length > 0) {
      insertions.push(Departement.insertMany(donneesAInserer.departements, { ordered: false }));
    }
    if (donneesAInserer.communes.length > 0) {
      insertions.push(Commune.insertMany(donneesAInserer.communes, { ordered: false }));
    }
    if (donneesAInserer.grades.length > 0) {
      insertions.push(Grade.insertMany(donneesAInserer.grades, { ordered: false }));
    }
    if (donneesAInserer.categories.length > 0) {
      insertions.push(CategorieProfessionnelle.insertMany(donneesAInserer.categories, { ordered: false }));
    }
    if (donneesAInserer.famillesMetier.length > 0) {
      insertions.push(FamilleMetier.insertMany(donneesAInserer.famillesMetier, { ordered: false }));
    }
    if (donneesAInserer.postes.length > 0) {
      insertions.push(PosteDeTravail.insertMany(donneesAInserer.postes, { ordered: false }));
    }
    if (donneesAInserer.structures.length > 0) {
      insertions.push(Structure.insertMany(donneesAInserer.structures, { ordered: false }));
    }
    if (donneesAInserer.services.length > 0) {
      insertions.push(Service.insertMany(donneesAInserer.services, { ordered: false }));
    }

    // Attendre que toutes les entités de référence soient insérées
    await Promise.all(insertions);

    // Insérer les utilisateurs en lots de 1000 pour éviter les timeouts
    if (donneesAInserer.utilisateurs.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < donneesAInserer.utilisateurs.length; i += batchSize) {
        const batch = donneesAInserer.utilisateurs.slice(i, i + batchSize);
        await Utilisateur.insertMany(batch, { ordered: false });
        console.log(`✅ Lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(donneesAInserer.utilisateurs.length/batchSize)} d'utilisateurs inséré`);
      }
    }

    console.log(`✅ Importation terminée:
    - ${donneesAInserer.regions.length} régions
    - ${donneesAInserer.departements.length} départements  
    - ${donneesAInserer.communes.length} communes
    - ${donneesAInserer.grades.length} grades
    - ${donneesAInserer.categories.length} catégories
    - ${donneesAInserer.famillesMetier.length} familles métier
    - ${donneesAInserer.postes.length} postes
    - ${donneesAInserer.structures.length} structures
    - ${donneesAInserer.services.length} services
    - ${donneesAInserer.utilisateurs.length} utilisateurs`);

    return res.status(200).json({
      success: true,
      message: "✅ Importation terminée avec succès.",
      stats: {
        regions: donneesAInserer.regions.length,
        departements: donneesAInserer.departements.length,
        communes: donneesAInserer.communes.length,
        grades: donneesAInserer.grades.length,
        categories: donneesAInserer.categories.length,
        famillesMetier: donneesAInserer.famillesMetier.length,
        postes: donneesAInserer.postes.length,
        structures: donneesAInserer.structures.length,
        services: donneesAInserer.services.length,
        utilisateurs: donneesAInserer.utilisateurs.length
      }
    });
  } catch (err) {
    console.error("❌ Erreur importation :", err.message);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'importation.",
      error: err.message,
    });
  }
};


