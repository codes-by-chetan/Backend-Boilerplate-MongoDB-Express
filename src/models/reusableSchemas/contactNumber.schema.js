import validator from "validator";
import httpStatus from "http-status";
import ApiError from "../../utils/ApiError.js";

const contactNumberSchema = {
    countryCode: { type: String },
    number: {
        type: String,
        required: true,
        index: true,
        validate(value) {
            if (!validator.isNumeric(value)) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    "Invalid Contact Number"
                );
            }
        },
    },
};

export default contactNumberSchema;
