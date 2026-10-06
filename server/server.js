const dotenv=require("dotenv");
// Load .env before anything else reads process.env.
dotenv.config();

const cors=require("cors");
const express=require("express");
const path=require("path");
const mongoose=require("mongoose");
const connectDB=require("./config/db.js");
const startReminderScheduler=require("./utils/reminderScheduler.js");
const app=express();

// Hosts (Render, Railway, Heroku, Fly...) inject PORT. PRT is kept for backwards compatibility.
const port=process.env.PORT || process.env.PRT || 3000;
const isProduction=process.env.NODE_ENV==="production";
// The Capacitor app's WebView origins are included so the native build can call a deployed API directly
// (it has no server of its own to proxy through).
const allowedOrigins=(process.env.CLIENT_ORIGINS || "http://localhost:4200,http://127.0.0.1:4200,http://localhost,capacitor://localhost")
    .split(",")
    .map((origin)=>origin.trim().replace(/\/+$/,""))
    .filter(Boolean);

if(!process.env.JWT_SECRET){
    throw new Error("JWT_SECRET must be set - generate one with `node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"`");
}

if(!process.env.MONGO_URI){
    throw new Error("MONGO_URI must be set to your MongoDB connection string");
}

connectDB();
startReminderScheduler();

//middleware
app.disable("x-powered-by");

// Behind a hosting proxy every request would otherwise appear to come from the proxy's IP, so the rate
// limiters would throttle all users together. TRUST_PROXY is the number of proxy hops (0 disables it).
app.set("trust proxy",Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)));

app.use((req,res,next)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Referrer-Policy","no-referrer");
    res.setHeader("Permissions-Policy","geolocation=(), microphone=(), camera=()");
    res.setHeader("Cross-Origin-Resource-Policy","same-site");
    if(isProduction){
        res.setHeader("Strict-Transport-Security","max-age=15552000; includeSubDomains");
    }
    next();
});

// Lightweight liveness/readiness probe for the hosting platform. Registered before the rate limiter.
app.get("/api/health",(req,res)=>{
    const dbReady=mongoose.connection.readyState===1;
    res.status(dbReady ? 200 : 503).json({status:dbReady ? "ok" : "starting",uptime:Math.round(process.uptime())});
});

// The app serves its own client in production, so requests from its own origin are always allowed;
// CLIENT_ORIGINS only needs to list *other* origins (e.g. a separately hosted frontend).
app.use(cors((req,callback)=>{
    const origin=req.get("origin");
    const sameOrigin=!!origin && origin.replace(/^https?:\/\//,"")===req.get("host");

    callback(null,{origin:!origin || sameOrigin || allowedOrigins.includes(origin)});
}));

const rateLimitWindowMs=15*60*1000;
const maxRequestsPerWindow=Number(process.env.RATE_LIMIT_MAX || 300);
const requestCounts=new Map();

// Drop expired entries so the map can't grow without bound on a long-running process.
setInterval(()=>{
    const now=Date.now();
    requestCounts.forEach((entry,key)=>{
        if(now>entry.resetAt) requestCounts.delete(key);
    });
},rateLimitWindowMs).unref();

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

// Unknown API paths get a JSON 404 instead of falling through to the SPA's index.html.
app.use("/api",(req,res)=>{
    res.status(404).json({message:"Not found"});
});

if(isProduction){
    const clientDistPath=path.join(__dirname,"..","client","dist","client","browser");
    const noCache=new Set(["index.html"]);

    app.use(express.static(clientDistPath,{
        // Angular fingerprints its bundles (main-XXXXXXXX.js), so they can be cached forever; the entry
        // point must always be revalidated or users get stuck on an old version.
        setHeaders(res,filePath){
            if(noCache.has(path.basename(filePath))){
                res.setHeader("Cache-Control","no-cache");
            }
            else if(/-[A-Z0-9]{8}\.(js|css)$/.test(path.basename(filePath))){
                res.setHeader("Cache-Control","public, max-age=31536000, immutable");
            }
        }
    }));

    app.get(/^(?!\/api).*/,(req,res)=>{
        res.setHeader("Cache-Control","no-cache");
        res.sendFile(path.join(clientDistPath,"index.html"));
    });
}

app.use((err,req,res,next)=>{
    console.error("Request failed",err);
    res.status(err.status || 500).json({message:err.status ? err.message : "Internal server error"});
});

const server=app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
});

// Hosts send SIGTERM on every deploy/restart; finish in-flight requests and close the DB cleanly.
const shutdown=(signal)=>{
    console.log(`${signal} received, shutting down`);
    server.close(async ()=>{
        await mongoose.connection.close().catch(()=>{});
        process.exit(0);
    });
    setTimeout(()=>process.exit(1),10000).unref();
};
process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));
