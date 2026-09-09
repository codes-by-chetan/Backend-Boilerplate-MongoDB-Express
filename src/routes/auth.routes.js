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


// Verify social token endpoint
router.post(
    "/verify-social-token",
    controllers.authController.verifySocialToken
);

router.use(authMiddleware);
// Change password endpoint
router.post("/change-password", controllers.authController.changePassword);
router.get("/refresh-user", controllers.authController.getUserDetails);
router.get("/logout", controllers.authController.logout);

const authRouter = router;
export default authRouter;
