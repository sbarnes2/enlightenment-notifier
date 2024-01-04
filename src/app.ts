//# sourceMappingURL=app.js.map
import pgPromise, { ParameterizedQuery } from 'pg-promise';
import nodemailer from 'nodemailer';
import dotenv from "dotenv";


dotenv.config();

const port = parseInt(process.env.PGPORT || "5432",10);


const config = {
    database: process.env.PGDATABASE || "training",
    host: process.env.PGHOST || "localhost",
    port,
    user : process.env.PGUSER || "postgres",
    password:process.env.PGPASSWORD || "postgres"
};

const email_text = [{id_level:1,text:"A new version of these documents has been published. Please review and document your training in the next three (3) weeks. "}
                    ,{id_level:2,text:"A new version of these documents has been published. Please review and document your training."}
                    ,{id_level:3,text:"A new version of these documents has been published. Please review and document your training. In one (1) week, an email notification will be sent to your direct supervisor"}
                    ,{id_level:4,text:"A new version of these documents has been published. This training is considered overdue. This notification has been escalated to your direct supervisor. "}];

const pgp  = pgPromise();
const db = pgp(config);

type userdata_type = {userid:number,username:string,email_address:string};
type userDocumentData_type = {userid:number,documentid:number,documentqtid:string,documenttitle:string,rev:string,risklevel:number};


let userdata  : userdata_type [] ;
let userDocumentData : userDocumentData_type [];

async function getUserData():Promise<userdata_type[]>{
    //console.log('Getting user data');
    userdata = await db.any('select distinct userid,username,email_address from user_training_needed order by userid',);
    return userdata;
}

async function getDocumentsPerPerson(userid:number){
    //console.log('Getting document data');
    userDocumentData = await db.any(`select distinct userid,documentid,documentqtid,documenttitle,rev from user_training_needed where userid = ${userid} order by documentid`,);
    return userDocumentData;
}

async function udpateDatebaseTrainingRecords(userid:number,documentid:number,documentRevision:number){
    //console.log(`adding new record to the training_record table for user id ${userid} document number ${documentid} revision number ${documentRevision} on ${Date.now()}`);
    const sql = new ParameterizedQuery ({
        text:'insert into training_record(userid,doc_id,doc_version,date_notified) values($1,$2,$3,$4)',
        values:[userid,documentid,documentRevision,Date.now()]
    });

    console.log(JSON.stringify(sql));
   // await db.one(sql); //uncomment this to enable!
}


async function processbasedata(transporter : nodemailer.Transporter){
    await getUserData();
    //console.log('data = '+JSON.stringify(userdata));
    
    userdata?.map(async user =>{
        console.log(`getting document data for user id = ${user.userid}`);
        const docs: userDocumentData_type [] = await getDocumentsPerPerson(user.userid);
        
/*         const email_response = await transporter.sendMail({    //uncomment this to enable emailing!
            from :'"QT9 Training App" <qt9training@mybinxhealth.com>',
            to: user.email_address,
            subject:'Training Update from QT9',
            text:createEmailText(),
            html:createEmailHtml(),
            headers:{'x-qt9':Date.now.toString()}
        }); 
*/

        const email_response : string = createEmailText();
        const email_html: string = createEmailHtml();
/*         console.log(user.email_address);
        console.log(email_response);
        console.log(email_html);
        console.log(`MESSAGE SENT TO : ${user.email_address}  UPDATING DATABASE !!`); */
        docs?.map(doc=>{
            udpateDatebaseTrainingRecords(user.userid,doc.documentid,parseInt(doc.rev));
        })
        
    });
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }


async function processManagerAuthRequests(){
    //check for manager escalation tags in the training_record, if there send escalated email to user on the record.
    const now:number = Date.now()/1000;
    const one_week:Date = addDays(new Date(),7);
    const two_weeks:Date = addDays(new Date(),14);
    const three_weeks:Date = addDays(new Date(),21);

    if(one_week>two_weeks){
        console.log('seems to work');
    }

    console.log(one_week);
    console.log(two_weeks);
    console.log(three_weeks);

    //-1 = system
/*     //first close all low priority that have a updated date
    const initial_update_low_priority = `update training_record set date_validated=${now}, Validated_by=-1 where (risklevel = 1 and trained = true)`;
    //if there are any open records with a notified date more than 1 week old but trained = false (or absent)
    const week_one_update_any_priority = `update training_record set date_validated=${now}, Validated_by=-1 where (date_notified > ${one_week} and trained = false)`;//????

     db.one(initial_update_low_priority);
     db.one(week_one_update_any_priority); */
}


async function housekeeping(){
    // update all outstanding to higher escalaion level based on current date.
    // get the n time from the escalation_state table based on the current excalation level
    // any entry with a notify_date more than n time away from now, no date_validated and no trained === true
    // update the escalation state by 1 and trigger the a new email of type escalation_state +1.

    //if the escalation state is already 4 (notify manager) do what?

    // add jobs here.
}

function createEmailText(level:number=1):string{
    const preamble:string = email_text[level].text+'\n';
    const suffix : string = '';
    let data ='';
    userDocumentData.map(doc=>{
        data += doc.documentqtid + '\t'+ doc.rev + '\t'+doc.documenttitle+'\n'
    })
    const email:string = preamble+data+suffix+'\n'
    return email;
}

function createEmailHtml(level:number=1):string{

    const preamble:string = `<html><div><p>${email_text[level].text}</p><br><div><table>`;
    const table_header:string = '<thead><tr><td>Document Id</td><td>Revision</td><td>Name</td></tr></thead>';
    const suffix : string = '</table></div></div></html>';
    let data:string = '';
    userDocumentData.map(doc=>{
        data+=`<tr><td><a href='${process.env.QT9LINK+doc.documentid}'>${doc.documentqtid}</a></td><td>${doc.rev}</td><td>${doc.documenttitle}</td></tr></tr>`
    })
    const email:string = preamble+table_header+data+suffix+'\n'
    return email;
}

function createTransport(){
    const hostname = process.env.HOSTNAME;
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    const transporter = nodemailer.createTransport({
      host: hostname,
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: username,
        pass: password,
      },
      logger: true
    });
    return transporter;
}

function processdataperpeson(){
    getUserData();
    userdata?.map(async user=>{
        userDocumentData = await getDocumentsPerPerson(user.userid);
        userDocumentData.map(docs=>{
            console.log(docs.documentqtid);
        })
    })
    console.log(userdata?.length+' users processed');
}

function Main (){
    processbasedata(createTransport());
    //processManagerAuthRequests();

    processdataperpeson();
    housekeeping();
}

Main();
