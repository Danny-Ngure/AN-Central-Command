// Public surface of @an/auth.

export { hashPassword, hashDefaultPassword, verifyPassword } from './passwords';
export { changePassword, type ChangePasswordResult } from './change-password';
export { generateTotpSecret, verifyTotp, type TotpEnrollment } from './totp';
export { signSessionJwt, verifySessionJwt, type SessionClaims } from './jwt';
export { getRedis } from './redis';
export { checkAuthRateLimit, recordAuthFailure, resetAuthAttempts } from './rate-limit';
export {
  createSession,
  revokeSession,
  isSessionRevokedOrInvalid,
  touchSession,
  type CreateSessionInput,
  type SessionTokens,
} from './sessions';
export {
  login,
  type LoginInput,
  type LoginResult,
  type LoginErrorCode,
} from './login';
export {
  signEnrollmentStep1Jwt,
  verifyEnrollmentStep1Jwt,
  signEnrollmentStep2Jwt,
  verifyEnrollmentStep2Jwt,
  finalizeEnrollment,
  type EnrollmentStep1Claims,
  type EnrollmentStep2Claims,
} from './enrollment';
