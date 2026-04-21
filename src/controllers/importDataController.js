import fs from "fs";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import xlsx from "xlsx";
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
  if (texte === null || texte === undefined || texte === "") return null;
  // Excel peut renvoyer des nombres, booléens ou dates — on force la conversion en string
  const str = String(texte).trim();
  if (!str || str === "null" || str === "undefined") return null;
  return str.replace(/\s+/g, " ");
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
    // Lecture du fichier CSV
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
    
    // Supprimer tous les utilisateurs sauf le premier
    const premiersUtilisateurs = await Utilisateur.find({})
      .sort({ _id: 1 })
      .limit(1)
      .select('_id')
      .lean();

    const idsASauvegarder = premiersUtilisateurs.map(u => u._id);
    await Utilisateur.deleteMany({ _id: { $nin: idsASauvegarder } });

    // Lire toutes les données du CSV
    const lignes = [];
    for await (const ligne of stream) {
      lignes.push(ligne);
    }

    console.log(`📊 ${lignes.length} lignes à traiter`);

    // Caches
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

    // Données à insérer
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

    // Utilisateurs non traités
    const utilisateursNonTraites = [];

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

        const erreursLigne = [];
        const avertissementsLigne = []; // ✅ NOUVEAU : Pour les erreurs non bloquantes
        const donneesLigne = {
          numeroLigne: i + 1,
          matricule: ligne.MATRICULE ? nettoyerTexte(ligne.MATRICULE) : null,
          nom: ligne.NOM ? nettoyerTexte(ligne.NOM).toUpperCase() : null,
          email: ligne.EMAIL ? nettoyerTexte(ligne.EMAIL).toLowerCase() : null
        };

        // 1️⃣ Région
        if (ligne.REGION && nettoyerTexte(ligne.REGION)) {
          const regionNom = nettoyerTexte(ligne.REGION).toUpperCase();
          const regionKey = regionNom;
          
          if (!caches.regions.has(regionKey)) {
            const regionData = {
              _id: new mongoose.Types.ObjectId(),
              code: "REG-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: regionNom,
              nomEn: regionNom,
            };
            caches.regions.set(regionKey, regionData._id);
            donneesAInserer.regions.push(regionData);
            regionId = regionData._id;
          } else {
            regionId = caches.regions.get(regionKey);
          }
        }

        // 2️⃣ Département
        if (regionId && ligne.DEPARTEMENT && nettoyerTexte(ligne.DEPARTEMENT)) {
          const departementNom = nettoyerTexte(ligne.DEPARTEMENT).toUpperCase();
          const departementKey = `${departementNom}|${regionId}`;
          
          if (!caches.departements.has(departementKey)) {
            const departementData = {
              _id: new mongoose.Types.ObjectId(),
              code: "DEP-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: departementNom,
              nomEn: departementNom,
              region: regionId,
            };
            caches.departements.set(departementKey, departementData._id);
            donneesAInserer.departements.push(departementData);
            departementId = departementData._id;
          } else {
            departementId = caches.departements.get(departementKey);
          }
        }

        // 3️⃣ Commune - ✅ MODIFIÉ : Non bloquant
        if (departementId && ligne.COMMUNE && nettoyerTexte(ligne.COMMUNE)) {
          const communeNom = nettoyerTexte(ligne.COMMUNE).toUpperCase();
          const communeKey = `${communeNom}|${departementId}`;
          
          if (!caches.communes.has(communeKey)) {
            const communeData = {
              _id: new mongoose.Types.ObjectId(),
              code: "COM-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              nomFr: communeNom,
              nomEn: communeNom,
              departement: departementId,
            };
            caches.communes.set(communeKey, communeData._id);
            donneesAInserer.communes.push(communeData);
            communeId = communeData._id;
          } else {
            communeId = caches.communes.get(communeKey);
          }
        } else if (ligne.COMMUNE) {
          // ✅ Avertissement au lieu d'erreur bloquante
          avertissementsLigne.push("Commune non enregistrée (département manquant ou invalide)");
        }

        // 4️⃣ Grade
        if (ligne.GRADE && nettoyerTexte(ligne.GRADE)) {
          const gradeNom = nettoyerTexte(ligne.GRADE).toUpperCase();
          const gradeKey = gradeNom;
          
          if (!caches.grades.has(gradeKey)) {
            const gradeData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: gradeNom,
              nomEn: gradeNom,
            };
            caches.grades.set(gradeKey, gradeData._id);
            donneesAInserer.grades.push(gradeData);
            gradeId = gradeData._id;
          } else {
            gradeId = caches.grades.get(gradeKey);
          }
        } else if (ligne.GRADE) {
          erreursLigne.push("Grade invalide ou vide");
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
        } else if (!gradeId && ligne.CATEGORIE_PROFESSIONNELLE) {
          erreursLigne.push("Catégorie professionnelle sans grade valide");
        } else if (ligne.CATEGORIE_PROFESSIONNELLE && !nettoyerTexte(ligne.CATEGORIE_PROFESSIONNELLE)) {
          erreursLigne.push("Catégorie professionnelle invalide ou vide");
        }

        // 6️⃣ Famille Métier
        if (ligne.FAMILLE_METIER && nettoyerTexte(ligne.FAMILLE_METIER)) {
          const familleMetierNom = nettoyerTexte(ligne.FAMILLE_METIER).toUpperCase();
          const familleMetierKey = familleMetierNom;
          
          if (!caches.famillesMetier.has(familleMetierKey)) {
            const familleMetierData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: familleMetierNom,
              nomEn: familleMetierNom,
            };
            caches.famillesMetier.set(familleMetierKey, familleMetierData._id);
            donneesAInserer.famillesMetier.push(familleMetierData);
            familleMetierId = familleMetierData._id;
          } else {
            familleMetierId = caches.famillesMetier.get(familleMetierKey);
          }
        } else if (ligne.FAMILLE_METIER) {
          erreursLigne.push("Famille métier invalide ou vide");
        }

        // 8️⃣ Structure
        if (ligne.STRUCTURE && nettoyerTexte(ligne.STRUCTURE)) {
          const structureNom = nettoyerTexte(ligne.STRUCTURE).toUpperCase();
          const structureKey = structureNom;
          
          if (!caches.structures.has(structureKey)) {
            const structureData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: structureNom,
              nomEn: structureNom,
            };
            caches.structures.set(structureKey, structureData._id);
            donneesAInserer.structures.push(structureData);
            structureId = structureData._id;
          } else {
            structureId = caches.structures.get(structureKey);
          }
        } else if (ligne.STRUCTURE) {
          erreursLigne.push("Structure invalide ou vide");
        }

        // 9️⃣ Service
        if (structureId && ligne.SERVICE && nettoyerTexte(ligne.SERVICE)) {
          const serviceNom = nettoyerTexte(ligne.SERVICE).toUpperCase();
          const serviceKey = `${serviceNom}|${structureId}`;
          
          if (!caches.services.has(serviceKey)) {
            const serviceData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: serviceNom,
              nomEn: serviceNom,
              structure: structureId,
            };
            caches.services.set(serviceKey, serviceData._id);
            donneesAInserer.services.push(serviceData);
            serviceId = serviceData._id;
          } else {
            serviceId = caches.services.get(serviceKey);
          }
        } else if (!structureId && ligne.SERVICE) {
          erreursLigne.push("Service sans structure valide");
        } else if (ligne.SERVICE && !nettoyerTexte(ligne.SERVICE)) {
          erreursLigne.push("Service invalide ou vide");
        }

        // 7️⃣ Poste de Travail
        // 7️⃣ Poste de Travail - 🔑 MODIFIÉ
        if (familleMetierId && ligne.POSTE_DE_TRAVAIL && nettoyerTexte(ligne.POSTE_DE_TRAVAIL)) {
          const posteNom = nettoyerTexte(ligne.POSTE_DE_TRAVAIL).toUpperCase();
          const posteKey = posteNom;

          if (!caches.postes.has(posteKey)) {
            // ... (Logique pour nouveau poste ou poste existant en BD - NON MODIFIÉE) ...
            let existingPoste = await PosteDeTravail.findOne({ 
              nomFr: posteNom, 
              nomEn: posteNom
            });

            if (existingPoste) {
              // Mise à jour atomique si le poste existe DÉJÀ en DB au début de l'import
              const updateFields = {};
              
              if (!existingPoste.famillesMetier.some(id => id.equals(familleMetierId))) {
                updateFields.famillesMetier = familleMetierId;
              }
              
              if (serviceId && !existingPoste.services.some(id => id.equals(serviceId))) {
                updateFields.services = serviceId;
              }
              
              if (Object.keys(updateFields).length > 0) {
                // Utiliser $addToSet pour ajouter des IDs uniques
                await PosteDeTravail.findByIdAndUpdate(
                  existingPoste._id,
                  { 
                    $addToSet: { 
                      famillesMetier: updateFields.famillesMetier,
                      services: updateFields.services
                    }
                  }
              );
              existingPoste.famillesMetier.push(familleMetierId); // Mettre à jour l'objet local
              if (serviceId) existingPoste.services.push(serviceId); // Mettre à jour l'objet local
            }

            // Créer le cache avec les valeurs à jour
            caches.postes.set(posteKey, {
              id: existingPoste._id,
              famillesMetier: [...existingPoste.famillesMetier],
              services: [...existingPoste.services],
              isInDB: true
            });
            posteId = existingPoste._id;
          } else {
            // ... (Logique pour créer un nouveau posteData - NON MODIFIÉE) ...
            const posteData = {
              _id: new mongoose.Types.ObjectId(),
              nomFr: posteNom,
              nomEn: posteNom,
              famillesMetier: [familleMetierId],
              services: serviceId ? [serviceId] : [],
            };

            caches.postes.set(posteKey, {
              id: posteData._id,
              famillesMetier: [familleMetierId],
              services: serviceId ? [serviceId] : [],
              isInDB: false,
              data: posteData
            });
            donneesAInserer.postes.push(posteData);
            posteId = posteData._id;
          }
          } else {
            // Le poste est déjà dans le cache (qu'il soit nouveau ou existant en DB)
            const cachedPoste = caches.postes.get(posteKey);
            
            let needsUpdate = false;
            
            const familleExists = cachedPoste.famillesMetier.some(id => 
              id.equals ? id.equals(familleMetierId) : id.toString() === familleMetierId.toString()
            );
            
            if (!familleExists) {
              cachedPoste.famillesMetier.push(familleMetierId);
              needsUpdate = true;
            }
            
            let serviceNeedsUpdate = false;
            if (serviceId) {
              const serviceExists = cachedPoste.services.some(id => 
                id.equals ? id.equals(serviceId) : id.toString() === serviceId.toString()
              );
              
              if (!serviceExists) {
                cachedPoste.services.push(serviceId);
                needsUpdate = true;
                serviceNeedsUpdate = true;
              }
            }
            
            if (needsUpdate) {
              if (cachedPoste.isInDB) {
                const updateQuery = { $addToSet: {} };
                
                if (!familleExists) {
                  updateQuery.$addToSet.famillesMetier = familleMetierId;
                }
                
                // 💡 CORRIGÉ : On vérifie si l'ajout de service est nécessaire
                if (serviceNeedsUpdate) { 
                  updateQuery.$addToSet.services = serviceId;
                }
                
                // Exécuter la mise à jour seulement si $addToSet n'est pas vide
                if (Object.keys(updateQuery.$addToSet).length > 0) {
                  await PosteDeTravail.findByIdAndUpdate(cachedPoste.id, updateQuery);
                }
              } else {
                // Mise à jour du nouveau poste en attente d'insertion
                if (!familleExists) {
                  cachedPoste.data.famillesMetier.push(familleMetierId);
                }
                if (serviceNeedsUpdate) { // Utiliser la variable de vérification
                  cachedPoste.data.services.push(serviceId);
                }
              }
            }
            
            posteId = cachedPoste.id;
          }
        } else if (!familleMetierId && ligne.POSTE_DE_TRAVAIL) {
          erreursLigne.push("Poste de travail sans famille métier valide");
        } else if (ligne.POSTE_DE_TRAVAIL && !nettoyerTexte(ligne.POSTE_DE_TRAVAIL)) {
          erreursLigne.push("Poste de travail invalide ou vide");
        }

        // 🔟 Utilisateur - ✅ GESTION EMAIL AMÉLIORÉE
        const nomComplet = ligne.NOM ? nettoyerTexte(ligne.NOM).toUpperCase() : null;
        
        if (!nomComplet) {
          erreursLigne.push("Nom manquant ou invalide");
        }

        // ✅ NOUVELLE LOGIQUE EMAIL
        let email = null;
        let emailGenere = false;
        
        // Tentative 1 : Utiliser l'email du CSV s'il est valide
        if (ligne.EMAIL && nettoyerTexte(ligne.EMAIL)) {
          const emailCandidat = nettoyerTexte(ligne.EMAIL).toLowerCase();
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidat)) {
            email = emailCandidat;
          } else {
            avertissementsLigne.push("Email invalide dans CSV, email généré automatiquement");
          }
        }
        
        // Tentative 2 : Générer l'email si nécessaire
        if (!email && nomComplet) {
          email = genererEmail(nomComplet, ligne.MATRICULE);
          emailGenere = true;
          
          // Vérifier que l'email généré est valide
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            erreursLigne.push("Impossible de générer un email valide");
            email = null;
          }
        }

        // Vérifier les doublons d'email
        if (email && caches.utilisateurs.has(email)) {
          // Si l'email est en double, essayer de générer un nouveau avec un suffixe
          const baseEmail = email.split('@')[0];
          const domaine = email.split('@')[1];
          let tentative = 1;
          let emailUnique = email;
          
          while (caches.utilisateurs.has(emailUnique) && tentative <= 10) {
            emailUnique = `${baseEmail}${tentative}@${domaine}`;
            tentative++;
          }
          
          if (caches.utilisateurs.has(emailUnique)) {
            erreursLigne.push("Email en double, impossible de générer un email unique");
            email = null;
          } else {
            email = emailUnique;
            avertissementsLigne.push(`Email modifié pour éviter doublon: ${email}`);
          }
        }

        // Si des erreurs BLOQUANTES, ajouter aux non traités
        if (erreursLigne.length > 0) {
          utilisateursNonTraites.push({
            ...donneesLigne,
            raisons: erreursLigne,
            avertissements: avertissementsLigne.length > 0 ? avertissementsLigne : undefined
          });
        } else if (nomComplet && email) {
          // ✅ Créer l'utilisateur même sans commune
          const hashedPassword = await bcrypt.hash(passwordParDefaut, 10);
          
          const utilisateurData = {
            matricule: ligne.MATRICULE ? nettoyerTexte(ligne.MATRICULE) : `MAT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            nom: nomComplet,
            prenom: "",
            email: email,
            motDePasse: hashedPassword,
            genre: ligne.SEXE ? nettoyerTexte(ligne.SEXE) : "AUTRE",
            dateNaissance: ligne.DATE_NAISSANCE ? convertirDateNaissance(ligne.DATE_NAISSANCE) : null,
            lieuNaissance: ligne.LIEU_NAISSANCE ? nettoyerTexte(ligne.LIEU_NAISSANCE).toUpperCase() : null,
            telephone: ligne.TEL ? ligne.TEL.replace(" ","") : "",
            dateEntreeEnService: ligne.DATE_E_ADM ? convertirDateNaissance(ligne.DATE_E_ADM) : null,
            role: "UTILISATEUR",
            roles: ["UTILISATEUR"],
            actif: true,
            // ✅ Ajouter les avertissements en commentaire interne si nécessaire
            _avertissements: avertissementsLigne.length > 0 ? avertissementsLigne : undefined
          };

          // Ajouter les références (commune devient optionnelle)
          if (structureId) utilisateurData.structure = structureId;
          if (serviceId) utilisateurData.service = serviceId;
          if (categorieId) utilisateurData.categorieProfessionnelle = categorieId;
          if (posteId) utilisateurData.posteDeTravail = posteId;
          if (gradeId) utilisateurData.grade = gradeId;
          if (familleMetierId) utilisateurData.familleMetier = familleMetierId;
          if (communeId) utilisateurData.commune = communeId; // ✅ Optionnel

          donneesAInserer.utilisateurs.push(utilisateurData);
          caches.utilisateurs.add(email);
        }

      } catch (err) {
        console.error(`❌ Erreur ligne ${i + 1}:`, err.message);
        utilisateursNonTraites.push({
          numeroLigne: i + 1,
          matricule: ligne.MATRICULE || null,
          nom: ligne.NOM || null,
          email: ligne.EMAIL || null,
          raisons: [`Erreur technique: ${err.message}`]
        });
      }
    }

    // Insertion en lot
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
    if (donneesAInserer.structures.length > 0) {
      insertions.push(Structure.insertMany(donneesAInserer.structures, { ordered: false }));
    }
    if (donneesAInserer.services.length > 0) {
      insertions.push(Service.insertMany(donneesAInserer.services, { ordered: false }));
    }

    await Promise.all(insertions);

    // Insérer les postes
    if (donneesAInserer.postes.length > 0) {
      await PosteDeTravail.insertMany(donneesAInserer.postes, { ordered: false });
    }

    // Insérer les utilisateurs en lots
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
    - ${donneesAInserer.utilisateurs.length} utilisateurs traités
    - ${utilisateursNonTraites.length} utilisateurs non traités`);

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
        utilisateursTraites: donneesAInserer.utilisateurs.length,
        utilisateursNonTraites: utilisateursNonTraites.length
      },
      utilisateursNonTraites: utilisateursNonTraites
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



// ─────────────────────────────────────────────────────────────────────────────
// Correspondances colonnes Excel → champs internes
//
//  N°              → (ignoré)
//  MATRICULE       → matricule
//  NOM             → nom
//  GRADE           → grade
//  CATEGORIE       → categorieProfessionnelle
//  FONCTION        → posteDeTravail
//  SERVICEH        → structure
//  SERVICE         → service
//  REGION          → region
//  DEPARTEMENT     → departement
//  COMMUNE         → commune
//  DATE_E_ADM      → dateEntreeEnService
//  DATE_NAISSANCE  → dateNaissance
//  AGE             → (ignoré, calculable)
//  LIEU_NAISSANCE  → lieuNaissance
//  SEXE            → genre
//  ETATCIVIL       → (ignoré ou à mapper selon modèle)
//  REF_ACTE_NOMI2  → (ignoré ou à mapper selon modèle)
//  TEL             → telephone
//  email           → email
// ─────────────────────────────────────────────────────────────────────────────


// ── Utilitaires ──────────────────────────────────────────────────────────────


function convertirDate(valeur) {
  if (!valeur) return null;

  // Numéro de série Excel (ex: 44927)
  if (typeof valeur === "number") {
    const date = xlsx.SSF.parse_date_code(valeur);
    if (date) return new Date(date.y, date.m - 1, date.d);
    return null;
  }

  const str = String(valeur).trim();

  // Format JJ/MM/AAAA
  const matchSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchSlash) {
    return new Date(+matchSlash[3], +matchSlash[2] - 1, +matchSlash[1]);
  }

  // Format AAAA-MM-JJ
  const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchISO) {
    return new Date(+matchISO[1], +matchISO[2] - 1, +matchISO[3]);
  }

  return null;
}


// ── Lecture du fichier Excel ──────────────────────────────────────────────────

function lireExcel(cheminFichier) {
  const workbook = xlsx.readFile(cheminFichier, {
    cellDates: false, // On gère nous-mêmes les dates via convertirDate()
    raw: false,
  });

  const nomFeuille = workbook.SheetNames[0];
  const feuille = workbook.Sheets[nomFeuille];

  // raw: false → xlsx convertit toutes les cellules en string formatée
  // Cela évite que nettoyerTexte() reçoive des nombres ou objets Date bruts
  return xlsx.utils.sheet_to_json(feuille, {
    defval: null,
    raw: false,
  });
}

// ── Helpers "trouver ou créer" (upsert en mémoire + cache) ───────────────────

async function obtenirOuCreerRegion(nom, caches, donneesAInserer) {
  const key = nom.toUpperCase();
  if (caches.regions.has(key)) return caches.regions.get(key);

  // Chercher en BD (données pré-existantes)
  let doc = await Region.findOne({ nomFr: key }).lean();
  if (!doc) {
    doc = {
      _id: new mongoose.Types.ObjectId(),
      code: `REG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nomFr: key,
      nomEn: key,
    };
    donneesAInserer.regions.push(doc);
  }

  caches.regions.set(key, doc._id);
  return doc._id;
}

async function obtenirOuCreerDepartement(nom, regionId, caches, donneesAInserer) {
  const key = `${nom.toUpperCase()}|${regionId}`;
  if (caches.departements.has(key)) return caches.departements.get(key);

  let doc = await Departement.findOne({ nomFr: nom.toUpperCase(), region: regionId }).lean();
  if (!doc) {
    doc = {
      _id: new mongoose.Types.ObjectId(),
      code: `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nomFr: nom.toUpperCase(),
      nomEn: nom.toUpperCase(),
      region: regionId,
    };
    donneesAInserer.departements.push(doc);
  }

  caches.departements.set(key, doc._id);
  return doc._id;
}

async function obtenirOuCreerCommune(nom, departementId, caches, donneesAInserer) {
  const key = `${nom.toUpperCase()}|${departementId}`;
  if (caches.communes.has(key)) return caches.communes.get(key);

  let doc = await Commune.findOne({ nomFr: nom.toUpperCase(), departement: departementId }).lean();
  if (!doc) {
    doc = {
      _id: new mongoose.Types.ObjectId(),
      code: `COM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nomFr: nom.toUpperCase(),
      nomEn: nom.toUpperCase(),
      departement: departementId,
    };
    donneesAInserer.communes.push(doc);
  }

  caches.communes.set(key, doc._id);
  return doc._id;
}

async function obtenirOuCreerGrade(nom, caches, donneesAInserer) {
  const key = nom.toUpperCase();
  if (caches.grades.has(key)) return caches.grades.get(key);

  let doc = await Grade.findOne({ nomFr: key }).lean();
  if (!doc) {
    doc = {
      _id: new mongoose.Types.ObjectId(),
      nomFr: key,
      nomEn: key,
    };
    donneesAInserer.grades.push(doc);
  }

  caches.grades.set(key, doc._id);
  return doc._id;
}

async function obtenirOuCreerCategorie(nom, gradeId, caches, donneesAInserer) {
  const key = nom.toUpperCase();

  if (caches.categories.has(key)) {
    const cached = caches.categories.get(key);
    // S'assurer que le grade est bien rattaché
    const gradeStr = gradeId.toString();
    const exists = cached.grades.some((id) => id.toString() === gradeStr);
    if (!exists) {
      cached.grades.push(gradeId);
      if (cached.isInDB) {
        await CategorieProfessionnelle.findByIdAndUpdate(cached.id, {
          $addToSet: { grades: gradeId },
        });
      } else {
        cached.data.grades.push(gradeId);
      }
    }
    return cached.id;
  }

  let doc = await CategorieProfessionnelle.findOne({ nomFr: key });
  if (doc) {
    if (!doc.grades.some((id) => id.equals(gradeId))) {
      doc.grades.push(gradeId);
      await doc.save();
    }
    caches.categories.set(key, {
      id: doc._id,
      grades: [...doc.grades],
      isInDB: true,
    });
    return doc._id;
  }

  const newDoc = {
    _id: new mongoose.Types.ObjectId(),
    nomFr: key,
    nomEn: key,
    grades: [gradeId],
  };
  donneesAInserer.categories.push(newDoc);
  caches.categories.set(key, {
    id: newDoc._id,
    grades: [gradeId],
    isInDB: false,
    data: newDoc,
  });
  return newDoc._id;
}

async function obtenirOuCreerStructure(nom, caches, donneesAInserer) {
  const key = nom.toUpperCase();
  if (caches.structures.has(key)) return caches.structures.get(key);

  let doc = await Structure.findOne({ nomFr: key }).lean();
  if (!doc) {
    doc = {
      _id: new mongoose.Types.ObjectId(),
      nomFr: key,
      nomEn: key,
    };
    donneesAInserer.structures.push(doc);
  }

  caches.structures.set(key, doc._id);
  return doc._id;
}

async function obtenirOuCreerService(nom, structureId, caches, donneesAInserer) {
  const key = `${nom.toUpperCase()}|${structureId}`;
  if (caches.services.has(key)) return caches.services.get(key);

  let doc = await Service.findOne({ nomFr: nom.toUpperCase(), structure: structureId }).lean();
  if (!doc) {
    doc = {
      _id: new mongoose.Types.ObjectId(),
      nomFr: nom.toUpperCase(),
      nomEn: nom.toUpperCase(),
      structure: structureId,
    };
    donneesAInserer.services.push(doc);
  }

  caches.services.set(key, doc._id);
  return doc._id;
}

/**
 * Pour le poste de travail : la FONCTION dans l'Excel.
 * - Si le poste EXISTE déjà en BD → on le réutilise sans toucher à ses familles métier.
 * - Si le poste est NOUVEAU → on crée automatiquement une FamilleMetier du même nom
 *   et on les lie, afin que l'utilisateur puisse réaffecter plus tard depuis l'interface.
 */
async function obtenirOuCreerPoste(nom, serviceId, caches, donneesAInserer) {
  const key = nom.toUpperCase();

  if (caches.postes.has(key)) {
    const cached = caches.postes.get(key);
    // Associer le service si pas encore fait
    if (serviceId) {
      const serviceStr = serviceId.toString();
      const exists = cached.services.some((id) => id.toString() === serviceStr);
      if (!exists) {
        cached.services.push(serviceId);
        if (cached.isInDB) {
          await PosteDeTravail.findByIdAndUpdate(cached.id, {
            $addToSet: { services: serviceId },
          });
        } else {
          cached.data.services.push(serviceId);
        }
      }
    }
    return cached.id;
  }

  // ── Poste déjà en BD → réutiliser tel quel ────────────────────────────────
  let doc = await PosteDeTravail.findOne({ nomFr: key });
  if (doc) {
    if (serviceId && !doc.services.some((id) => id.equals(serviceId))) {
      await PosteDeTravail.findByIdAndUpdate(doc._id, {
        $addToSet: { services: serviceId },
      });
      doc.services.push(serviceId);
    }
    caches.postes.set(key, {
      id: doc._id,
      famillesMetier: [...(doc.famillesMetier || [])],
      services: [...(doc.services || [])],
      isInDB: true,
    });
    return doc._id;
  }

  // ── Nouveau poste → assigner à la famille "POSTE NON AFFECTÉ" ───────────
  // Cette famille doit exister en BD avant l'import.
  // Une seule requête BD grâce au cache (valable pour tous les nouveaux postes).

  let familleNonAffecteeId = null;

  if (caches.famillesMetier.has("__NON_AFFECTE__")) {
    familleNonAffecteeId = caches.famillesMetier.get("__NON_AFFECTE__");
  } else {
    const familleDoc = await FamilleMetier.findOne({
      nomFr: { $regex: /^poste non affect/i },
    }).lean();

    if (familleDoc) {
      familleNonAffecteeId = familleDoc._id;
    }
    // On stocke même null pour ne pas refaire la requête à chaque nouveau poste
    caches.famillesMetier.set("__NON_AFFECTE__", familleNonAffecteeId);
  }

  const newDoc = {
    _id: new mongoose.Types.ObjectId(),
    nomFr: key,
    nomEn: key,
    famillesMetier: familleNonAffecteeId ? [familleNonAffecteeId] : [],
    services: serviceId ? [serviceId] : [],
  };
  donneesAInserer.postes.push(newDoc);
  caches.postes.set(key, {
    id: newDoc._id,
    famillesMetier: familleNonAffecteeId ? [familleNonAffecteeId] : [],
    services: serviceId ? [serviceId] : [],
    isInDB: false,
    data: newDoc,
  });
  return newDoc._id;
}

// ── Controller principal ──────────────────────────────────────────────────────

export const importerPersonnelExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Aucun fichier reçu. Veuillez envoyer un fichier Excel (.xlsx).",
    });
  }

  const cheminFichier = req.file.path;

  try {
    // ── 1. Lecture du fichier Excel ─────────────────────────────────────────
    let lignes;
    try {
      lignes = lireExcel(cheminFichier);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Impossible de lire le fichier Excel. Vérifiez le format.",
        error: e.message,
      });
    }

    console.log(`📊 ${lignes.length} lignes à traiter`);

    // ── 2. Caches en mémoire (évite les requêtes BD répétées) ───────────────
    const caches = {
      regions: new Map(),
      departements: new Map(),
      communes: new Map(),
      grades: new Map(),
      categories: new Map(),    // { id, grades[], isInDB, data? }
      famillesMetier: new Map(), // clé = nomFr → _id
      postes: new Map(),        // { id, famillesMetier[], services[], isInDB, data? }
      structures: new Map(),
      services: new Map(),
      emailsUtilises: new Set(), // Pour détecter les doublons dans ce fichier
    };

    // ── 3. Tampons d'insertion (entités nouvelles uniquement) ────────────────
    const donneesAInserer = {
      regions: [],
      departements: [],
      communes: [],
      grades: [],
      categories: [],
      postes: [],
      structures: [],
      services: [],
    };

    // ── 4. Résultats ────────────────────────────────────────────────────────
    const stats = {
      crees: 0,
      misAJour: 0,
      ignores: 0,
    };
    const utilisateursNonTraites = [];

    // ── 5. Traitement ligne par ligne ────────────────────────────────────────
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];

      if (i % 500 === 0 && i > 0) {
        console.log(`🔄 Traitement ligne ${i + 1}/${lignes.length}`);
      }

      const erreursBloquantes = [];
      const avertissements = [];

      // Infos de base pour le rapport d'erreur
      const infoLigne = {
        numeroLigne: i + 2, // +2 car ligne 1 = en-têtes
        matricule: nettoyerTexte(ligne.MATRICULE),
        nom: nettoyerTexte(ligne.NOM),
        email: nettoyerTexte(ligne.email),
      };

      try {
        // ── a. Validation du nom ──────────────────────────────────────────
        const nomComplet = ligne.NOM ? nettoyerTexte(ligne.NOM).toUpperCase() : null;
        if (!nomComplet) {
          erreursBloquantes.push("NOM manquant ou invalide");
        }

        const matricule = ligne.MATRICULE ? nettoyerTexte(ligne.MATRICULE) : null;

        // ── b. Email ─────────────────────────────────────────────────────
        let email = null;
        if (ligne.email && nettoyerTexte(ligne.email)) {
          const candidat = nettoyerTexte(ligne.email).toLowerCase();
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidat)) {
            email = candidat;
          } else {
            avertissements.push("Email invalide dans le fichier, génération automatique");
          }
        }

        if (!email && nomComplet) {
          email = genererEmail(nomComplet, matricule);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            erreursBloquantes.push("Impossible de générer un email valide");
            email = null;
          }
        }

        // Gestion des doublons d'email dans le fichier courant
        if (email && caches.emailsUtilises.has(email)) {
          const [base, domaine] = email.split("@");
          let emailUnique = email;
          for (let t = 1; t <= 10; t++) {
            emailUnique = `${base}${t}@${domaine}`;
            if (!caches.emailsUtilises.has(emailUnique)) break;
            if (t === 10) {
              erreursBloquantes.push("Email en double, impossible de générer un email unique");
              emailUnique = null;
            }
          }
          if (emailUnique) {
            avertissements.push(`Email modifié pour éviter un doublon : ${emailUnique}`);
            email = emailUnique;
          } else {
            email = null;
          }
        }

        // ── c. Si erreurs bloquantes, on passe ────────────────────────────
        if (erreursBloquantes.length > 0) {
          utilisateursNonTraites.push({
            ...infoLigne,
            raisons: erreursBloquantes,
            avertissements: avertissements.length > 0 ? avertissements : undefined,
          });
          stats.ignores++;
          continue;
        }

        // ── d. Entités géographiques ──────────────────────────────────────
        let regionId = null;
        let departementId = null;
        let communeId = null;

        if (nettoyerTexte(ligne.REGION)) {
          regionId = await obtenirOuCreerRegion(
            nettoyerTexte(ligne.REGION),
            caches,
            donneesAInserer
          );
        }

        if (regionId && nettoyerTexte(ligne.DEPARTEMENT)) {
          departementId = await obtenirOuCreerDepartement(
            nettoyerTexte(ligne.DEPARTEMENT),
            regionId,
            caches,
            donneesAInserer
          );
        }

        if (departementId && nettoyerTexte(ligne.COMMUNE)) {
          communeId = await obtenirOuCreerCommune(
            nettoyerTexte(ligne.COMMUNE),
            departementId,
            caches,
            donneesAInserer
          );
        } else if (ligne.COMMUNE && !departementId) {
          avertissements.push("Commune ignorée : département manquant ou invalide");
        }

        // ── e. Grade ──────────────────────────────────────────────────────
        let gradeId = null;
        if (nettoyerTexte(ligne.GRADE)) {
          gradeId = await obtenirOuCreerGrade(
            nettoyerTexte(ligne.GRADE),
            caches,
            donneesAInserer
          );
        }

        // ── f. Catégorie Professionnelle (CATEGORIE dans l'Excel) ─────────
        let categorieId = null;
        if (gradeId && nettoyerTexte(ligne.CATEGORIE)) {
          categorieId = await obtenirOuCreerCategorie(
            nettoyerTexte(ligne.CATEGORIE),
            gradeId,
            caches,
            donneesAInserer
          );
        } else if (ligne.CATEGORIE && !gradeId) {
          avertissements.push("Catégorie ignorée : grade manquant");
        }

        // ── g. Structure (SERVICEH dans l'Excel) ───────────────────────
        let structureId = null;
        if (nettoyerTexte(ligne.SERVICEH)) {
          structureId = await obtenirOuCreerStructure(
            nettoyerTexte(ligne.SERVICEH),
            caches,
            donneesAInserer
          );
        }

        // ── h. Service (SERVICE dans l'Excel) ───────────────────────────
        let serviceId = null;
        if (structureId && nettoyerTexte(ligne.SERVICE)) {
          serviceId = await obtenirOuCreerService(
            nettoyerTexte(ligne.SERVICE),
            structureId,
            caches,
            donneesAInserer
          );
        } else if (ligne.SERVICE && !structureId) {
          avertissements.push("Service ignoré : SERVICEH manquant");
        }

        // ── i. Poste de Travail (FONCTION dans l'Excel) ───────────────────
        let posteId = null;
        if (nettoyerTexte(ligne.FONCTION)) {
          posteId = await obtenirOuCreerPoste(
            nettoyerTexte(ligne.FONCTION),
            serviceId,
            caches,
            donneesAInserer
          );
        }

        // ── j. Upsert Utilisateur ──────────────────────────────────────────
        // Critère d'identification : matricule (si présent) ou email
        const filtreRecherche = matricule
          ? { matricule }
          : { email };

        const utilisateurExistant = await Utilisateur.findOne(filtreRecherche).lean();

        if (utilisateurExistant) {
          // ── MISE À JOUR : on met à jour uniquement les champs professionnels
          //    sans toucher au mot de passe, rôles, etc.
          const champsMaj = {};

          // Champs professionnels toujours mis à jour depuis le fichier
          if (gradeId) champsMaj.grade = gradeId;
          if (categorieId) champsMaj.categorieProfessionnelle = categorieId;
          if (structureId) champsMaj.structure = structureId;
          if (serviceId) champsMaj.service = serviceId;
          if (posteId) champsMaj.posteDeTravail = posteId;
          if (communeId) champsMaj.commune = communeId;

          // Champs d'identité : on met à jour seulement si la valeur est vide en BD
          if (!utilisateurExistant.telephone && nettoyerTexte(ligne.TEL)) {
            champsMaj.telephone = String(ligne.TEL).replace(/\s/g, "");
          }
          if (!utilisateurExistant.dateNaissance && ligne.DATE_NAISSANCE) {
            champsMaj.dateNaissance = convertirDate(ligne.DATE_NAISSANCE);
          }
          if (!utilisateurExistant.dateEntreeEnService && ligne.DATE_E_ADM) {
            champsMaj.dateEntreeEnService = convertirDate(ligne.DATE_E_ADM);
          }
          if (!utilisateurExistant.lieuNaissance && nettoyerTexte(ligne.LIEU_NAISSANCE)) {
            champsMaj.lieuNaissance = nettoyerTexte(ligne.LIEU_NAISSANCE).toUpperCase();
          }
          if (!utilisateurExistant.genre && nettoyerTexte(ligne.SEXE)) {
            champsMaj.genre = nettoyerTexte(ligne.SEXE).toUpperCase();
          }

          if (Object.keys(champsMaj).length > 0) {
            await Utilisateur.findByIdAndUpdate(
              utilisateurExistant._id,
              { $set: champsMaj }
            );
            stats.misAJour++;
          } else {
            stats.ignores++;
          }
        } else {
          // ── CRÉATION : nouvel utilisateur
          caches.emailsUtilises.add(email);

          const hashedPassword = await bcrypt.hash(passwordParDefaut, 10);

          const nouvelUtilisateur = {
            matricule: matricule || `MAT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            nom: nomComplet,
            prenom: "",
            email,
            motDePasse: hashedPassword,
            genre: nettoyerTexte(ligne.SEXE) ? nettoyerTexte(ligne.SEXE).toUpperCase() : "AUTRE",
            dateNaissance: convertirDate(ligne.DATE_NAISSANCE),
            lieuNaissance: nettoyerTexte(ligne.LIEU_NAISSANCE)
              ? nettoyerTexte(ligne.LIEU_NAISSANCE).toUpperCase()
              : null,
            telephone: ligne.TEL ? String(ligne.TEL).replace(/\s/g, "") : "",
            dateEntreeEnService: convertirDate(ligne.DATE_E_ADM),
            role: "UTILISATEUR",
            roles: ["UTILISATEUR"],
            actif: true,
          };

          if (structureId) nouvelUtilisateur.structure = structureId;
          if (serviceId) nouvelUtilisateur.service = serviceId;
          if (categorieId) nouvelUtilisateur.categorieProfessionnelle = categorieId;
          if (posteId) nouvelUtilisateur.posteDeTravail = posteId;
          if (gradeId) nouvelUtilisateur.grade = gradeId;
          if (communeId) nouvelUtilisateur.commune = communeId;

          await Utilisateur.create(nouvelUtilisateur);
          stats.crees++;
        }
      } catch (err) {
        console.error(`❌ Erreur ligne ${i + 2}:`, err.message);
        utilisateursNonTraites.push({
          ...infoLigne,
          raisons: [`Erreur technique: ${err.message}`],
        });
        stats.ignores++;
      }
    }

    // ── 6. Insertion en lot des nouvelles entités référentielles ─────────────
    console.log("📝 Insertion des nouvelles entités référentielles...");

    const insertions = [];
    if (donneesAInserer.regions.length > 0)
      insertions.push(Region.insertMany(donneesAInserer.regions, { ordered: false }));
    if (donneesAInserer.departements.length > 0)
      insertions.push(Departement.insertMany(donneesAInserer.departements, { ordered: false }));
    if (donneesAInserer.communes.length > 0)
      insertions.push(Commune.insertMany(donneesAInserer.communes, { ordered: false }));
    if (donneesAInserer.grades.length > 0)
      insertions.push(Grade.insertMany(donneesAInserer.grades, { ordered: false }));
    if (donneesAInserer.categories.length > 0)
      insertions.push(CategorieProfessionnelle.insertMany(donneesAInserer.categories, { ordered: false }));
    if (donneesAInserer.structures.length > 0)
      insertions.push(Structure.insertMany(donneesAInserer.structures, { ordered: false }));
    if (donneesAInserer.services.length > 0)
      insertions.push(Service.insertMany(donneesAInserer.services, { ordered: false }));

    await Promise.all(insertions);

    if (donneesAInserer.postes.length > 0)
      await PosteDeTravail.insertMany(donneesAInserer.postes, { ordered: false });

    // ── 7. Réponse ───────────────────────────────────────────────────────────
    console.log(`✅ Importation terminée :
  - Utilisateurs créés      : ${stats.crees}
  - Utilisateurs mis à jour : ${stats.misAJour}
  - Ignorés / erreurs       : ${stats.ignores}
  - Nouvelles régions       : ${donneesAInserer.regions.length}
  - Nouveaux départements   : ${donneesAInserer.departements.length}
  - Nouvelles communes      : ${donneesAInserer.communes.length}
  - Nouveaux grades         : ${donneesAInserer.grades.length}
  - Nouvelles catégories    : ${donneesAInserer.categories.length}
  - Nouvelles structures    : ${donneesAInserer.structures.length}
  - Nouveaux services       : ${donneesAInserer.services.length}
  - Nouveaux postes         : ${donneesAInserer.postes.length}`);

    return res.status(200).json({
      success: true,
      message: "Importation Excel terminée avec succès.",
      stats: {
        utilisateursCrees: stats.crees,
        utilisateursMisAJour: stats.misAJour,
        utilisateursIgnores: stats.ignores,
        nouvellesRegions: donneesAInserer.regions.length,
        nouveauxDepartements: donneesAInserer.departements.length,
        nouvellesCommunes: donneesAInserer.communes.length,
        nouveauxGrades: donneesAInserer.grades.length,
        nouvellesCategories: donneesAInserer.categories.length,
        nouvellesStructures: donneesAInserer.structures.length,
        nouveauxServices: donneesAInserer.services.length,
        nouveauxPostes: donneesAInserer.postes.length,
      },
      utilisateursNonTraites,
    });
  } catch (err) {
    console.error("❌ Erreur importation Excel :", err.message);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'importation Excel.",
      error: err.message,
    });
  }
};