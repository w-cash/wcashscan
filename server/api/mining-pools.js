// Compatibility path for upstream route imports. The W.cash deployment uses
// the shared attribution module and never carries the inherited Zcash address
// list.
module.exports = require('../lib/wcash-mining-attribution');
