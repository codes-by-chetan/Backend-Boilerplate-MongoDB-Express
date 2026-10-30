import express from "express";
import controllers from "../controllers/index.js";
import middleware from "../middlewares/index.js";
import constants from "../constants/index.js";

const router = express.Router();

router.use(middleware.authMiddleware);

// User Profile routes
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

// Account Support & Admin Unlock routes (Protected by Admin privilege)
router.get(
    "/admin/locked-users",
    middleware.authorize(constants.UserRoles.ADMIN),
    controllers.userController.getLockedUsers
);

router.post(
    "/admin/unlock",
    middleware.authorize(constants.UserRoles.ADMIN),
    controllers.userController.adminUnlockUser
);

router.post(
    "/admin/unlock/:userId",
    middleware.authorize(constants.UserRoles.ADMIN),
    controllers.userController.adminUnlockUser
);

const userRouter = router;
export default userRouter;
