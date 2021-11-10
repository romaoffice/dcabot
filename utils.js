
var RSI = require('technicalindicators').RSI;


const get_rsi = async(exchange,symbol,rsi_interval)=>{
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
const timestampToString =(timestamp)=>{
    var date = new Date(timestamp);
    // Hours part from the timestamp
    var hours = date.getHours();
    // Minutes part from the timestamp
    var minutes = "0" + date.getMinutes();
    // Seconds part from the timestamp
    var seconds = "0" + date.getSeconds();

    // Will display time in 10:30:23 format
    var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    return(formattedTime)
}
const prepare_number = ()=>{
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
    
}

module.exports ={
    get_rsi:get_rsi,
    prepare_number:prepare_number,
    timestampToString:timestampToString
}