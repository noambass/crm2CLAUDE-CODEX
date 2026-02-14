// Form Validation Utilities

export const validatePhone = (phone) => {
  if (!phone) return { valid: false, error: 'טלפון הוא שדה חובה' };
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length !== 10) {
    return { valid: false, error: 'טלפון חייב להיות 10 ספרות' };
  }
  
  if (!cleaned.startsWith('05')) {
    return { valid: false, error: 'טלפון חייב להתחיל ב-05' };
  }
  
  return { valid: true, error: null };
};

export const validateEmail = (email) => {
  if (!email) return { valid: true, error: null }; // Email is optional
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!regex.test(email)) {
    return { valid: false, error: 'כתובת אימייל לא תקינה' };
  }
  
  return { valid: true, error: null };
};

export const validateTaxId = (taxId) => {
  if (!taxId) return { valid: true, error: null }; // Tax ID is optional
  
  const cleaned = taxId.replace(/\D/g, '');
  
  if (cleaned.length !== 9) {
    return { valid: false, error: 'ח.פ/ת.ז חייב להכיל 9 ספרות (ללא מקפים)' };
  }
  
  return { valid: true, error: null };
};

export const validateContactName = (name) => {
  if (!name) return { valid: false, error: 'שם הוא שדה חובה' };
  
  if (name.trim().length < 2) {
    return { valid: false, error: 'שם חייב להכיל לפחות 2 תווים' };
  }
  
  return { valid: true, error: null };
};

export const validateJobTitle = (title) => {
  if (!title) return { valid: false, error: 'כותרת היא שדה חובה' };
  
  if (title.trim().length < 3) {
    return { valid: false, error: 'כותרת חייבת להכיל לפחות 3 תווים' };
  }
  
  return { valid: true, error: null };
};