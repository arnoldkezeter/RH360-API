// controllers/exportController.js
import Utilisateur from '../models/Utilisateur.js';
import Service from '../models/Service.js';
import Structure from '../models/Structure.js';
import Grade from '../models/Grade.js';
import CategorieProfessionnelle from '../models/CategorieProfessionnelle.js';
import FamilleMetier from '../models/FamilleMetier.js';
import PosteDeTravail from '../models/PosteDeTravail.js';
import Commune from '../models/Commune.js';
import Departement from '../models/Departement.js';
import Region from '../models/Region.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';

class ExportController {
  
  // Méthode pour construire les filtres MongoDB
  static buildFilters(filters) {
    const mongoFilters = {};
    
    if (filters.service) {
      mongoFilters.service = new mongoose.Types.ObjectId(filters.service);
    }
    
    if (filters.posteDeTravail) {
      mongoFilters.posteDeTravail = new mongoose.Types.ObjectId(filters.posteDeTravail);
    }
    
    if (filters.grade) {
      mongoFilters.grade = new mongoose.Types.ObjectId(filters.grade);
    }
    
    if (filters.categorieProfessionnelle) {
      mongoFilters.categorieProfessionnelle = new mongoose.Types.ObjectId(filters.categorieProfessionnelle);
    }
    
    if (filters.familleMetier) {
      mongoFilters.familleMetier = new mongoose.Types.ObjectId(filters.familleMetier);
    }
    
    if (filters.commune) {
      mongoFilters.commune = new mongoose.Types.ObjectId(filters.commune);
    }
    
    return mongoFilters;
  }

  // Méthode optimisée pour construire les filtres géographiques avec cache
  static async buildGeographicFilters(filters) {
    let communeIds = [];
    
    if (filters.region) {
      // Une seule requête avec pipeline d'agrégation
      const result = await Commune.aggregate([
        {
          $lookup: {
            from: 'departements',
            localField: 'departement',
            foreignField: '_id',
            as: 'departement'
          }
        },
        {
          $unwind: '$departement'
        },
        {
          $match: {
            'departement.region': new mongoose.Types.ObjectId(filters.region)
          }
        },
        {
          $project: {
            _id: 1
          }
        }
      ]);
      
      communeIds = result.map(c => c._id);
    }
    else if (filters.departement) {
      // Requête directe plus rapide
      const communes = await Commune.find({ 
        departement: new mongoose.Types.ObjectId(filters.departement) 
      }).select('_id').lean();
      
      communeIds = communes.map(c => c._id);
    }
    else if (filters.commune) {
      communeIds = [new mongoose.Types.ObjectId(filters.commune)];
    }
    
    return communeIds;
  }

  // Méthode optimisée pour construire les filtres de structure
  static async buildStructureFilters(filters) {
    let serviceIds = [];
    
    if (filters.structure) {
      const services = await Service.find({ 
        structure: new mongoose.Types.ObjectId(filters.structure) 
      }).select('_id').lean();
      
      serviceIds = services.map(s => s._id);
    }
    
    return serviceIds;
  }

  // Méthode ULTRA-OPTIMISÉE pour récupérer les utilisateurs avec aggregation
  static async getFilteredUsers(filters) {
    let mongoFilters = ExportController.buildFilters(filters);
    
    // Filtres géographiques
    const communeIds = await ExportController.buildGeographicFilters(filters);
    if (communeIds.length > 0) {
      mongoFilters.commune = { $in: communeIds };
    }
    
    // Filtres de structure
    const serviceIds = await ExportController.buildStructureFilters(filters);
    if (serviceIds.length > 0) {
      mongoFilters.service = { $in: serviceIds };
    }
    
    // Pipeline d'agrégation optimisé avec tous les joins en une seule requête
    const pipeline = [
      // Filtrage initial
      { $match: mongoFilters },
      
      // Tous les lookups en parallèle
      {
        $lookup: {
          from: 'services',
          localField: 'service',
          foreignField: '_id',
          as: 'service',
          pipeline: [
            {
              $lookup: {
                from: 'structures',
                localField: 'structure',
                foreignField: '_id',
                as: 'structure'
              }
            },
            {
              $unwind: {
                path: '$structure',
                preserveNullAndEmptyArrays: true
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'grades',
          localField: 'grade',
          foreignField: '_id',
          as: 'grade'
        }
      },
      {
        $lookup: {
          from: 'categorieprofessionnelles',
          localField: 'categorieProfessionnelle',
          foreignField: '_id',
          as: 'categorieProfessionnelle'
        }
      },
      {
        $lookup: {
          from: 'famillemetiers',
          localField: 'familleMetier',
          foreignField: '_id',
          as: 'familleMetier'
        }
      },
      {
        $lookup: {
          from: 'postedetravails',
          localField: 'posteDeTravail',
          foreignField: '_id',
          as: 'posteDeTravail'
        }
      },
      {
        $lookup: {
          from: 'communes',
          localField: 'commune',
          foreignField: '_id',
          as: 'commune',
          pipeline: [
            {
              $lookup: {
                from: 'departements',
                localField: 'departement',
                foreignField: '_id',
                as: 'departement',
                pipeline: [
                  {
                    $lookup: {
                      from: 'regions',
                      localField: 'region',
                      foreignField: '_id',
                      as: 'region'
                    }
                  },
                  {
                    $unwind: {
                      path: '$region',
                      preserveNullAndEmptyArrays: true
                    }
                  }
                ]
              }
            },
            {
              $unwind: {
                path: '$departement',
                preserveNullAndEmptyArrays: true
              }
            }
          ]
        }
      },
      
      // Unwind des arrays (sauf service qui est déjà géré)
      {
        $unwind: {
          path: '$service',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$grade',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$categorieProfessionnelle',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$familleMetier',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$posteDeTravail',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$commune',
          preserveNullAndEmptyArrays: true
        }
      },
      
      // Projection pour optimiser la taille des données
      {
        $project: {
          matricule: 1,
          nom: 1,
          prenom: 1,
          email: 1,
          genre: 1,
          telephone: 1,
          dateNaissance: 1,
          lieuNaissance: 1,
          dateEntreeEnService: 1,
          role: 1,
          actif: 1,
          'service.nomFr': 1,
          'service.nomEn': 1,
          'service.structure.nomFr': 1,
          'service.structure.nomEn': 1,
          'grade.nomFr': 1,
          'grade.nomEn': 1,
          'categorieProfessionnelle.nomFr': 1,
          'categorieProfessionnelle.nomEn': 1,
          'familleMetier.nomFr': 1,
          'familleMetier.nomEn': 1,
          'posteDeTravail.nomFr': 1,
          'posteDeTravail.nomEn': 1,
          'commune.nomFr': 1,
          'commune.nomEn': 1,
          'commune.departement.nomFr': 1,
          'commune.departement.nomEn': 1,
          'commune.departement.region.nomFr': 1,
          'commune.departement.region.nomEn': 1
        }
      },
      
      // Tri final
      {
        $sort: { nom: 1, prenom: 1 }
      }
    ];
    
    const utilisateurs = await Utilisateur.aggregate(pipeline);
    return utilisateurs;
  }

  // Export Excel optimisé avec streaming
  static async exportToExcel(req, res) {
    try {
      const { format, lang = 'fr', ...filters } = req.query;
      
      // Configuration de la réponse en mode streaming
      const fileName = lang === 'fr' ? 
        `utilisateurs_${new Date().toISOString().split('T')[0]}.xlsx` :
        `users_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Création du workbook avec streaming
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true
      });
      
      const worksheet = workbook.addWorksheet(
        lang === 'fr' ? 'Liste des Utilisateurs' : 'Users List'
      );
      
      // En-têtes des colonnes selon la langue
      const headers = lang === 'fr' ? [
        'Matricule', 'Nom', 'Prénom', 'Email', 'Genre', 'Téléphone',
        'Date de Naissance', 'Lieu de Naissance', 'Date d\'Entrée en Service',
        'Rôle', 'Service', 'Structure', 'Grade', 'Catégorie Professionnelle',
        'Famille Métier', 'Poste de Travail', 'Commune', 'Département', 'Région',
        'Statut'
      ] : [
        'Registration Number', 'Last Name', 'First Name', 'Email', 'Gender', 'Phone',
        'Birth Date', 'Birth Place', 'Service Entry Date',
        'Role', 'Service', 'Structure', 'Grade', 'Professional Category',
        'Job Family', 'Work Position', 'Municipality', 'Department', 'Region',
        'Status'
      ];
      
      // Définir les colonnes avec largeur optimisée
      worksheet.columns = headers.map(header => ({
        header,
        key: header.toLowerCase().replace(/[^a-z0-9]/g, ''),
        width: 15
      }));
      
      // Style pour l'en-tête
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.commit();
      
      // Stream des données utilisateur avec curseur pour éviter de charger tout en mémoire
      const utilisateurs = await ExportController.getFilteredUsers(filters);
      
      // Traitement par batch pour optimiser la mémoire
      const batchSize = 1000;
      for (let i = 0; i < utilisateurs.length; i += batchSize) {
        const batch = utilisateurs.slice(i, i + batchSize);
        
        batch.forEach(user => {
          const rowData = [
            user.matricule || '',
            user.nom || '',
            user.prenom || '',
            user.email || '',
            user.genre || '',
            user.telephone || '',
            user.dateNaissance ? new Date(user.dateNaissance).toLocaleDateString() : '',
            user.lieuNaissance || '',
            user.dateEntreeEnService ? new Date(user.dateEntreeEnService).toLocaleDateString() : '',
            user.role || '',
            user.service ? (lang === 'fr' ? user.service.nomFr : user.service.nomEn) : '',
            user.service?.structure ? (lang === 'fr' ? user.service.structure.nomFr : user.service.structure.nomEn) : '',
            user.grade ? (lang === 'fr' ? user.grade.nomFr : user.grade.nomEn) : '',
            user.categorieProfessionnelle ? (lang === 'fr' ? user.categorieProfessionnelle.nomFr : user.categorieProfessionnelle.nomEn) : '',
            user.familleMetier ? (lang === 'fr' ? user.familleMetier.nomFr : user.familleMetier.nomEn) : '',
            user.posteDeTravail ? (lang === 'fr' ? user.posteDeTravail.nomFr : user.posteDeTravail.nomEn) : '',
            user.commune ? (lang === 'fr' ? user.commune.nomFr : user.commune.nomEn) : '',
            user.commune?.departement ? (lang === 'fr' ? user.commune.departement.nomFr : user.commune.departement.nomEn) : '',
            user.commune?.departement?.region ? (lang === 'fr' ? user.commune.departement.region.nomFr : user.commune.departement.region.nomEn) : '',
            user.actif ? (lang === 'fr' ? 'Actif' : 'Active') : (lang === 'fr' ? 'Inactif' : 'Inactive')
          ];
          
          worksheet.addRow(rowData).commit();
        });
      }
      
      await workbook.commit();
      
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          message: req.query.lang === 'fr' ? 
            'Erreur lors de l\'export Excel' : 
            'Error during Excel export',
          error: error.message 
        });
      }
    }
  }

  // Export PDF optimisé
  static async exportToPDF(req, res) {
    try {
      const { format, lang = 'fr', ...filters } = req.query;
      
      const utilisateurs = await ExportController.getFilteredUsers(filters);
      
      // Limitation pour PDF (trop d'utilisateurs peuvent être problématiques)
      if (utilisateurs.length > 10000) {
        return res.status(400).json({
          message: lang === 'fr' ? 
            'Trop d\'utilisateurs pour l\'export PDF. Veuillez utiliser des filtres ou choisir l\'export Excel.' :
            'Too many users for PDF export. Please use filters or choose Excel export.'
        });
      }
      
      // Configuration streaming pour PDF
      const fileName = lang === 'fr' ? 
        `utilisateurs_${new Date().toISOString().split('T')[0]}.pdf` :
        `users_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Création du document PDF avec options optimisées
      const doc = new PDFDocument({ 
        margin: 30, 
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true
      });
      
      doc.pipe(res);
      
      // Titre du document
      doc.fontSize(16).font('Helvetica-Bold')
         .text(lang === 'fr' ? 'Liste des Utilisateurs' : 'Users List', { align: 'center' });
      
      doc.moveDown();
      
      // Date de génération
      doc.fontSize(10).font('Helvetica')
         .text(`${lang === 'fr' ? 'Généré le' : 'Generated on'}: ${new Date().toLocaleDateString()}`, { align: 'right' });
      
      doc.moveDown();
      
      // Tableau des utilisateurs avec pagination optimisée
      let yPosition = doc.y;
      const pageWidth = doc.page.width - 60;
      const tableTop = yPosition + 20;
      
      // Définition des colonnes pour le tableau (réduites pour plus d'efficacité)
      const columns = [
        { header: lang === 'fr' ? 'Nom' : 'Name', width: pageWidth * 0.15 },
        { header: lang === 'fr' ? 'Prénom' : 'First Name', width: pageWidth * 0.15 },
        { header: 'Email', width: pageWidth * 0.25 },
        { header: lang === 'fr' ? 'Service' : 'Service', width: pageWidth * 0.2 },
        { header: lang === 'fr' ? 'Poste' : 'Position', width: pageWidth * 0.25 }
      ];
      
      let currentY = tableTop;
      
      // Fonction pour dessiner l'en-tête
      const drawHeader = (y) => {
        doc.fontSize(9).font('Helvetica-Bold');
        let currentX = 30;
        
        columns.forEach(col => {
          doc.rect(currentX, y, col.width, 20).stroke();
          doc.text(col.header, currentX + 5, y + 5, { 
            width: col.width - 10, 
            height: 20,
            align: 'left'
          });
          currentX += col.width;
        });
        
        return y + 20;
      };
      
      currentY = drawHeader(currentY);
      
      // Traitement par batch pour éviter les problèmes de mémoire
      doc.fontSize(8).font('Helvetica');
      const batchSize = 500;
      
      for (let i = 0; i < utilisateurs.length; i += batchSize) {
        const batch = utilisateurs.slice(i, i + batchSize);
        
        batch.forEach((user) => {
          // Vérifier si on a besoin d'une nouvelle page
          if (currentY > doc.page.height - 100) {
            doc.addPage();
            currentY = 50;
            currentY = drawHeader(currentY);
          }
          
          let currentX = 30;
          const rowHeight = 25;
          
          // Données de l'utilisateur (optimisées)
          const rowData = [
            user.nom || '',
            user.prenom || '',
            user.email || '',
            user.service ? (lang === 'fr' ? user.service.nomFr : user.service.nomEn) : '',
            user.posteDeTravail ? (lang === 'fr' ? user.posteDeTravail.nomFr : user.posteDeTravail.nomEn) : ''
          ];
          
          columns.forEach((col, colIndex) => {
            doc.rect(currentX, currentY, col.width, rowHeight).stroke();
            doc.text(rowData[colIndex], currentX + 5, currentY + 5, { 
              width: col.width - 10, 
              height: rowHeight - 10,
              align: 'left'
            });
            currentX += col.width;
          });
          
          currentY += rowHeight;
        });
      }
      
      // Pied de page avec statistiques
      doc.fontSize(10).font('Helvetica')
         .text(`${lang === 'fr' ? 'Total des utilisateurs' : 'Total users'}: ${utilisateurs.length}`, 30, doc.page.height - 50);
      
      doc.end();
      
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          message: req.query.lang === 'fr' ? 
            'Erreur lors de l\'export PDF' : 
            'Error during PDF export',
          error: error.message 
        });
      }
    }
  }

  // Méthode combinée pour gérer les deux formats
  static async exportUsers(req, res) {
    try {
      const { format = 'excel' } = req.query;
      
      if (format === 'pdf') {
        return await ExportController.exportToPDF(req, res);
      } else if (format === 'excel') {
        return await ExportController.exportToExcel(req, res);
      } else {
        return res.status(400).json({
          message: req.query.lang === 'fr' ? 
            'Format non supporté. Utilisez "excel" ou "pdf"' :
            'Unsupported format. Use "excel" or "pdf"'
        });
      }
      
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          message: req.query.lang === 'fr' ? 
            'Erreur lors de l\'export' : 
            'Export error',
          error: error.message 
        });
      }
    }
  }

  // Méthode pour obtenir les statistiques optimisée
  static async getExportStats(req, res) {
    try {
      const { lang = 'fr', ...filters } = req.query;
      
      let mongoFilters = ExportController.buildFilters(filters);
      
      // Filtres géographiques
      const communeIds = await ExportController.buildGeographicFilters(filters);
      if (communeIds.length > 0) {
        mongoFilters.commune = { $in: communeIds };
      }
      
      // Filtres de structure
      const serviceIds = await ExportController.buildStructureFilters(filters);
      if (serviceIds.length > 0) {
        mongoFilters.service = { $in: serviceIds };
      }
      
      // Pipeline d'agrégation pour les statistiques (très rapide)
      const statsAggregate = await Utilisateur.aggregate([
        { $match: mongoFilters },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            byRole: {
              $push: {
                role: '$role',
                count: 1
              }
            },
            byGender: {
              $push: {
                genre: '$genre',
                count: 1
              }
            },
            byStatus: {
              $push: {
                actif: '$actif',
                count: 1
              }
            }
          }
        },
        {
          $project: {
            total: 1,
            byRole: {
              $reduce: {
                input: '$byRole',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this.role',
                        v: { $add: [{ $ifNull: [{ $getField: { input: '$$value', field: '$$this.role' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            byGender: {
              $reduce: {
                input: '$byGender',
                initialValue: { M: 0, F: 0 },
                in: {
                  $cond: {
                    if: { $eq: ['$$this.genre', 'M'] },
                    then: { M: { $add: ['$$value.M', 1] }, F: '$$value.F' },
                    else: { M: '$$value.M', F: { $add: ['$$value.F', 1] } }
                  }
                }
              }
            },
            byStatus: {
              $reduce: {
                input: '$byStatus',
                initialValue: { active: 0, inactive: 0 },
                in: {
                  $cond: {
                    if: { $eq: ['$$this.actif', true] },
                    then: { active: { $add: ['$$value.active', 1] }, inactive: '$$value.inactive' },
                    else: { active: '$$value.active', inactive: { $add: ['$$value.inactive', 1] } }
                  }
                }
              }
            }
          }
        }
      ]);
      
      const stats = statsAggregate[0] || {
        total: 0,
        byRole: {},
        byGender: { M: 0, F: 0 },
        byStatus: { active: 0, inactive: 0 }
      };
      
      res.json({
        message: lang === 'fr' ? 
          'Statistiques récupérées avec succès' :
          'Statistics retrieved successfully',
        stats
      });
      
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      res.status(500).json({ 
        message: req.query.lang === 'fr' ? 
          'Erreur lors du calcul des statistiques' : 
          'Error calculating statistics',
        error: error.message 
      });
    }
  }
}

export default ExportController;