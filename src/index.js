// require('dotenv').config({ path: './env' })    //works but this is commonjs style
import { app } from "./app.js"
import connectDB from "./db/index.js"
import dotenv from "dotenv"

dotenv.config({
    path: "./env",
})


const PORT = process.env.PORT || 8000
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running at port : ${PORT}`);
        })
        app.on("error", (error) => {
            console.log("ERROR: ", error);
            throw error;
        })
    }).catch((error) => {
        console.log(`MongoDB connection failed. ${error}`);
    })




























/* approach 1
import express from "express"
const app = express();

(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log("ERROR: ", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`App listening on port: ${process.env.PORT}`);
        })
    } catch (error) {
        console.log("ERROR: ", error);
        throw error;
    }
})()        //IIFE
*/