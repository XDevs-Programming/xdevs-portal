const crypto = require("crypto");
const nodemailer = require("nodemailer");
const CATEGORIES = new Set(["New Project Enquiry","Existing Client","Technical Support","Billing","Partnership / Business","Other"]);
const TYPES = new Set(["","Website / Web App","Discord Bot","API / Backend","Automation","Other"]);
const clean=(v,n)=>String(v||"").trim().replace(/\0/g,"").slice(0,n);
const esc=v=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
function transport(){const port=Number(process.env.SMTP_PORT||587);if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)throw new Error("Support email transport is not configured.");return nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},requireTLS:port!==465});}
exports.sendSupportEmail=async(req,res,next)=>{try{
 if(clean(req.body.website,200))return res.json({success:true,reference:"received"});
 const name=clean(req.body.name,100),email=clean(req.body.email,254).toLowerCase(),category=clean(req.body.category,60),subject=clean(req.body.subject,140),message=clean(req.body.message,5000),projectType=clean(req.body.projectType,80),budget=clean(req.body.budget,80);
 if(name.length<2||subject.length<3||message.length<10)return res.status(400).json({success:false,message:"Please complete all required fields."});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({success:false,message:"Please enter a valid email address."});
 if(!CATEGORIES.has(category)||!TYPES.has(projectType))return res.status(400).json({success:false,message:"Please select a valid enquiry category."});
 const reference=`XDS-${new Date().getUTCFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,to=process.env.SUPPORT_TO_EMAIL,from=process.env.SUPPORT_FROM_EMAIL||process.env.SMTP_USER;
 if(!to||!from)throw new Error("Support destination email is not configured.");
 const received=new Date().toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"full",timeStyle:"short"});
 const rows=[["Reference",reference],["From",name],["Email",email],["Category",category],["Project type",projectType||"Not specified"],["Budget",budget||"Not specified"],["Received",received]].map(([a,b])=>`<tr><td style="padding:9px 12px;color:#8f9bb3;border-bottom:1px solid #20283a">${esc(a)}</td><td style="padding:9px 12px;color:#f4f7ff;border-bottom:1px solid #20283a">${esc(b)}</td></tr>`).join("");
 const html=`<div style="background:#070a12;padding:28px;font-family:Arial,sans-serif;color:#f4f7ff"><div style="max-width:680px;margin:auto;background:#0f1625;border:1px solid #20283a;border-radius:16px;overflow:hidden"><div style="padding:24px;background:linear-gradient(135deg,#7457ff,#258be8)"><b>XDEVS PROGRAMMING</b><h1>New public support enquiry</h1></div><table style="width:100%;border-collapse:collapse">${rows}</table><div style="padding:22px"><b>SUBJECT</b><h2>${esc(subject)}</h2><b>MESSAGE</b><div style="white-space:pre-wrap;line-height:1.65;margin-top:8px">${esc(message)}</div></div></div></div>`;
 await transport().sendMail({from:`"XDevs Support" <${from}>`,to,replyTo:email,subject:`[${reference}] ${category}: ${subject}`,text:`${reference}\nName: ${name}\nEmail: ${email}\nCategory: ${category}\nProject: ${projectType||"Not specified"}\nBudget: ${budget||"Not specified"}\n\n${subject}\n\n${message}`,html});
 res.json({success:true,reference,message:"Your message has been sent to XDevs."});
}catch(e){next(e)}};
