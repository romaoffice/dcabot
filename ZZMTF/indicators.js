
var RSI = require('technicalindicators').RSI;
const Stochastic     = require('technicalindicators').Stochastic
const EMA = require('technicalindicators').EMA

const getLimit=(value,limit=50)=>{
    const maxlimit = value.length<limit ? value.length:limit;
    let stoValue =[];
    for(let i=0;i<maxlimit;i++){
        stoValue.push(value[value.length-maxlimit+i])
    }
    return(stoValue);
}
const get_sto = (price,period,signalPeriod,limit=50)=>{
    var inputSto = {
        high : price.h,
        low : price.l,
        close : price.c,
        period : period,
        signalPeriod : signalPeriod
    };
    const value = Stochastic.calculate(inputSto)
    let stoValue =getLimit(value,limit);
    return(stoValue);
}
const get_ema = (price,period,limit=50)=>{
    var inputEma = {
        values : price.c,
        period : period
    };
    const value = EMA.calculate(inputEma)
    let emaValue =getLimit(value,limit);
    return(emaValue);
}
const get_rsi = (values,rsi_period,limit =50 )=>{
    var inputRSI = {
        values : values.c,
        period : rsi_period
    };
    const value = RSI.calculate(inputRSI)
    let rsiValue =getLimit(value,limit);
    return(rsiValue);
}

//download price
const preparePrice = async(symbol,period,exchange,limit)=>{

    let values = {t:[],o:[],h:[],l:[],c:[],v:[],original:[]};
    values.original = await exchange.fetchOHLCV(symbol, period);
    const from = values.original.length-limit<0?0:values.original.length-limit;
    const to = values.original.length;
    for(let i=from;i<to;i++){
        values.t.push(values.original[i][0]);
        values.o.push(values.original[i][1]);
        values.h.push(values.original[i][2]);
        values.l.push(values.original[i][3]);
        values.c.push(values.original[i][4]);
        values.v.push(values.original[i][5]);
    }
    return(values)
}
//get zigzag
const get_zigzag = (prices_current,price_upper,prd,backlimit=500)=>{
  
  let zigzag = [];
  const zigzaglimit = 10;
  const lenprice = prices_current.t.length;
  const back = lenprice>backlimit ? backlimit:lenprice;
  let lastupperindex = price_upper.t.length-1;
  //assign HTF
  prices_current.backbars =[];
  for(let i=0;i<back;i++){
    if(prices_current.t[lenprice-1-i]<price_upper.t[lastupperindex]){
        lastupperindex--;
    }
    const getbacklen =(prices_current_index,htf_time)=>{
        let len = 0;
        for(let i=prices_current_index;i>=0;i--){
            if (prices_current.t[i]<htf_time){
                break;
            }else{
                len++;
            }
        }
        return(len);
    }
    prices_current.backbars[lenprice-1-i] = getbacklen(lenprice-1-i,price_upper.t[lastupperindex-prd+1]) 
  }
  let dir = 0
  for(let i=back-1;i>=0;i--){

    let dirchanged = false
    const bar_index = lenprice-i;
    
    let isHighestBar =prices_current.h[bar_index];
    for(let j=bar_index-1;j>bar_index-1-prices_current.backbars[bar_index];j--){
        if(prices_current.h[j]>isHighestBar){
            isHighestBar = undefined;break;
        }
    }

    let isLowestBar =prices_current.l[bar_index];
    for(let j=bar_index-1;j>bar_index-1-prices_current.backbars[bar_index];j--){
        if(prices_current.l[j]<isLowestBar){
            isLowestBar = undefined;break;
        }
    }
    if(isHighestBar && isLowestBar==undefined) {
        dirchanged = dir!=1;
        dir =1;
    }
    if(isLowestBar && isHighestBar==undefined) {
        dirchanged = dir!=-1;
        dir =-1;
    }
    const add_to_zigzag = (price,index)=>{
        zigzag.unshift(index)
        zigzag.unshift(price)
        if(zigzag.length>zigzaglimit) zigzag.pop()
    }
    const update_to_zigzag=(price,index)=>{
        if(zigzag.length==0){
            add_to_zigzag(price,index);
        }else{
            if((dir==1 && price>zigzag[0]) || (dir==-1 && price<zigzag[0])){
                zigzag[0] = price
                zigzag[1] = index
            }
        }
    }
    if(isHighestBar || isLowestBar){
        if(dirchanged){
            add_to_zigzag(dir==1?isHighestBar:isLowestBar,bar_index)
        }else{
            update_to_zigzag(dir==1?isHighestBar:isLowestBar,bar_index)
        }
    }
  }
  return(zigzag);
}
//get fobo level
const get_fibo = (prices_current,price_upper,prd,backlimit=500)=>{
    const zigzag = get_zigzag(prices_current,price_upper,prd,backlimit);
    let fibratios = [0,0.236,0.382,0.5,0.618,0.786,1];
    const fibratios_ext = [0.272,0.414,0.618];
    const multiple = 10;
    for(let i=0;i<multiple;i++){
        for(let j=0;j<fibratios_ext.length;j++){
            fibratios.push(fibratios_ext[j]+i+1)
        }
        fibratios.push(i+2)
    }
    if(zigzag.length<6) return undefined;
    let fibLebel=[];
    diff = zigzag[4] - zigzag[2];
    for(let i=0;i<fibratios.length;i++){
        fibLebel.push({level:fibratios[i],value:zigzag[2]+diff*fibratios[i]})
    }
    return(fibLebel);
}
const getReversed = (values,index)=>{
    const id = values.length-1-index;
    return(values[id])
}
const get_signal=(prices_current,price_upper,options,backLimit=500)=>{
    
    const stoValue = get_sto(prices_current,options.stoPeriod,options.stoSignalPeriod,backLimit);
    const rsiValue = get_rsi(prices_current,options.rsiPeriod,backLimit);
    const emaValue = get_ema(prices_current,options.emaPeriod,backLimit);

    if(stoValue.length<100) return(undefined);

    const overBought = getReversed(stoValue,1).k >options.stoLevel.overBought && getReversed(rsiValue,1)>options.rsiLevel.overBought;
    const overSold = getReversed(stoValue,1).k <options.stoLevel.overSold && getReversed(rsiValue,1)<options.rsiLevel.overSold;
    // const overBoughtPrev = getReversed(stoValue,2).k >options.stoLevel.overBought && getReversed(rsiValue,2)>options.rsiLevel.overBought;
    // const overSoldPrev = getReversed(stoValue,2).k <options.stoLevel.overSold && getReversed(rsiValue,2)<options.rsiLevel.overSold;
    // const buySignal = overSoldPrev==false && overSold && getReversed(prices_current.c,1)>getReversed(emaValue,1);
    // const sellSignal = overBoughtPrev==false && overBought && getReversed(prices_current.c,1)<getReversed(emaValue,1);
    const buySignal =  overSold && getReversed(prices_current.c,1)>getReversed(emaValue,1);
    const sellSignal = overBought && getReversed(prices_current.c,1)<getReversed(emaValue,1);
    const signal = buySignal?1:sellSignal?-1:0;
    const closeSignal = overBought?1:overSold?-1:0;
    const fibLevel = get_fibo(prices_current,price_upper,options.fiboPeriod,backLimit);
    if(fibLevel==undefined) return(undefined);
    const closestLevelIndex = (()=>{
        let levelIndex = 0;
        for(let i=1;i<fibLevel.length;i++){
            if(Math.abs(fibLevel[i].value -getReversed(prices_current.c,1))<Math.abs(fibLevel[levelIndex].value -getReversed(prices_current.c,1))){
                levelIndex = i;
            }
        }
        return(levelIndex);
    })()
    return({
        signal:signal,
        closeSignal:closeSignal,
        fibLevel:fibLevel,
        closestLevelIndex:closestLevelIndex,
        sto : getReversed(stoValue,1).k,
        rsi : getReversed(rsiValue,1),
        ema:getReversed(emaValue,1),
        timestamp:getReversed(prices_current.t,1)
    })
}
module.exports ={
    preparePrice:preparePrice,
    get_rsi:get_rsi,
    get_fibo:get_fibo,
    get_sto:get_sto,
    get_signal:get_signal
}
