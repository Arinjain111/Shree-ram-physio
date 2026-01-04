import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logError } from '../utils/errorLogger';
import axios from '../services/http';
import { getBackendUrl } from '../config/backend';

export function registerPatientHandlers() {
    const prisma = getPrismaClient();
    const backendUrl = getBackendUrl();

    // Create patient
    ipcMain.handle('create-patient', async (_event, patientData: any) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const patient = await prisma.patient.create({
                data: {
                    firstName: patientData.firstName,
                    lastName: patientData.lastName,
                    age: patientData.age,
                    gender: patientData.gender,
                    phone: patientData.phone,
                    uhid: patientData.uhid,
                    syncStatus: 'PENDING'
                }
            });

            return { success: true, patientId: patient.id };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Load all patients (from old load-patients handler)
    ipcMain.handle('load-patients', async () => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const patients = await prisma.patient.findMany({
                orderBy: {
                    updatedAt: 'desc'
                }
            });

            return { success: true, patients };
        } catch (error) {
            logError('Load patients', error);
            return { success: false, error: String(error) };
        }
    });

    // Get all patients (from old get-patients handler)
    ipcMain.handle('get-patients', async () => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const patients = await prisma.patient.findMany({
                orderBy: { createdAt: 'desc' }
            });

            return { success: true, patients };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Get patient by ID
    ipcMain.handle('get-patient', async (_event, patientId: number) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const patient = await prisma.patient.findUnique({
                where: { id: patientId }
            });

            if (!patient) {
                throw new Error('Patient not found');
            }

            return { success: true, patient };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('delete-patient', async (_event, patientId: number, target: 'local' | 'cloud' | 'both') => {
        try {
            if (!prisma) throw new Error('Prisma not initialized');

            const result = { local: false, cloud: false, errors: [] as string[] };

            // 1. Delete from Cloud
            if (target === 'cloud' || target === 'both') {
                try {
                    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
                    if (patient && patient.cloudId) {
                        await axios.delete(`${backendUrl}/api/patients/${patient.cloudId}`);
                        result.cloud = true;
                    } else if (target === 'cloud') {
                        throw new Error('Patient not synced to cloud (no Cloud ID)');
                    }
                } catch (e: any) {
                    console.error('Cloud delete failed', e);
                    result.errors.push(`Cloud: ${e.message}`);
                }
            }

            // 2. Delete from Local
            if (target === 'local' || target === 'both') {
                try {
                    await prisma.patient.delete({ where: { id: patientId } });
                    result.local = true;
                } catch (e: any) {
                    console.error('Local delete failed', e);
                    result.errors.push(`Local: ${e.message}`);
                }
            }

            return { success: result.local || result.cloud, ...result };

        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Search patients by name or UHID
    ipcMain.handle('search-patients', async (_event, query: string) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const patients = await prisma.patient.findMany({
                where: {
                    OR: [
                        { firstName: { contains: query } },
                        { lastName: { contains: query } },
                        { uhid: { contains: query } }
                    ]
                },
                orderBy: { createdAt: 'desc' }
            });

            return { success: true, patients };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Update patient
    ipcMain.handle('update-patient', async (_event, patientId: number, patientData: any) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            await prisma.patient.update({
                where: { id: patientId },
                data: {
                    firstName: patientData.firstName,
                    lastName: patientData.lastName,
                    age: patientData.age,
                    gender: patientData.gender,
                    phone: patientData.phone,
                    uhid: patientData.uhid,
                    syncStatus: 'PENDING'
                }
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
}
