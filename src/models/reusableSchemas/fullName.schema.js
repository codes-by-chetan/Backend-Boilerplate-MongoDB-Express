const fullNameSchema = {
    firstName: {
        type: String,
        required: [true, "First name is required"],
        index: true,
        trim: true,
    },
    middleName: {
        type: String,
        required: false,
        index: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, "Last name is required"],
        index: true,
        trim: true,
    },
};

export default fullNameSchema