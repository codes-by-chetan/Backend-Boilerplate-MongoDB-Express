import express from "express";
import controllers from "../controllers/index.js";
import middleware from "../middlewares/index.js";
import { authorize } from "../middlewares/auth.middleware.js";
import constants from "../constants/index.js";
import validations from "../validations/index.js";
import validate from "../middlewares/validate.js";

const router = express.Router();

router.use(middleware.authMiddleware);

router.get("/profile", controllers.userController.getUserProfile);
router.get("/profile-whole", controllers.userController.getUserFullProfile);
router.post("/update/profile", controllers.userController.updateUserProfile);
router.post(
    "/avatar",
    middleware.upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
    ]),
    controllers.userController.updateUserAvatar
);

// Admin-only User Management Routes
router.get(
    "/admin/all",
    authorize(constants.UserRoles.ADMIN),
    validate(validations.userValidations.getUsersAdmin),
    controllers.userController.getAllUsersAdmin
);

router.patch(
    "/:userId/role",
    authorize(constants.UserRoles.ADMIN),
    validate(validations.userValidations.updateUserRole),
    controllers.userController.updateUserRole
);

router.patch(
    "/:userId/status",
    authorize(constants.UserRoles.ADMIN),
    validate(validations.userValidations.updateUserStatus),
    controllers.userController.updateUserStatus
);

router.post(
    "/:userId/revoke-sessions",
    authorize(constants.UserRoles.ADMIN),
    controllers.userController.revokeUserSessions
);

router.get(
    "/:userId/sessions",
    authorize(constants.UserRoles.ADMIN),
    validate(validations.userValidations.getUserSessions),
    controllers.userController.getUserSessions
);

router.delete(
    "/:userId/sessions/:tokenId",
    authorize(constants.UserRoles.ADMIN),
    validate(validations.userValidations.revokeSingleSession),
    controllers.userController.revokeSingleSession
);

const userRouter = router;
export default userRouter;
