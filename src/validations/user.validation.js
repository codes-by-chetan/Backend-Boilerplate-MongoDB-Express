import Joi from "joi";
import constants from "../constants/index.js";

const updateUserRole = {
    params: Joi.object().keys({
        userId: Joi.string().required(),
    }),
    body: Joi.object().keys({
        role: Joi.string()
            .lowercase()
            .required()
            .valid(...Object.values(constants.UserRoles)),
    }),
};

const getUsersAdmin = {
    query: Joi.object().keys({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        search: Joi.string().allow("").optional(),
        role: Joi.string().lowercase().valid(...Object.values(constants.UserRoles)).optional(),
        status: Joi.string().uppercase().valid(...Object.values(constants.UserStatus)).optional(),
        sortBy: Joi.string().optional(),
        order: Joi.string().valid("asc", "desc").optional(),
    }),
};

const updateUserStatus = {
    params: Joi.object().keys({
        userId: Joi.string().required(),
    }),
    body: Joi.object().keys({
        status: Joi.string()
            .uppercase()
            .required()
            .valid(...Object.values(constants.UserStatus)),
    }),
};

const getUserSessions = {
    params: Joi.object().keys({
        userId: Joi.string().required(),
    }),
};

const revokeSingleSession = {
    params: Joi.object().keys({
        userId: Joi.string().required(),
        tokenId: Joi.string().required(),
    }),
};

const userValidations = {
    updateUserRole,
    getUsersAdmin,
    updateUserStatus,
    getUserSessions,
    revokeSingleSession,
};

export default userValidations;
