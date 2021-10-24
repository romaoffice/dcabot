const fs = require("fs");
const ccxt = require("ccxt");
const _ = require('lodash');
var term = require( 'terminal-kit' ).terminal ;
var RSI = require('technicalindicators').RSI;

const {
    marketplace,
    apiKey,
    secret,
    continueflag,
    tokenlist,
    buyamount,
    tp,
    sl,
    rsi_level,
    rsi_interval,
    trstart,
    trstop,
    dca
} = require('./config_multi');

const status_file_name = 'status_multi_symbol.json'
let dcalevel,dcatp,dcalimit,openprice,status,stoploss,dcatrlevel,trprice;

var myArgs = process.argv.slice(2);
let bot_index =myArgs.length>0 ? parseInt(myArgs[0]):0;

const token  = tokenlist[bot_index].token;
const minprice  = tokenlist[bot_index].min;
const maxprice = tokenlist[bot_index].max;

let rsivalue=0;
let status_messages=['',''];
const ui_lines = 4;
let working_zone = true;
let current_price=0;

const maxdcalevel = dca.length;
const enhancedExchangeID = 'binance';
const exchange = new ccxt[enhancedExchangeID]({
    apiKey,
    secret,
    options: { adjustForTimeDifference: true, 
        recvWindow: 10000,
        warnOnFetchOpenOrdersWithoutSymbol: false,
        createMarketBuyOrderRequiresPrice: false },
});

Number.prototype.toFixedNumber = function(x, base) {
    const pow = Math.pow(base || 10, x);
    return +(Math.floor(this * pow) / pow);
};

Number.prototype.noExponents = function() {
    const data = String(this).split(/[eE]/);
    if (data.length == 1) return data[0];
    let z = '';
    const sign = this < 0 ? '-' : '';
    const str = data[0].replace('.', '');
    let mag = Number(data[1]) + 1;
    if (mag < 0) {
        z = `${sign}0.`;
        while (mag++) z += '0';
        return z + str.replace(/^\-/, '');
    }
    mag -= str.length;
    while (mag--) z += '0';
    return str + z;
};

let markets ;
let symbol = token+"/"+marketplace;
let precision;

const init  = async ()=>{
    
    status = JSON.parse(fs.readFileSync(status_file_name, 'utf8'));

    if(status[token]==undefined){
        status[token] = {"dcalevel":0,"dcatp":[],"openprice":0,"dcalimit":[],"stoploss":0,"dcatrlevel":[],'trprice':0}
    }

    dcalevel = status[token].dcalevel;
    dcatp = status[token].dcatp;
    dcalimit = status[token].dcalimit;
    dcatrlevel = status[token].dcatrlevel;
    trprice = status[token].trprice;
    openprice = status[token].openprice;
    stoploss = status[token].stoploss;
    markets = await exchange.fetchMarkets();
     const mdata  = _.find(markets, o => o.symbol === symbol);
     precision = mdata.precision;
     watchmarket();
}
const cancelAllOrders = async()=>{
    const openorders = await exchange.fetchOpenOrders (symbol);
    const order_count = openorders.length;
    
    for(let i=0;i<order_count;i++){
        await exchange.cancelOrder(openorders[i].id,symbol);
    }
}
const closeAllOrders = async()=>{
    const balance_all_ = await exchange.fetchBalance();
    const tokenbalance = balance_all_[token].total;
    const openorders = await exchange.fetchOpenOrders (symbol);
    const order_count =openorders.length; 
    for(let i=0;i<order_count;i++){
        await exchange.cancelOrder(openorders[i].id,symbol);
    }
    await exchange.createMarketOrder(symbol,"sell",tokenbalance.toFixedNumber(precision.amount).noExponents(),current_price);             
    await init_status();
    add_log("Closed all orders in "+token);
}
const watchmarket = async()=> {
 
    try {
        const price_all = await exchange.fetchTicker(symbol);
        const price = price_all.bid;
        current_price =price; 
        const rsi_current_value = await get_rsi();
        rsivalue = rsi_current_value!=undefined?rsi_current_value:rsivalue;        
        working_zone = (price>minprice && price<maxprice && rsivalue<rsi_level);
        showui();
        const openorders = await exchange.fetchOpenOrders (symbol);
        const order_count = openorders.length;
        let sellorders =0;
        let sellorderid = 0;
        let buyorders =0;
        
        for(let i=0;i<order_count;i++){
            if(openorders[i].side=='sell'){
                sellorders ++;
                sellorderid = openorders[i].id;
            }else{
                buyorders ++;
            }
        }

        if(dcalevel>0 && sellorders==0){
            cancelAllOrders();
            await init_status();
            const balance_all_ = await exchange.fetchBalance();
            add_log("Terminated trade with profit.Current balance="+balance_all_[marketplace].total);
            showui();
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }

        if(dcalevel ==0 && order_count>0){
            add_log("Found wrong position with config file.try close all orders.")
            await closeAllOrders();
            showui();        
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }

        if(dcalevel>0 && sl>0 && price <stoploss){
            add_log("The price hit stoploss.Try close all orders.")
            await closeAllOrders();
            showui();        
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }
        if(dcalevel>0 && trstart>0 &&  trprice>0 && price<trprice){
            add_log("The price hit trailling stop.Try close all order");
            await closeAllOrders();
            add_log("Closed all orders with profit.");
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }

        if(dcalevel>0 && trstart>0 &&  trprice==0 && price >dcatrlevel[dcalevel-1]){
            add_log("The trailling stop started.")
            trprice = dcatrlevel[dcalevel-1];
            await write_status();
        }
        if(dcalevel>0 && trstart>0 &&  trprice>0 && price*(100-trstop)/100 >trprice){
            add_log("The trailling stop moved to ."+(price*(100-trstop)/100));
            trprice = price*(100-trstop)/100;
            await write_status();
        }

        if(dcalevel==0 && working_zone){
            let balance_all = await exchange.fetchBalance();
            const balance =balance_all[marketplace].free; 
            const buylot = balance*buyamount/100;
            const cost = (buylot/price).toFixedNumber(precision.amount).noExponents();
            const order = await exchange.createMarketBuyOrder(symbol,cost);
            openprice = price;
            const tpstart = price * (100+tp)/100;
            stoploss = price *(100-sl)/100;
            dcalimit = [];
            dcatp = [];
            dcatrlevel=[];
            trprice=0;
            dcatp[0] = tpstart;
            dcatrlevel[0] = price * (100+trstart)/100;;
            let allbuy_marketplace = buylot;
            let allbuy_token = buylot/price;

            for (let i=0;i<maxdcalevel;i++){
                dcalimit[i] = [buylot*dca[i][1]/100,price * (100-dca[i][0])/100];
                const buy_marketplace =  dcalimit[i][0];
                const buy_token =  dcalimit[i][0]/dcalimit[i][1];
                allbuy_marketplace = allbuy_marketplace + buy_marketplace;
                allbuy_token = allbuy_token + buy_token;
                dcatp[i+1] = (allbuy_marketplace*(100+tp)/100)/allbuy_token;
                dcatrlevel[i+1] = (allbuy_marketplace*(100+trstart)/100)/allbuy_token;
            }

            await exchange.createLimitBuyOrder(symbol,(dcalimit[0][0]/dcalimit[0][1]).toFixedNumber(precision.amount).noExponents(),dcalimit[0][1]);
            
            
            balance_all = await exchange.fetchBalance();
            const tokenbalance = balance_all[token].total;
            exchange.createLimitSellOrder(symbol,tokenbalance.toFixedNumber(precision.amount).noExponents(),tpstart.toFixedNumber(precision.price).noExponents());
            dcalevel = 1;
            await write_status();
            add_log("Place orders.Max dca level="+maxdcalevel);
        }else{
            if(dcalevel>0 && dcalevel<maxdcalevel && buyorders==0){
                exchange.cancelOrder(sellorderid,symbol);
                dcalevel++;
                let balance_all = await exchange.fetchBalance();
                const tokenbalance = balance_all[token].total;
                await exchange.createLimitSellOrder(symbol,tokenbalance.toFixedNumber(precision.amount).noExponents(),(dcatp[dcalevel-1]).toFixedNumber(precision.price).noExponents());
                await exchange.createLimitBuyOrder(symbol,(dcalimit[dcalevel-1][0]/dcalimit[dcalevel-1][1]).toFixedNumber(precision.amount).noExponents(),dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents());
                await write_status();
                add_log("Filled dca limit order.Placed next dca order "+(dcalevel-1));
            }
        }

    }catch(e){
        add_log(e.message)
    }
 
 setTimeout(watchmarket,2000);
}

const add_log = (log)=>{
    for(let i=0;i<status_messages.length-1;i++){
        status_messages[i] =status_messages[i+1];
    }
    status_messages[status_messages.length-1] =log;
}

const showui =()=>{

    term.moveTo( 1 , 1+bot_index*ui_lines) ;
    for(let i=0;i<ui_lines;i++){
        term('                                                                                                  \n');
    }
    term.moveTo( 1 , 1+bot_index*ui_lines) ;
    term.bold.green(token)("[%s:",working_zone?'working zone':'waiting zone').yellow(current_price)("(%d-%d),rsi(%d)]\n",minprice,maxprice,rsivalue);
    if(dcalevel>0 && dcalimit.length>dcalevel-1){
        if(dcalevel>maxdcalevel){
            term("dca level :%d,tp:%f,sl:%f,tr stop:%f\n",dcalevel-1,dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents(),sl>0?stoploss:0,trprice);
        }else{
            term("dca level :%d, next:%f,tp:%f,sl:%f,tr stop:%f\n",dcalevel-1,dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents(),dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents(),sl>0?stoploss:0,trprice);
        }
    }
    for(let i=0;i<status_messages.length;i++){
        term.gray("%s\n",status_messages[i]);
    }
}

const get_rsi = async()=>{
    try{
        const ohlc = await exchange.fetchOHLCV(symbol, rsi_interval);
        const period =14;
        let values = [];
        for(let i=ohlc.length-period*2;i<ohlc.length;i++){
            values.push(ohlc[i][4]);
        }
        var inputRSI = {
            values : values,
            period : period
        };
        const value = RSI.calculate(inputRSI)
        return(value[value.length-1]);
    }catch(e){
        return(undefined);
    }
}
const write_status = async()=>{
    const json = {
        "dcalevel":dcalevel,
        "dcatp":dcatp,
        "dcalimit":dcalimit,
        "openprice":openprice,
        "stoploss":stoploss,
        "dcatrlevel":dcatrlevel,
        "trprice":trprice
    };
    status[token] = json;
    fs.writeFile(status_file_name, JSON.stringify(status), 'utf8',()=>{});
    
}

const init_status = async()=>{

    status[token] = {"dcalevel":0,"dcatp":[],"openprice":0,"dcalimit":[],"stoploss":0,"dcatrlevel":[],'trprice':0}

    dcalevel = status[token].dcalevel;
    dcatp = status[token].dcatp;
    dcalimit = status[token].dcalimit;
    dcatrlevel = status[token].dcatrlevel;
    trprice = status[token].trprice;
    openprice = status[token].openprice;
    stoploss = status[token].stoploss;

    fs.writeFile(status_file_name, JSON.stringify(status), 'utf8',()=>{});    
}

init();


