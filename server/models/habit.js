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
    kind:{
        type:String,
        enum:["grow","break"],
        default:"grow"
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    // Last-writer-wins timestamp used by the offline-first sync (client stamps it on every edit).
    updatedAt:{
        type:Date,
        default:Date.now
    },

});
// Every habit route looks habits up by owner.
habitSchema.index({owner:1,createdAt:1});
module.exports=mongoose.model("Habit",habitSchema);
