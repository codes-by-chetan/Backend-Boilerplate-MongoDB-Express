import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/temp/images");
  },
  filename: (req, file, cb) => {
    const imageName = req.body.title
      ? req.body.title.replace(/['"\s]+/g, "_")
      : req.body.name
        ? req.body.name.replace(/['"\s]+/g, "_")
        : req.body.fullName
        ? req.body.fullName.replace(/['"\s]+/g, "_")
        : req.user.fullNameString.replace(/['"\s]+/g, "_"); // Remove quotes and replace spaces with underscores
    console.log(imageName,path.extname(file.originalname) );    
        cb(null, `${imageName}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({ storage });
