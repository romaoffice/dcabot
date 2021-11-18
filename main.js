var cp = require('child_process');


let configSettings = require('./config');

var myArgs = process.argv.slice(2);
if(myArgs.length>0){
    configSettings = JSON.parse(myArgs[0]);
}
tokenlist = configSettings.tokenlist;
const js = JSON.stringify(configSettings);
//'{"marketplace":"USDT","tokenlist":[{"token":"ALGO","min":2,"max":3},{"token":"LTC","min":190,"max":210}],"apiKey":"iALoKUiAKslA8at6xlKkYTfHLrFGsB2TupQVPd1Rzn9HFdcfPOps0yM5iJurhl77","secret":"nIrwG5etQTlz2RgRhreXXl7oU7PlKT6yi3q0nrxaCst2gheidjPAcWibc5UkISMF","buyamount":20,"tp":3,"sl":10,"continueflag":1,"rsi_level":0,"rsi_interval":"5m","trstart":1.5,"trstop":0.1,"dca":[[2,100],[4,100],[6,100],[8,100],[10,100],[15,100]],"host":"localhost","user":"root","password":"","database":"trading"}'
//
//
for(let i=0;i<tokenlist.length;i++){
    cp.fork('./trade_multi.js',[JSON.stringify(configSettings),i]);
}
