import express from "express";
import controllers from "../controllers/index.js";
import validations from "../validations/index.js";
import validate from "../middlewares/validate.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
    "/register",
    validate(validations.authValidations.register),
    controllers.authController.register
);

router.post(
    "/login",
    validate(validations.authValidations.login),
    controllers.authController.login
);

router.post(
    "/admin/login",
    validate(validations.authValidations.login),
    controllers.authController.adminLogin
);


// Verify social token endpoint
router.post(
    "/verify-social-token",
    controllers.authController.verifySocialToken
);

// Refresh tokens endpoint
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

router.use(authMiddleware);
// Authenticated routes
router.post("/change-password", controllers.authController.changePassword);
router.get("/refresh-user", controllers.authController.getUserDetails);
router.get("/logout", controllers.authController.logout);
router.post("/logout", controllers.authController.logout);
router.post("/logout-all", controllers.authController.logoutAll);

const authRouter = router;
export default authRouter;
