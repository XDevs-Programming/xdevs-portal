const crypto = require("crypto");
const CATEGORIES = new Set(["New Project Enquiry","Existing Client","Technical Support","Billing","Partnership / Business","Other"]);
const TYPES = new Set(["","Website / Web App","Discord Bot","API / Backend","Automation","Other"]);
const clean=(v,n)=>String(v||"").trim().replace(/\0/g,"").slice(0,n);
const esc=v=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
exports.sendSupportEmail=async(req,res,next)=>{try{
 if(clean(req.body.website,200))return res.json({success:true,reference:"received"});
 const name=clean(req.body.name,100),email=clean(req.body.email,254).toLowerCase(),category=clean(req.body.category,60),subject=clean(req.body.subject,140),message=clean(req.body.message,5000),projectType=clean(req.body.projectType,80),budget=clean(req.body.budget,80);
 if(name.length<2||subject.length<3||message.length<10)return res.status(400).json({success:false,message:"Please complete all required fields."});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({success:false,message:"Please enter a valid email address."});
 if(!CATEGORIES.has(category)||!TYPES.has(projectType))return res.status(400).json({success:false,message:"Please select a valid enquiry category."});
 const reference=`XDS-${new Date().getUTCFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,to=process.env.SUPPORT_TO_EMAIL,from=process.env.SUPPORT_FROM_EMAIL;
 if(!to||!from)throw new Error("Support destination email is not configured.");
 const received=new Date().toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"full",timeStyle:"short"});
 const rows=[["Reference",reference],["From",name],["Email",email],["Category",category],["Project type",projectType||"Not specified"],["Budget",budget||"Not specified"],["Received",received]].map(([a,b])=>`<tr><td style="padding:9px 12px;color:#8f9bb3;border-bottom:1px solid #20283a">${esc(a)}</td><td style="padding:9px 12px;color:#f4f7ff;border-bottom:1px solid #20283a">${esc(b)}</td></tr>`).join("");
 const html=`<div style="background:#070a12;padding:28px;font-family:Arial,sans-serif;color:#f4f7ff"><div style="max-width:680px;margin:auto;background:#0f1625;border:1px solid #20283a;border-radius:16px;overflow:hidden"><div style="padding:24px;background:linear-gradient(135deg,#7457ff,#258be8)"><b>XDEVS PROGRAMMING</b><h1>New public support enquiry</h1></div><table style="width:100%;border-collapse:collapse">${rows}</table><div style="padding:22px"><b>SUBJECT</b><h2>${esc(subject)}</h2><b>MESSAGE</b><div style="white-space:pre-wrap;line-height:1.65;margin-top:8px">${esc(message)}</div></div></div></div>`;
 const apiKey=process.env.BREVO_API_KEY;
 if(!apiKey||!from)throw new Error("Support email API is not configured.");
 const emailResponse=await fetch("https://api.brevo.com/v3/smtp/email",{
  method:"POST",
  headers:{"accept":"application/json","api-key":apiKey,"content-type":"application/json"},
  body:JSON.stringify({
   sender:{name:"XDevs Support",email:from},
   to:[{email:to}],
   replyTo:{email,name},
   subject:`[${reference}] ${category}: ${subject}`,
   textContent:`${reference}\nName: ${name}\nEmail: ${email}\nCategory: ${category}\nProject: ${projectType||"Not specified"}\nBudget: ${budget||"Not specified"}\n\n${subject}\n\n${message}`,
   htmlContent:html
  })
 });
 if(!emailResponse.ok){
  const details=await emailResponse.json().catch(()=>({}));
  const deliveryError=new Error(`Email API rejected the support message: ${details.message||emailResponse.statusText}`);
  deliveryError.status=502;
  throw deliveryError;
 }
 res.json({success:true,reference,message:"Your message has been sent to XDevs."});
}catch(e){next(e)}};
