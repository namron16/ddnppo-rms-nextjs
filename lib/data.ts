// lib/data.ts
// ─────────────────────────────────────────────
// All mock/seed data for the DDNPPO RMS prototype.
// In production, replace with API calls.

import type {
  User, MasterDocument, SpecialOrder,
  JournalEntry, ConfidentialDoc, LibraryItem,
  ActivityLog, OrgNode
} from '@/types'

/* ════════════════════════════════════════════
   USERS
════════════════════════════════════════════ */
export const USERS: User[] = [
  {
    id: '1',
    name: 'Ramon Dela Cruz',
    email: 'rdelacruz@ddnppo.gov.ph',
    role: 'admin',
    initials: 'RD',
    avatarColor: '#f0b429',
  },
  {
    id: '2',
    name: 'Ana Santos',
    email: 'asantos@ddnppo.gov.ph',
    role: 'officer',
    initials: 'AS',
    avatarColor: '#3b63b8',
  },
  {
    id: '3',
    name: 'Jose Reyes',
    email: 'jreyes@ddnppo.gov.ph',
    role: 'officer',
    initials: 'JR',
    avatarColor: '#8b5cf6',
  },
]

/* ════════════════════════════════════════════
   MASTER DOCUMENTS
════════════════════════════════════════════ */
export const MASTER_DOCUMENTS: MasterDocument[] = [
  {
    id: 'md-1',
    title: 'RO XI General Circular No. 2024-01',
    level: 'REGIONAL',
    date: '2024-01-15',
    type: 'PDF',
    size: '0.8 MB',
    tag: 'COMPLIANCE',
    children: [
      {
        id: 'md-2',
        title: 'DDNPPO Provincial Implementation Order 2024-01',
        level: 'PROVINCIAL',
        date: '2024-01-20',
        type: 'PDF',
        size: '1.2 MB',
        tag: 'COMPLIANCE',
        children: [
          {
            id: 'md-3',
            title: 'Tagum City PS Compliance Order',
            level: 'STATION',
            date: '2024-01-25',
            type: 'PDF',
            size: '0.8 MB',
            tag: 'COMPLIANCE',
          },
          {
            id: 'md-4',
            title: 'Panabo City PS Compliance Order',
            level: 'STATION',
            date: '2024-01-26',
            type: 'PDF',
            size: '0.7 MB',
            tag: 'COMPLIANCE',
          },
        ],
      },
    ],
  },
  {
    id: 'md-5',
    title: 'RO XI Memorandum Circular No. 2024-05',
    level: 'REGIONAL',
    date: '2024-02-03',
    type: 'PDF',
    size: '1.1 MB',
    tag: 'REGIONAL',
    children: [
      {
        id: 'md-6',
        title: 'DDNPPO Compliance Report Q1 2024',
        level: 'PROVINCIAL',
        date: '2024-02-10',
        type: 'PDF',
        size: '2.1 MB',
        tag: 'PROVINCIAL',
      },
    ],
  },
  {
    id: 'md-7',
    title: 'RO XI Directive on Community Policing 2024',
    level: 'REGIONAL',
    date: '2024-03-01',
    type: 'PDF',
    size: '0.9 MB',
    tag: 'REGIONAL',
  },
]

/* ════════════════════════════════════════════
   SPECIAL ORDERS
════════════════════════════════════════════ */
export const SPECIAL_ORDERS: SpecialOrder[] = [
  {
    id: 'so-1',
    reference: 'SO No. 2024-101',
    subject: 'Designation of Officers – Q1',
    date: '2024-01-10',
    attachments: 3,
    status: 'ACTIVE',
  },
  {
    id: 'so-2',
    reference: 'SO No. 2024-089',
    subject: 'Transfer of Assignment – Tagum CPS',
    date: '2024-01-05',
    attachments: 1,
    status: 'ACTIVE',
  },
  {
    id: 'so-3',
    reference: 'SO No. 2023-244',
    subject: 'Promotion of Personnel – Dec 2023',
    date: '2023-12-15',
    attachments: 2,
    status: 'ARCHIVED',
  },
]

/* ════════════════════════════════════════════
   DAILY JOURNALS
════════════════════════════════════════════ */
export const JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'j-1',
    title: 'Daily Operations Update – 15 Mar',
    type: 'MEMO',
    author: 'P/Col. Dela Cruz',
    date: '2024-03-15',
  },
  {
    id: 'j-2',
    title: 'Morning Formation Report',
    type: 'REPORT',
    author: 'P/Maj. Santos',
    date: '2024-03-14',
  },
  {
    id: 'j-3',
    title: 'Crime Prevention Activity Log – 13 Mar',
    type: 'LOG',
    author: 'P/Insp. Reyes',
    date: '2024-03-13',
  },
]

/* ════════════════════════════════════════════
   CONFIDENTIAL DOCUMENTS
════════════════════════════════════════════ */
export const CONFIDENTIAL_DOCS: ConfidentialDoc[] = [
  {
    id: 'cd-1',
    title: 'Intelligence Report Alpha-7',
    classification: 'RESTRICTED',
    date: '2024-03-10',
    access: 'All w/ Password',
  },
  {
    id: 'cd-2',
    title: 'Personnel Investigation Report – Santos',
    classification: 'CONFIDENTIAL',
    date: '2024-02-28',
    access: 'Admin Only',
  },
]

/* ════════════════════════════════════════════
   LIBRARY
════════════════════════════════════════════ */
export const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'lib-1',
    title: 'PNP Patrol Manual 2023',
    category: 'MANUAL',
    size: '12.4 MB',
    dateAdded: '2023-06-01',
  },
  {
    id: 'lib-2',
    title: 'Anti-VAWC Guidelines',
    category: 'GUIDELINE',
    size: '3.2 MB',
    dateAdded: '2023-09-15',
  },
  {
    id: 'lib-3',
    title: 'Crime Prevention Templates Pack',
    category: 'TEMPLATE',
    size: '1.8 MB',
    dateAdded: '2024-01-10',
  },
]

/* ════════════════════════════════════════════
   ACTIVITY LOGS
════════════════════════════════════════════ */
export const ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    user: 'P/Maj. Ana Santos',
    userInitials: 'PA',
    userColor: '#3b82f6',
    action: 'Viewed',
    document: 'DDNPPO Provincial Implementation Order',
    date: '2024-03-15',
    time: '09:24 AM',
    device: 'Desktop / Chrome',
  },
  {
    id: 'log-2',
    user: 'P/Insp. Jose Reyes',
    userInitials: 'RJ',
    userColor: '#8b5cf6',
    action: 'Downloaded',
    document: 'SO No. 2024-101',
    date: '2024-03-15',
    time: '08:55 AM',
    device: 'Mobile / Safari',
  },
  {
    id: 'log-3',
    user: 'P/Maj. Ana Santos',
    userInitials: 'PA',
    userColor: '#3b82f6',
    action: 'Forwarded',
    document: 'Daily Operations Update',
    date: '2024-03-14',
    time: '11:03 AM',
    device: 'Desktop / Chrome',
  },
  {
    id: 'log-4',
    user: 'P/Col. Ramon Dela Cruz',
    userInitials: 'PR',
    userColor: '#f0b429',
    action: 'Viewed',
    document: 'Intelligence Report Alpha-7',
    date: '2024-03-13',
    time: '02:15 PM',
    device: 'Tablet / Edge',
  },
  {
    id: 'log-5',
    user: 'P/Insp. Jose Reyes',
    userInitials: 'RJ',
    userColor: '#8b5cf6',
    action: 'Downloaded',
    document: 'RO XI General Circular No. 2024-01',
    date: '2024-03-12',
    time: '10:20 AM',
    device: 'Desktop / Firefox',
  },
]

/* ════════════════════════════════════════════
   ORG CHART
════════════════════════════════════════════ */
export const ORG_CHART: OrgNode = {
  id: 'org-1',
  initials: 'RD',
  rank: 'Police Colonel',
  name: 'P/Col. Ramon Dela Cruz',
  title: 'Provincial Director',
  unit: 'DDNPPO',
  color: '#f0b429',
  children: [
    {
      id: 'org-2',
      initials: 'SY',
      rank: 'Police Captain',
      name: 'P/Capt. Sara Yap',
      title: 'PCADU Unit Chief',
      unit: 'PCADU',
      color: '#6366f1',
      children: [
        {
          id: 'org-5',
          initials: 'LT',
          rank: 'Police Inspector',
          name: 'P/Insp. Leo Tan',
          title: 'PIO Officer',
          unit: 'PCADU',
          color: '#059669',
        },
        {
          id: 'org-6',
          initials: 'MR',
          rank: 'Police Inspector',
          name: 'P/Insp. Mia Reyes',
          title: 'FJGAD Officer',
          unit: 'PCADU',
          color: '#d97706',
        },
      ],
    },
    {
      id: 'org-3',
      initials: 'JS',
      rank: 'Police Captain',
      name: 'P/Capt. Jun Santos',
      title: 'PDMU Unit Chief',
      unit: 'PDMU',
      color: '#3b63b8',
      children: [
        {
          id: 'org-7',
          initials: 'AD',
          rank: 'Police Inspector',
          name: 'P/Insp. Ana Dela Cruz',
          title: 'WCPD Officer',
          unit: 'PDMU',
          color: '#7c3aed',
        },
      ],
    },
    {
      id: 'org-4',
      initials: 'DL',
      rank: 'Police Major',
      name: 'P/Maj. Dan Lim',
      title: 'PPPU Unit Chief',
      unit: 'PPPU',
      color: '#0891b2',
    },
  ],
}
