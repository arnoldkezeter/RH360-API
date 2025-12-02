import express from 'express';
import {
  createThemeFormation,
  updateThemeFormation,
  deleteThemeFormation,
  ajouterFormateur,
  supprimerFormateur,
  
  getThemeFormationsForDropdown,
  getThemesByFamilleMetier,
  getFilteredThemes,
  invitation,
  getTargetedUsers,
  checkUserIsTargeted,
  getThemeById
} from '../controllers/themeFormationController.js';
import { validateFields } from '../middlewares/validateFields/validateTheme.js';
import { authentificate } from '../middlewares/auth.js';


const router = express.Router();

router.post('/:themeId/invitation', authentificate, invitation);
router.post('/', validateFields, authentificate, createThemeFormation);

router.put('/:id', validateFields, authentificate, updateThemeFormation);

router.delete('/:id', authentificate, deleteThemeFormation);
router.get('/filtre', authentificate, getFilteredThemes);


router.put('/:id/formateur', authentificate, ajouterFormateur);
router.delete('/:id/formateur/:formateurId', authentificate, supprimerFormateur);

router.get('/dropdown/formation/:formationId', authentificate, getThemeFormationsForDropdown);
router.get('/:themeId/targeted-users', authentificate, getTargetedUsers);
router.get('/famille-metier', authentificate, getThemesByFamilleMetier);

router.get('/:themeId/targeted-users', getTargetedUsers);
router.get('/:themeId/users/:userId/is-targeted', checkUserIsTargeted);
router.get('/:themeId', authentificate, getThemeById)

export default router;
