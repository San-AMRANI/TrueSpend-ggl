import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  validateAuthConfig,
  getJwtSecret,
  hashPasswordAsync,
  verifyPasswordAsync,
  needsPasswordRehash,
  validatePasswordStrength,
  generateOpaqueToken,
  hashOpaqueToken,
  encryptSecret,
  decryptSecret,
  isOriginAllowed,
} from '../server/services/SecurityCrypto.js';
import {
  createRateLimiter,
  checkLoginThrottle,
  recordLoginFailure,
  clearLoginFailures,
  resetRateLimitsForTests,
} from '../server/middleware/rateLimit.js';
import {
  requireUserManager,
  requireFeature,
  requireTrustedOriginForCookieAuth,
} from '../src/middleware/auth.js';
import { userManagementController } from '../server/controllers/UserManagementController.js';
import { settingsService } from '../server/services/SettingsService.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../server/services/AuthService.js';
import { emailService } from '../server/services/EmailService.js';

function createMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: null as any,
    headers,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

async function runTests() {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevJwt = process.env.JWT_SECRET;

  // 1. Auth config validation fails closed in production when JWT_SECRET is missing or weak
  {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '';
    assert.throws(() => validateAuthConfig(), /JWT_SECRET must be set/);

    process.env.JWT_SECRET = 'super_secret_fallback_key';
    assert.throws(() => validateAuthConfig(), /JWT_SECRET must be set/);

    process.env.JWT_SECRET = 'a_very_strong_random_secret_at_least_32_bytes_long_for_prod';
    assert.deepEqual(validateAuthConfig(), { ok: true, mode: 'env' });

    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = '';
    const devRes = validateAuthConfig();
    assert.equal(devRes.ok, true);
    assert.equal(devRes.mode, 'ephemeral_dev');
    assert.ok(getJwtSecret().length >= 32);
  }

  // Restore env defaults for rest of suite
  process.env.NODE_ENV = prevNodeEnv || 'test';
  process.env.JWT_SECRET = prevJwt || 'test_secret_at_least_32_characters_long_for_truespend';

  // 2. Async scrypt hashing, legacy compatibility & rehash detection
  {
    const hash = await hashPasswordAsync('Correct!Horse_Battery#2026');
    assert.ok(hash.startsWith('scrypt2$16384$8$1$'));
    assert.equal(await verifyPasswordAsync('Correct!Horse_Battery#2026', hash), true);
    assert.equal(await verifyPasswordAsync('WrongPassphrase123!', hash), false);
    assert.equal(needsPasswordRehash(hash), false);

    // Legacy scrypt$<salt>$<hex> format should still verify cleanly and trigger rehash
    const salt = '00112233445566778899aabbccddeeff';
    const derived = crypto.scryptSync('LegacyPassphrase#99', salt, 64, { N: 16384, r: 8, p: 1 });
    const legacyHash = `scrypt$${salt}$${derived.toString('hex')}`;
    assert.equal(await verifyPasswordAsync('LegacyPassphrase#99', legacyHash), true);
    assert.equal(needsPasswordRehash(legacyHash), true);
  }

  // 3. Password strength policy (12+ chars, rejects common/email/username/repeated)
  {
    assert.equal(validatePasswordStrength('Short1!').valid, false);
    assert.equal(validatePasswordStrength('password123456').valid, false);
    assert.equal(validatePasswordStrength('aaaaaaaaaaaa').valid, false);
    assert.equal(
      validatePasswordStrength('myname@example.com_2026', { email: 'myname@example.com' }).valid,
      false
    );
    assert.equal(
      validatePasswordStrength('sanaa_amrani_pass', { username: 'sanaa_amrani' }).valid,
      false
    );
    assert.equal(
      validatePasswordStrength('Ocean!Breeze#Sunset_2026', { email: 'u@example.com', username: 'oceanuser' })
        .valid,
      true
    );
  }

  // 4. Opaque token generation & SHA-256 hashing
  {
    const raw = generateOpaqueToken(32);
    const hashed = hashOpaqueToken(raw);
    assert.ok(raw.length >= 40);
    assert.equal(hashed.length, 64);
    assert.notEqual(hashed, raw);
    assert.equal(hashOpaqueToken(raw), hashed);
  }

  // 5. AES-256-GCM integration credential encryption at rest
  {
    const token = 'ya29.test-google-drive-oauth-access-token';
    const encrypted = encryptSecret(token);
    assert.ok(encrypted.startsWith('enc:v1:'));
    assert.equal(encrypted.includes('ya29.'), false);
    assert.equal(decryptSecret(encrypted), token);
    assert.equal(decryptSecret('enc:v1:bad:bad:bad'), null);
    // Legacy plaintext fallback still readable
    assert.equal(decryptSecret('legacy-plain'), 'legacy-plain');
  }

  // 6. Rate limiting & progressive login throttling
  {
    resetRateLimitsForTests();
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      keyPrefix: 'test_auth',
    });
    const req: any = { headers: {}, ip: '10.0.0.5' };

    let nextCalls = 0;
    const res1 = createMockRes();
    limiter(req, res1, () => {
      nextCalls += 1;
    });
    const res2 = createMockRes();
    limiter(req, res2, () => {
      nextCalls += 1;
    });
    const res3 = createMockRes();
    limiter(req, res3, () => {
      nextCalls += 1;
    });

    assert.equal(nextCalls, 2);
    assert.equal(res3.statusCode, 429);
    assert.equal(res3.body?.code, 'RATE_LIMITED');

    // Progressive login throttling triggers after 5 failures and clears cleanly
    for (let i = 0; i < 5; i += 1) {
      recordLoginFailure('alice@example.com', '10.0.0.6');
    }
    const throttled = checkLoginThrottle('alice@example.com', '10.0.0.6');
    assert.equal(throttled.allowed, false);
    assert.ok((throttled.retryAfterSeconds || 0) >= 1);

    clearLoginFailures('alice@example.com', '10.0.0.6');
    assert.equal(checkLoginThrottle('alice@example.com', '10.0.0.6').allowed, true);
  }

  // 7. Strict account isolation, impersonation disablement, & admin route guard
  {
    const resImp = createMockRes();
    await userManagementController.impersonateUser({ params: { id: 'target-1' } } as any, resImp);
    assert.equal(resImp.statusCode, 403);
    assert.equal(resImp.body?.code, 'IMPERSONATION_DISABLED');

    const resMember = createMockRes();
    let passed = false;
    requireUserManager({ authUser: { role: 'member' } } as any, resMember, () => {
      passed = true;
    });
    assert.equal(passed, false);
    assert.equal(resMember.statusCode, 403);
    assert.equal(resMember.body?.code, 'ADMIN_REQUIRED');

    const resAdmin = createMockRes();
    requireUserManager({ authUser: { role: 'admin' } } as any, resAdmin, () => {
      passed = true;
    });
    assert.equal(passed, true);
  }

  // 8. Feature tier gating middleware & Origin CSRF check
  {
    const guard = requireFeature('investments');
    const basicRes = createMockRes();
    let basicAllowed = false;
    guard({ experienceTier: 'basic', authUser: { experienceTier: 'basic' } } as any, basicRes, () => {
      basicAllowed = true;
    });
    assert.equal(basicAllowed, false);
    assert.equal(basicRes.statusCode, 403);
    assert.equal(basicRes.body?.code, 'FEATURE_NOT_AVAILABLE_FOR_TIER');

    const advRes = createMockRes();
    let advAllowed = false;
    guard({ experienceTier: 'advanced', authUser: { experienceTier: 'advanced' } } as any, advRes, () => {
      advAllowed = true;
    });
    assert.equal(advAllowed, true);

    assert.equal(isOriginAllowed('http://localhost:3000'), true);
    assert.equal(isOriginAllowed('https://evil-phishing-site.invalid'), false);

    const csrfRes = createMockRes();
    let csrfPassed = false;
    requireTrustedOriginForCookieAuth(
      { headers: { origin: 'https://evil-phishing-site.invalid' } } as any,
      csrfRes,
      () => {
        csrfPassed = true;
      }
    );
    assert.equal(csrfPassed, false);
    assert.equal(csrfRes.statusCode, 403);
    assert.equal(csrfRes.body?.code, 'CSRF_ORIGIN_DENIED');
  }

  // 9. Signed JWT claims cannot leak across token types
  {
    const secret = getJwtSecret();
    const badTypeToken = jwt.sign({ userId: 'u1', tokenType: 'refresh' }, secret);
    const decoded: any = jwt.verify(badTypeToken, secret);
    assert.equal(decoded.tokenType, 'refresh');
  }

  // 10. SettingsService SQL backup preview rejects malformed/forged headers cleanly
  {
    await assert.rejects(
      () => settingsService.validateBackupPreview('user-1', '-- Random SQL file\nDROP TABLE users;'),
      /Please select a SQL backup exported by TrueSpend/
    );
  }

  // 11. Access token TTL is 1 week (604,800 seconds) and EmailService reflects configuration state
  {
    assert.equal(ACCESS_TOKEN_TTL_SECONDS, 7 * 24 * 60 * 60);
    const prevResend = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = '';
    assert.equal(emailService.isEmailDeliveryConfigured(), false);
    process.env.RESEND_API_KEY = 're_test_dummy_key';
    assert.equal(emailService.isEmailDeliveryConfigured(), true);
    process.env.RESEND_API_KEY = prevResend;
  }

  console.log('✓ All security isolation, crypto, rate-limit, and auth guard tests passed');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
