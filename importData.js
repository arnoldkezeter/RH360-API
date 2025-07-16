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
// mongoose.connect("mongodb://localhost:8085", {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log("✅ Connecté à MongoDB"))
//   .catch((err) => console.error("❌ Erreur MongoDB :", err));

// const passwordParDefaut = "Utilisateur@123";

async function importerDonnees() {
  const results = [];

  fs.createReadStream("FICHIER_PERSONNEL_DGI_TRADUIT_CSV.csv")
    .pipe(csv({ separator: ";", mapHeaders: ({ header }) => header.trim() }))
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      console.log(`📦 ${results.length} lignes à traiter...`);

      for (const ligne of results) {
        try {
          // Tout mettre en MAJUSCULE
          const upper = (str) => str ? str.trim().toUpperCase() : "";

          // 1️⃣ Région
          let region = await Region.findOne({ nomFr: upper(ligne.REGION_FR), nomEn: upper(ligne.REGION_EN) });
          if (!region) {
            region = await Region.create({
              code: "REG-" + Date.now(),
              nomFr: upper(ligne.REGION_FR),
              nomEn: upper(ligne.REGION_EN)
            });
            console.log(`➕ Région : ${region.nomFr}`);
          }

          // 2️⃣ Département
          let departement = await Departement.findOne({ nomFr: upper(ligne.DEPARTEMENT_FR), region: region._id });
          if (!departement) {
            departement = await Departement.create({
              code: "DEP-" + Date.now(),
              nomFr: upper(ligne.DEPARTEMENT_FR),
              nomEn: upper(ligne.DEPARTEMENT_EN),
              region: region._id
            });
            console.log(`➕ Département : ${departement.nomFr}`);
          }

          // 3️⃣ Commune
          let commune = await Commune.findOne({ nomFr: upper(ligne.COMMUNE_FR), departement: departement._id });
          if (!commune) {
            commune = await Commune.create({
              code: "COM-" + Date.now(),
              nomFr: upper(ligne.COMMUNE_FR),
              nomEn: upper(ligne.COMMUNE_EN),
              departement: departement._id
            });
            console.log(`➕ Commune : ${commune.nomFr}`);
          }

          // 4️⃣ Grade
          let grade = await Grade.findOne({ nomFr: upper(ligne.GRADE_FR) });
          if (!grade) {
            grade = await Grade.create({
              nomFr: upper(ligne.GRADE_FR),
              nomEn: upper(ligne.GRADE_EN)
            });
            console.log(`➕ Grade : ${grade.nomFr}`);
          }

          // 5️⃣ Catégorie Professionnelle
          let categorie = await CategorieProfessionnelle.findOne({ nomFr: upper(ligne.CATEGORIE_PROFESSIONNELLE), grade: grade._id });
          if (!categorie) {
            categorie = await CategorieProfessionnelle.create({
              nomFr: upper(ligne.CATEGORIE_PROFESSIONNELLE),
              nomEn: upper(ligne.CATEGORIE_PROFESSIONNELLE),
              grade: grade._id
            });
            console.log(`➕ Catégorie : ${categorie.nomFr}`);
          }

          // 6️⃣ Famille Metier
          let familleMetier = await FamilleMetier.findOne({ nomFr: upper(ligne.FAMILLE_METIER_FR) });
          if (!familleMetier) {
            familleMetier = await FamilleMetier.create({
              nomFr: upper(ligne.FAMILLE_METIER_FR),
              nomEn: upper(ligne.FAMILLE_METIER_EN)
            });
            console.log(`➕ Famille Metier : ${familleMetier.nomFr}`);
          }

          // 7️⃣ Poste De Travail
          let poste = await PosteDeTravail.findOne({ nomFr: upper(ligne.POSTE_DE_TRAVAIL_FR), familleMetier: familleMetier._id });
          if (!poste) {
            poste = await PosteDeTravail.create({
              nomFr: upper(ligne.POSTE_DE_TRAVAIL_FR),
              nomEn: upper(ligne.POSTE_DE_TRAVAIL_EN),
              familleMetier: familleMetier._id
            });
            console.log(`➕ Poste : ${poste.nomFr}`);
          }

          // 8️⃣ Structure
          let structure = await Structure.findOne({ nomFr: upper(ligne.STRUCTURE_FR) });
          if (!structure) {
            structure = await Structure.create({
              nomFr: upper(ligne.STRUCTURE_FR),
              nomEn: upper(ligne.STRUCTURE_EN)
            });
            console.log(`➕ Structure : ${structure.nomFr}`);
          }

          // 9️⃣ Service
          let service = await Service.findOne({ nomFr: upper(ligne.SERVICE_FR), structure: structure._id });
          if (!service) {
            service = await Service.create({
              nomFr: upper(ligne.SERVICE_FR),
              nomEn: upper(ligne.SERVICE_EN),
              structure: structure._id
            });
            console.log(`➕ Service : ${service.nomFr}`);
          }

          // 🔟 Utilisateur
          let utilisateur = await Utilisateur.findOne({ email: ligne.EMAIL });
          if (!utilisateur) {
            const hashedPassword = await bcrypt.hash(passwordParDefaut, 10);
            utilisateur = await Utilisateur.create({
              matricule: ligne.MATRICULE,
              nom: upper(ligne.NOM),
              prenom: upper(ligne.PRENOM),
              email: ligne.EMAIL.toLowerCase(),
              motDePasse: hashedPassword,
              genre: ligne.SEXE,
              dateNaissance: new Date(ligne.DATE_NAISSANCE),
              lieuNaissance: upper(ligne.LIEU_NAISSANCE),
              telephone: ligne.TEL,
              dateEntreeEnService: new Date(ligne.DATE_E_ADM),
              service: service._id,
              categorieProfessionnelle: categorie._id,
              posteDeTravail: poste._id,
              role: "UTILISATEUR",
              actif: true
            });
            console.log(`👤 Utilisateur ajouté : ${utilisateur.nom} ${utilisateur.prenom}`);
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
