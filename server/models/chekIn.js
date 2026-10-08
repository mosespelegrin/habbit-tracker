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
    },
    updatedAt:{
        type:Date,
        default:Date.now
    }

});
// Every check-in query filters by habit and a date range, so index for that.
checkInSchema.index({habit:1,date:-1});
module.exports=mongoose.model("CheckIn",checkInSchema);