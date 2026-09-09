import addressSchema from "./address.schema.js";
import avatarSchema from "./avatar.schema.js";
import contactNumberSchema from "./contactNumber.schema.js";
import fullNameSchema from "./fullName.schema.js";
import logoSchema from "./logo.schema.js";

const reusableSchemas = {
    avatarSchema,
    addressSchema,
    contactNumberSchema,
    fullNameSchema,
    logoSchema
};

export default reusableSchemas;
