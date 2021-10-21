const fs = require("fs");
const ccxt = require("ccxt");
const _ = require('lodash');

const {
    marketplace,
    token,
    apiKey,
    secret,
    buyamount,
    tp,
    dca
} = require('./config_multi');

let {
    dcalevel,
    dcatp,
    dcalimit,
    openprice
}= require('./status_multi');

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
const watchmarket = async()=> {
 
    try {
        
        const price_all = await exchange.fetchTicker(symbol);
        const price = price_all.bid;
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

        //side 'sell'
        // const balance_all_ = await exchange.fetchBalance();
        // const tokenbalance = balance_all_[token].total;
        // for(let i=0;i<order_count;i++){
        // await exchange.cancelOrder(openorders[i].id,symbol);
        // }
        // await exchange.createMarketOrder(symbol,"sell",tokenbalance.toFixedNumber(precision.amount).noExponents(),price); 
        

        if(dcalevel>0 && sellorders==0){
            
            cancelAllOrders();
            const json = JSON.stringify({
                "dcalevel":0,
                "dcatp":[],
                "openprice":0,
                "dcalimit":[]
            });
            fs.writeFile('status_multi.json', json, 'utf8',()=>{});
            const balance_all_ = await exchange.fetchBalance();
            console.log("Terminated trade with profit.Current balance=",balance_all_[marketplace].total);
            return;
        }

        if(dcalevel==0){
            let balance_all = await exchange.fetchBalance();
            const balance =balance_all[marketplace].free; 
    
            const buylot = balance*buyamount/100;
            const cost = (buylot/price).toFixedNumber(precision.amount).noExponents();
            const order = await exchange.createMarketBuyOrder(symbol,cost);
            openprice = price;
            const tpstart = price * (100+tp)/100;
            dcalimit = [];
            
            dcatp = [];
            dcatp[0] = tpstart;
            let allbuy_marketplace = buylot;
            let allbuy_token = buylot/price;

            for (let i=0;i<maxdcalevel;i++){
                dcalimit[i] = [buylot*dca[i][1]/100,price * (100-dca[i][0])/100];
                const buy_marketplace =  dcalimit[i][0];
                const buy_token =  dcalimit[i][0]/dcalimit[i][1];
                allbuy_marketplace = allbuy_marketplace + buy_marketplace;
                allbuy_token = allbuy_token + buy_token;
                dcatp[i+1] = (allbuy_marketplace*(100+tp)/100)/allbuy_token;

            }

            await exchange.createLimitBuyOrder(symbol,(dcalimit[0][0]/dcalimit[0][1]).toFixedNumber(precision.amount).noExponents(),dcalimit[0][1]);
            
            
            balance_all = await exchange.fetchBalance();
            const tokenbalance = balance_all[token].total;
            exchange.createLimitSellOrder(symbol,tokenbalance.toFixedNumber(precision.amount).noExponents(),tpstart.toFixedNumber(precision.price).noExponents());
            dcalevel = 1;
            const json = JSON.stringify({
                "dcalevel":dcalevel,
                "dcatp":dcatp,
                "dcalimit":dcalimit,
                "openprice":openprice
            });
            fs.writeFile('status_multi.json', json, 'utf8',()=>{});
            console.log("Place orders.Max dca level=",maxdcalevel);
        }else{
            if(dcalevel<maxdcalevel && buyorders==0){
                exchange.cancelOrder(sellorderid,symbol);
                dcalevel++;
                let balance_all = await exchange.fetchBalance();
                const tokenbalance = balance_all[token].total;
                await exchange.createLimitSellOrder(symbol,tokenbalance.toFixedNumber(precision.amount).noExponents(),(dcatp[dcalevel-1]).toFixedNumber(precision.price).noExponents());
                await exchange.createLimitBuyOrder(symbol,(dcalimit[dcalevel-1][0]/dcalimit[dcalevel-1][1]).toFixedNumber(precision.amount).noExponents(),dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents());
                const json = JSON.stringify({
                    "dcalevel":dcalevel,
                    "dcatp":dcatp,
                    "dcalimit":dcalimit,
                    "openprice":openprice
                });
                fs.writeFile('status_multi.json', json, 'utf8',()=>{});
                console.log("Filled dca limit order.Placed next dca order ",dcalevel-1);
            }else{
                if(dcalevel>maxdcalevel){
                    console.log("Level=",dcalevel-1,",current price=", price,",take profit=",dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents());

                }else{
                    console.log("Level=",dcalevel-1,",current price=", price,",take profit=",dcatp[dcalevel-1].toFixedNumber(precision.price).noExponents(),",next dca level",dcalimit[dcalevel-1][1].toFixedNumber(precision.price).noExponents());

                }
            }
        }

    }catch(e){
        console.log(e)
    }
 
 setTimeout(watchmarket,2000);
}

init();


