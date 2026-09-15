const express=require("express");
const router=express.Router();
const mongoose=require("mongoose");
const Habit=require("../models/habit.js");
const CheckIn=require("../models/chekIn.js");
const requireAuth=require("../middleware/auth.js");

router.use(requireAuth);

const pickHabitFields=(body)=>{
    const habit={};
    const source=body || {};

    ["name","identity","miniVersion","cue","reward","stackedAfter","reminderTime"].forEach((field)=>{
        if(Object.prototype.hasOwnProperty.call(source,field)){
            habit[field]=source[field];
        }
    });

    if(habit.stackedAfter===""){
        habit.stackedAfter=null;
    }

    return habit;
};

const isValidObjectId=(id)=>typeof id==="string" && /^[a-f\d]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);

const sendServerError=(res)=>{
    res.status(500).json({message:"Internal server error"});
};

const validateHabitInput=(habit,{requireName=false}={})=>{
    const errors=[];

    if(requireName && typeof habit.name!=="string"){
        errors.push("Name is required");
    }

    ["name","identity","miniVersion","cue","reward"].forEach((field)=>{
        if(habit[field]!==undefined && typeof habit[field]!=="string"){
            errors.push(`${field} must be text`);
        }
    });

    if(habit.name!==undefined && !habit.name.trim()){
        errors.push("Name cannot be empty");
    }

    if(habit.stackedAfter && !isValidObjectId(habit.stackedAfter)){
        errors.push("stackedAfter must be a valid habit id");
    }

    if(habit.reminderTime!==undefined && habit.reminderTime!=="" && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(habit.reminderTime)){
        errors.push("reminderTime must be in HH:MM 24-hour format");
    }

    return errors;
};



router.get("/",async(req,res)=>{
    try{
        const habits=await Habit.find({owner:req.userId});
        res.json(habits);
    }
    catch(error){
        console.error("Failed to load habits",error);
        sendServerError(res);
    }
});
//for saving a new habit
router.post("/", async(req,res)=>{
    try{
        const habitData=pickHabitFields(req.body);
        const errors=validateHabitInput(habitData,{requireName:true});

        if(errors.length){
            return res.status(400).json({message:errors[0]});
        }

        if(habitData.stackedAfter){
            const parentExists=await Habit.exists({_id:habitData.stackedAfter,owner:req.userId});
            if(!parentExists){
                return res.status(400).json({message:"stackedAfter habit not found"});
            }
        }

        const habit=new Habit({...habitData,owner:req.userId});
        const savedHabit=await habit.save();
        res.status(201).json(savedHabit);
    }
    catch(error){
        console.error("Failed to create habit",error);
        res.status(400).json({message:"Invalid habit data"});
    }
});

router.get("/stacks",async(req,res)=>{
    try{
        const habits=await Habit.find({owner:req.userId}).sort({ createdAt: 1 });
        const habitsById=new Map(habits.map((habit)=>[habit._id.toString(),habit]));
        const childrenByParent=new Map();

        habits.forEach((habit)=>{
            if(!habit.stackedAfter) return;

            const parentId=habit.stackedAfter.toString();
            const siblings=childrenByParent.get(parentId) || [];
            siblings.push(habit);
            childrenByParent.set(parentId,siblings);
        });

        const chains=[];
        const visited=new Set();
        const heads=habits.filter((habit)=>!habit.stackedAfter || !habitsById.has(habit.stackedAfter.toString()));

        heads.forEach((head)=>{
            const chain=[];
            let current=head;

            while(current && !visited.has(current._id.toString())){
                visited.add(current._id.toString());
                chain.push(current.name);

                const children=childrenByParent.get(current._id.toString()) || [];
                current=children.find((child)=>!visited.has(child._id.toString()));
            }

            if(chain.length){
                chains.push({chain});
            }
        });

        habits.forEach((habit)=>{
            if(!visited.has(habit._id.toString())){
                chains.push({chain:[habit.name]});
            }
        });

        res.json(chains);
    }
    catch(error){
        console.error("Failed to load habit stacks",error);
        sendServerError(res);
    }
});

router.get("/:id/identity-stats",async(req,res)=>{
    if(!isValidObjectId(req.params.id)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try{
        const habit=await Habit.findOne({_id:req.params.id,owner:req.userId});
        if(!habit){
            return res.status(404).json({message:"Habit not found"});
        }

        const since=new Date();
        since.setHours(0,0,0,0);
        since.setDate(since.getDate()-29);

        const provenCount=await CheckIn.countDocuments({
            habit:req.params.id,
            done:true,
            date:{$gte:since}
        });

        res.json({
            identity:habit.identity || "",
            provenCount,
            period:"last 30 days"
        });
    }
    catch(error){
        console.error("Failed to load identity stats",error);
        sendServerError(res);
    }
});

//for selecting a habit by id
router.get("/:id",async(req,res)=>{
    if(!isValidObjectId(req.params.id)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try{
        const habit=await Habit.findOne({_id:req.params.id,owner:req.userId});
        if(!habit){
            return res.status(404).json({message:"Habit not found"});
        }
        res.json(habit);
    }
    catch(error){
        console.error("Failed to load habit",error);
        sendServerError(res);
    }
});

router.put("/:id",async(req,res)=>{
    if(!isValidObjectId(req.params.id)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try{
        const habitData=pickHabitFields(req.body);
        const errors=validateHabitInput(habitData);

        if(errors.length){
            return res.status(400).json({message:errors[0]});
        }

        if(habitData.stackedAfter){
            if(habitData.stackedAfter===req.params.id){
                return res.status(400).json({message:"A habit cannot be stacked after itself"});
            }

            const parentExists=await Habit.exists({_id:habitData.stackedAfter,owner:req.userId});
            if(!parentExists){
                return res.status(400).json({message:"stackedAfter habit not found"});
            }
        }

        const habit=await Habit.findOneAndUpdate({_id:req.params.id,owner:req.userId},habitData,{new:true,runValidators:true});
        if(!habit){
            return res.status(404).json({message:"Habit not found"});
        }
        res.status(200).json(habit);
    }catch(error){
        console.error("Failed to update habit",error);
        res.status(400).json({message:"Invalid habit data"});
    }
});

router.delete("/:id",async(req,res)=>{
    if(!isValidObjectId(req.params.id)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try{
    const habit =await Habit.findOneAndDelete({_id:req.params.id,owner:req.userId});
    if(!habit){
        return res.status(404).json({message:"Habit not found"});
    }
    await CheckIn.deleteMany({habit:req.params.id});
    res.status(200).json(habit);
}catch(error){
    console.error("Failed to delete habit",error);
    sendServerError(res);
}});

module.exports=router;
