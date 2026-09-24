import fs from 'fs';
import path from 'path';

const sqlPath = path.resolve('nadar_tms (12).sql');
const content = fs.readFileSync(sqlPath, 'utf8');

// Institutions mapping
const INSTITUTIONS = [
  {
    id: '1',
    name: 'Nadar Saraswathi College of Engineering & Technology (NSCET)',
    type: 'college',
    code: 'NSCET',
    city: 'Vadapudupatti, Theni'
  },
  {
    id: '2',
    name: 'Nadar Saraswathi College of Arts & Science (NSCAS)',
    type: 'college',
    code: 'NSCAS',
    city: 'Vadapudupatti, Theni'
  },
  {
    id: '3',
    name: 'T.M.H.N.U. Matriculation Higher Secondary School',
    type: 'school',
    code: 'TMHNU-MHSS',
    city: 'Theni'
  },
  {
    id: '7',
    name: 'T.M.H.N.U. Nadar Saraswathi Higher Secondary School',
    type: 'school',
    code: 'TMHNU-NSHSS',
    city: 'Vadapudupatti, Theni'
  },
  {
    id: '8',
    name: 'T.M.H.N.U. Public School (CBSE)',
    type: 'school',
    code: 'TMHNU-PS',
    city: 'Theni'
  },
  {
    id: '9',
    name: 'T.M.H.N.U. Vidhyalaya Matriculation Higher Secondary School',
    type: 'school',
    code: 'TMHNU-VIDH',
    city: 'Theni'
  }
];

// Parse routes
const routesRegex = /\((\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([0-9.]+),\s*(\d+|NULL),\s*'([^']+)',\s*(NULL|'[^']*'),\s*(NULL|'[^']*')\)/g;
const routesMap = new Map();
let rMatch;
while ((rMatch = routesRegex.exec(content)) !== null) {
  const [_, id, routeCode, routeName, origin, destination, totalDistance, institutionId, shift, initialPoint, initialTime] = rMatch;
  routesMap.set(id, {
    id: String(id),
    routeNumber: routeCode.trim(),
    name: routeName.trim(),
    origin: origin.trim(),
    destination: destination.trim(),
    distance: parseFloat(totalDistance) || 0,
    institutionId: institutionId !== 'NULL' ? String(institutionId) : null,
    shift: shift.trim(),
    timing: initialTime && initialTime !== 'NULL' ? initialTime.replace(/'/g, '').trim() : '08:00 AM',
    stops: []
  });
}

// Parse stops
const stopsRegex = /\((\d+),\s*(\d+),\s*'([^']+)',\s*(\d+),\s*(NULL|'[^']*'),\s*(NULL|[0-9.]+),\s*(NULL|[0-9.]+)\)/g;
let sMatch;
let totalStops = 0;
while ((sMatch = stopsRegex.exec(content)) !== null) {
  const [_, id, routeId, stopName, sequence, scheduledTime, lat, lng] = sMatch;
  const route = routesMap.get(routeId);
  if (route) {
    route.stops.push({
      id: String(id),
      name: stopName.trim(),
      sequence: parseInt(sequence, 10),
      time: scheduledTime && scheduledTime !== 'NULL' ? scheduledTime.replace(/'/g, '').trim() : null
    });
    totalStops++;
  }
}

// Sort stops by sequence
for (const route of routesMap.values()) {
  route.stops.sort((a, b) => a.sequence - b.sequence);
}

const routesArray = Array.from(routesMap.values()).map(r => ({
  id: r.id,
  routeNumber: r.routeNumber,
  name: r.name,
  origin: r.origin,
  destination: r.destination,
  distance: r.distance,
  institutionId: r.institutionId,
  shift: r.shift,
  timing: r.timing,
  stops: r.stops.map(s => s.name)
}));

console.log('Institutions:', INSTITUTIONS.length);
console.log('Routes parsed:', routesArray.length);
console.log('Total Stops attached:', totalStops);

const outputCode = `// Generated directly from nadar_tms (12).sql
import { Institution, BusRoute } from '../types';

export const INSTITUTIONS: Institution[] = ${JSON.stringify(INSTITUTIONS, null, 2)};

export const BUS_ROUTES: BusRoute[] = ${JSON.stringify(routesArray, null, 2)};

export const COLLEGE_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Artificial Intelligence & Data Science',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Commerce (B.Com / M.Com)',
  'Business Administration (BBA / MBA)',
  'English Literature',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biotechnology',
  'Computer Applications (BCA / MCA)',
];

export const COLLEGE_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
];

export const SCHOOL_CLASSES = [
  'Pre-KG',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

export const SCHOOL_SECTIONS = [
  'Section A',
  'Section B',
  'Section C',
  'Section D',
  'Section E',
];
`;

fs.writeFileSync('src/data/mockData.ts', outputCode, 'utf8');
console.log('Successfully generated src/data/mockData.ts from nadar_tms (12).sql');
