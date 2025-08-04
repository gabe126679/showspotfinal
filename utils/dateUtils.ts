// Utility function to format dates without timezone conversion
export const formatShowDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Date TBD';
  
  // Parse the date string and extract year, month, day
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Return in MM/DD/YYYY format
  return `${month}/${day}/${year}`;
};

// Alternative: Parse as UTC and display in local format
export const formatShowDateUTC = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Date TBD';
  
  // Add 'T00:00:00Z' if the date string doesn't include time
  const utcDateString = dateString.includes('T') ? dateString : `${dateString}T00:00:00Z`;
  const date = new Date(utcDateString);
  
  // Use UTC methods to get the date components
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  // Return in MM/DD/YYYY format
  return `${month}/${day}/${year}`;
};