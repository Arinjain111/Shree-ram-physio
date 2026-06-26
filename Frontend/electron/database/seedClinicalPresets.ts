import { loadBetterSqlite3 } from '../lib/nativeLoader';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

const DIAGNOSIS_PRESETS = [
  'Low Back Pain',
  'Cervical Spondylosis',
  'Frozen Shoulder',
  'Plantar Fasciitis',
  'Knee Osteoarthritis',
  'Cervical Radiculopathy',
  'Lumbar Spondylosis',
  'Tennis Elbow',
  'Golfer\'s Elbow',
  'Carpal Tunnel Syndrome',
  'Rotator Cuff Tear',
  'Ankle Sprain',
  'Sciatica',
  'Prolapsed Intervertebral Disc',
  'Postural Deformity',
  'Scoliosis',
  'Kyphosis',
  'Forward Head Posture',
  'Shoulder Impingement',
  'Calcaneal Spur',
  'Heel Pain',
  'Patellar Tendinitis',
  'Osgood-Schlatter Disease',
  'IT Band Syndrome',
  'Shin Splints',
  'Achilles Tendinitis',
  'Hip Bursitis',
  'Trochanteric Bursitis',
  'Sacroliac Joint Dysfunction',
  'Coccydynia',
  'TMJ Dysfunction',
  'Migraine',
  'Tension Headache',
  'Cervicogenic Headache',
  'Whiplash Injury',
  'Fibromyalgia',
  'Myofascial Pain Syndrome',
  'Trigger Points',
  'Post-Surgical Rehabilitation',
  'ACL Reconstruction Rehab',
  'Meniscal Tear',
  'Ligamentous Laxity',
  'Recurrent Shoulder Dislocation',
  'Adhesive Capsulitis',
  'Bicipital Tendinitis',
  'Supraspinatus Tendinitis',
  'Thoracic Outlet Syndrome',
  'De Quervain\'s Tenosynovitis',
  'Dupuytren\'s Contracture',
  'Trigger Finger',
  'Ganglion Cyst',
  'Baker\'s Cyst',
  'Pes Anserine Bursitis',
  'Morton\'s Neuroma',
  'Hallux Valgus (Bunion)',
  'Hammer Toe',
  'Flat Feet',
  'High Arch Foot',
  'Chronic Venous Insufficiency',
  'Lymphoedema',
  'Post-Mastectomy Rehab',
  'Parkinson\'s Disease Rehab',
  'Stroke Rehab',
  'Bell\'s Palsy',
  'Cerebral Palsy',
  'Spina Bifida',
  'Spinal Cord Injury',
  'Peripheral Neuropathy',
  'Diabetic Neuropathy',
  'Post-Polio Syndrome',
  'Guillain-Barre Syndrome',
  'Multiple Sclerosis',
  'Muscular Dystrophy',
  'Rheumatoid Arthritis',
  'Ankylosing Spondylitis',
  'Sjogren\'s Syndrome',
  'Systemic Lupus Erythematosus',
  'Vasculitis',
  'Psoriatic Arthritis',
  'Acute Torticollis',
  'Cervical Strain',
  'Lumbar Strain',
  'Piriformis Syndrome',
  'Costochondritis',
  'Rib Subluxation',
  'Pectus Deformity',
  'Tietze Syndrome',
  'Sacroiliitis',
  'Spinal Stenosis',
  'Spondylolisthesis',
  'Vertebral Compression Fracture',
  'Osteoporosis',
  'Avascular Necrosis',
  'Perthes Disease',
  'SCFE (Slipped Capital Femoral Epiphysis)',
  'Legg-Calve-Perthes Disease',
  'Growing Pains',
  'Developmental Dysplasia of Hip',
  'Torticollis (Congenital)',
  'Erb\'s Palsy',
  'Brachial Plexus Injury',
  'Peripheral Nerve Injury',
  'Complex Regional Pain Syndrome',
  'Phantom Limb Pain',
  'Stump Pain',
  'Scar Tissue Adhesion',
  'Burns Contracture',
  'Fracture (Conservative Management)',
  'Malunion / Non-Union Fracture',
  'Osteomyelitis',
  'Total Knee Replacement Rehab',
  'Total Hip Replacement Rehab',
  'Shoulder Replacement Rehab',
  'Amputation Rehab',
  'Cardiac Rehab',
  'Pulmonary Rehab',
  'Chronic Obstructive Pulmonary Disease',
  'Post-COVID Rehabilitation',
  'Obesity Management',
  'Sports Injury (General)',
  'Deconditioning Syndrome',
  'Geriatric Rehab',
  'Pediatric Rehab',
  'Vestibular Rehabilitation',
  'Vertigo / BPPV',
  'Labyrinthitis',
  'Meniere\'s Disease',
  'Concussion Rehab',
  'Post-Concussion Syndrome',
  'Balance Disorder',
  'Gait Abnormality',
  'Foot Drop',
  'Hemiplegia',
  'Paraplegia',
  'Quadriplegia',
  'Diplegia',
  'Ataxia',
  'Dystonia',
  'Tremors',
  'Chorea',
  'Huntington\'s Disease',
  'ALS (Motor Neuron Disease)',
  'Post-Surgical Scar Management',
  'Oedema Management',
  'Pain Management',
  'Stress Incontinence',
  'Pelvic Floor Dysfunction',
];

const EXERCISE_PRESETS = [
  'Quadriceps Sets',
  'Hamstring Curls',
  'Straight Leg Raises',
  'Heel Slides',
  'Ankle Pumps',
  'Glute Bridges',
  'Wall Squats',
  'Calf Raises',
  'Bird Dog',
  'Cat-Cow Stretch',
  'Pelvic Tilts',
  'Knee to Chest Stretch',
  'Child Pose',
  'Cobra Stretch',
  'Bridge Exercise',
  'Side Leg Raises',
  'Hip Abduction',
  'Hip Adduction',
  'Mini Squats',
  'Step Ups',
  'Single Leg Stance',
  'Tandem Walking',
  'Heel-Toe Walking',
  'Toe Raises',
  'Resisted Row',
  'Shoulder Flexion',
  'Shoulder Abduction',
  'External Rotation',
  'Internal Rotation',
  'Pendulum Exercise',
  'Wall Push-Ups',
  'Scapular Retraction',
  'Chin Tucks',
  'Cervical Retraction',
  'Upper Trapezius Stretch',
  'Levator Scapulae Stretch',
  'Pec Stretch',
  'Thoracic Extension',
  'Diaphragmatic Breathing',
  'Active Cycle of Breathing',
  'Pursed Lip Breathing',
  'Incentive Spirometry',
  'Postural Correction',
  'Scapular Squeezes',
  'Wrist Flexor Stretch',
  'Wrist Extensor Stretch',
  'Tendon Gliding',
  'Grip Strengthening',
  'Finger Tapping',
  'Thumb Opposition',
  'Pelvic Floor Kegels',
  'Transverse Abdominis Activation',
  'Core Stabilization',
  'Dead Bug',
  'Plank',
  'Side Plank',
  'Superman Exercise',
  'Balance Board Training',
  'BOSU Ball Exercises',
  'Resistance Band Rows',
  'Theraband Exercises',
  'Foam Roller Release',
  'Self Myofascial Release',
  'Static Stretching',
  'Dynamic Stretching',
  'PNF Stretching',
  'Range of Motion Exercises',
  'Strengthening Exercises',
  'Endurance Training',
  'Aerobic Conditioning',
  'Gait Training',
  'Stair Training',
  'Sit to Stand',
  'Transfer Training',
  'Proprioception Training',
  'Agility Drills',
  'Sport-Specific Training',
];

const SHORTCUTS: Array<{ shortcut: string; expands: string }> = [
  { shortcut: 'lbp', expands: 'Low Back Pain' },
  { shortcut: 'cs', expands: 'Cervical Spondylosis' },
  { shortcut: 'fs', expands: 'Frozen Shoulder' },
  { shortcut: 'pf', expands: 'Plantar Fasciitis' },
  { shortcut: 'knee oa', expands: 'Knee Osteoarthritis' },
  { shortcut: 'sciatica', expands: 'Sciatica' },
  { shortcut: 'pid', expands: 'Prolapsed Intervertebral Disc' },
  { shortcut: 'ct', expands: 'Carpal Tunnel Syndrome' },
  { shortcut: 'rc', expands: 'Rotator Cuff Tear' },
  { shortcut: 'tennis e', expands: 'Tennis Elbow' },
  { shortcut: 'golfer e', expands: 'Golfer\'s Elbow' },
  { shortcut: 'si', expands: 'Shoulder Impingement' },
  { shortcut: 'achilles', expands: 'Achilles Tendinitis' },
  { shortcut: 'itb', expands: 'IT Band Syndrome' },
  { shortcut: 'shin', expands: 'Shin Splints' },
  { shortcut: 'tkr', expands: 'Total Knee Replacement Rehab' },
  { shortcut: 'thr', expands: 'Total Hip Replacement Rehab' },
  { shortcut: 'crps', expands: 'Complex Regional Pain Syndrome' },
  { shortcut: 'tmd', expands: 'TMJ Dysfunction' },
  { shortcut: 'bppv', expands: 'Vertigo / BPPV' },
];

export function seedClinicalData(): void {
  const Database = loadBetterSqlite3();
  const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');

  if (!fs.existsSync(dbPath)) {
    logger.debug('db', 'DB not found, skipping diagnosis seed');
    return;
  }

  const db = new Database(dbPath);

  try {
    const existingDiagnosis = db.prepare('SELECT COUNT(*) as count FROM clinical_presets WHERE category = \'diagnosis\'').get() as { count: number };
    const existingExercise = db.prepare('SELECT COUNT(*) as count FROM clinical_presets WHERE category = \'exercise\'').get() as { count: number };

    if (existingDiagnosis.count === 0) {
      logger.info('db', 'Seeding diagnosis presets');
      const insertDiagnosis = db.prepare('INSERT OR IGNORE INTO clinical_presets (name, category, frequency) VALUES (?, \'diagnosis\', ?)');
      const insertMany = db.transaction((items: string[]) => {
        for (const name of items) {
          insertDiagnosis.run(name, 0);
        }
      });
      insertMany(DIAGNOSIS_PRESETS);
      logger.info('db', 'Seeded diagnosis presets', { count: DIAGNOSIS_PRESETS.length });
    }

    if (existingExercise.count === 0) {
      logger.info('db', 'Seeding exercise presets');
      const insertExercise = db.prepare('INSERT OR IGNORE INTO clinical_presets (name, category, frequency) VALUES (?, \'exercise\', ?)');
      const insertMany = db.transaction((items: string[]) => {
        for (const name of items) {
          insertExercise.run(name, 0);
        }
      });
      insertMany(EXERCISE_PRESETS);
      logger.info('db', 'Seeded exercise presets', { count: EXERCISE_PRESETS.length });
    }

    if (existingDiagnosis.count > 0 && existingExercise.count > 0) {
      db.close();
      return;
    }

    logger.info('db', 'Seeding diagnosis shortcuts');
    const insertShortcut = db.prepare('INSERT OR IGNORE INTO diagnosis_shortcuts (shortcut, expands) VALUES (?, ?)');

    const insertShortcuts = db.transaction((items: Array<{ shortcut: string; expands: string }>) => {
      for (const item of items) {
        insertShortcut.run(item.shortcut, item.expands);
      }
    });

    insertShortcuts(SHORTCUTS);
    logger.info('db', 'Seeded diagnosis shortcuts', { count: SHORTCUTS.length });
  } catch (error) {
    logger.error('db', 'Failed to seed diagnosis data', { error: error instanceof Error ? error.message : String(error) });
  } finally {
    db.close();
  }
}
