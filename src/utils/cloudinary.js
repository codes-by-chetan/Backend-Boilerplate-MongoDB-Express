import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import ApiError from "./ApiError.js";
import config from "../config/env.config.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const uploadOnCloudinary = async (localFilePath, subFolder = "") => {
  try {
    if (!localFilePath) return null;

    // Combine base folder from config with subfolder
    const baseFolder = config.cloudinary.folder;
    const folderPath = subFolder 
      ? `${baseFolder}/${subFolder}`.replace(/\/+/g, "/") 
      : baseFolder;

    console.log("Uploading file:", localFilePath, "to folder:", folderPath);

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: folderPath,
    });

    console.log("File uploaded to Cloudinary successfully:", response);

    // Optionally delete the local file after upload
    await fs.unlink(localFilePath);

    return response;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new ApiError(500, "Failed to upload file to Cloudinary", error);
  }
};

export { uploadOnCloudinary };