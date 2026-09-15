const mongoose=require('mongoose');
const habitSchema=new mongoose.Schema({
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    name:{
        type:String,
        required:true,
        trim:true,
        maxlength:120
    },
    identity:{
        type:String,
        default:"",
        trim:true,
        maxlength:240
    },
    miniVersion:{
        type:String,
        default:"",
        trim:true,
        maxlength:120
    },
    cue:{
        type:String,
        default:"",
        trim:true,
        maxlength:160
    },
    reward:{
        type:String,
        default:"",
        trim:true,
        maxlength:160
    },
    stackedAfter:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Habit",
        default:null
    },
    reminderTime:{
        type:String,
        default:"",
        validate:{
            validator:(value)=>value==="" || /^([01]\d|2[0-3]):([0-5]\d)$/.test(value),
            message:"reminderTime must be in HH:MM 24-hour format"
        }
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
   
});
module.exports=mongoose.model("Habit",habitSchema);
