import express from "express";
import controllers from "../controllers/index.js";
import validations from "../validations/index.js";
import validate from "../middlewares/validate.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    unlockLimiter,
    resetPasswordLimiter,
} from "../middlewares/authRateLimiter.middleware.js";

const router = express.Router();

// 1. Registration endpoint (Protected by registration rate limiter)
router.post(
    "/register",
    registerLimiter,
    validate(validations.authValidations.register),
    controllers.authController.register
);

// 2. Login endpoint (Protected by Layer 1 IP Sliding-Window Limiter & Layer 3 Lockout Engine)
router.post(
    "/login",
    loginLimiter,
    validate(validations.authValidations.login),
    controllers.authController.login
);

// Admin dedicated login endpoint
router.post(
    "/admin/login",
    validate(validations.authValidations.login),
    controllers.authController.adminLogin
);

// 3. Social Authentication
router.post(
    "/verify-social-token",
    loginLimiter,
    controllers.authController.verifySocialToken
);

// 4. Layer 5: Safe Password Reset Flow (Anti-Enumeration + 60s Account Cooldown + Rate Limiter)
router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    validate(validations.authValidations.forgotPassword),
    controllers.authController.forgotPassword
);

router.post(
    "/reset-password",
    resetPasswordLimiter,
    validate(validations.authValidations.resetPassword),
    controllers.authController.resetPassword
);

// 5. Layer 4: Self-Service Cryptographic Account Unlock Flow
router.post(
    "/request-unlock",
    unlockLimiter,
    validate(validations.authValidations.requestUnlock),
    controllers.authController.requestUnlock
);

// Supports both browser redirect (GET link in email) and API JSON consumption (POST)
router.get(
    "/unlock-account",
    validate(validations.authValidations.unlockAccount),
    controllers.authController.unlockAccount
);

router.post(
    "/unlock-account",
    validate(validations.authValidations.unlockAccount),
    controllers.authController.unlockAccount
);

// 6. Layer 6: Session Management & Refresh Token Endpoints
router.post(
    "/refresh-tokens",
    validate(validations.authValidations.refreshTokens),
    controllers.authController.refreshTokens
);

router.post(
    "/refresh-token",
    validate(validations.authValidations.refreshTokens),
    controllers.authController.refreshTokens
);

// 7. Layer 7: Two-Factor Authentication (2FA Step-up Login Challenge)
router.post(
    "/2fa/verify-login",
    loginLimiter,
    controllers.authController.verify2FALogin
);

// -----------------------------------------------------------------------------
// Authenticated Routes (Requires Valid JWT Access Token)
// -----------------------------------------------------------------------------
router.use(authMiddleware);

// 2FA Management Endpoints
router.post("/2fa/generate", controllers.authController.generate2FA);
router.post("/2fa/enable", controllers.authController.enable2FA);
router.post("/2fa/disable", controllers.authController.disable2FA);

router.post(
    "/change-password",
    validate(validations.authValidations.changePassword),
    controllers.authController.changePassword
);

router.get("/refresh-user", controllers.authController.getUserDetails);

// Logout: Supports POST (recommended standard) and GET (legacy backward compatibility)
router.post("/logout", controllers.authController.logout);
router.get("/logout", controllers.authController.logout);
router.post("/logout-all", controllers.authController.logoutAll);

const authRouter = router;
export default authRouter;
