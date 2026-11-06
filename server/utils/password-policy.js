/**
 * Password policy — dependency-free so it can be unit-tested in isolation.
 * Minimum length is enforced here and in every auth route.
 */
const COMMON_PASSWORDS = new Set([
  '1234', '12345', '123456', '1234567', '12345678', '123456789', 'password',
  'passw0rd', 'qwerty', 'qwerty123', 'admin', 'admin123', '1111', '0000',
  'letmein', 'welcome', 'iloveyou', 'abc123', 'arnstream', 'arnstream123'
]);

export const PASSWORD_MIN_LENGTH = 8;

/**
 * @param {unknown} password
 * @param {{minLength?: number}} [options]
 * @returns {{ok: boolean, message?: string}}
 */
export function validatePasswordStrength(password, { minLength = PASSWORD_MIN_LENGTH } = {}) {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, message: 'كلمة المرور مطلوبة.' };
  }
  if (password.length < minLength) {
    return { ok: false, message: `كلمة المرور قصيرة جداً — يجب أن تكون ${minLength} أحرف على الأقل.` };
  }
  if (password.length > 200) {
    return { ok: false, message: 'كلمة المرور طويلة بشكل غير مسموح.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: 'كلمة المرور شائعة جداً وسهلة التخمين — اختر كلمة أقوى.' };
  }
  return { ok: true };
}

export default validatePasswordStrength;
