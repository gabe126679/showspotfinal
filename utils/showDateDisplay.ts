// Simple utility to ensure show dates are displayed consistently
// This prevents any timezone conversion issues

export const displayShowDate = (showDate: string | null | undefined, preferredDate: string | null | undefined): string => {
  const dateToDisplay = showDate || preferredDate;
  
  if (!dateToDisplay) return 'Date TBD';
  
  // If the date string is already in YYYY-MM-DD format, just return it as is
  // This prevents any timezone conversion issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateToDisplay)) {
    return dateToDisplay;
  }
  
  // If it has time information, extract just the date part
  return dateToDisplay.split('T')[0];
};

export const formatShowDateTime = (showDate: string | null | undefined, showTime: string | null | undefined, preferredDate?: string | null, preferredTime?: string | null): string => {
  const date = displayShowDate(showDate, preferredDate);
  const time = showTime || preferredTime;
  
  if (time) {
    return `${date} at ${time}`;
  }
  
  return date;
};