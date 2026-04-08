import { addDays } from '../utils/dates';

// Official VIC public holiday data from business.vic.gov.au
// We define long weekends / camping-friendly periods around each holiday

const HOLIDAYS_BY_YEAR = {
  2026: [
    { name: 'Australia Day',    date: '2026-01-24', nights: 3, desc: '1/24(Sat) → 1/27(Mon)' },
    { name: 'Labour Day',       date: '2026-03-07', nights: 3, desc: '3/7(Sat) → 3/10(Mon)' },
    { name: 'Easter',           date: '2026-04-03', nights: 4, desc: '4/3(Fri) → 4/7(Mon)' },
    { name: "King's Birthday",  date: '2026-06-06', nights: 3, desc: '6/6(Sat) → 6/9(Mon)' },
    { name: 'AFL Grand Final',  date: '2026-09-25', nights: 3, desc: '9/25(Fri) → 9/28(Mon)' },
    { name: 'Melbourne Cup',    date: '2026-10-30', nights: 4, desc: '10/30(Fri) → 11/3(Tue)' },
    { name: 'Christmas',        date: '2026-12-25', nights: 4, desc: '12/25(Fri) → 12/29(Mon)' },
  ],
  2027: [
    { name: 'Australia Day',    date: '2027-01-23', nights: 3, desc: '1/23(Sat) → 1/26(Tue)' },
    { name: 'Labour Day',       date: '2027-03-06', nights: 3, desc: '3/6(Sat) → 3/9(Mon)' },
    { name: 'Easter',           date: '2027-03-26', nights: 4, desc: '3/26(Fri) → 3/30(Mon)' },
    { name: "King's Birthday",  date: '2027-06-12', nights: 3, desc: '6/12(Sat) → 6/15(Mon)' },
    { name: 'AFL Grand Final',  date: '2027-09-24', nights: 3, desc: '9/24(Fri) → 9/27(Mon)' },
    { name: 'Melbourne Cup',    date: '2027-10-29', nights: 4, desc: '10/29(Fri) → 11/2(Tue)' },
    { name: 'Christmas',        date: '2027-12-25', nights: 4, desc: '12/25(Sat) → 12/29(Wed)' },
  ],
};

// Show holidays within the next ~8 months (booking window)
export function getVicHolidays() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const maxDate = addDays(now, 240); // ~8 months
  const thisYear = now.getFullYear();

  // Gather this year + next year
  const allHols = [];
  for (const year of [thisYear, thisYear + 1]) {
    const hols = HOLIDAYS_BY_YEAR[year];
    if (hols) {
      allHols.push(...hols.map(h => ({ ...h, year })));
    }
  }

  // Filter: not fully past AND starts within booking window
  return allHols.filter(hol => {
    const end = addDays(new Date(hol.date + 'T00:00:00'), hol.nights);
    const start = new Date(hol.date + 'T00:00:00');
    return end >= now && start <= maxDate;
  });
}

export const VIC_HOLIDAYS_2026 = getVicHolidays();
