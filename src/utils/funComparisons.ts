// Turns a dry number into a relatable "ciekawostka" — the user loves these. e.g. 202k
// steps → "tyle co z Lublina do Rzeszowa piechotą". Used on the Wrapped cards, the
// achievements/trophies, and the fun-facts widget.

const STEP_M = 0.762; // average step length in metres

// Walking-relatable distances, smallest → largest. Each is something you'd "walk".
const DISTANCES: { km: number; label: string }[] = [
  { km: 5,     label: 'spacer przez całe miasto' },
  { km: 10.5,  label: 'bieg na 10 km' },
  { km: 21.1,  label: 'półmaraton' },
  { km: 42.2,  label: 'maraton' },
  { km: 90,    label: 'z Rzeszowa do Krakowa' },
  { km: 150,   label: 'z Lublina do Rzeszowa' },
  { km: 300,   label: 'z Rzeszowa do Warszawy' },
  { km: 650,   label: 'przez całą Polskę (z północy na południe)' },
  { km: 1047,  label: 'cała długość Wisły' },
  { km: 3500,  label: 'z Polski do Egiptu' },
  { km: 40075, label: 'raz dookoła Ziemi' },
];

// steps → "≈ tyle co <landmark>" (or a multiple of it). Empty string below ~1 km.
export function stepsToDistanceFact(steps: number): string {
  const km = (steps * STEP_M) / 1000;
  if (km < 1) return '';
  // largest landmark that fits at least once
  let pick = DISTANCES[0];
  for (const d of DISTANCES) if (km >= d.km) pick = d;
  const times = km / pick.km;
  const kmTxt = km >= 100 ? Math.round(km).toLocaleString('pl-PL') : km.toFixed(1).replace('.', ',');
  if (times >= 1.8) return `${kmTxt} km piechotą — ${times.toFixed(1).replace('.', ',')}× ${pick.label}`;
  return `${kmTxt} km piechotą — prawie tyle co ${pick.label}`;
}

// spend → relatable everyday things it could buy (kept light + a bit cheeky).
export function spendToFact(zl: number): string {
  if (zl < 20) return '';
  const coffees = Math.round(zl / 16);      // ~16 zł a coffee
  const kebabs = Math.round(zl / 25);       // ~25 zł a kebab
  if (zl >= 2000) return `${coffees.toLocaleString('pl-PL')} kaw na mieście`;
  if (kebabs >= 3) return `${kebabs} kebab${kebabs === 1 ? '' : 'y'}`;
  return `${coffees} kaw`;
}

// total sweets/snacks weight (kg) → a relatable mass. Optional, for sweet-heavy months.
export function kgToFact(kg: number): string {
  if (kg < 0.5) return '';
  if (kg >= 4) return `${kg.toFixed(1).replace('.', ',')} kg — jak spory arbuz`;
  return `${(kg * 1000).toFixed(0)} g cukru i przekąsek`;
}
