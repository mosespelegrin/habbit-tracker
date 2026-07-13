const dotenv=require("dotenv");
const cors=require("cors");
const express=require("express");
const connectDB=require("./config/db.js");
const app=express();

dotenv.config();
app.port=process.env.PRT || 3000;

connectDB();

//middleware
app.use(cors());

app.use(express.json());

app.use("/api/habits",require("./routes/habits.js"));
app.use("/api/checkins",require("./routes/checkins.js"));


app.listen(app.port,()=>{
    console.log(`Server is running on port ${app.port}`);
});