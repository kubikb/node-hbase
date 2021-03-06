// Generated by CoffeeScript 2.0.1
// # Scanner operations

// Scanner are the most efficient way to retrieve multiple 
// rows and columns from HBase.

// ## Dependencies
var Readable, Scanner, Table, util, utils;

util = require('util');

utils = require('./utils');

Table = require('./table');

({Readable} = require('stream'));

// ## Grab an instance of "Scanner"

// ```javascript
// var myScanner = hbase({}).table('my_table').scan(...);
// ```

// Or

// ```javascript
// var client = new hbase.Client({});
// var myScanner = new hbase.Scanner(client, {table: 'my_table'});
// ```

// ## Options

// All options except the "table" option are optional. The following properties are
// available:

// *   `startRow`
//     First row returned by the scanner.   
// *   `endRow`
//     Row stopping the scanner, not returned by the scanner.   
// *   `columns`
//     Filter the scanner by columns (a string or an array of columns).   
// *   `batch`
//     Number of cells returned on each iteration, internal use, default to "1000".   
// *   `maxVersions`
//     Number of returned version for each row.   
// *   `startTime`
//     Row minimal timestamp (included).   
// *   `endTime`
//     Row maximal timestamp (excluded).   
// *   `filter`
//     See below for more information.   
// *   `encoding`
//     Default to client.options.encoding, set to null to overwrite default
//     encoding and return a buffer.   

// ## Using filter

// Filter are defined during the scanner creation. If you
// are familiar with HBase filters, it will be real easy to
// use them. Note, you should not worry about encoding the
// values, the library will do it for you. When you create
// a new scanner, just associate the `filter` property with  
// your filter object. All filters are supported.   

// Many examples are available in the tests but here's one
// wich returns all rows starting by "my_key_" and whose
// value is "here you are".   

// ```javascript
// client.table('my_tb').scan({
//   filter: {
//   "op":"MUST_PASS_ALL","type":"FilterList","filters":[{
//       "op":"EQUAL",
//       "type":"RowFilter",
//       "comparator":{"value":"my_key_.+","type":"RegexStringComparator"}
//     },{
//       "op":"EQUAL",
//       "type":"ValueFilter",
//       "comparator":{"value":"here you are","type":"BinaryComparator"}
//     }
//   ]}
// }, function(error, cells){
//   assert.ifError(error);
// });
// ```
Scanner = function(client, options = {}) {
  this.options = options;
  this.options.objectMode = true;
  Readable.call(this, this.options);
  this.client = client;
  if (typeof this.options === 'string') {
    // @table = if typeof table is 'string' then table else table.name
    // @id = id or null
    this.options = {
      table: this.options
    };
  }
  if (!this.options.table) {
    throw Error('Missing required option "table"');
  }
  this.options.id = null;
  return this.callback = null;
};

util.inherits(Scanner, Readable);

// ## `Scanner.init(callback)`

// Create a new scanner and return its ID.
Scanner.prototype.init = function(callback) {
  var encode, encoding, key, params;
  // options = utils.merge {}, @options
  params = {};
  if (params.batch == null) {
    params.batch = 1000;
  }
  key = `/${this.options.table}/scanner`;
  encoding = this.options.encoding === 'undefined' ? this.options.encoding : this.client.options.encoding;
  if (this.options.startRow) {
    params.startRow = utils.base64.encode(this.options.startRow, encoding);
  }
  if (this.options.endRow) {
    params.endRow = utils.base64.encode(this.options.endRow, encoding);
  }
  if (this.options.startTime) {
    params.startTime = this.options.startTime;
  }
  if (this.options.endTime) {
    params.endTime = this.options.endTime;
  }
  if (this.options.maxVersions) {
    params.maxVersions = this.options.maxVersions;
  }
  if (this.options.column) {
    params.column = [];
    if (typeof this.options.column === 'string') {
      this.options.column = [this.options.column];
    }
    this.options.column.forEach(function(column, i) {
      return params.column[i] = utils.base64.encode(column, encoding);
    });
  }
  if (this.options.filter) {
    encode = function(obj) {
      var k, results;
      results = [];
      for (k in obj) {
        if (k === 'value' && (!obj['type'] || obj['type'] !== 'RegexStringComparator' && obj['type'] !== 'PageFilter')) {
          results.push(obj[k] = utils.base64.encode(obj[k], encoding));
        } else {
          if (typeof obj[k] === 'object') {
            results.push(encode(obj[k]));
          } else {
            results.push(void 0);
          }
        }
      }
      return results;
    };
    encode(this.options.filter);
    params.filter = JSON.stringify(this.options.filter);
  }
  return this.client.connection.put(key, params, (err, data, response) => {
    var id;
    if (err) {
      return callback(err);
    }
    id = /scanner\/(\w+)$/.exec(response.headers.location)[1];
    this.options.id = id;
    return callback(null, id);
  });
};

// ## `Scanner.get(callback)`

// Retrieve the next cells from HBase. The callback is required
// and receive two arguments, an error object if any and a array
// of cells or null if the scanner is exhausted.
// ```
Scanner.prototype.get = function(callback) {
  var key;
  key = `/${this.table}/scanner/${this.options.id}`;
  return this.client.connection.get(key, (err, data, response) => {
    var cells;
    if (response && response.statusCode === 204) {
      // result is successful but the scanner is exhausted, returns HTTP 204 status (no content)
      return callback();
    }
    if (err) {
      return callback(err);
    }
    cells = [];
    data.Row.forEach((row) => {
      key = utils.base64.decode(row.key, this.client.options.encoding);
      return row.Cell.forEach((cell) => {
        data = {};
        data.key = key;
        data.column = utils.base64.decode(cell.column, this.client.options.encoding);
        data.timestamp = cell.timestamp;
        data.$ = utils.base64.decode(cell.$, this.client.options.encoding);
        return cells.push(data);
      });
    });
    return callback(null, cells);
  });
};

// ## `Scanner.delete(callback)`

// Delete a scanner.

// ```javascript
// myScanner.delete(callback);
// ```

// Callback is optionnal and receive two arguments, an 
// error object if any and a boolean indicating whether 
// the scanner was removed or not.
Scanner.prototype.delete = function(callback) {
  return this.client.connection.delete(`/${this.table}/scanner/${this.options.id}`, callback);
};

// ## Scanner._read(size)

// Implementation of the `stream.Readable` API.
Scanner.prototype._read = function(size) {
  if (this.done) {
    return;
  }
  if (!this.options.id) {
    return this.init((err, id) => {
      if (err) {
        return this.emit('error', err);
      }
      return this._read();
    });
  }
  return this.get((err, cells) => {
    var cell, j, len, results;
    if (this.done) {
      return;
    }
    if (err) {
      return this.emit('error', err);
    }
    if (!cells) {
      this.done = true;
      return this.delete((err) => {
        if (err) {
          return this.emit('error', err);
        }
        return this.push(null);
      });
    }
    results = [];
    for (j = 0, len = cells.length; j < len; j++) {
      cell = cells[j];
      results.push(this.push(cell));
    }
    return results;
  });
};

module.exports = Scanner;
