var cp = require('child_process');

const {
    tokenlist
} = require('./config');

for(let i=0;i<tokenlist.length;i++){
    cp.fork('./trade.js',[i]);
}
