import * as utils from './utils.js';

(async () => {
    await utils.divideCSVInChuncks('./large_websites.csv', 2);
})();