import Joi from "joi";

const register = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        userName: Joi.string().optional(),
        fullName: Joi.object().keys({
            firstName: Joi.string().required(),
            lastName: Joi.string().required(),
        }),
        password: Joi.string().required().min(8),
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
        })
        .or("userName", "email"), // Ensures that at least one of userName or email is provided
};

const authValidations = { register, login };

export default authValidations;
