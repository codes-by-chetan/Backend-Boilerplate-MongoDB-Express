import express from "express";
import controllers from "../controllers/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

// router.use(authMiddleware);

router.get("/", controllers.logsController.getAllLogs);
router.get("/recents", controllers.logsController.getRecentLogs);
router.get("/by-date/:date", controllers.logsController.getLogsByDate); // Get logs by date

const logsRouter = router;
export default logsRouter;
