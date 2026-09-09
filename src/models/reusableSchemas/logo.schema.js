const logoSchema = {
    publicId: {
        type: String,
        required: [true, "publicId is required in Logo"],
    },
    url: {
        type: String,
        required: [true, "URL is required in Logo"],
    },
};

export default logoSchema;
