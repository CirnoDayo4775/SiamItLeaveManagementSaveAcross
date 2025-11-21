// Centralized Toast Service
// This file provides a centralized way to handle all toast notifications

import { toast } from '@/hooks/use-toast';
import { config } from '@/config';
import i18next from 'i18next';

// Toast variants (only allowed: 'default' | 'destructive')
export type ToastVariant = 'default' | 'destructive';

// Toast options interface
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

// Centralized toast service
export const showToast = {
  // Success toast (use 'default')
  success: (title: string, description?: string, duration?: number) => {
    return toast({
      title,
      description,
      variant: 'default',
      duration: duration || config.notifications.duration
    });
  },
  // Error toast (use 'destructive')
  error: (title: string, description?: string, duration?: number) => {
    return toast({
      title,
      description,
      variant: 'destructive',
      duration: duration || config.notifications.duration
    });
  },
  // Warning toast (map to 'destructive')
  warning: (title: string, description?: string, duration?: number) => {
    return toast({
      title,
      description,
      variant: 'destructive',
      duration: duration || config.notifications.duration
    });
  },
  // Info toast (map to 'default')
  info: (title: string, description?: string, duration?: number) => {
    return toast({
      title,
      description,
      variant: 'default',
      duration: duration || config.notifications.duration
    });
  },
  // Custom toast (only allow allowed variants)
  custom: (options: ToastOptions) => {
    const { title, description, variant = 'default', duration } = options;
    return toast({
      title,
      description,
      variant,
      duration
    });
  }
};

// Helper to get translation function (t)
function getT(t?: any) {
  return t || i18next.t.bind(i18next);
}

// Helper: map canonical item keys to localized labels
const resolveItemName = (itemName?: string, t?: any): string | undefined => {
  const _t = getT(t);
  if (!itemName) return undefined;
  if (!t) return itemName;
  switch (itemName) {
    case 'position':
      return _t('positions.position');
    case 'department':
      return _t('departments.departments');
    case 'leaveType':
      return _t('leave.leaveType');
    case 'announcement':
      return _t('companyNews.news');
    case 'user':
      return _t('common.user');
    default:
      return itemName; // already localized or custom
  }
};
export const toastMessages = {
  // Authentication
  auth: {
    loginSuccess: (name?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.loginSuccess'),
        description: name ? _t('auth.welcomeToSystem', { name }) : _t('auth.welcomeToSystem')
      };
    },
    loginError: (message?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.loginError'),
        description: message || _t('auth.enterEmailPassword')
      };
    },
    logoutSuccess: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.logoutSuccess'),
        description: _t('auth.logoutSuccess')
      };
    },
    sessionExpired: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.sessionExpired'),
        description: _t('auth.sessionExpiredDesc')
      };
    },
    tokenNotFound: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.tokenNotFound'),
        description: _t('auth.pleaseLoginAgain')
      };
    }
  },

  // CRUD operations
  crud: {
    createSuccess: (itemName?: string, t?: any) => {
      const _t = getT(t);
      const item = resolveItemName(itemName, _t) || _t('common.user');
      return {
        title: _t('system.createSuccess'),
        description: _t('system.createSuccessDesc', { itemName: item })
      };
    },
    createError: (itemName?: string, message?: string, t?: any) => {
      const _t = getT(t);
      const item = resolveItemName(itemName, _t) || _t('common.user');
      return {
        title: _t('system.createError'),
        description: message || _t('system.createErrorDesc', { itemName: item, message: '' })
      };
    },
    updateSuccess: (itemName?: string, t?: any) => {
      const _t = getT(t);
      const item = resolveItemName(itemName, _t) || _t('common.user');
      return {
        title: _t('system.updateSuccess'),
        description: _t('system.updateSuccessDesc', { itemName: item })
      };
    },
    updateError: (itemName?: string, message?: string, t?: any) => {
      const _t = getT(t);
      const item = resolveItemName(itemName, _t) || _t('common.user');
      return {
        title: _t('system.updateError'),
        description: message || _t('system.updateErrorDesc', { itemName: item, message: '' })
      };
    },
    deleteSuccess: (itemName?: string, t?: any) => {
      const _t = getT(t);
      const item = resolveItemName(itemName, _t) || _t('common.user');
      return {
        title: _t('system.deleteSuccess'),
        description: `${_t('common.delete')} ${item} ${_t('common.success')}`
      };
    },
    deleteError: (itemName?: string, message?: string, t?: any) => {
      const _t = getT(t);
      const item = resolveItemName(itemName, _t) || _t('common.user');
      return {
        title: _t('system.deleteError'),
        description: message || `${_t('common.delete')} ${item} ${_t('common.error')}`
      };
    },
    loadSuccess: (itemName?: string, t?: any) => {
      const _t = getT(t);
      const item = itemName ? resolveItemName(itemName, _t) : undefined;
      return {
        title: _t('system.loadSuccess'),
        description: item ? _t('system.loadSuccessDesc', { itemName: item }) : _t('system.loadSuccessDesc')
      };
    },
    loadError: (itemName?: string, message?: string, t?: any) => {
      const _t = getT(t);
      const item = itemName ? resolveItemName(itemName, _t) : undefined;
      return {
        title: _t('system.loadError'),
        description: message || (item ? _t('system.loadErrorDesc', { itemName: item }) : _t('system.loadErrorDesc'))
      };
    }
  },

  // Leave management
  leave: {
    requestSubmitted: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('leave.submitSuccess'),
        description: _t('leave.submitSuccessDesc')
      };
    },
    requestApproved: (employeeName?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('admin.approveSuccess'),
        description: employeeName ? _t('admin.approveSuccessDesc', { name: employeeName }) : _t('admin.approveSuccessDesc')
      };
    },
    requestRejected: (employeeName?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('admin.rejectSuccess'),
        description: employeeName ? _t('admin.rejectSuccessDesc', { name: employeeName }) : _t('admin.rejectSuccessDesc')
      };
    },
    requestError: (action: string, message?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: `${action}${_t('leave.submitError')}`,
        description: message || `${_t('leave.submitErrorDesc')}`
      };
    }
  },

  // File operations
  file: {
    uploadSuccess: (fileName?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('profile.uploadSuccess'),
        description: fileName ? _t('profile.uploadSuccessDesc', { fileName }) : _t('profile.uploadSuccessDesc')
      };
    },
    uploadError: (fileName?: string, message?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('profile.uploadError'),
        description: message || (fileName ? _t('profile.uploadErrorDesc', { fileName }) : _t('profile.uploadErrorDesc'))
      };
    },
    downloadSuccess: (fileName?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('file.downloadSuccess'),
        description: fileName ? _t('file.downloadSuccessDesc', { fileName }) : _t('file.downloadSuccessDesc')
      };
    },
    downloadError: (fileName?: string, message?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('file.downloadError'),
        description: message || (fileName ? _t('file.downloadErrorDesc', { fileName }) : _t('file.downloadErrorDesc'))
      };
    }
  },

  // Network errors
  network: {
    connectionError: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('admin.connectionError'),
        description: _t('admin.serverConnectionError')
      };
    },
    timeoutError: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('network.timeoutError'),
        description: _t('network.timeoutErrorDesc')
      };
    },
    serverError: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('network.serverError'),
        description: _t('network.serverErrorDesc')
      };
    }
  },

  // Validation
  validation: {
    requiredField: (fieldName?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('validation.requiredField'),
        description: fieldName ? _t('validation.requiredFieldDesc', { fieldName }) : _t('validation.requiredFieldDesc')
      };
    },
    invalidFormat: (fieldName?: string, t?: any) => {
      const _t = getT(t);
      return {
        title: _t('validation.invalidFormat'),
        description: fieldName ? _t('validation.invalidFormatDesc', { fieldName }) : _t('validation.invalidFormatDesc')
      };
    },
    invalidEmail: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('validation.invalidEmail'),
        description: _t('validation.invalidEmailDesc')
      };
    },
    passwordMismatch: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.passwordMismatch'),
        description: _t('auth.passwordMismatch')
      };
    },
    passwordTooShort: (t?: any) => {
      const _t = getT(t);
      return {
        title: _t('auth.passwordTooShort'),
        description: _t('auth.passwordTooShort')
      };
    }
  }
};

// Helper function to show toast with predefined messages
export const showToastMessage = {
  // Show authentication related toasts
  auth: {
    loginSuccess: (name?: string, t?: any) => {
      const { title, description } = toastMessages.auth.loginSuccess(name, t);
      return showToast.success(title, description);
    },
    loginError: (message?: string, t?: any) => {
      const { title, description } = toastMessages.auth.loginError(message, t);
      return showToast.error(title, description);
    },
    logoutSuccess: (t?: any) => {
      const { title, description } = toastMessages.auth.logoutSuccess(t);
      return showToast.success(title, description);
    },
    sessionExpired: (t?: any) => {
      const { title, description } = toastMessages.auth.sessionExpired(t);
      return showToast.error(title, description);
    },
    tokenNotFound: (t?: any) => {
      const { title, description } = toastMessages.auth.tokenNotFound(t);
      return showToast.error(title, description);
    }
  },

  // Show CRUD related toasts
  crud: {
    createSuccess: (itemName?: string, t?: any) => {
      const { title, description } = toastMessages.crud.createSuccess(itemName, t);
      return showToast.success(title, description);
    },
    createError: (itemName?: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.crud.createError(itemName, message, t);
      return showToast.error(title, description);
    },
    updateSuccess: (itemName?: string, t?: any) => {
      const { title, description } = toastMessages.crud.updateSuccess(itemName, t);
      return showToast.success(title, description);
    },
    updateError: (itemName?: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.crud.updateError(itemName, message, t);
      return showToast.error(title, description);
    },
    deleteSuccess: (itemName?: string, t?: any) => {
      const { title, description } = toastMessages.crud.deleteSuccess(itemName, t);
      return showToast.success(title, description);
    },
    deleteError: (itemName?: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.crud.deleteError(itemName, message, t);
      return showToast.error(title, description);
    },
    loadSuccess: (itemName?: string, t?: any) => {
      const { title, description } = toastMessages.crud.loadSuccess(itemName, t);
      return showToast.success(title, description);
    },
    loadError: (itemName?: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.crud.loadError(itemName, message, t);
      return showToast.error(title, description);
    }
  },

  // Show leave management related toasts
  leave: {
    requestSubmitted: (t?: any) => {
      const { title, description } = toastMessages.leave.requestSubmitted(t);
      return showToast.success(title, description);
    },
    requestApproved: (employeeName?: string, t?: any) => {
      const { title, description } = toastMessages.leave.requestApproved(employeeName, t);
      return showToast.success(title, description);
    },
    requestRejected: (employeeName?: string, t?: any) => {
      const { title, description } = toastMessages.leave.requestRejected(employeeName, t);
      return showToast.error(title, description);
    },
    requestError: (action: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.leave.requestError(action, message, t);
      return showToast.error(title, description);
    }
  },

  // Show file operation related toasts
  file: {
    uploadSuccess: (fileName?: string, t?: any) => {
      const { title, description } = toastMessages.file.uploadSuccess(fileName, t);
      return showToast.success(title, description);
    },
    uploadError: (fileName?: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.file.uploadError(fileName, message, t);
      return showToast.error(title, description);
    },
    downloadSuccess: (fileName?: string, t?: any) => {
      const { title, description } = toastMessages.file.downloadSuccess(fileName, t);
      return showToast.success(title, description);
    },
    downloadError: (fileName?: string, message?: string, t?: any) => {
      const { title, description } = toastMessages.file.downloadError(fileName, message, t);
      return showToast.error(title, description);
    }
  },

  // Show network error related toasts
  network: {
    connectionError: (t?: any) => {
      const { title, description } = toastMessages.network.connectionError(t);
      return showToast.error(title, description);
    },
    timeoutError: (t?: any) => {
      const { title, description } = toastMessages.network.timeoutError(t);
      return showToast.error(title, description);
    },
    serverError: (t?: any) => {
      const { title, description } = toastMessages.network.serverError(t);
      return showToast.error(title, description);
    }
  },

  // Show validation related toasts
  validation: {
    requiredField: (fieldName?: string, t?: any) => {
      const { title, description } = toastMessages.validation.requiredField(fieldName, t);
      return showToast.error(title, description);
    },
    invalidFormat: (fieldName?: string, t?: any) => {
      const { title, description } = toastMessages.validation.invalidFormat(fieldName, t);
      return showToast.error(title, description);
    },
    invalidEmail: (t?: any) => {
      const { title, description } = toastMessages.validation.invalidEmail(t);
      return showToast.error(title, description);
    },
    passwordMismatch: (t?: any) => {
      const { title, description } = toastMessages.validation.passwordMismatch(t);
      return showToast.error(title, description);
    },
    passwordTooShort: (t?: any) => {
      const { title, description } = toastMessages.validation.passwordTooShort(t);
      return showToast.error(title, description);
    }
  }
};

// Export the original toast function for backward compatibility
export { toast };

