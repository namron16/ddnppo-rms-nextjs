// lib/data201.ts
// ─────────────────────────────────────────────
// Seed data for Personnel 201 Files.
// Based on the PNP DPRM "Checklist in the Updating
// of Records — Police Personal File (Database)" form.
//
// Checklist items (A–U):
//  A  Updated PDS (DPRM Form) with latest 2x2 ID in Type A GOA Uniform
//  B  Birth Certificate, Marriage Contract, Birth Certificates of all children
//  C  College Diploma, SO, Transcript of Records and CAV, School Records or CAV
//  D  All Mandatory Training with Diploma, Final Order of Merits, and Declaration of Graduates
//  E  All Specialized Training/Seminars Attended (Certificate of Graduation/Attendance)
//  F  All Eligibilities (Highest/Appropriate)
//  G  All Attested Appointment/Special Orders (Temp/Perm)
//  H  Order of Assignment, Designation/Detail
//  I  Service Records (indicate Longevity and RCA Orders)
//  J  Promotion Orders/Demotion (include Absorption Order and Appointments)
//  K  Awards and Decorations and Commendations
//  L  Firearms Records (Property Accountability Receipt P.A.R)
//  M  Latest Medical Records
//  N  Cases/Offenses
//  O  Leave Records
//  P  All RCA/Longevity Pay Orders
//  Q  Latest Per FM Previous Unit
//  R  Statement of Assets, Liabilities & Networth (SALN)
//  S  Individual Income Tax Return (ITR)
//  T  Photocopy of Tax Identification Card (TIN)
//  U  1 PC Latest 2x2 ID Picture in GOA Type A Uniform

import type { Personnel201, Doc201Item } from '@/types'

// ── Shared checklist template ─────────────────
// Returns the standard 21-item 201 checklist
// pre-filled with MISSING status for a new record.
function blankChecklist(): Omit<Doc201Item, 'id'>[] {
  return [
    { category: 'PERSONAL_DATA',  label: 'Updated PDS (DPRM Form)',                          sublabel: 'With latest 2x2 ID in Type A GOA Uniform',      status: 'MISSING',     dateUpdated: '' },
    { category: 'CIVIL_DOCUMENTS',label: 'Birth Certificate',                                 sublabel: 'PSA copy',                                       status: 'MISSING',     dateUpdated: '' },
    { category: 'CIVIL_DOCUMENTS',label: 'Marriage Contract',                                 sublabel: 'PSA copy (if applicable)',                        status: 'MISSING',     dateUpdated: '' },
    { category: 'CIVIL_DOCUMENTS',label: 'Birth Certificates of all Children',                sublabel: 'PSA copy',                                       status: 'MISSING',     dateUpdated: '' },
    { category: 'ACADEMIC',       label: 'College Diploma',                                                                                               status: 'MISSING',     dateUpdated: '' },
    { category: 'ACADEMIC',       label: 'Transcript of Records and CAV',                     sublabel: 'School Records or CAV',                          status: 'MISSING',     dateUpdated: '' },
    { category: 'TRAINING',       label: 'Mandatory Training Documents',                      sublabel: 'Diploma, Final Order of Merits, Declaration of Graduates', status: 'MISSING', dateUpdated: '' },
    { category: 'TRAINING',       label: 'Specialized Training / Seminars Attended',          sublabel: 'Certificate of Graduation/Attendance',           status: 'MISSING',     dateUpdated: '' },
    { category: 'ELIGIBILITY',    label: 'Eligibilities',                                     sublabel: 'Highest/Appropriate — attested copies',          status: 'MISSING',     dateUpdated: '' },
    { category: 'SPECIAL_ORDERS', label: 'Attested Appointment / Special Orders',             sublabel: 'Temp/Perm — attested and approved',              status: 'MISSING',     dateUpdated: '' },
    { category: 'ASSIGNMENTS',    label: 'Order of Assignment, Designation / Detail',                                                                     status: 'MISSING',     dateUpdated: '' },
    { category: 'ASSIGNMENTS',    label: 'Service Records',                                   sublabel: 'Indicate Longevity and RCA Orders',              status: 'MISSING',     dateUpdated: '' },
    { category: 'PROMOTIONS',     label: 'Promotion / Demotion Orders',                       sublabel: 'Include Absorption Order and Appointments',      status: 'MISSING',     dateUpdated: '' },
    { category: 'AWARDS',         label: 'Awards, Decorations and Commendations',                                                                         status: 'MISSING',     dateUpdated: '' },
    { category: 'FIREARMS',       label: 'Firearms Records',                                  sublabel: 'Property Accountability Receipt (P.A.R)',        status: 'MISSING',     dateUpdated: '' },
    { category: 'MEDICAL',        label: 'Latest Medical Records',                                                                                        status: 'MISSING',     dateUpdated: '' },
    { category: 'CASES',          label: 'Cases / Offenses',                                  sublabel: 'All administrative and criminal cases',          status: 'MISSING',     dateUpdated: '' },
    { category: 'LEAVE',          label: 'Leave Records',                                                                                                 status: 'MISSING',     dateUpdated: '' },
    { category: 'PAY_RECORDS',    label: 'RCA / Longevity Pay Orders',                        sublabel: 'All pay orders',                                 status: 'MISSING',     dateUpdated: '' },
    { category: 'PAY_RECORDS',    label: 'Latest Per FM Previous Unit',                                                                                   status: 'MISSING',     dateUpdated: '' },
    { category: 'FINANCIAL',      label: 'Statement of Assets, Liabilities & Net Worth',      sublabel: 'SALN — latest copy',                            status: 'MISSING',     dateUpdated: '' },
    { category: 'TAXATION',       label: 'Individual Income Tax Return (ITR)',                 sublabel: 'Latest filed ITR',                               status: 'MISSING',     dateUpdated: '' },
    { category: 'TAXATION',       label: 'Photocopy of Tax Identification Card (TIN)',                                                                    status: 'MISSING',     dateUpdated: '' },
    { category: 'IDENTIFICATION', label: '1 PC Latest 2x2 ID Picture',                        sublabel: 'GOA Type A Uniform',                            status: 'MISSING',     dateUpdated: '' },
  ]
}

function makeId(prefix: string, n: number) { return `${prefix}-${n}` }

// ── Seeded 201 Records ────────────────────────
export const PERSONNEL_201: Personnel201[] = [
  {
    id: 'p201-1',
    name: 'Ramon Dela Cruz',
    rank: 'P/Col.',
    serialNo: 'PN-2004-0012',
    unit: 'DDNPPO HQ',
    dateCreated: '2010-06-15',
    lastUpdated: '2024-01-10',
    initials: 'RD',
    avatarColor: '#f0b429',
    documents: [
      { id: makeId('d',  1), category: 'PERSONAL_DATA',  label: 'Updated PDS (DPRM Form)',                    sublabel: 'With latest 2x2 ID in Type A GOA Uniform',          status: 'COMPLETE',    dateUpdated: '2024-01-10', filedBy: 'Admin', fileSize: '1.2 MB' },
      { id: makeId('d',  2), category: 'CIVIL_DOCUMENTS',label: 'Birth Certificate',                          sublabel: 'PSA copy',                                           status: 'COMPLETE',    dateUpdated: '2010-06-15', filedBy: 'Admin', fileSize: '0.8 MB' },
      { id: makeId('d',  3), category: 'CIVIL_DOCUMENTS',label: 'Marriage Contract',                          sublabel: 'PSA copy (if applicable)',                           status: 'COMPLETE',    dateUpdated: '2010-06-15', filedBy: 'Admin', fileSize: '0.7 MB' },
      { id: makeId('d',  4), category: 'CIVIL_DOCUMENTS',label: 'Birth Certificates of all Children',         sublabel: 'PSA copy',                                           status: 'COMPLETE',    dateUpdated: '2015-03-20', filedBy: 'Admin', fileSize: '1.1 MB' },
      { id: makeId('d',  5), category: 'ACADEMIC',       label: 'College Diploma',                                                                                            status: 'COMPLETE',    dateUpdated: '2010-06-15', filedBy: 'Admin', fileSize: '0.5 MB' },
      { id: makeId('d',  6), category: 'ACADEMIC',       label: 'Transcript of Records and CAV',              sublabel: 'School Records or CAV',                              status: 'COMPLETE',    dateUpdated: '2010-06-15', filedBy: 'Admin', fileSize: '0.6 MB' },
      { id: makeId('d',  7), category: 'TRAINING',       label: 'Mandatory Training Documents',               sublabel: 'Diploma, Final Order of Merits, Declaration of Graduates', status: 'COMPLETE', dateUpdated: '2023-08-01', filedBy: 'Admin', fileSize: '2.1 MB' },
      { id: makeId('d',  8), category: 'TRAINING',       label: 'Specialized Training / Seminars Attended',   sublabel: 'Certificate of Graduation/Attendance',               status: 'COMPLETE',    dateUpdated: '2023-11-15', filedBy: 'Admin', fileSize: '1.8 MB' },
      { id: makeId('d',  9), category: 'ELIGIBILITY',    label: 'Eligibilities',                              sublabel: 'Highest/Appropriate — attested copies',              status: 'COMPLETE',    dateUpdated: '2010-06-15', filedBy: 'Admin', fileSize: '0.4 MB' },
      { id: makeId('d', 10), category: 'SPECIAL_ORDERS', label: 'Attested Appointment / Special Orders',      sublabel: 'Temp/Perm — attested and approved',                  status: 'COMPLETE',    dateUpdated: '2024-01-05', filedBy: 'Admin', fileSize: '0.9 MB' },
      { id: makeId('d', 11), category: 'ASSIGNMENTS',    label: 'Order of Assignment, Designation / Detail',                                                                  status: 'COMPLETE',    dateUpdated: '2024-01-05', filedBy: 'Admin', fileSize: '0.6 MB' },
      { id: makeId('d', 12), category: 'ASSIGNMENTS',    label: 'Service Records',                            sublabel: 'Indicate Longevity and RCA Orders',                  status: 'FOR_UPDATE',  dateUpdated: '2022-12-01', filedBy: 'Admin', remarks: 'Needs 2023 entries' },
      { id: makeId('d', 13), category: 'PROMOTIONS',     label: 'Promotion / Demotion Orders',               sublabel: 'Include Absorption Order and Appointments',           status: 'COMPLETE',    dateUpdated: '2023-06-15', filedBy: 'Admin', fileSize: '0.7 MB' },
      { id: makeId('d', 14), category: 'AWARDS',         label: 'Awards, Decorations and Commendations',                                                                      status: 'COMPLETE',    dateUpdated: '2023-09-01', filedBy: 'Admin', fileSize: '1.0 MB' },
      { id: makeId('d', 15), category: 'FIREARMS',       label: 'Firearms Records',                           sublabel: 'Property Accountability Receipt (P.A.R)',            status: 'COMPLETE',    dateUpdated: '2024-01-10', filedBy: 'Admin', fileSize: '0.5 MB' },
      { id: makeId('d', 16), category: 'MEDICAL',        label: 'Latest Medical Records',                                                                                     status: 'EXPIRED',     dateUpdated: '2022-05-10', filedBy: 'Admin', remarks: 'Annual PE overdue' },
      { id: makeId('d', 17), category: 'CASES',          label: 'Cases / Offenses',                           sublabel: 'All administrative and criminal cases',              status: 'COMPLETE',    dateUpdated: '2024-01-10', filedBy: 'Admin' },
      { id: makeId('d', 18), category: 'LEAVE',          label: 'Leave Records',                                                                                              status: 'COMPLETE',    dateUpdated: '2024-01-10', filedBy: 'Admin' },
      { id: makeId('d', 19), category: 'PAY_RECORDS',    label: 'RCA / Longevity Pay Orders',                 sublabel: 'All pay orders',                                     status: 'COMPLETE',    dateUpdated: '2023-12-01', filedBy: 'Admin' },
      { id: makeId('d', 20), category: 'PAY_RECORDS',    label: 'Latest Per FM Previous Unit',                                                                                 status: 'COMPLETE',    dateUpdated: '2023-12-01', filedBy: 'Admin' },
      { id: makeId('d', 21), category: 'FINANCIAL',      label: 'SALN',                                       sublabel: 'Statement of Assets, Liabilities & Net Worth',       status: 'FOR_UPDATE',  dateUpdated: '2023-01-15', filedBy: 'Admin', remarks: '2024 SALN pending' },
      { id: makeId('d', 22), category: 'TAXATION',       label: 'Individual Income Tax Return (ITR)',          sublabel: 'Latest filed ITR',                                   status: 'COMPLETE',    dateUpdated: '2023-04-15', filedBy: 'Admin' },
      { id: makeId('d', 23), category: 'TAXATION',       label: 'Photocopy of Tax Identification Card (TIN)',                                                                  status: 'COMPLETE',    dateUpdated: '2010-06-15', filedBy: 'Admin' },
      { id: makeId('d', 24), category: 'IDENTIFICATION', label: '1 PC Latest 2x2 ID Picture',                 sublabel: 'GOA Type A Uniform',                                status: 'COMPLETE',    dateUpdated: '2024-01-10', filedBy: 'Admin' },
    ],
  },
  {
    id: 'p201-2',
    name: 'Ana Santos',
    rank: 'P/Maj.',
    serialNo: 'PN-2015-0047',
    unit: 'PDMU',
    dateCreated: '2015-09-01',
    lastUpdated: '2024-01-08',
    initials: 'AS',
    avatarColor: '#3b63b8',
    documents: blankChecklist().map((d, i) => ({
      ...d,
      id: makeId('as', i + 1),
      status: i < 10 ? 'COMPLETE' : i < 15 ? 'FOR_UPDATE' : 'MISSING',
      dateUpdated: i < 10 ? '2024-01-08' : '',
      filedBy: i < 10 ? 'Admin' : undefined,
    })),
  },
  {
    id: 'p201-3',
    name: 'Jose Reyes',
    rank: 'P/Insp.',
    serialNo: 'PN-2019-0093',
    unit: 'PCADU',
    dateCreated: '2019-03-15',
    lastUpdated: '2024-01-05',
    initials: 'JR',
    avatarColor: '#8b5cf6',
    documents: blankChecklist().map((d, i) => ({
      ...d,
      id: makeId('jr', i + 1),
      status: i < 6 ? 'COMPLETE' : i < 12 ? 'MISSING' : 'FOR_UPDATE',
      dateUpdated: i < 6 ? '2024-01-05' : '',
      filedBy: i < 6 ? 'Admin' : undefined,
    })),
  },
]

// ── Checklist category labels ─────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL_DATA:  'Personal Data Sheet',
  CIVIL_DOCUMENTS:'Civil Documents',
  ACADEMIC:       'Academic Records',
  ELIGIBILITY:    'Eligibilities',
  ASSIGNMENTS:    'Assignment & Service Records',
  SPECIAL_ORDERS: 'Appointment / Special Orders',
  TRAINING:       'Training & Seminars',
  AWARDS:         'Awards & Commendations',
  PROMOTIONS:     'Promotions & Demotions',
  FIREARMS:       'Firearms Records',
  MEDICAL:        'Medical Records',
  CASES:          'Cases & Offenses',
  LEAVE:          'Leave Records',
  PAY_RECORDS:    'Pay Records',
  FINANCIAL:      'Financial Disclosures',
  TAXATION:       'Tax Documents',
  IDENTIFICATION: 'Identification',
}
