import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      
        //will stay on local server for a very short time.
        //eventually change it so that file name is more specific
      cb(null, file.originalname)
    }
  })
  
  export const upload = multer({ storage: storage })