import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';

// Get all patients
export const getAllPatients = async (_req: Request, res: Response) => {
  const patients = await prisma.patient.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      invoices: {
        include: {
          treatments: true,
        },
      },
    },
  });

  res.json({
    success: true,
    patients,
  });
};

// Get patient by ID
export const getPatientById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Patient ID is required', { code: 'PATIENT_ID_REQUIRED' });
  }

  const patientId = parseInt(id, 10);
  if (Number.isNaN(patientId)) {
    throw new ApiError(400, 'Invalid patient ID', { code: 'INVALID_PATIENT_ID' });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      invoices: {
        include: {
          treatments: true,
        },
      },
    },
  });

  if (!patient) {
    throw new ApiError(404, 'Patient not found', { code: 'PATIENT_NOT_FOUND' });
  }

  res.json({
    success: true,
    patient,
  });
};

// Search patients
export const searchPatients = async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Search query is required', { code: 'SEARCH_QUERY_REQUIRED' });
  }

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { uhid: { contains: query } },
        { phone: { contains: query } },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    patients,
  });
};

// Create patient
export const createPatient = async (req: Request, res: Response) => {
  const { first_name, last_name, age, gender, phone, uhid } = req.body;

  // Basic validation for incoming form data
  if (!first_name || !last_name || !age || !gender || !phone || !uhid) {
    throw new ApiError(400, 'All fields are required', { code: 'MISSING_REQUIRED_FIELDS' });
  }

  const numericAge = parseInt(age, 10);
  if (Number.isNaN(numericAge) || numericAge < 0) {
    throw new ApiError(400, 'Age must be a valid non-negative number', { code: 'INVALID_AGE' });
  }

  // Check if UHID already exists
  const existingPatient = await prisma.patient.findUnique({
    where: { uhid },
  });

  if (existingPatient) {
    throw new ApiError(409, 'Patient with this UHID already exists', { code: 'DUPLICATE_UHID' });
  }

  const patient = await prisma.patient.create({
    data: {
      firstName: first_name,
      lastName: last_name,
      age: numericAge,
      gender,
      phone,
      uhid,
    },
  });

  res.status(201).json({
    success: true,
    patient,
  });
};

// Update patient
export const updatePatient = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, age, gender, phone, uhid } = req.body;

  if (!id) {
    throw new ApiError(400, 'Patient ID is required', { code: 'PATIENT_ID_REQUIRED' });
  }

  const patientId = parseInt(id, 10);
  if (Number.isNaN(patientId)) {
    throw new ApiError(400, 'Invalid patient ID');
  }

  // Check if patient exists
  const existingPatient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  if (!existingPatient) {
    throw new ApiError(404, 'Patient not found', { code: 'PATIENT_NOT_FOUND' });
  }

  // If UHID is being changed, check for conflicts
  if (uhid && uhid !== existingPatient.uhid) {
    const uhidConflict = await prisma.patient.findUnique({
      where: { uhid },
    });

    if (uhidConflict) {
      throw new ApiError(409, 'Another patient with this UHID already exists', { code: 'DUPLICATE_UHID' });
    }
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (age) {
    const numericAge = parseInt(age, 10);
    if (Number.isNaN(numericAge) || numericAge < 0) {
      throw new ApiError(400, 'Age must be a valid non-negative number', { code: 'INVALID_AGE' });
    }
    updateData.age = numericAge;
  }
  if (gender) updateData.gender = gender;
  if (phone) updateData.phone = phone;
  if (uhid) updateData.uhid = uhid;

  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: updateData,
  });

  res.json({
    success: true,
    patient,
  });
};

// Delete patient
export const deletePatient = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Patient ID is required', { code: 'PATIENT_ID_REQUIRED' });
  }

  const patientId = parseInt(id, 10);
  if (Number.isNaN(patientId)) {
    throw new ApiError(400, 'Invalid patient ID', { code: 'INVALID_PATIENT_ID' });
  }

  // Check if patient exists
  const existingPatient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      invoices: true,
    },
  });

  if (!existingPatient) {
    throw new ApiError(404, 'Patient not found', { code: 'PATIENT_NOT_FOUND' });
  }

  // Check if patient has invoices
  if (existingPatient.invoices.length > 0) {
    throw new ApiError(400, 'Cannot delete patient with existing invoices', { code: 'PATIENT_HAS_INVOICES' });
  }

  await prisma.patient.delete({
    where: { id: patientId },
  });

  res.json({
    success: true,
    message: 'Patient deleted successfully',
  });
};
