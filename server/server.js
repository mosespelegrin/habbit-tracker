const dotenv=require("dotenv");
const cors=require("cors");
const express=require("express");
const crypto=require("crypto");
const path=require("path");
const connectDB=require("./config/db.js");
const app=express();

dotenv.config();
app.port=process.env.PRT || 3000;
const isProduction=process.env.NODE_ENV==="production";
const apiKey=process.env.HABIT_TRACKER_API_KEY;
const allowedOrigins=(process.env.CLIENT_ORIGINS || "http://localhost:4200,http://127.0.0.1:4200")
    .split(",")
    .map((origin)=>origin.trim())
    .filter(Boolean);

if(isProduction && !apiKey){
    throw new Error("HABIT_TRACKER_API_KEY must be set in production");
}

connectDB();

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

app.use(express.json({limit:"10kb"}));

app.use("/api",(req,res,next)=>{
    if(!apiKey){
        if(isProduction){
            return res.status(503).json({message:"API key is not configured"});
        }

        return next();
    }

    const providedKey=req.get("x-api-key") || "";
    const providedBuffer=Buffer.from(providedKey);
    const expectedBuffer=Buffer.from(apiKey);

    if(providedBuffer.length!==expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer,expectedBuffer)){
        return res.status(401).json({message:"Valid API key required"});
    }

    next();
});

app.use((req,res,next)=>{
    res.on("finish",()=>{
        if(res.statusCode>=400){
            console.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`);
        }
    });

    next();
});

app.use("/api/habits",require("./routes/habits.js"));
app.use("/api/checkins",require("./routes/checkins.js"));

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
