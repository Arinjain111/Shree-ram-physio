import { Router } from 'express';
import {
  getAllPatients,
  getPatientById,
  searchPatients,
  createPatient,
  updatePatient,
  deletePatient
} from '../controllers/patient';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/patients - Get all patients
router.get('/', asyncHandler(getAllPatients));

// GET /api/patients/search?query=term - Search patients
router.get('/search', asyncHandler(searchPatients));

// GET /api/patients/:id - Get patient by ID
router.get('/:id', asyncHandler(getPatientById));

// POST /api/patients - Create new patient
router.post('/', asyncHandler(createPatient));

// PUT /api/patients/:id - Update patient
router.put('/:id', asyncHandler(updatePatient));

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', asyncHandler(deletePatient));

export default router;
