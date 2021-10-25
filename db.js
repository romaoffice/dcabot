var MySql = require('sync-mysql');
 
var connection;

const inittoken  = {"tporderid":-1,"dcaorderid":-1,"averageprice":[],"totalqty":[],"deals_id":-1,"dcalevel":0,"dcatp":[],"openprice":0,"dcalimit":[],"stoploss":0,"dcatrlevel":[],'trprice':0};
const {
  host,
  user,
  password,
  database
} = require('./config');


const init_mysql=()=>{
   connection = new MySql({
    host: host,
    user: user,
    password: password,
    database: database
  });
  }
const addq=(data)=>{
  return "'"+data+"'";
}
const addqc = (data)=>{
  return "`"+data+"`";
}
const get_insert_sql = (data,table)=>{
 
  let columns = '';
  let values = '';
  Object.keys(data).map((key)=>{
    columns = columns+(columns===''?addqc(key):','+addqc(key));
    values = values + (values===''?addq(data[key]):','+addq(data[key]));
  })
  const sqlquery = `INSERT INTO \`${table}\` (${columns}) VALUES (${values})`;
  return(sqlquery);

}

const get_update_sql = (id,data,table,idfield='id')=>{
 
  let values = '';
  Object.keys(data).map((key)=>{
    const f = addqc(key)+"="+addq(data[key]);
    values = values + (values===''?f:','+f);
  })
  const sqlquery = `UPDATE  ${table} set ${values} where ${idfield}=${id}`;
  return(sqlquery);

}

const insert_deals =(data)=>{
  const sqlquery = get_insert_sql(data,"deals");
  const result = connection.query(sqlquery);
  return(result);
}

const update_deals = (id,data)=>{
  const sqlquery = get_update_sql(id,data,'deals');
  const result = connection.query(sqlquery);
  return(result);
}

const insert_errors = async(data)=>{
  const sqlquery = get_insert_sql(data,"errors");
  const result = connection.query(sqlquery);
  return(result);
}

const insert_orders = (data)=>{
  const sqlquery = get_insert_sql(data,"orders");
  const result = connection.query(sqlquery);
  return(result);
}
const update_orders =(id,data)=>{
  const sqlquery = get_update_sql(id,data,'orders','order_id');
  const result = connection.query(sqlquery);
  return(result);
} 
const getstatus_tokens = (token)=>{
  let ret = {};
  const result = connection.query("SELECT * FROM tokens where token=?", [token])
  if(result.length==0){
    ret = {"tporderid":-1,"dcaorderid":-1,"averageprice":[],"totalqty":[],"deals_id":-1,"dcalevel":0,"dcatp":[],"openprice":0,"dcalimit":[],"stoploss":0,"dcatrlevel":[],'trprice':0};
    const result = connection.query("insert into tokens (token,settings_value) VALUES  (?,?)", [token,JSON.stringify(ret)])
  }else{
    ret = JSON.parse(result[0].settings_value);
  }
  return(ret);  
}
const setstatus_tokens = (token,data)=>{
  const result = connection.query("UPDATE tokens set settings_value=? where token=?", [JSON.stringify(data),token])
  return(result);  
}
module.exports = {
  insert_deals: insert_deals,
  update_deals:update_deals,
  setstatus_tokens: setstatus_tokens,
  getstatus_tokens:getstatus_tokens,
  insert_errors: insert_errors,
  insert_orders: insert_orders,
  update_orders:update_orders,
  init_mysql:init_mysql,
  inittoken:inittoken
}

//console.log(update_deals(14,{s_date:'2021-10-23',e_date:'2022-10-23'}));