// routes/exportRoutes.js
import express from 'express';
import ExportController from '../controllers/exportController.js';

const router = express.Router();

/**
 * @route GET /api/export/users
 * @desc Export users to Excel or PDF with optional filters
 * @access Private (add authentication middleware as needed)
 * @query {string} format - Format of export ('excel' or 'pdf') - default: 'excel'
 * @query {string} lang - Language ('fr' or 'en') - default: 'fr'
 * @query {string} service - Filter by service ID (optional)
 * @query {string} posteDeTravail - Filter by work position ID (optional)
 * @query {string} structure - Filter by structure ID (optional)
 * @query {string} grade - Filter by grade ID (optional)
 * @query {string} categorieProfessionnelle - Filter by professional category ID (optional)
 * @query {string} region - Filter by region ID (optional)
 * @query {string} departement - Filter by department ID (optional)
 * @query {string} commune - Filter by municipality ID (optional)
 * @query {string} familleMetier - Filter by job family ID (optional)
 * 
 * Examples:
 * GET /api/export/users?format=excel&lang=fr
 * GET /api/export/users?format=pdf&lang=en&service=64a1b2c3d4e5f6789abcdef0
 * GET /api/export/users?format=excel&region=64a1b2c3d4e5f6789abcdef1&grade=64a1b2c3d4e5f6789abcdef2
 */
router.get('/users', ExportController.exportUsers);

/**
 * @route GET /api/export/users/stats
 * @desc Get export statistics with optional filters
 * @access Private (add authentication middleware as needed)
 * @query {string} lang - Language ('fr' or 'en') - default: 'fr'
 * @query {string} service - Filter by service ID (optional)
 * @query {string} posteDeTravail - Filter by work position ID (optional)
 * @query {string} structure - Filter by structure ID (optional)
 * @query {string} grade - Filter by grade ID (optional)
 * @query {string} categorieProfessionnelle - Filter by professional category ID (optional)
 * @query {string} region - Filter by region ID (optional)
 * @query {string} departement - Filter by department ID (optional)
 * @query {string} commune - Filter by municipality ID (optional)
 * @query {string} familleMetier - Filter by job family ID (optional)
 * 
 * Examples:
 * GET /api/export/users/stats?lang=fr
 * GET /api/export/users/stats?lang=en&service=64a1b2c3d4e5f6789abcdef0
 */
router.get('/users/stats', ExportController.getExportStats);

/**
 * @route GET /api/export/users/excel
 * @desc Export users to Excel format with optional filters
 * @access Private (add authentication middleware as needed)
 */
router.get('/users/excel', ExportController.exportToExcel);

/**
 * @route GET /api/export/users/pdf
 * @desc Export users to PDF format with optional filters
 * @access Private (add authentication middleware as needed)
 */
router.get('/users/pdf', ExportController.exportToPDF);

export default router;