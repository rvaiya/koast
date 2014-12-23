//var mds = require('mongodump-stream');
//var knox = require('knox');
//var q = require('q');
//
////TODO implement me
//
////Testing/debugging utils
////==================================================================================
//
//function printStream(stream) {
//    var d='';
//    stream.on('data', function(c) {
//      d+=c;
//    });
//    stream.on('end', function() {
//      console.log(d);
//    });
//}
//
//function compareStreams(str1, str2) {
//    var d1 = '', d2 = '', fin = 0;
//    var p = q.defer();
//
//    function compare() {
//        if(d1.toString() === d2.toString()) {
//            p.resolve('streams are identical');
//        } else {
//            p.reject('streams are NOT identical');
//        }
//    };
//
//    str2.on('data', function(c) {
//        d2+=c;
//    }).on('end', function() {
//        if(fin++) compare();
//    });
//
//    str1.on('data', function(c) {
//        d1+=c;
//    }).on('end', function() {
//        if(fin++) compare();
//    });
//
//    return p.promise;
//}
