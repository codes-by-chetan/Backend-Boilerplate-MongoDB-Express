import ApiError from "../../utils/ApiError.js";
import validator from "validator";
import httpStatus from "http-status";


const addressSchema = {
    street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
    },
    addressLine2: {
        type: String,
        required: false,
        trim: true,
    },
    city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
    },
    state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
    },
    postalCode: {
        type: String,
        required: [true, "Postal code is required"],
        trim: true,
        validate(value) {
            if (!validator.isNumeric(value)) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    "Invalid Postal Code"
                );
            }
            if (value.length < 5) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Postal code should be at least 5 digits"); ;
            }
        },
    },
    country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
    },
};

export default addressSchema;
