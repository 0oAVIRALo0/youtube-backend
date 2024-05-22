import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file) => "./public/temp",
  filename: (req, file) => file.originalname,
});

export const upload = multer({
  storage,
});
