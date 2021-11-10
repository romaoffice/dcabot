const ccxt = require("ccxt");
const fs = require('fs');
const _ = require('lodash');
var term = require( 'terminal-kit' ).terminal ;
var Mutex = require('async-mutex').Mutex;
const mutex = new Mutex();
var {preparePrice,get_signal} = require('./indicators');
const {prepare_number,timestampToString} = require('../utils');

const {
    marketplace,
    tokenlist,
    apiKey,
    secret,
    interval,
    htfIntrerval,
    fiboPeriod,

    stoPeriod,
    stoSignalPeriod,
    stoLevel,
    rsiPeriod,
    rsiLevel,

    emaPeriod,

    firstEntry,
    saftyOrderCount,
    nextEntry,
    threshold
} = require('./config');
const options =  require('./config');
let dcaLevel,status;
var myArgs = process.argv.slice(2);
let bot_index =myArgs.length>0 ? parseInt(myArgs[0]):0;

const token  = tokenlist[bot_index];

let status_messages=['',''];
const ui_lines = 4;

const enhancedExchangeID = 'binance';
const exchange = new ccxt[enhancedExchangeID]({
    apiKey,
    secret,
    options: { adjustForTimeDifference: true, 
        recvWindow: 60000,
        warnOnFetchOpenOrdersWithoutSymbol: false,
        createMarketBuyOrderRequiresPrice: false },
});

prepare_number();

let markets ;
let symbol = token+"/"+marketplace;
let precision;

const init  = async ()=>{
    try{
        try{
            status =  JSON.parse(fs.readFileSync('./tmp/'+token+'.json'));
        }catch{
            status = undefined;
        }
        dcaLevel = await get_dcalevel();
        markets = await exchange.fetchMarkets();
        const mdata  = _.find(markets, o => o.symbol === symbol);
        precision = mdata.precision;
    }catch(e){
        add_log('failed to init,try again('+e.message.slice(0,20)+"...)",true );
        await showui();
        setTimeout(init,2000);
        return;
    }
    await closeAllOrders();
            
    //await cancelAllOrders();
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
    try{
        await cancelAllOrders();

        const price_all = await exchange.fetchTicker(symbol);
        const price = price_all.bid;
        const current_price =price; 

        const balance_all_ = await exchange.fetchBalance();
        const tokenbalance = balance_all_[token].total;
        if(tokenbalance>0){
            await exchange.createMarketOrder(symbol,"sell",tokenbalance.toFixedNumber(precision.amount).noExponents(),current_price);             
        }
    }catch{
        
    }
}
let lastchecktime =0;
let signal;

const get_dcalevel = async()=>{
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
    const balance_all_ = await exchange.fetchBalance();
    const tokenbalance = balance_all_[token].free;
    const level = buyorders==0?((sellorders==0 && (status==undefined || tokenbalance<status.amount))?-1:options.saftyOrderCount):options.saftyOrderCount-buyorders+1;
    if(status && tokenbalance>=status.amount && buyorders==0 && sellorders==0){
        const ordersell = await exchange.createLimitSellOrder(symbol,status.amount.toFixedNumber(precision.amount).noExponents(),status.price.toFixedNumber(precision.price).noExponents());
        add_log('sent stoploss order.');
    }
    return(level);
}
const watchmarket = async()=> {
 
    try {
        const h4price = await preparePrice(symbol,options.interval,exchange,500)
        const d1price = await preparePrice(symbol,options.htfIntrerval,exchange,500)
        if(lastchecktime!=h4price.t[h4price.t.length-2]){//new bar

            lastchecktime = h4price.t[h4price.t.length-2];
            signal = get_signal(h4price,d1price,options);

             if(signal.signal==1 && dcaLevel==-1){//get buy signal
            // if( dcaLevel==-1){//get buy signal
                dcaLevel = 0;
                let balance_all = await exchange.fetchBalance();
                const balance =balance_all[marketplace].free; 
                const buylot = balance*options.firstEntry/100;
                const range = (100+threshold)/100;
                const direction = signal.fibLevel[signal.closestLevelIndex+1].value<signal.fibLevel[signal.closestLevelIndex-1].value?1:-1;
                const amountFirstBuy = (buylot/(range*signal.fibLevel[signal.closestLevelIndex+direction].value)).toFixedNumber(precision.amount).noExponents();
                let orderbuy = await exchange.createLimitBuyOrder(symbol,amountFirstBuy,(signal.fibLevel[signal.closestLevelIndex+direction].value*range).toFixedNumber(precision.price).noExponents());
                let orderTotalAmount = parseFloat(amountFirstBuy);
                for(let i=2;i<2+options.saftyOrderCount;i++){
                    const price = signal.fibLevel[signal.closestLevelIndex+direction*i].value*range;
                    const amountNextBuy = (buylot*options.nextEntry/100/price).toFixedNumber(precision.amount).noExponents();
                    orderTotalAmount = orderTotalAmount+parseFloat(amountNextBuy);
                    const orderbuy = await exchange.createLimitBuyOrder(symbol,amountNextBuy,price.toFixedNumber(precision.price).noExponents());
                }
                // const params = {
                //     'stopPrice': parseFloat(signal.fibLevel[signal.closestLevelIndex+direction*(1+options.saftyOrderCount)].value.toFixedNumber(precision.price)),
                //     'type': 'STOP_LOSS_LIMIT',
                //     "timeInForce": "GTC"
                // }
                //const ordersell = exchange.createOrder (symbol, "STOP_LOSS_LIMIT", "SELL", orderTotalAmount.toFixedNumber(precision.amount).noExponents(), signal.fibLevel[signal.closestLevelIndex+direction*(2+options.saftyOrderCount)].value.toFixedNumber(precision.price).noExponents(), params)
                status = {amount:orderTotalAmount,price:signal.fibLevel[signal.closestLevelIndex+direction*(2+options.saftyOrderCount)].value.toFixedNumber(precision.price).noExponents()};
                fs.writeFileSync('./tmp/'+token+'.json',JSON.stringify(status));
                //const ordersell = await exchange.createLimitSellOrder(symbol,orderTotalAmount.toFixedNumber(precision.amount).noExponents(),signal.fibLevel[signal.closestLevelIndex+direction*(2+options.saftyOrderCount)].value.toFixedNumber(precision.price).noExponents(),params);
            }
            if(signal.closeSignal==1 && dcaLevel>=0){//get close signal
                closeAllOrders();
                add_log("DCA terminated by close condition.");
            }
            const dcaLevelNew = await get_dcalevel();
            if(dcaLevelNew!=dcaLevel){//changed dca level
                if(dcaLevelNew==0){
                    add_log("Positions closed.");
                }
                add_log("DCA level changed.");
            }
            dcaLevel = dcaLevelNew;
        }
        await showui(signal,h4price);
    }catch(e){
        console.log(e);
        //add_log(e.message.slice(0,50),true)
    }
 
 setTimeout(watchmarket,5000);
}

const add_log = (log,iserror=false)=>{
    for(let i=0;i<status_messages.length-1;i++){
        status_messages[i] =status_messages[i+1];
    }
    status_messages[status_messages.length-1] =log;
}

const showui =async(signal,prices)=>{
    await mutex.runExclusive(async () => {
        term.moveTo( 1 , 1+bot_index*ui_lines) ;
        for(let i=0;i<ui_lines;i++){
            term('                                                                                                  \n');
        }
        term.moveTo( 1 , 1+bot_index*ui_lines) ;
        if(signal && signal.fibLevel!=undefined){
            term.bold.green(token)("[fibzone(%f-%f),last close(%f),ema=%f,rsi=%f,sto=%f,last bar time=%s/%s]\n",
            signal.fibLevel[signal.closestLevelIndex+1].value.toFixed(precision.price), 
            signal.fibLevel[signal.closestLevelIndex-1].value.toFixed(precision.price),
            prices.c[prices.c.length-1],
            signal.ema.toFixed(precision.price),
            signal.rsi.toFixed(2),
            signal.sto.toFixed(2),
            timestampToString(lastchecktime),
            timestampToString(Date.now()));
        } 
        if(dcaLevel==-1){
            term("Waiting signal.No position.\n");
        }        
        if(dcaLevel==0){
            term("Sent limit order.Waiting filling for first limit order.\n");
        }
        if(dcaLevel>0){
            term("DCA level = %d\n",dcaLevel);
        }        
        // if(dcalevel>0 && dcalimit.length>dcalevel-1){
        //     if(dcalevel>maxdcalevel){
        //         term("dca level :%d,tp:%f,sl:%f,tr stop:%f\n",dcalevel-1,dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents(),sl>0?stoploss:0,trprice);
        //     }else{
        //         term("dca level :%d, next:%f,tp:%f,sl:%f,tr stop:%f\n",dcalevel-1,dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents(),dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents(),sl>0?stoploss:0,trprice);
        //     }
        // }
        
        for(let i=0;i<status_messages.length;i++){
            term.gray("%s\n",status_messages[i]);
        }
    });
}


init();