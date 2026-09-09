import mongooseDelete from "mongoose-delete"

/**
 * A mongoose schema plugin uses mongoose-delete npm package to soft delete documents
 */

const softDelete = (schema) => {
 schema.plugin(mongooseDelete, {
  overrideMethods: ["count", "countDocuments", "find"]
 });
};

export default softDelete;
