const ccxt = require("ccxt");
const _ = require('lodash');
var term = require( 'terminal-kit' ).terminal ;
var Mutex = require('async-mutex').Mutex;
const mutex = new Mutex();
var {preparePrice,get_signal, get_fibo,get_sto,get_rsi} = require('./indicators');


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
} = require('../config');

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
    options: { 
        adjustForTimeDifference: true, 
        recvWindow: 60000,
        warnOnFetchOpenOrdersWithoutSymbol: false,
        createMarketBuyOrderRequiresPrice: false },
});

const main = async()=>{
    const options = {
        interval:"1m",
        htfIntrerval:"4h",
        stoPeriod:14,
        stoSignalPeriod:4,
        rsiPeriod:14,
        emaPeriod:200,
        stoLevel:{overBought:70,overSold:30},
        rsiLevel:{overBought:70,overSold:30},
        fiboPeriod:2
    }
    const h4price = await preparePrice("CAKE/USDT",options.interval,exchange,500)
    const d1price = await preparePrice("CAKE/USDT",options.htfIntrerval,exchange,500)
    const signal = get_signal(h4price,d1price,options);

    console.log(signal);
    setTimeout(main,10000);
}
setTimeout(main,10000);