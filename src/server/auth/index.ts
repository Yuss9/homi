import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "../../../db";
import { account, session, user, verification } from "../../../db/schema";
import { getEnv } from "../env";
import { sendEmail } from "../email";
import { passwordResetEmail, verificationEmail } from "../email/templates";
import { logger } from "../logger";

const env = getEnv();
const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const auth = betterAuth({
  appName: "Homi",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: "homi",
    database: { generateId: () => crypto.randomUUID() },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: accountUser, url }) => {
      void sendEmail(accountUser.email, passwordResetEmail(accountUser.name, url)).catch((error) =>
        logger.error({ error }, "password_reset_email_failed"),
      );
    },
    onPasswordReset: async ({ user: accountUser }) => {
      logger.info({ userId: accountUser.id }, "password_reset_completed");
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user: accountUser, url }) => {
      void sendEmail(accountUser.email, verificationEmail(accountUser.name, url)).catch((error) =>
        logger.error({ error }, "verification_email_failed"),
      );
    },
  },
  socialProviders: google,
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

