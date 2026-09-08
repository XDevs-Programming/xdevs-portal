const express=require("express");const{rateLimit}=require("express-rate-limit");const{sendSupportEmail}=require("../controllers/supportController");const router=express.Router();
router.post("/",rateLimit({windowMs:30*60*1000,limit:5,standardHeaders:"draft-8",legacyHeaders:false,message:{success:false,message:"Too many enquiries have been sent from this connection. Please try again later."}}),sendSupportEmail);
module.exports=router;
