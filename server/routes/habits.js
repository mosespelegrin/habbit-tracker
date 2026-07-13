const express=require("express");
const router=express.Router();
const Habit=require("../models/habit.js");



router.get("/",async(req,res)=>{
    try{
        const habits=await Habit.find();
        res.json(habits);       
    }
    catch(error){
        res.status(500).json({message:error.message});
    }
});
//for saving a new habit
router.post("/", async(req,res)=>{
    const habit=new Habit(req.body);
    try{
        const savedHabit=await habit.save();
        res.status(201).json(savedHabit);
    }
    catch(error){
        res.status(400).json({message:error.message});
    }
});

//for selecting a habit by id
router.get("/:id",async(req,res)=>{
    try{
        const habit=await Habit.findById(req.params.id);
        if(!habit){
            return res.status(404).json({message:"Habit not found"});
        }
        res.json(habit);
    }
    catch(error){
        res.status(500).json({message:error.message});
    }
});

router.put("/:id",async(req,res)=>{
    try{ 
        const habit=await Habit.findByIdAndUpdate(req.params.id,req.body,{new:true});
        if(!habit){
            return res.status(404).json({message:"Habit not found"});
        }   
        res.status(200).json(habit);                
    }catch(error){
        res.status(400).json({message:error.message});
    }
});

router.delete("/:id",async(req,res)=>{
    try{
    const habit =await Habit.findByIdAndDelete(req.params.id);
    if(!habit){
        return res.status(500).json({message:"habit not found"});
    }
    res.status(200).json(habit);
}catch(error){
    res.json({message:error.message});
}});

module.exports=router;