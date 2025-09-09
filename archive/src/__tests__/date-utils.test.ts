import { 
  getUTCDateKey, 
  getLocalDateKey,
  getTodayUTCDateKey,
  getTodayLocalDateKey,
  formatDateName, 
  isSameUTCDay, 
  safeParseDate,
  isValidUTCDateKey 
} from '../utils/date-utils';

describe('Date Utils', () => {
  describe('getUTCDateKey', () => {
    it('should extract UTC date string in YYYY-MM-DD format', () => {
      const date = new Date('2025-08-26T14:30:00.000Z');
      expect(getUTCDateKey(date)).toBe('2025-08-26');
    });

    it('should handle timezone edge cases consistently', () => {
      // Near midnight in different timezones should still give UTC date
      const nearMidnightUTC = new Date('2025-08-26T00:01:00.000Z');
      const lateNightLocal = new Date('2025-08-25T23:59:00-05:00'); // EST timezone
      
      expect(getUTCDateKey(nearMidnightUTC)).toBe('2025-08-26');
      expect(getUTCDateKey(lateNightLocal)).toBe('2025-08-26'); // Should be same UTC day
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      expect(getUTCDateKey(invalidDate)).toBe('unknown');
    });
  });

  describe('getLocalDateKey', () => {
    it('should extract local date string in YYYY-MM-DD format', () => {
      const date = new Date('2025-08-26T14:30:00.000Z');
      const result = getLocalDateKey(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle timezone edge cases by using local date', () => {
      // Create a date that's on different local vs UTC days
      const lateNightLocal = new Date('2025-08-26T05:30:00.000Z'); // This might be Aug 25 local time
      const result = getLocalDateKey(lateNightLocal);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // The exact result depends on system timezone, but format should be consistent
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      expect(getLocalDateKey(invalidDate)).toBe('unknown');
    });
  });

  describe('getTodayUTCDateKey', () => {
    it('should return today\'s date in YYYY-MM-DD format', () => {
      const result = getTodayUTCDateKey();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Should match manual calculation
      const expected = new Date().toISOString().split('T')[0];
      expect(result).toBe(expected);
    });
  });

  describe('getTodayLocalDateKey', () => {
    it('should return today\'s local date in YYYY-MM-DD format', () => {
      const result = getTodayLocalDateKey();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Should match manual calculation
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });

  describe('formatDateName', () => {
    beforeAll(() => {
      // Mock Date.now to have consistent tests
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-08-26T15:00:00.000Z'));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should format today as "Today"', () => {
      const todayKey = '2025-08-26'; // Matches mocked system time
      expect(formatDateName(todayKey)).toBe('Today');
    });

    it('should format yesterday as "Yesterday"', () => {
      const yesterdayKey = '2025-08-25'; // Day before mocked system time
      expect(formatDateName(yesterdayKey)).toBe('Yesterday');
    });

    it('should format other dates as weekday names', () => {
      const fridayKey = '2025-08-22'; // Should be a Friday
      expect(formatDateName(fridayKey)).toBe('Friday');
    });

    it('should handle invalid date keys gracefully', () => {
      expect(formatDateName('invalid-date')).toBe('invalid-date');
      expect(formatDateName('')).toBe('');
    });
  });

  describe('isSameUTCDay', () => {
    it('should return true for dates on the same UTC day', () => {
      const morning = new Date('2025-08-26T08:00:00.000Z');
      const evening = new Date('2025-08-26T20:00:00.000Z');
      expect(isSameUTCDay(morning, evening)).toBe(true);
    });

    it('should return false for dates on different UTC days', () => {
      const today = new Date('2025-08-26T08:00:00.000Z');
      const tomorrow = new Date('2025-08-27T08:00:00.000Z');
      expect(isSameUTCDay(today, tomorrow)).toBe(false);
    });

    it('should handle timezone edge cases correctly', () => {
      const endOfDayEST = new Date('2025-08-26T23:59:00-05:00'); // 04:59 UTC next day
      const startOfDayPST = new Date('2025-08-27T00:01:00-08:00'); // 08:01 UTC same day
      
      // These are on the same UTC day (Aug 27)
      expect(isSameUTCDay(endOfDayEST, startOfDayPST)).toBe(true);
    });
  });

  describe('safeParseDate', () => {
    it('should parse valid ISO date strings', () => {
      const result = safeParseDate('2025-08-26T15:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-08-26T15:30:00.000Z');
    });

    it('should parse valid date strings', () => {
      const result = safeParseDate('2025-08-26');
      expect(result).toBeInstanceOf(Date);
      expect(getUTCDateKey(result)).toBe('2025-08-26');
    });

    it('should return current date for invalid strings', () => {
      const before = new Date();
      const result = safeParseDate('invalid-date-string');
      const after = new Date();
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('isValidUTCDateKey', () => {
    it('should validate correct YYYY-MM-DD format', () => {
      expect(isValidUTCDateKey('2025-08-26')).toBe(true);
      expect(isValidUTCDateKey('2000-01-01')).toBe(true);
      expect(isValidUTCDateKey('2099-12-31')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidUTCDateKey('25-08-26')).toBe(false); // Wrong year format
      expect(isValidUTCDateKey('2025-8-26')).toBe(false); // Missing zero padding
      expect(isValidUTCDateKey('2025/08/26')).toBe(false); // Wrong separator
      expect(isValidUTCDateKey('invalid')).toBe(false);
      expect(isValidUTCDateKey('')).toBe(false);
    });
  });

  describe('Real-world timezone scenarios', () => {
    it('should handle memories created at different times on same local day', () => {
      // Scenario: User creates 3 checkpoints on same calendar day in EST timezone
      const morning = new Date('2025-08-26T09:00:00-05:00'); // 14:00 UTC
      const afternoon = new Date('2025-08-26T15:00:00-05:00'); // 20:00 UTC  
      const lateNight = new Date('2025-08-26T23:45:00-05:00'); // 04:45 UTC next day!
      
      const morningKey = getUTCDateKey(morning);
      const afternoonKey = getUTCDateKey(afternoon);
      const lateNightKey = getUTCDateKey(lateNight);
      
      // The late night one will be on the next UTC day
      expect(morningKey).toBe('2025-08-26');
      expect(afternoonKey).toBe('2025-08-26');
      expect(lateNightKey).toBe('2025-08-27'); // This is the timezone challenge!
      
      // This is EXPECTED behavior - UTC grouping prevents ambiguity
      expect(morningKey).not.toBe(lateNightKey);
    });
  });
});