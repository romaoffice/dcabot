const ccxt = require("ccxt");
const _ = require('lodash');
var term = require( 'terminal-kit' ).terminal ;
var Mutex = require('async-mutex').Mutex;
const mutex = new Mutex();
const db = require("./db");

const {get_rsi,prepare_number} = require('./utils');

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
} = require('./config');

let deals_id,dcalevel,dcatp,dcalimit,openprice,status,stoploss,dcatrlevel,
    trprice,tporderid,dcaorderid,averageprice,totalqty;
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

prepare_number();

let markets ;
let symbol = token+"/"+marketplace;
let precision;

const initvarbyjson = (status)=>{
    deals_id = status.deals_id;
    dcalevel = status.dcalevel;
    dcatp = status.dcatp;
    dcalimit = status.dcalimit;
    dcatrlevel = status.dcatrlevel;
    trprice = status.trprice;
    openprice = status.openprice;
    stoploss = status.stoploss;
    tporderid = status.tporderid;
    dcaorderid = status.dcaorderid;
    averageprice = status.averageprice;
    totalqty=status.totalqty;

}
const init  = async ()=>{
    try{
        db.init_mysql();
        status = db.getstatus_tokens(token)
        initvarbyjson(status);

        markets = await exchange.fetchMarkets();
        const mdata  = _.find(markets, o => o.symbol === symbol);
        precision = mdata.precision;

    }catch(e){
        add_log('failed to init,try again('+e.message.slice(0,20)+"...)",true );
        await showui();
        setTimeout(init,2000);
        return;
    }
    //await cancelAllOrders();
    watchmarket();
}
const cancelAllOrders = async()=>{
    const openorders = await exchange.fetchOpenOrders (symbol);
    const order_count = openorders.length;
    
    for(let i=0;i<order_count;i++){
        await exchange.cancelOrder(openorders[i].id,symbol);
        db.update_orders(openorders[i].id,{order_status:'canceled'})
    }
}
const closeAllOrders = async()=>{
    await cancelAllOrders();
    const balance_all_ = await exchange.fetchBalance();
    const tokenbalance = balance_all_[token].total;
    await exchange.createMarketOrder(symbol,"sell",tokenbalance.toFixedNumber(precision.amount).noExponents(),current_price);             
    await init_status();
}
const watchmarket = async()=> {
 
    try {
        const price_all = await exchange.fetchTicker(symbol);
        const price = price_all.bid;
        current_price =price; 
        const rsi_current_value = await get_rsi(exchange,symbol,rsi_interval);
        rsivalue = rsi_current_value!=undefined?rsi_current_value:rsivalue;        
        working_zone = (price>minprice && price<maxprice && (rsi_level==0 || rsivalue<rsi_level));
        await showui();
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
            await cancelAllOrders();
            db.update_deals(deals_id,{
                'deal_status':'Closed',
                'e_date':new Date().toISOString(),
                'status':'Take profit',
                'avg_exit_price':averageprice[dcalevel-1],
                'exit_qty':totalqty[dcalevel-1],
                'exit_total':averageprice[dcalevel-1]*totalqty[dcalevel-1],
            })

            await init_status();

            const balance_all_ = await exchange.fetchBalance();
            add_log("Terminated trade with profit.Current balance="+balance_all_[marketplace].total);
            await showui();
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }

        if(dcalevel ==0 && order_count>0){
            add_log("Found wrong position with config file.try close all orders.")
            await closeAllOrders();
            await showui();        
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }

        if(dcalevel>0 && sl>0 && price <stoploss){
            add_log("The price hit stoploss.Try close all orders.")
            db.update_deals(deals_id,{
                'deal_status':'Closed',
                'e_date':new Date().toISOString(),
                'status':'hit stoploss',
                'avg_exit_price':price,
                'exit_qty':totalqty[dcalevel-1],
                'exit_total':price*totalqty[dcalevel-1],
            })
            await closeAllOrders();
            await showui();        
            if(continueflag){
                setTimeout(watchmarket,2000);
            }        
            return;
        }
        if(dcalevel>0 && trstart>0 &&  trprice>0 && price<trprice){
            add_log("The price hit trailling stop.Try close all order");
            db.update_deals(deals_id,{
                'deal_status':'Closed',
                'e_date':new Date().toISOString(),
                'status':'hit trailling stop',
                'avg_exit_price':price,
                'exit_qty':totalqty[dcalevel-1],
                'exit_total':price*totalqty[dcalevel-1],
            })
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
            averageprice=[];
            totalqty=[];
            trprice=0;
            dcatp[0] = tpstart;
            dcatrlevel[0] = price * (100+trstart)/100;;
            let allbuy_marketplace = buylot;
            let allbuy_token = buylot/price;
            averageprice[0] = price;
            totalqty[0] = allbuy_token

            for (let i=0;i<maxdcalevel;i++){
                dcalimit[i] = [buylot*dca[i][1]/100,price * (100-dca[i][0])/100];
                const buy_marketplace =  dcalimit[i][0];
                const buy_token =  dcalimit[i][0]/dcalimit[i][1];
                allbuy_marketplace = allbuy_marketplace + buy_marketplace;
                allbuy_token = allbuy_token + buy_token;
                
                totalqty[i+1] =allbuy_token;
                averageprice[i+1] = allbuy_marketplace/allbuy_token;

                dcatp[i+1] = (allbuy_marketplace*(100+tp)/100)/allbuy_token;
                dcatrlevel[i+1] = (allbuy_marketplace*(100+trstart)/100)/allbuy_token;
            }
            const rt = db.insert_deals({
                's_date':new Date().toISOString(),
                'pair':token,
                'based':marketplace,
                'avg_entry_price':price.toFixedNumber(precision.price).noExponents(),
                'entry_price':price.toFixedNumber(precision.price).noExponents(),
                'entry_total':cost,
                'take_profit':dcatp.join(','),
                'DCA_No':0,
                'deal_status':'Open'
            })
            deals_id = rt.insertId;
            db.insert_orders({
                'deal_id':deals_id,
                'date':new Date().toISOString(),
                'order_id':order.id,
                'pair':token,
                'based':marketplace,
                'side':'buy',
                'type':'market',
                'qty':cost,
                'usdt':buylot,
                'average':price.toFixedNumber(precision.price).noExponents(),
                'order_type':'Based Order',
                'status':'filled',
                'level':0,
                'fee':order.fee,
                'role':'taker',
                'order_status':'open'
            })
            const orderbuy = await exchange.createLimitBuyOrder(symbol,(dcalimit[0][0]/dcalimit[0][1]).toFixedNumber(precision.amount).noExponents(),dcalimit[0][1]);
            const rt_orders_buy = db.insert_orders({
                'deal_id':deals_id,
                'date':new Date().toISOString(),
                'order_id':orderbuy.id,
                'pair':token,
                'based':marketplace,
                'side':'buy',
                'type':'limit',
                'qty':(dcalimit[0][0]/dcalimit[0][1]).toFixedNumber(precision.amount).noExponents(),
                'usdt':dcalimit[0][0],
                'average':dcalimit[0][1].toFixedNumber(precision.price).noExponents(),
                'order_type':'Based Order',
                'status':'New',
                'level':1,
                'fee':orderbuy.fee,
                'role':'taker',
                'order_status':'open'
            })
            
            balance_all = await exchange.fetchBalance();
            const tokenbalance = balance_all[token].total;
            const ordersell = await exchange.createLimitSellOrder(symbol,tokenbalance.toFixedNumber(precision.amount).noExponents(),tpstart.toFixedNumber(precision.price).noExponents());
            const rt_orders_sell=db.insert_orders({
                'deal_id':deals_id,
                'date':new Date().toISOString(),
                'order_id':ordersell.id,
                'pair':token,
                'based':marketplace,
                'side':'sell',
                'type':'limit',
                'qty':tokenbalance,
                'usdt':tpstart*tokenbalance,
                'average':tpstart.toFixedNumber(precision.price).noExponents(),
                'order_type':'Based Order',
                'status':'New',
                'level':1,
                'fee':ordersell.fee,
                'role':'Seller',
                'order_status':'open'
            })
            tporderid = rt_orders_sell.insertId;
            dcaorderid = rt_orders_buy.insertId;
            dcalevel = 1;
            await write_status();
            add_log("Place orders.Max dca level="+maxdcalevel);
        }else{
            if(dcalevel>0 && dcalevel<maxdcalevel && buyorders==0){
                exchange.cancelOrder(sellorderid,symbol);
                db.update_orders(sellorderid,{order_status:'canceled'})
                dcalevel++;
                let balance_all = await exchange.fetchBalance();
                const tokenbalance = balance_all[token].total;
                const ordersell = await exchange.createLimitSellOrder(symbol,tokenbalance.toFixedNumber(precision.amount).noExponents(),(dcatp[dcalevel-1]).toFixedNumber(precision.price).noExponents());
                const orderbuy = await exchange.createLimitBuyOrder(symbol,(dcalimit[dcalevel-1][0]/dcalimit[dcalevel-1][1]).toFixedNumber(precision.amount).noExponents(),dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents());
                const rt_orders_buy = db.insert_orders({
                    'deal_id':deals_id,
                    'date':new Date().toISOString(),
                    'order_id':orderbuy.id,
                    'pair':token,
                    'based':marketplace,
                    'side':'buy',
                    'type':'limit',
                    'qty':(dcalimit[dcalevel-1][0]/dcalimit[dcalevel-1][1]).toFixedNumber(precision.amount).noExponents(),
                    'usdt':dcalimit[dcalevel-1][0],
                    'average':dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents(),
                    'order_type':'Based Order',
                    'status':'New',
                    'level':1,
                    'fee':orderbuy.fee,
                    'role':'taker',
                    'order_status':'open'
                })
                const rt_orders_sell=db.insert_orders({
                    'deal_id':deals_id,
                    'date':new Date().toISOString(),
                    'order_id':ordersell.id,
                    'pair':token,
                    'based':marketplace,
                    'side':'sell',
                    'type':'limit',
                    'qty':tokenbalance,
                    'usdt':dcatp[dcalevel-1]*tokenbalance,
                    'average':dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents(),
                    'order_type':'Based Order',
                    'status':'New',
                    'level':1,
                    'fee':ordersell.fee,
                    'role':'Seller',
                    'order_status':'open'
                })

                db.update_deals(deals_id,{
                    'avg_entry_price':averageprice[dcalevel-1].toFixedNumber(precision.price).noExponents(),
                    'entry_total':totalqty[dcalevel-1].toFixedNumber(precision.amount).noExponents(),
                    'DCA_no':dcalevel-1
                })

                tporderid = rt_orders_sell.insertId;
                dcaorderid = rt_orders_buy.insertId;
                            
                await write_status();
                add_log("Filled dca limit order.Placed next dca order "+(dcalevel-1));
            }
        }

    }catch(e){
        add_log(e.message.slice(0,50),true)
    }
 
 setTimeout(watchmarket,2000);
}

const add_log = (log,iserror=false)=>{
    if(iserror){
        db.insert_errors({
            'desc' :log,
            'date':new Date().toISOString(),
            'status':'error',
            'pairs':token,
            'based':marketplace 
        })
    }
    for(let i=0;i<status_messages.length-1;i++){
        status_messages[i] =status_messages[i+1];
    }
    status_messages[status_messages.length-1] =log;
}

const showui =async()=>{
    await mutex.runExclusive(async () => {
        term.moveTo( 1 , 1+bot_index*ui_lines) ;
        for(let i=0;i<ui_lines;i++){
            term('                                                                                                  \n');
        }
        term.moveTo( 1 , 1+bot_index*ui_lines) ;
        term.bold.green(token)("[%s:",working_zone?'working zone':'waiting zone').yellow(current_price)("(%f-%f),rsi(%d)]\n",minprice,maxprice,rsivalue);
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
    });
}


const write_status = async()=>{
    const json = {
        "deals_id":deals_id,
        "dcalevel":dcalevel,
        "dcatp":dcatp,
        "dcalimit":dcalimit,
        "openprice":openprice,
        "stoploss":stoploss,
        "dcatrlevel":dcatrlevel,
        "trprice":trprice,
        "tporderid": tporderid,
        "dcaorderid": dcaorderid,
        "averageprice":averageprice,
        "totalqty":totalqty
    };
    db.setstatus_tokens(token,json)
}

const init_status = async()=>{
    status = db.inittoken;
    initvarbyjson(status);
    await write_status();
}

init();