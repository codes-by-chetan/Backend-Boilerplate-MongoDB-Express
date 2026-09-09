const avatarSchema = {
    publicId: {
        type: String,
        required: [true, "publicId is required in Avatar"],
    },
    url: {
        type: String,
        required: [true, "URL is required in Avatar"],
    },
};

export default avatarSchema;
