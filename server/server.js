const dotenv=require("dotenv");
const cors=require("cors");
const express=require("express");
const path=require("path");
const connectDB=require("./config/db.js");
const startReminderScheduler=require("./utils/reminderScheduler.js");
const app=express();

dotenv.config();
app.port=process.env.PRT || 3000;
const isProduction=process.env.NODE_ENV==="production";
const allowedOrigins=(process.env.CLIENT_ORIGINS || "http://localhost:4200,http://127.0.0.1:4200")
    .split(",")
    .map((origin)=>origin.trim())
    .filter(Boolean);

if(!process.env.JWT_SECRET){
    throw new Error("JWT_SECRET must be set - generate one with `node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"`");
}

connectDB();
startReminderScheduler();

//middleware
app.disable("x-powered-by");

app.use((req,res,next)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Referrer-Policy","no-referrer");
    res.setHeader("Permissions-Policy","geolocation=(), microphone=(), camera=()");
    res.setHeader("Cross-Origin-Resource-Policy","same-site");
    next();
});

app.use(cors({
    origin(origin,callback){
        if(!origin || allowedOrigins.includes(origin)){
            return callback(null,true);
        }

        return callback(new Error("Origin not allowed by CORS"));
    }
}));

const rateLimitWindowMs=15*60*1000;
const maxRequestsPerWindow=Number(process.env.RATE_LIMIT_MAX || 300);
const requestCounts=new Map();

app.use((req,res,next)=>{
    const now=Date.now();
    const key=req.ip || req.socket.remoteAddress || "unknown";
    const entry=requestCounts.get(key) || {count:0,resetAt:now+rateLimitWindowMs};

    if(now>entry.resetAt){
        entry.count=0;
        entry.resetAt=now+rateLimitWindowMs;
    }

    entry.count++;
    requestCounts.set(key,entry);

    if(entry.count>maxRequestsPerWindow){
        return res.status(429).json({message:"Too many requests"});
    }

    next();
});

// Data import/export carries a full backup, so it gets a larger body limit than the rest of the API.
app.use("/api/data",express.json({limit:"5mb"}));
app.use(express.json({limit:"256kb"}));

app.use((req,res,next)=>{
    res.on("finish",()=>{
        if(res.statusCode>=400){
            console.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`);
        }
    });

    next();
});

app.use("/api/auth",require("./routes/auth.js"));
app.use("/api/habits",require("./routes/habits.js"));
app.use("/api/checkins",require("./routes/checkins.js"));
app.use("/api/scorecard",require("./routes/scorecard.js"));
app.use("/api/weekly-reviews",require("./routes/weeklyReview.js"));
app.use("/api/push",require("./routes/push.js"));
app.use("/api/data",require("./routes/data.js"));

if(isProduction){
    const clientDistPath=path.join(__dirname,"..","client","dist","client","browser");

    app.use(express.static(clientDistPath));

    app.get(/^(?!\/api).*/,(req,res)=>{
        res.sendFile(path.join(clientDistPath,"index.html"));
    });
}

app.use((err,req,res,next)=>{
    console.error("Request failed",err);
    res.status(err.status || 500).json({message:err.status ? err.message : "Internal server error"});
});

app.listen(app.port,()=>{
    console.log(`Server is running on port ${app.port}`);
});
