//# sourceMappingURL=app.js.map
import pgPromise from 'pg-promise';
import nodemailer from 'nodemailer';
import dotenv from "dotenv";
import morgan from "morgan";


dotenv.config();

const port = parseInt(process.env.PGPORT || "5432",10);
let transporter;


type email = {from:string,to:string,subject:string,text:string,html:string,headers:unknown}

let listOfEmails:email[];

morgan('dev');


const config = {
    database: process.env.PGDATABASE || "training",
    host: process.env.PGHOST || "localhost",
    port,
    user : process.env.PGUSER || "postgres",
    password:process.env.PGPASSWORD || "postgres"
};

let email_text:string = '';
let email_html:string;

const email_text_language = [{id_level:1,text:"A new version of these documents has been published. Please review and document your training in the next three (3) weeks. "}
                    ,{id_level:2,text:"A new version of these documents has been published. Please review and document your training."}
                    ,{id_level:3,text:"A new version of these documents has been published. Please review and document your training. In one (1) week, an email notification will be sent to your direct supervisor"}
                    ,{id_level:4,text:"A new version of these documents has been published. This training is considered overdue. This notification has been escalated to your direct supervisor. "}];

const pgp  = pgPromise();
const db = pgp(config);


type userdata_type = {userid:number,username:string,email_address:string};
type userDocumentData_type = {userid:number,documentid:number,documentqtid:string,documenttitle:string,rev:string,risklevel:number};


let userdata  : userdata_type [] ;


function initServices(){
    createTransport();
}

async function initData(){
    console.log('entering initdata.........');
    const userdata_res = await db.any('select distinct userid,username,email_address from user_training_needed order by userid; ',);
    console.log(JSON.stringify(userdata_res));
    userdata = userdata_res;
    console.log('exiting initdata');
    //userdata : userdata [] = userdata_res
}

function createTransport(){
    const hostname = process.env.HOSTNAME;
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    transporter = nodemailer.createTransport({
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
}



function processUsersAndCreateEmails(level:number){

    userdata.map(user=>{
    //create email and add to email_list

        email_text = email_text_language[level].text+getUserEmailText(user.userid,level);
        const email_response :email = {  
                from :'"QT9 Training App" <qt9training@mybinxhealth.com>',
                to: user.email_address,
                subject:'Training Update from QT9',
                text:email_text,
                html:email_html,
                headers:{'x-qt9':Date.now.toString()}
            } 
            console.log(email_response);
        listOfEmails.push(email_response);  
    });
}

async function getUserEmailText(userid:number,level:number){
    const userDocumentData = await db.one(`select distinct userid,documentid,documentqtid,documenttitle,rev from user_training_needed where userid = ${userid} order by documentid`,);
    getUserHtmlData(userDocumentData,level);

    const preamble:string = email_text_language[level].text+'\n';
    const suffix : string = '';
    let data ='';
    userDocumentData.map(doc=>{
        data += doc.documentqtid + '\t'+ doc.rev + '\t'+doc.documenttitle+'\n'
    })
     email_text = preamble+data+suffix+'\n'
    return email_text;
}

function getUserHtmlData(docs:userDocumentData_type[],level:number){

    const preamble:string = `<html><div><p>${email_text_language[level].text}</p><br><div><table>`;
    const table_header:string = '<thead><tr><td>Document Id</td><td>Revision</td><td>Name</td></tr></thead>';
    const suffix : string = '</table></div></div></html>';
    let data:string = '';
    docs.map(doc=>{
        data+=`<tr><td><a href='${process.env.QT9LINK+doc.documentid}'>${doc.documentqtid}</a></td><td>${doc.rev}</td><td>${doc.documenttitle}</td></tr></tr>`
    })
    const email_html:string = preamble+table_header+data+suffix+'\n' 
    return email_html;
}

function sendEmail(){
    listOfEmails.map(email=>{
    transporter.sendMail(email)
    });
}

function housekeeping(){

}

function exiting(){
    transporter = null;
}

function Main(){

    //setup 
    initServices();
    initData();

    //process
    processUsersAndCreateEmails(0);

    //send data
    //sendEmail(); <-- uncomment to send emails.


    //tidy up
    housekeeping();
    exiting();

}





Main();