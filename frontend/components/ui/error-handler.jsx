import React from 'react';
import { toast } from 'react-hot-toast';

export const handleError = (error, fallbackMessage = 'An error occurred') => {
  console.error('Error handled:', error);
  
  let message = fallbackMessage;
  
  if (error?.message) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error?.response?.data?.message) {
    message = error.response.data.message;
  } else if (error?.response?.statusText) {
    message = error.response.statusText;
  }
  
  toast.error(message);
  return message;
};

export const handleSuccess = (message) => {
  toast.success(message);
};

export const handleWarning = (message) => {
  toast.warning(message);
};

export const handleInfo = (message) => {
  toast.info(message);
};
