import fs from 'fs';

const content = fs.readFileSync('src/data/mockData.ts', 'utf8');
const lines = content.split('\n');

let currentRoute = {};
const allRoutes = [];

lines.forEach((line) => {
  if (line.includes('"routeNumber":')) {
    currentRoute.routeNumber = line.split(':')[1].replace(/["',]/g, '').trim();
  }
  if (line.includes('"institutionId":')) {
    currentRoute.institutionId = line.split(':')[1].replace(/["',]/g, '').trim();
  }
  if (line.includes('"name":') && !currentRoute.name) {
    currentRoute.name = line.split(':')[1].replace(/["',]/g, '').trim();
  }
  if (line.includes('stops": [')) {
    if (currentRoute.routeNumber) {
      allRoutes.push({ ...currentRoute });
      currentRoute = {};
    }
  }
});

console.log('Total routes found:', allRoutes.length);
const engRoutes = allRoutes.filter(r => r.institutionId === '1' || r.routeNumber.includes('101') || r.routeNumber.startsWith('ROUTE 1'));
console.log('Engineering routes count:', engRoutes.length);
engRoutes.forEach(r => console.log(`${r.routeNumber} - ${r.name} (institutionId: ${r.institutionId})`));
