import mongoose from "mongoose";
import fs from "fs";
import csv from "csv-parser";
import bcrypt from "bcrypt";

// Import des modèles
import Region from "./src/models/Region.js";
import Departement from "./src/models/Departement.js";
import Commune from "./src/models/Commune.js";
import Grade from "./src/models/Grade.js";
import CategorieProfessionnelle from "./src/models/CategorieProfessionnelle.js";
import FamilleMetier from "./src/models/FamilleMetier.js";
import PosteDeTravail from "./src/models/PosteDeTravail.js";
import Structure from "./src/models/Structure.js";
import Service from "./src/models/Service.js";
import Utilisateur from "./src/models/Utilisateur.js";

// Connexion MongoDB
mongoose.connect("mongodb://localhost:8085", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connecté à MongoDB"))
  .catch((err) => console.error("❌ Erreur MongoDB :", err));

const passwordParDefaut = "Utilisateur@123";

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

async function importerDonnees() {
  const results = [];

  fs.createReadStream("FICHIER_DU_PERSONNEL.csv")
    .pipe(csv({ separator: ",", mapHeaders: ({ header }) => header.trim() })) // ✅ Virgule comme séparateur
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      console.log(`📦 ${results.length} lignes à traiter...`);

      for (const ligne of results) {
        try {
          // Tout mettre en MAJUSCULE
          const upper = (str) => str ? str.trim().toUpperCase() : "";

          // 1️⃣ Région
          let region = await Region.findOne({ nomFr: upper(ligne.REGION) });
          if (!region) {
            region = await Region.create({
              code: "REG-" + Date.now(),
              nomFr: upper(ligne.REGION),
              nomEn: upper(ligne.REGION) // ✅ Même valeur pour FR et EN
            });
            console.log(`➕ Région : ${region.nomFr}`);
          }

          // 2️⃣ Département
          let departement = await Departement.findOne({ 
            nomFr: upper(ligne.DEPARTEMENT), 
            region: region._id 
          });
          if (!departement) {
            departement = await Departement.create({
              code: "DEP-" + Date.now(),
              nomFr: upper(ligne.DEPARTEMENT),
              nomEn: upper(ligne.DEPARTEMENT), // ✅ Même valeur
              region: region._id
            });
            console.log(`➕ Département : ${departement.nomFr}`);
          }

          // 3️⃣ Commune
          let commune = await Commune.findOne({ 
            nomFr: upper(ligne.COMMUNE), 
            departement: departement._id 
          });
          if (!commune) {
            commune = await Commune.create({
              code: "COM-" + Date.now(),
              nomFr: upper(ligne.COMMUNE),
              nomEn: upper(ligne.COMMUNE), // ✅ Même valeur
              departement: departement._id
            });
            console.log(`➕ Commune : ${commune.nomFr}`);
          }

          // 4️⃣ Grade
          let grade = await Grade.findOne({ nomFr: upper(ligne.GRADE) });
          if (!grade) {
            grade = await Grade.create({
              nomFr: upper(ligne.GRADE),
              nomEn: upper(ligne.GRADE) // ✅ Même valeur
            });
            console.log(`➕ Grade : ${grade.nomFr}`);
          }

          // 5️⃣ Catégorie Professionnelle
          let categorie = await CategorieProfessionnelle.findOne({ 
            nomFr: upper(ligne.CATEGORIE_PROFESSIONNELLE), 
            grade: grade._id 
          });
          if (!categorie) {
            categorie = await CategorieProfessionnelle.create({
              nomFr: upper(ligne.CATEGORIE_PROFESSIONNELLE),
              nomEn: upper(ligne.CATEGORIE_PROFESSIONNELLE), // ✅ Même valeur
              grade: grade._id
            });
            console.log(`➕ Catégorie : ${categorie.nomFr}`);
          }

          // 6️⃣ Famille Metier
          let familleMetier = await FamilleMetier.findOne({ 
            nomFr: upper(ligne.FAMILLE_METIER) 
          });
          if (!familleMetier) {
            familleMetier = await FamilleMetier.create({
              nomFr: upper(ligne.FAMILLE_METIER),
              nomEn: upper(ligne.FAMILLE_METIER) // ✅ Même valeur
            });
            console.log(`➕ Famille Metier : ${familleMetier.nomFr}`);
          }

          // 7️⃣ Poste De Travail
          let poste = await PosteDeTravail.findOne({ 
            nomFr: upper(ligne.POSTE_DE_TRAVAIL), 
            familleMetier: familleMetier._id 
          });
          if (!poste) {
            poste = await PosteDeTravail.create({
              nomFr: upper(ligne.POSTE_DE_TRAVAIL),
              nomEn: upper(ligne.POSTE_DE_TRAVAIL), // ✅ Même valeur
              familleMetier: familleMetier._id
            });
            console.log(`➕ Poste : ${poste.nomFr}`);
          }

          // 8️⃣ Structure
          let structure = await Structure.findOne({ 
            nomFr: upper(ligne.STRUCTURE) 
          });
          if (!structure) {
            structure = await Structure.create({
              nomFr: upper(ligne.STRUCTURE),
              nomEn: upper(ligne.STRUCTURE) // ✅ Même valeur
            });
            console.log(`➕ Structure : ${structure.nomFr}`);
          }

          // 9️⃣ Service
          let service = await Service.findOne({ 
            nomFr: upper(ligne.SERVICE), 
            structure: structure._id 
          });
          if (!service) {
            service = await Service.create({
              nomFr: upper(ligne.SERVICE),
              nomEn: upper(ligne.SERVICE), // ✅ Même valeur
              structure: structure._id
            });
            console.log(`➕ Service : ${service.nomFr}`);
          }

          // 🔟 Utilisateur
          // ✅ Ne pas séparer - garder le nom complet
          const nomComplet = upper(ligne.NOM);
          
          // ✅ Générer email si absent
          const email = ligne.EMAIL && ligne.EMAIL.trim() 
            ? ligne.EMAIL.toLowerCase().trim()
            : genererEmail(ligne.NOM, ligne.MATRICULE);

          // Vérifier si l'utilisateur existe déjà
          let utilisateur = await Utilisateur.findOne({ 
            $or: [
              { email: email },
              { matricule: ligne.MATRICULE }
            ]
          });

          if (!utilisateur) {
            const hashedPassword = await bcrypt.hash(passwordParDefaut, 10);
            
            utilisateur = await Utilisateur.create({
              matricule: ligne.MATRICULE || `MAT-${Date.now()}`,
              nom: nomComplet, // ✅ Nom complet
              prenom: "", // ✅ Prénom vide
              email: email,
              motDePasse: hashedPassword,
              genre: ligne.SEXE || "AUTRE",
              dateNaissance: ligne.DATE_NAISSANCE ? new Date(ligne.DATE_NAISSANCE) : null,
              lieuNaissance: upper(ligne.LIEU_NAISSANCE),
              telephone: ligne.TEL || "",
              dateEntreeEnService: ligne.DATE_E_ADM ? new Date(ligne.DATE_E_ADM) : null,
              service: service._id,
              grade: grade._id,
              familleMetier: familleMetier._id,
              categorieProfessionnelle: categorie._id,
              posteDeTravail: poste._id,
              role: "UTILISATEUR",
              roles: ["UTILISATEUR"],
              actif: true
            });
            
            console.log(`👤 Utilisateur ajouté : ${utilisateur.nom} (${email})`);
          } else {
            console.log(`⚠️ Utilisateur existant : ${nomComplet}`);
          }

        } catch (err) {
          console.error(`❌ Erreur sur la ligne : ${JSON.stringify(ligne)}\n`, err.message);
        }
      }

      console.log("✅ Importation terminée !");
      mongoose.connection.close();
    });
}

importerDonnees();