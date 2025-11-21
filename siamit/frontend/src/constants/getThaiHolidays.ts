import Holidays from 'date-holidays';

// Holiday name mapping to i18n keys
const holidayNameMapping: { [key: string]: string } = {
  "New Year's Day": "holidays.newYearsDay",
  "Children's Day": "holidays.childrensDay",
  "Makha Bucha": "holidays.makhaBucha",
  "Chakri Memorial Day": "holidays.chakriMemorialDay",
  "Songkran Festival": "holidays.songkranFestival",
  "Labour Day": "holidays.labourDay",
  "Coronation Day": "holidays.coronationDay",
  "Royal Ploughing Ceremony": "holidays.royalPloughingCeremony",
  "Vesak Day": "holidays.visakhaBucha",
  "Asalha Puja": "holidays.asalhaPuja",
  "Buddhist Lent": "holidays.buddhistLent",
  "Queen Suthida's Birthday": "holidays.queenBirthday",
  "The Queen Mother's Birthday": "holidays.mothersDay",
  "King Bhumibol Adulyadej Memorial Day": "holidays.kingBhumibolMemorialDay",
  "King Chulalongkorn Day": "holidays.kingChulalongkornDay",
  "King's Birthday": "holidays.kingsBirthday",
  "End of Buddhist Lent": "holidays.endOfBuddhistLent",
  "Chulalongkorn Day": "holidays.chulalongkornDay",
  "Loy Krathong": "holidays.loyKrathong",
  "King Bhumibol Adulyadej's Birthday": "holidays.fathersDay",
  "Constitution Day": "holidays.constitutionDay",
  "New Year's Eve": "holidays.newYearsEve",
  "Christmas Day": "holidays.christmasDay",
  "Christmas Eve": "holidays.christmasEve",
  "Valentine's Day": "holidays.valentinesDay",
  "Halloween": "holidays.halloween",
  "Easter": "holidays.easter",
  "Good Friday": "holidays.goodFriday",
  "Easter Monday": "holidays.easterMonday",
  // Add alternative names for the same holidays
  "National Labour Day": "holidays.labourDay",
  "International Workers' Day": "holidays.labourDay",
  "May Day": "holidays.labourDay",
};

// Function to get translated holiday name using i18n
function getTranslatedHolidayName(holidayName: string, t: (key: string) => string): string {
  const i18nKey = holidayNameMapping[holidayName];
  return i18nKey ? t(i18nKey) : holidayName;
}

// Function to add missing holidays that might not be in the date-holidays library
function addMissingHolidays(holidays: any[], year: number): any[] {
  const missingHolidays = [];
  
  // Add Labour Day (May 1st) if not present
  const labourDay = holidays.find(h => {
    const date = new Date(h.date);
    return date.getMonth() === 4 && date.getDate() === 1; // May 1st
  });
  
  if (!labourDay) {
    missingHolidays.push({
      date: `${year}-05-01`,
      name: "Labour Day",
      type: "public"
    });
  }
  
  // Combine and sort by date
  const allHolidays = [...holidays, ...missingHolidays];
  return allHolidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getUpcomingThaiHolidays(count = 3, t: (key: string) => string) {
  const hd = new Holidays('TH');
  const all = hd.getHolidays(new Date().getFullYear());
  const year = new Date().getFullYear();
  
  // Add missing holidays and sort by date
  const allWithMissing = addMissingHolidays(all, year);
  
  const today = new Date();
  // กรองเฉพาะวันหยุดที่ยังไม่ถึง
  const upcoming = allWithMissing
    .filter(h => new Date(h.date) >= today)
    .slice(0, count)
    .map(h => ({
      ...h,
      name: getTranslatedHolidayName(h.name, t)
    }));
  return upcoming;
}

export function getThaiHolidaysByMonth(year: number, month: number, t: (key: string) => string) {
  const hd = new Holidays('TH');
  const all = hd.getHolidays(year);
  
  // Add missing holidays and sort by date
  const allWithMissing = addMissingHolidays(all, year);
  
  return allWithMissing
    .filter(h => new Date(h.date).getMonth() === month)
    .map(h => ({
      ...h,
      name: getTranslatedHolidayName(h.name, t)
    }));
}

// Function to get all holidays for a year with translation
export function getAllThaiHolidays(year: number, t: (key: string) => string) {
  const hd = new Holidays('TH');
  const all = hd.getHolidays(year);
  
  // Add missing holidays and sort by date
  const allWithMissing = addMissingHolidays(all, year);
  
  return allWithMissing.map(h => ({
    ...h,
    name: getTranslatedHolidayName(h.name, t)
  }));
}

// Function to get holidays by date range with translation
export function getThaiHolidaysByDateRange(startDate: Date, endDate: Date, t: (key: string) => string) {
  const hd = new Holidays('TH');
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  let allHolidays = [];
  
  // Get holidays for all years in range
  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = hd.getHolidays(year);
    allHolidays = allHolidays.concat(yearHolidays);
  }
  
  return allHolidays
    .filter(h => {
      const holidayDate = new Date(h.date);
      return holidayDate >= startDate && holidayDate <= endDate;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(h => ({
      ...h,
      name: getTranslatedHolidayName(h.name, t)
    }));
} 