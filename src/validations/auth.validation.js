import Joi from "joi";

// Enterprise Password Policy: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character
export const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
export const passwordComplexityMessage =
    "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special symbol (!@#$%^&*...).";

const register = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        userName: Joi.string().optional(),
        fullName: Joi.object().keys({
            firstName: Joi.string().required(),
            lastName: Joi.string().required(),
        }),
        password: Joi.string()
            .required()
            .regex(passwordComplexityRegex)
            .messages({
                "string.pattern.base": passwordComplexityMessage,
            }),
        contactNumber: Joi.object().keys({
            countryCode: Joi.string().optional(),
            number: Joi.string().required(),
        }),
    }),
};

const login = {
    body: Joi.object()
        .keys({
            userName: Joi.string().optional(),
            email: Joi.string().optional().email(),
            password: Joi.string().required(),
            clientOrigin: Joi.string().optional(),
            clientUrl: Joi.string().optional(),
        })
        .or("userName", "email"),
};

const forgotPassword = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        clientOrigin: Joi.string().optional(),
        clientUrl: Joi.string().optional(),
    }),
};

const resetPassword = {
    body: Joi.object().keys({
        token: Joi.string().required(),
        newPassword: Joi.string()
            .required()
            .regex(passwordComplexityRegex)
            .messages({
                "string.pattern.base": passwordComplexityMessage,
            }),
        clientOrigin: Joi.string().optional(),
        clientUrl: Joi.string().optional(),
    }),
};

const requestUnlock = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        clientOrigin: Joi.string().optional(),
        clientUrl: Joi.string().optional(),
    }),
};

const unlockAccount = {
    query: Joi.object().keys({
        token: Joi.string().optional(),
        clientOrigin: Joi.string().optional(),
        clientUrl: Joi.string().optional(),
    }),
    body: Joi.object().keys({
        token: Joi.string().optional(),
        clientOrigin: Joi.string().optional(),
        clientUrl: Joi.string().optional(),
    }),
};

const refreshTokens = {
    body: Joi.object().keys({
        refreshToken: Joi.string().optional(),
    }),
};

const refreshToken = refreshTokens;

const changePassword = {
    body: Joi.object().keys({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string()
            .required()
            .regex(passwordComplexityRegex)
            .messages({
                "string.pattern.base": passwordComplexityMessage,
            }),
    }),
};

const authValidations = {
    register,
    login,
    forgotPassword,
    resetPassword,
    requestUnlock,
    unlockAccount,
    refreshToken,
    refreshTokens,
    changePassword,
};

export default authValidations;
