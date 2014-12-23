//var R = require('ramda');
//var fs = require('fs');
//var mds = require('mongodump-stream');
//var util = require('../../util/util');
//var q = require('q');
//var MongoUri = require('mongo-uri');
//var sprawn = require('sprawn');
//
////TODO implement me (broken)
//
////Mock get handler
////=================================================================================
//
//function getHandler() {
//  return {
//    restore: function(receipt) {
//      return q(fs.createReadStream(receipt.fname));
//    },
//
//    store: function(stream) {
//      var p = q.defer();
//      var fname = 'backup' + new Date().getTime() + '.bson';
//      var receipt = { fname: fname };
//
//      var fstream = fs.createWriteStream(receipt.fname)
//        .on('finish', function() {
//          p.resolve(receipt);
//        });
//      stream.pipe(fstream);
//
//      return p.promise;
//    }
//  };
//}
//
//
////Harness 
////=================================================================================
//
//var handler = getHandler();
//
//var stream1 = mds.slurp.binary('mongodb://localhost/testing', 'col1');
//var stream2 = mds.slurp.binary('mongodb://localhost/testing', 'col2');
//
//handler.store(stream2)
//    .then(function(receipt) {
//        restoreBackup({
//            receipts: [ {
//                collection: 'col1',
//                data: receipt
//            } ],
//            type: 's3'
//        }, 'mongodb://localhost:27017/testing');
//    });
//
////describe('restoreBackup', function() {
////    it('should ensure that the stream stored is identical to the stream returned', function() {
////        return handler.store(stream2)
////          .then(function(receipt) {
////            console.log(receipt);
////            handler.restore(receipt).then(function(str) {
////                compareStreams(
////                    mds.slurp.binary('mongodb://localhost/testing', 'col2'),
////                    str
////                ).then(console.log, console.error);
////            });
////          });
////        });
////});
//
