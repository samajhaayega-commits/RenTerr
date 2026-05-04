import { createAuditLog, logSecurityEvent } from '../services/auditService';

export class AppError extends Error {
  constructor(public message: string, public code: string, public severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
    super(message);
    this.name = 'AppError';
  }
}

export const handleError = async (error: any, context: string, userId?: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error.code || 'UNKNOWN_ERROR';
  
  console.error(`[${context}] ${errorCode}: ${errorMessage}`);

  // Log to audit for critical issues
  if (errorMessage.includes('insufficient permissions')) {
    await logSecurityEvent('CRITICAL', 'SECURITY', `Unauthorized access attempt at: ${context}`, userId);
    await createAuditLog('ACCESS_DENIED', `User attempted restricted action: ${context}`, userId, { error: errorMessage });
  } else {
    await createAuditLog('SYSTEM_RESTART', `Error trapped at ${context}`, userId, { error: errorMessage, code: errorCode });
  }

  // Automatic retry logic for specific network errors
  if (errorCode === 'unavailable' || errorMessage.includes('network-error')) {
    return true; // Signal for retry
  }

  return false;
};

export const wrapWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry = await handleError(error, `Retry Attempt ${i + 1}`);
      if (!shouldRetry) break;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};
