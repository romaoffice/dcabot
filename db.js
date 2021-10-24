var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "trading"
});

const connect_db = async()=>{
  try{
    await con.connect()
    return true;
  }catch{
    return false;
  }
}

const insert_deals =async (data)=>{
  try{
    var sql = "INSERT INTO deals (s_date,status,pair,based,avg_entry_price,entry_price,entry_total,take_profit,DCA_no,fees,net_profit_per,net_profit_amount,deal_status) VALUES"+
    " ('Company Inc', 'Highway 37')";
    await con.query(sql);
  
  }catch{
    console.log('error db');
  }
}

const update_deals = async(id,data)=>{

}

const insert_errors = async(data)=>{

}

const insert_orders = async(data)=>{

}
