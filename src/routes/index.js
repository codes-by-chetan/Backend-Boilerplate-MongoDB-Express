import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import profileRouter from "./profile.routes.js";
import notificationRouter from "./notifications.routes.js";
import logsRouter from "./logs.routes.js";

const router = express.Router();

const defaultRoutes = [
    {
        path: "/auth",
        route: authRoutes,
    },
    {
        path: "/user",
        route: userRoutes,
    },
    {
        path: "/profiles",
        route: profileRouter,
    },
    {
        path: "/notifications",
        route: notificationRouter,
    },
    {
        path: "/logs",
        route: logsRouter,
    },
];

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

const mainRouter = router;
export default mainRouter;
