import { browserCluster, initCluster } from './clusterHandler.js';
import * as homePlus from './contexts/homePlus.js';
import { readWebsiteCSV } from './utils.js';

(async () => {

    await initCluster();

    //const csvPath = process.env.CSVFILEPATH;
    const csvPath = './large_websites.csv';
    if(csvPath == null) {
        console.log("No CSV file path provided");
        return;
    }
    let websites = await readWebsiteCSV(csvPath);

    for(let i = 0; i < websites.length; i++) {
        await homePlus.analyseDomain(websites[i].domain);
    }

    await browserCluster.idle();
    await browserCluster.close();
})();