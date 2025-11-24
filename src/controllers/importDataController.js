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

// ✅ Fonction pour générer un email à partir du nom complet
function genererEmail(nomComplet, matricule = "") {
  if (!nomComplet) {
    return `user.${Date.now()}@exemple.cm`;
  }
  
  // Nettoyer les caractères spéciaux et accents
  const clean = (str) => str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  
  const nomClean = clean(nomComplet);
  const matriculeClean = matricule ? clean(matricule) : Date.now();
  
  return `${nomClean}.${matriculeClean}@exemple.cm`;
}

export const importerDonnees = async (req, res) => {
  const fichierCSV = req.file ? req.file.path : "./FICHIER_DU_PERSONNEL.csv";

  try {
    // Lecture du fichier CSV avec virgule comme séparateur
    const stream = fs.createReadStream(fichierCSV, { encoding: 'utf8' })
      .pipe(csv({ 
        separator: ";", // ✅ Changé de ";" à ","
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
      .limit(1)
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

    // Caches améliorés
    const caches = {
      regions: new Map(),
      departements: new Map(),
      communes: new Map(),
      grades: new Map(),
      categories: new Map(),
      famillesMetier: new Map(),
      postes: new Map(),
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

        // 1️⃣ Région - ✅ CORRIGÉ : colonnes uniques
        if (ligne.REGION && nettoyerTexte(ligne.REGION)) {
          const regionNom = nettoyerTexte(ligne.REGION).toUpperCase();
          const regionKey = regionNom;
          
          if (!caches.regions.has(regionKey)) {
            const regionData = {
              _id: new mongoose.Types.ObjectId(),
              code: "REG-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: regionNom,
              nomEn: regionNom, // ✅ Même valeur
            };
            caches.regions.set(regionKey, regionData._id);
            donneesAInserer.regions.push(regionData);
            regionId = regionData._id;
          } else {
            regionId = caches.regions.get(regionKey);
          }
        }

        // 2️⃣ Département - ✅ CORRIGÉ
        if (regionId && ligne.DEPARTEMENT && nettoyerTexte(ligne.DEPARTEMENT)) {
          const departementNom = nettoyerTexte(ligne.DEPARTEMENT).toUpperCase();
          const departementKey = `${departementNom}|${regionId}`;
          
          if (!caches.departements.has(departementKey)) {
            const departementData = {
              _id: new mongoose.Types.ObjectId(),
              code: "DEP-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: departementNom,
              nomEn: departementNom, // ✅ Même valeur
              region: regionId,
            };
            caches.departements.set(departementKey, departementData._id);
            donneesAInserer.departements.push(departementData);
            departementId = departementData._id;
          } else {
            departementId = caches.departements.get(departementKey);
          }
        }

        // 3️⃣ Commune - ✅ CORRIGÉ
        if (departementId && ligne.COMMUNE && nettoyerTexte(ligne.COMMUNE)) {
          const communeNom = nettoyerTexte(ligne.COMMUNE).toUpperCase();
          const communeKey = `${communeNom}|${departementId}`;
          
          if (!caches.communes.has(communeKey)) {
            const communeData = {
              _id: new mongoose.Types.ObjectId(),
              code: "COM-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: communeNom,
              nomEn: communeNom, // ✅ Même valeur
              departement: departementId,
            };
            caches.communes.set(communeKey, communeData._id);
            donneesAInserer.communes.push(communeData);
            communeId = communeData._id;
          } else {
            communeId = caches.communes.get(communeKey);
          }
        }

        // 4️⃣ Grade - ✅ CORRIGÉ
        if (ligne.GRADE && nettoyerTexte(ligne.GRADE)) {
          const gradeNom = nettoyerTexte(ligne.GRADE).toUpperCase();
          const gradeKey = gradeNom;
          
          if (!caches.grades.has(gradeKey)) {
            const gradeData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: gradeNom,
              nomEn: gradeNom, // ✅ Même valeur
            };
            caches.grades.set(gradeKey, gradeData._id);
            donneesAInserer.grades.push(gradeData);
            gradeId = gradeData._id;
          } else {
            gradeId = caches.grades.get(gradeKey);
          }
        }

        // 5️⃣ Catégorie Professionnelle
        if (gradeId && ligne.CATEGORIE_PROFESSIONNELLE && nettoyerTexte(ligne.CATEGORIE_PROFESSIONNELLE)) {
          const categoriePro = nettoyerTexte(ligne.CATEGORIE_PROFESSIONNELLE).toUpperCase();
          const categorieKey = categoriePro;

          if (!caches.categories.has(categorieKey)) {
            let existingCategorie = await CategorieProfessionnelle.findOne({ 
              nomFr: categoriePro, 
              nomEn: categoriePro
            });

            if (existingCategorie) {
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
              const categorieData = {
                _id: new mongoose.Types.ObjectId(),
                nomFr: categoriePro,
                nomEn: categoriePro, // ✅ Même valeur
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
            const cachedCategorie = caches.categories.get(categorieKey);
            
            const gradeExists = cachedCategorie.grades.some(id => 
              id.equals ? id.equals(gradeId) : id.toString() === gradeId.toString()
            );
            
            if (!gradeExists) {
              cachedCategorie.grades.push(gradeId);
              
              if (cachedCategorie.isInDB) {
                await CategorieProfessionnelle.findByIdAndUpdate(
                  cachedCategorie.id,
                  { $addToSet: { grades: gradeId } }
                );
              } else {
                cachedCategorie.data.grades.push(gradeId);
              }
            }
            
            categorieId = cachedCategorie.id;
          }
        }

        // 6️⃣ Famille Métier - ✅ CORRIGÉ
        if (ligne.FAMILLE_METIER && nettoyerTexte(ligne.FAMILLE_METIER)) {
          const familleMetierNom = nettoyerTexte(ligne.FAMILLE_METIER).toUpperCase();
          const familleMetierKey = familleMetierNom;
          
          if (!caches.famillesMetier.has(familleMetierKey)) {
            const familleMetierData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: familleMetierNom,
              nomEn: familleMetierNom, // ✅ Même valeur
            };
            caches.famillesMetier.set(familleMetierKey, familleMetierData._id);
            donneesAInserer.famillesMetier.push(familleMetierData);
            familleMetierId = familleMetierData._id;
          } else {
            familleMetierId = caches.famillesMetier.get(familleMetierKey);
          }
        }

        // 7️⃣ Poste de Travail - ✅ CORRIGÉ
        if (familleMetierId && ligne.POSTE_DE_TRAVAIL && nettoyerTexte(ligne.POSTE_DE_TRAVAIL)) {
          const posteNom = nettoyerTexte(ligne.POSTE_DE_TRAVAIL).toUpperCase();
          const posteKey = posteNom;

          if (!caches.postes.has(posteKey)) {
            let existingPoste = await PosteDeTravail.findOne({ 
              nomFr: posteNom, 
              nomEn: posteNom
            });

            if (existingPoste) {
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
              const posteData = {
                _id: new mongoose.Types.ObjectId(),
                nomFr: posteNom,
                nomEn: posteNom, // ✅ Même valeur
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
            const cachedPoste = caches.postes.get(posteKey);
            
            const familleExists = cachedPoste.famillesMetier.some(id => 
              id.equals ? id.equals(familleMetierId) : id.toString() === familleMetierId.toString()
            );
            
            if (!familleExists) {
              cachedPoste.famillesMetier.push(familleMetierId);
              
              if (cachedPoste.isInDB) {
                await PosteDeTravail.findByIdAndUpdate(
                  cachedPoste.id,
                  { $addToSet: { famillesMetier: familleMetierId } }
                );
              } else {
                cachedPoste.data.famillesMetier.push(familleMetierId);
              }
            }
            
            posteId = cachedPoste.id;
          }
        }

        // 8️⃣ Structure - ✅ CORRIGÉ
        if (ligne.STRUCTURE && nettoyerTexte(ligne.STRUCTURE)) {
          const structureNom = nettoyerTexte(ligne.STRUCTURE).toUpperCase();
          const structureKey = structureNom;
          
          if (!caches.structures.has(structureKey)) {
            const structureData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: structureNom,
              nomEn: structureNom, // ✅ Même valeur
            };
            caches.structures.set(structureKey, structureData._id);
            donneesAInserer.structures.push(structureData);
            structureId = structureData._id;
          } else {
            structureId = caches.structures.get(structureKey);
          }
        }

        // 9️⃣ Service - ✅ CORRIGÉ
        if (structureId && ligne.SERVICE && nettoyerTexte(ligne.SERVICE)) {
          const serviceNom = nettoyerTexte(ligne.SERVICE).toUpperCase();
          const serviceKey = `${serviceNom}|${structureId}`;
          
          if (!caches.services.has(serviceKey)) {
            const serviceData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: serviceNom,
              nomEn: serviceNom, // ✅ Même valeur
              structure: structureId,
            };
            caches.services.set(serviceKey, serviceData._id);
            donneesAInserer.services.push(serviceData);
            serviceId = serviceData._id;
          } else {
            serviceId = caches.services.get(serviceKey);
          }
        }

        // 🔟 Utilisateur - ✅ CORRIGÉ : nom complet + email généré
        const nomComplet = ligne.NOM ? nettoyerTexte(ligne.NOM).toUpperCase() : null;
        
        // ✅ Générer email si absent
        const email = ligne.EMAIL && nettoyerTexte(ligne.EMAIL)
          ? nettoyerTexte(ligne.EMAIL).toLowerCase()
          : genererEmail(nomComplet, ligne.MATRICULE);

        if (nomComplet && !caches.utilisateurs.has(email)) {
          const hashedPassword = await bcrypt.hash(passwordParDefaut, 10);
          
          const utilisateurData = {
            matricule: ligne.MATRICULE ? nettoyerTexte(ligne.MATRICULE) : `MAT-${Date.now()}`,
            nom: nomComplet, // ✅ Nom complet
            prenom: "", // ✅ Prénom vide
            email: email,
            motDePasse: hashedPassword,
            genre: ligne.SEXE ? nettoyerTexte(ligne.SEXE) : "AUTRE",
            dateNaissance: ligne.DATE_NAISSANCE ? convertirDateNaissance(ligne.DATE_NAISSANCE) : null,
            lieuNaissance: ligne.LIEU_NAISSANCE ? nettoyerTexte(ligne.LIEU_NAISSANCE).toUpperCase() : null,
            telephone: ligne.TEL ? nettoyerTexte(ligne.TEL) : "",
            dateEntreeEnService: ligne.DATE_E_ADM ? convertirDateNaissance(ligne.DATE_E_ADM) : null,
            role: "UTILISATEUR",
            roles:["UTILISATEUR"],
            actif: true,
          };

          // Ajouter les références si elles existent
          if (structureId) utilisateurData.structure = structureId;
          if (serviceId) utilisateurData.service = serviceId;
          if (categorieId) utilisateurData.categorieProfessionnelle = categorieId;
          if (posteId) utilisateurData.posteDeTravail = posteId;
          if (gradeId) utilisateurData.grade = gradeId;
          if (familleMetierId) utilisateurData.familleMetier = familleMetierId;
          if (communeId) utilisateurData.commune = communeId;


          donneesAInserer.utilisateurs.push(utilisateurData);
          caches.utilisateurs.add(email);
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

    // Insérer les utilisateurs en lots de 1000
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