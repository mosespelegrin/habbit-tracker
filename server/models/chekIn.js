const mongoose=require("mongoose");
const checkInSchema=new mongoose.Schema({
    habit:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Habit",
        required:true
    },
    date:{
        type:Date,
        default:Date.now
    },
    done:{
        type:Boolean,
        default:false
    }

});
module.exports=mongoose.model("CheckIn",checkInSchema);